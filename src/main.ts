/**
 * @fileoverview Main plugin entry point for Timeline Viewer
 *
 * This file orchestrates the entire plugin lifecycle, including:
 * - Initializing the DataService for entity management
 * - Registering 6 different views (Timeline, WBS, Dependency Graph, Board, List, My Tasks)
 * - Setting up commands and ribbon icons for user interaction
 * - Managing auto-refresh on file changes
 * - Providing entity creation dialogs
 *
 * @module main
 * @see {@link DataService} for data management
 * @see {@link TimelineViewerSettings} for configuration
 *
 * @example
 * // Views are registered and can be opened via:
 * // - Ribbon icons (left sidebar)
 * // - Command palette (Ctrl/Cmd+P)
 * // - Programmatically via activateView()
 */

import { Plugin, Modal, Setting } from 'obsidian';
import { TimelineViewerSettings, DEFAULT_SETTINGS, TimelineViewerSettingTab } from './settings';
import { TimelineView, TIMELINE_VIEW_TYPE } from './views/TimelineView';
import { WBSView, WBS_VIEW_TYPE } from './views/WBSView';
import { DependencyGraphView, DEPENDENCY_GRAPH_VIEW_TYPE } from './views/DependencyGraphView';
import { BoardView, BOARD_VIEW_TYPE } from './views/BoardView';
import { ListView, LIST_VIEW_TYPE } from './views/ListView';
import { MyTasksView, MY_TASKS_VIEW_TYPE } from './views/MyTasksView';
import { DataService } from './services/DataService';
import type { EntityType } from './models/types';
import { Logger } from './utils/Logger';

/**
 * Main plugin class for Timeline Viewer
 *
 * Extends Obsidian's Plugin class to provide project management capabilities
 * with timeline visualization, WBS hierarchy, and task tracking.
 *
 * **Architecture Overview:**
 * ```
 * TimelineViewerPlugin (this class)
 *   ├── DataService (entity CRUD, caching, queries)
 *   ├── Settings (user preferences, folder structure)
 *   └── Views (6 different visualizations)
 *       ├── TimelineView (Gantt chart)
 *       ├── WBSView (hierarchical tree)
 *       ├── DependencyGraphView (force-directed graph)
 *       ├── BoardView (Kanban board)
 *       ├── ListView (sortable table)
 *       └── MyTasksView (personal task list)
 * ```
 *
 * @extends Plugin
 */
export default class TimelineViewerPlugin extends Plugin {
  /** Plugin settings (folder structure, date format, mobile optimizations, etc.) */
  settings: TimelineViewerSettings;

  /** Core data service for entity management and caching */
  dataService: DataService;

