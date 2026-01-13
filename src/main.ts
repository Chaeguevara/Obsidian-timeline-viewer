import { Plugin, Modal, Setting } from 'obsidian';
import { TimelineViewerSettings, DEFAULT_SETTINGS, TimelineViewerSettingTab } from './settings';
import { TimelineView, TIMELINE_VIEW_TYPE } from './views/TimelineView';
import { WBSView, WBS_VIEW_TYPE } from './views/WBSView';
import { BoardView, BOARD_VIEW_TYPE } from './views/BoardView';
import { ListView, LIST_VIEW_TYPE } from './views/ListView';
import { MyTasksView, MY_TASKS_VIEW_TYPE } from './views/MyTasksView';
import { DataService } from './services/DataService';
import type { EntityType } from './models/types';

export default class TimelineViewerPlugin extends Plugin {
  settings: TimelineViewerSettings;
  dataService: DataService;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Initialize data service
    this.dataService = new DataService(this.app, this.settings);
    await this.dataService.initialize();

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
      BOARD_VIEW_TYPE,
      (leaf) => new BoardView(leaf, this)
    );

    this.registerView(
      LIST_VIEW_TYPE,
      (leaf) => new ListView(leaf, this)
    );

    this.registerView(
      MY_TASKS_VIEW_TYPE,
      (leaf) => new MyTasksView(leaf, this)
    );

    // Add ribbon icons
    this.addRibbonIcon('gantt-chart', 'Open Timeline View', () => {
      this.activateView(TIMELINE_VIEW_TYPE);
    });

    this.addRibbonIcon('list-tree', 'Open WBS View', () => {
      this.activateView(WBS_VIEW_TYPE);
    });

    this.addRibbonIcon('layout-dashboard', 'Open Board View', () => {
      this.activateView(BOARD_VIEW_TYPE);
    });

    this.addRibbonIcon('list', 'Open List View', () => {
      this.activateView(LIST_VIEW_TYPE);
    });

    this.addRibbonIcon('check-square', 'Open My Tasks', () => {
      this.activateView(MY_TASKS_VIEW_TYPE);
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
      id: 'open-board-view',
      name: 'Open Board View',
      callback: () => this.activateView(BOARD_VIEW_TYPE),
    });

    this.addCommand({
      id: 'open-list-view',
      name: 'Open List View',
      callback: () => this.activateView(LIST_VIEW_TYPE),
    });

    this.addCommand({
      id: 'open-my-tasks',
      name: 'Open My Tasks',
      callback: () => this.activateView(MY_TASKS_VIEW_TYPE),
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
      this.app.vault.on('modify', () => {
        this.dataService.refreshCache();
      })
    );

    this.registerEvent(
      this.app.vault.on('create', () => {
        this.dataService.refreshCache();
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', () => {
        this.dataService.refreshCache();
      })
    );
  }

  onunload(): void {
    // Clean up views
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(WBS_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(BOARD_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(LIST_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(MY_TASKS_VIEW_TYPE);
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

  refreshViews(): void {
    // Refresh timeline view
    const timelineLeaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    timelineLeaves.forEach(leaf => {
      const view = leaf.view as TimelineView;
      view.render();
    });

    // Refresh WBS view
    const wbsLeaves = this.app.workspace.getLeavesOfType(WBS_VIEW_TYPE);
    wbsLeaves.forEach(leaf => {
      const view = leaf.view as WBSView;
      view.render();
    });

    // Refresh Board view
    const boardLeaves = this.app.workspace.getLeavesOfType(BOARD_VIEW_TYPE);
    boardLeaves.forEach(leaf => {
      const view = leaf.view as BoardView;
      view.render();
    });

    // Refresh List view
    const listLeaves = this.app.workspace.getLeavesOfType(LIST_VIEW_TYPE);
    listLeaves.forEach(leaf => {
      const view = leaf.view as ListView;
      view.render();
    });

    // Refresh My Tasks view
    const myTasksLeaves = this.app.workspace.getLeavesOfType(MY_TASKS_VIEW_TYPE);
    myTasksLeaves.forEach(leaf => {
      const view = leaf.view as MyTasksView;
      view.render();
    });
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

  /**
   * Edit an entity (opens file in edit mode)
   */
  async editEntity(id: string): Promise<void> {
    await this.openEntity(id);
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
        .onClick(() => this.create()));
  }

  async create(): Promise<void> {
    if (!this.title.trim()) {
      return;
    }

    await this.plugin.dataService.createEntity(this.type, this.title.trim(), this.parentId);
    this.plugin.refreshViews();
    this.close();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
