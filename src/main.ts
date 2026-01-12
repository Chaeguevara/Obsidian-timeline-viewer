import { Plugin, Modal, Setting } from 'obsidian';
import { TimelineViewerSettings, DEFAULT_SETTINGS, TimelineViewerSettingTab } from './settings';
import { TimelineView, TIMELINE_VIEW_TYPE } from './views/TimelineView';
import { WBSView, WBS_VIEW_TYPE } from './views/WBSView';
import { DependencyGraphView, DEPENDENCY_GRAPH_VIEW_TYPE } from './views/DependencyGraphView';
import { DataService } from './services/DataService';
import type { EntityType } from './models/types';
import { Logger } from './utils/Logger';

export default class TimelineViewerPlugin extends Plugin {
  settings: TimelineViewerSettings;
  dataService: DataService;

  async onload(): Promise<void> {
    Logger.info('TimelineViewerPlugin.onload() - START');
    await this.loadSettings();

    // Initialize data service
    Logger.info('Initializing DataService...');
    this.dataService = new DataService(this.app, this.settings);

    // Wait for layout to be ready before initializing data
    // This ensures the metadata cache is populated
    this.app.workspace.onLayoutReady(async () => {
      Logger.info('Layout ready - initializing data...');
      await this.dataService.initialize();
      Logger.success('DataService initialized after layout ready');

      // Also listen for metadata cache resolution for late-loading files
      this.registerEvent(
        this.app.metadataCache.on('resolved', async () => {
          Logger.debug('Metadata cache resolved - refreshing cache');
          await this.dataService.refreshCache();
        })
      );
    });

    // Initial quick init (may be incomplete if metadata not ready)
    await this.dataService.initialize();
    Logger.success('DataService initial load complete');

    // Register views
    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new TimelineView(leaf, this)
    );

    this.registerView(
      WBS_VIEW_TYPE,
      (leaf) => new WBSView(leaf, this)
    );

    this.registerView(
      DEPENDENCY_GRAPH_VIEW_TYPE,
      (leaf) => new DependencyGraphView(leaf, this)
    );

    // Add ribbon icons
    this.addRibbonIcon('gantt-chart', 'Open Timeline View', () => {
      this.activateView(TIMELINE_VIEW_TYPE);
    });

    this.addRibbonIcon('list-tree', 'Open WBS View', () => {
      this.activateView(WBS_VIEW_TYPE);
    });

    this.addRibbonIcon('git-branch', 'Open Dependency Graph', () => {
      this.activateView(DEPENDENCY_GRAPH_VIEW_TYPE);
    });

    // Add commands
    this.addCommand({
      id: 'open-timeline-view',
      name: 'Open Timeline View',
      callback: () => this.activateView(TIMELINE_VIEW_TYPE),
    });

    this.addCommand({
      id: 'open-wbs-view',
      name: 'Open WBS View',
      callback: () => this.activateView(WBS_VIEW_TYPE),
    });

    this.addCommand({
      id: 'open-dependency-graph',
      name: 'Open Dependency Graph',
      callback: () => this.activateView(DEPENDENCY_GRAPH_VIEW_TYPE),
    });

    this.addCommand({
      id: 'create-goal',
      name: 'Create New Goal',
      callback: () => this.createNewEntity('goal'),
    });

    this.addCommand({
      id: 'create-portfolio',
      name: 'Create New Portfolio',
      callback: () => this.createNewEntity('portfolio'),
    });

    this.addCommand({
      id: 'create-project',
      name: 'Create New Project',
      callback: () => this.createNewEntity('project'),
    });

    this.addCommand({
      id: 'create-task',
      name: 'Create New Task',
      callback: () => this.createNewEntity('task'),
    });

    this.addCommand({
      id: 'refresh-data',
      name: 'Refresh Data',
      callback: async () => {
        await this.dataService.refreshCache();
        this.refreshViews();
      },
    });

    // Add settings tab
    this.addSettingTab(new TimelineViewerSettingTab(this.app, this));