  /**
   * Plugin initialization - called when plugin is loaded
   *
   * This method orchestrates the entire plugin setup in the following order:
   * 1. Load user settings from data.json
   * 2. Initialize DataService (scans vault for entities)
   * 3. Register all 6 views (Timeline, WBS, Dependency Graph, Board, List, My Tasks)
   * 4. Add ribbon icons and commands for user interaction
   * 5. Set up file watchers for auto-refresh
   *
   * **Important Notes:**
   * - DataService initialization happens twice: once immediately (may be incomplete)
   *   and once after layout ready (when metadata cache is fully populated)
   * - All views share the same DataService instance for data consistency
   * - File events (create, modify, delete) trigger automatic cache refresh
   *
   * @returns Promise that resolves when plugin is fully loaded
   *
   * @example
   * // This method is called automatically by Obsidian
   * // No need to call it manually
   */
  async onload(): Promise<void> {
    Logger.info('TimelineViewerPlugin.onload() - START');
    await this.loadSettings();

    // ========================================
    // STEP 1: Initialize DataService
    // ========================================
    Logger.info('Initializing DataService...');
    this.dataService = new DataService(this.app, this.settings);

    // Wait for layout to be ready before initializing data
    // This ensures the metadata cache is populated with all file frontmatter
    // Without this, we might miss entity relationships (parent links, dependencies)
    this.app.workspace.onLayoutReady(async () => {
      Logger.info('Layout ready - initializing data...');
      await this.dataService.initialize();
      Logger.success('DataService initialized after layout ready');

      // Listen for metadata cache resolution for late-loading files
      // This handles cases where files are added/modified after initial load
      this.registerEvent(
        this.app.metadataCache.on('resolved', async () => {
          Logger.debug('Metadata cache resolved - refreshing cache');
          await this.dataService.refreshCache();
        })
      );
    });

    // Initial quick init (may be incomplete if metadata not ready)
    // This allows views to show partial data while waiting for full metadata
    await this.dataService.initialize();
    Logger.success('DataService initial load complete');

    // ========================================
    // STEP 2: Register all views
    // ========================================
    // Each view receives a reference to this plugin, allowing access to:
    // - this.dataService (for entity queries)
    // - this.settings (for user preferences)
    // - this.app (for Obsidian API access)
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

    // ========================================
    // STEP 3: Add ribbon icons (left sidebar)
    // ========================================
    // These icons provide quick access to views from the left sidebar
    // Icon names are from Lucide icon set: https://lucide.dev/
    this.addRibbonIcon('gantt-chart', 'Open Timeline View', () => {
      this.activateView(TIMELINE_VIEW_TYPE);
    });

    this.addRibbonIcon('list-tree', 'Open WBS View', () => {
      this.activateView(WBS_VIEW_TYPE);
    });

    this.addRibbonIcon('git-branch', 'Open Dependency Graph', () => {
      this.activateView(DEPENDENCY_GRAPH_VIEW_TYPE);
    });

    this.addRibbonIcon('kanban', 'Open Board View', () => {
      this.activateView(BOARD_VIEW_TYPE);
    });

    this.addRibbonIcon('table', 'Open List View', () => {
      this.activateView(LIST_VIEW_TYPE);
    });

    this.addRibbonIcon('check-square', 'Open My Tasks', () => {
      this.activateView(MY_TASKS_VIEW_TYPE);
    });

    // ========================================
    // STEP 4: Register commands (Command Palette)
    // ========================================
    // These commands appear in Command Palette (Ctrl/Cmd+P)
    // Organized in 3 groups:
    // 1. View opening commands (6 views)
    // 2. Entity creation commands (4 entity types)
    // 3. Utility commands (refresh data)
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

    // ========================================
    // STEP 5: Register settings tab
    // ========================================
    // Appears in Settings → Plugin Options → Timeline Viewer
    this.addSettingTab(new TimelineViewerSettingTab(this.app, this));

    // ========================================
    // STEP 6: Set up file event listeners for auto-refresh
    // ========================================
    // Whenever a file is created, modified, or deleted in the vault,
    // we refresh the DataService cache to keep views in sync
    // This ensures views always show up-to-date data
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

  /**
   * Plugin cleanup - called when plugin is disabled or unloaded
   *
   * Detaches all registered views to prevent memory leaks.
   * Obsidian's built-in mechanisms handle:
   * - Unregistering event listeners (vault events, metadata cache)
   * - Cleaning up commands and ribbon icons
   * - Destroying the DataService instance
   *
   * @returns void
   */
  onunload(): void {
    Logger.info('TimelineViewerPlugin.onunload() - START');

    // Clean up all view instances
    // This ensures no dangling references remain in the workspace
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(WBS_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(DEPENDENCY_GRAPH_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(BOARD_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(LIST_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(MY_TASKS_VIEW_TYPE);

    Logger.success('TimelineViewerPlugin.onunload() - END');
  }

  /**
   * Load plugin settings from data.json
   *
   * Merges saved settings with defaults to ensure all properties exist.
   * This is called during onload() before DataService initialization.
   *
   * @returns Promise that resolves when settings are loaded
   * @private
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Save plugin settings to data.json and update DataService
   *
   * Called whenever settings are changed via the settings tab.
   * Updates both:
   * 1. Persistent storage (data.json)
   * 2. DataService (to apply new folder structure, etc.)
   *
   * @returns Promise that resolves when settings are saved
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Notify DataService of settings change (may trigger folder structure update)
    this.dataService.updateSettings(this.settings);
  }

  /**
   * Activate (open/focus) a specific view type
   *
   * If the view is already open, it will be focused.
   * If not, a new view will be created in the right sidebar.
   *
   * @param viewType - The view type constant (e.g., TIMELINE_VIEW_TYPE)
   * @returns Promise that resolves when view is activated
   *
   * @example
   * // Open Timeline View
   * await this.activateView(TIMELINE_VIEW_TYPE);
   *
   * @example
   * // Open Board View from a command
   * this.activateView(BOARD_VIEW_TYPE);
   */
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

  /**
   * Refresh all currently open views to reflect updated data
   *
   * Called after:
   * - Creating/updating/deleting entities
   * - Manual refresh command
   * - Settings changes
   *
   * **Note:** Only refreshes views that are currently open in the workspace.
   * Closed views will automatically refresh when reopened.
   *
   * **TODO:** Currently only refreshes Timeline and WBS views.
   * Need to add refresh logic for other views (Board, List, My Tasks, Dependency Graph).
   *
   * @returns Promise that resolves when all views are refreshed
   */
  async refreshViews(): Promise<void> {
    Logger.info('refreshViews() - START');

    // Refresh Timeline View
    const timelineLeaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    Logger.debug(`refreshViews() - Found ${timelineLeaves.length} timeline views`);
    for (const leaf of timelineLeaves) {
      const view = leaf.view;
      if (view instanceof TimelineView) {
        Logger.debug('refreshViews() - Rendering timeline view...');
        await view.render();
      }
    }

    // Refresh WBS View
    const wbsLeaves = this.app.workspace.getLeavesOfType(WBS_VIEW_TYPE);
    Logger.debug(`refreshViews() - Found ${wbsLeaves.length} WBS views`);
    for (const leaf of wbsLeaves) {
      const view = leaf.view;
      if (view instanceof WBSView) {
        Logger.debug('refreshViews() - Rendering WBS view...');
        await view.render();
      }
    }

    // TODO: Add refresh logic for other views
    // - DependencyGraphView
    // - BoardView
    // - ListView
    // - MyTasksView

    Logger.success('refreshViews() - END');
  }

  /**
   * Create a new entity with a modal dialog
   *
   * Opens a modal that prompts the user for:
   * - Entity title (required)
   * - Parent relationship (optional, pre-filled if parentId provided)
   *
   * After creation:
   * - Creates a markdown file with frontmatter
   * - Refreshes the DataService cache
   * - Refreshes all open views
   *
   * @param type - Type of entity to create (goal, portfolio, project, task)
   * @param parentId - Optional parent entity ID (for creating child entities)
   * @returns void (modal handles async creation internally)
   *
   * @example
   * // Create a standalone goal
   * this.createNewEntity('goal');
   *
   * @example
   * // Create a project under a specific portfolio
   * this.createNewEntity('project', 'portfolio-123');
   */
  createNewEntity(type: EntityType, parentId?: string): void {
    new CreateEntityModal(this.app, this, type, parentId).open();
  }

  /**
   * Open an entity's markdown file in a new leaf
   *
   * @param id - Entity ID to open
   * @returns Promise that resolves when file is opened
   *
   * @example
   * // Open a task from a click handler
   * await this.openEntity('task-456');
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
   *
   * Currently identical to openEntity() - Obsidian opens files in edit mode by default.
   * Kept as a separate method for future enhancement (e.g., opening in source mode).
   *
   * @param id - Entity ID to edit
   * @returns Promise that resolves when file is opened for editing
   */
  async editEntity(id: string): Promise<void> {
    await this.openEntity(id);
  }
}

/**
 * Modal dialog for creating new entities (Goal, Portfolio, Project, Task)
 *
 * Provides a simple form with:
 * - Entity type label and description
 * - Parent context (if creating a child entity)
 * - Title input field (with Enter key support)
 * - Create/Cancel buttons
 *
 * **User Experience:**
 * - Auto-focuses the title input for quick entry
 * - Shows helpful descriptions for each entity type
 * - Displays error messages inline if creation fails
 * - Closes automatically on successful creation
 *
 * @extends Modal
 * @see {@link TimelineViewerPlugin.createNewEntity} for usage
 */
class CreateEntityModal extends Modal {
  /** Reference to the main plugin instance */
  private plugin: TimelineViewerPlugin;

  /** Type of entity to create */
  private type: EntityType;

  /** Optional parent entity ID (for creating child entities) */
  private parentId?: string;

  /** User-entered title for the new entity */
  private title: string = '';

  /**
   * Construct a new entity creation modal
   *
   * @param app - Obsidian app instance
   * @param plugin - Plugin instance for accessing DataService
   * @param type - Entity type to create
   * @param parentId - Optional parent entity ID
   */
  constructor(app: import('obsidian').App, plugin: TimelineViewerPlugin, type: EntityType, parentId?: string) {
    super(app);
    this.plugin = plugin;
    this.type = type;
    this.parentId = parentId;
  }

  /**
   * Render the modal content
   *
   * Creates a form with:
   * - Header showing entity type
   * - Description of the entity type
   * - Parent context (if applicable)
   * - Title input field
   * - Create and Cancel buttons
   *
   * @returns void
   */
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

  /**
   * Get user-friendly description for an entity type
   *
   * Used to provide contextual help in the creation modal.
   *
   * @param type - Entity type
   * @returns Human-readable description
   * @private
   */
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

  /**
   * Create the entity via DataService
   *
   * Validates input, creates the entity, refreshes views, and closes modal.
   * On error, displays an inline error message without closing the modal.
   *
   * **Flow:**
   * 1. Validate title (must be non-empty)
   * 2. Call DataService.createEntity() to create markdown file
   * 3. Refresh all open views to show new entity
   * 4. Close modal on success, show error on failure
   *
   * @returns Promise that resolves when creation is complete
   * @private
   */
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

      // Show error message inline (replace existing error if present)
      const existingError = contentEl.querySelector('.timeline-error');
      if (existingError) {
        existingError.remove();
      }

      const errorEl = contentEl.createDiv({ cls: 'timeline-error' });
      errorEl.createEl('p', { text: errorMsg, cls: 'mod-warning' });
    }
  }

  /**
   * Clean up modal content when closed
   *
   * @returns void
   */
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