    // Register file events for auto-refresh
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        Logger.debug(`File modified: ${file.path}`);
        this.dataService.refreshCache();
      })
    );

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        Logger.debug(`File created: ${file.path}`);
        this.dataService.refreshCache();
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        Logger.debug(`File deleted: ${file.path}`);
        this.dataService.refreshCache();
      })
    );

    Logger.success('TimelineViewerPlugin.onload() - END');
  }

  onunload(): void {
    // Clean up views
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(WBS_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.dataService.updateSettings(this.settings);
  }

  async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(viewType)[0];

    if (!leaf) {
      const newLeaf = workspace.getRightLeaf(false);
      if (newLeaf) {
        leaf = newLeaf;
        await leaf.setViewState({ type: viewType, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async refreshViews(): Promise<void> {
    Logger.info('refreshViews() - START');
    // Refresh timeline view
    const timelineLeaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    Logger.debug(`refreshViews() - Found ${timelineLeaves.length} timeline views`);
    for (const leaf of timelineLeaves) {
      const view = leaf.view;
      if (view instanceof TimelineView) {
        Logger.debug('refreshViews() - Rendering timeline view...');
        await view.render();
      }
    }

    // Refresh WBS view
    const wbsLeaves = this.app.workspace.getLeavesOfType(WBS_VIEW_TYPE);
    Logger.debug(`refreshViews() - Found ${wbsLeaves.length} WBS views`);
    for (const leaf of wbsLeaves) {
      const view = leaf.view;
      if (view instanceof WBSView) {
        Logger.debug('refreshViews() - Rendering WBS view...');
        await view.render();
      }
    }
    Logger.success('refreshViews() - END');
  }

  /**
   * Create a new entity with a modal dialog
   */
  createNewEntity(type: EntityType, parentId?: string): void {
    new CreateEntityModal(this.app, this, type, parentId).open();
  }

  /**
   * Open an entity file
   */
  async openEntity(id: string): Promise<void> {
    const entity = this.dataService.getEntity(id);
    if (!entity?.filePath) return;

    const file = this.app.vault.getAbstractFileByPath(entity.filePath);
    if (file) {
      await this.app.workspace.getLeaf().openFile(file as import('obsidian').TFile);
    }
  }
}

/**
 * Modal for creating new entities
 */
class CreateEntityModal extends Modal {
  private plugin: TimelineViewerPlugin;
  private type: EntityType;
  private parentId?: string;
  private title: string = '';

  constructor(app: import('obsidian').App, plugin: TimelineViewerPlugin, type: EntityType, parentId?: string) {
    super(app);
    this.plugin = plugin;
    this.type = type;
    this.parentId = parentId;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    const typeLabel = this.type.charAt(0).toUpperCase() + this.type.slice(1);
    contentEl.createEl('h2', { text: `Create New ${typeLabel}` });

    // Show helpful context
    const description = this.getDescriptionForType(this.type);
    if (description) {
      const descEl = contentEl.createDiv({ cls: 'timeline-modal-desc' });
      descEl.createEl('p', { text: description });
    }

    // Show parent context if exists
    if (this.parentId) {
      const parent = this.plugin.dataService.getEntity(this.parentId);
      if (parent) {
        const parentInfo = contentEl.createDiv({ cls: 'timeline-modal-parent' });
        parentInfo.createEl('small', { text: `Part of: ${parent.title}` });
      }
    }

    new Setting(contentEl)
      .setName('Title')
      .setDesc(`Name for the new ${this.type}`)
      .addText(text => {
        text
          .setPlaceholder(`Enter ${this.type} title`)
          .onChange(value => {
            this.title = value;
          });
        text.inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            this.create();
          }
        });
        text.inputEl.focus();
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Create')
        .setCta()
        .onClick(() => this.create()))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()));
  }

  private getDescriptionForType(type: EntityType): string {
    switch (type) {
      case 'goal':
        return 'A high-level objective you want to achieve. Goals contain portfolios.';
      case 'portfolio':
        return 'A collection of related projects working towards a goal. Portfolios contain projects.';
      case 'project':
        return 'A defined piece of work with start and end dates. Projects contain tasks.';
      case 'task':
        return 'An atomic unit of work that needs to be completed.';
      default:
        return '';
    }
  }

  async create(): Promise<void> {
    if (!this.title.trim()) {
      Logger.warn('CreateEntityModal.create() - Empty title, aborting');
      return;
    }

    Logger.info(`CreateEntityModal.create() - Creating ${this.type}: "${this.title.trim()}"`);
    try {
      const entity = await this.plugin.dataService.createEntity(this.type, this.title.trim(), this.parentId);
      Logger.success(`CreateEntityModal.create() - Entity created: ${entity?.id || 'unknown'}`);
      Logger.info('CreateEntityModal.create() - Refreshing views...');
      await this.plugin.refreshViews();
      Logger.success('CreateEntityModal.create() - Views refreshed');
      this.close();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create entity';
      Logger.error(`CreateEntityModal.create() - Failed: ${errorMsg}`, error);
      const { contentEl } = this;

      // Show error message
      const existingError = contentEl.querySelector('.timeline-error');
      if (existingError) {
        existingError.remove();
      }

      const errorEl = contentEl.createDiv({ cls: 'timeline-error' });
      errorEl.createEl('p', { text: errorMsg, cls: 'mod-warning' });
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
