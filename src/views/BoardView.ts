import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { Task, Status, BoardColumn } from '../models/types';
import {
  isMobile,
  createLongPressHandler,
  hapticFeedback
} from '../utils/mobile';

export const BOARD_VIEW_TYPE = 'timeline-viewer-board';

const STATUS_COLUMNS: { status: Status; title: string; color: string }[] = [
  { status: 'not-started', title: 'To Do', color: 'var(--text-muted)' },
  { status: 'in-progress', title: 'In Progress', color: 'var(--interactive-accent)' },
  { status: 'on-hold', title: 'On Hold', color: 'var(--color-yellow)' },
  { status: 'completed', title: 'Done', color: 'var(--color-green)' }
];

export class BoardView extends ItemView {
  plugin: TimelineViewerPlugin;
  private contentEl: HTMLElement;
  private draggedTask: Task | null = null;
  private draggedElement: HTMLElement | null = null;
  private cleanupFunctions: (() => void)[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return BOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Board';
  }

  getIcon(): string {
    return 'layout-dashboard';
  }

  async onOpen(): Promise<void> {
    this.contentEl = this.containerEl.children[1] as HTMLElement;
    this.contentEl.empty();
    this.contentEl.addClass('board-viewer-container');

    await this.render();
  }

  async onClose(): Promise<void> {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    this.contentEl.empty();
  }

  async render(): Promise<void> {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    this.contentEl.empty();

    // Header
    const header = this.contentEl.createDiv({ cls: 'board-header' });
    header.createEl('h2', { text: 'Board View' });

    const controls = header.createDiv({ cls: 'board-controls' });

    const addTaskBtn = controls.createEl('button', {
      text: '+ Task',
      cls: 'board-btn mod-cta'
    });
    addTaskBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('task');
    });

    // Board container
    const boardContainer = this.contentEl.createDiv({ cls: 'board-columns' });

    // Create columns
    STATUS_COLUMNS.forEach(col => {
      this.renderColumn(boardContainer, col);
    });

    // Add FAB for mobile
    if (isMobile()) {
      this.addFloatingActionButton();
    }
  }

  private renderColumn(container: HTMLElement, columnDef: { status: Status; title: string; color: string }): void {
    const tasks = this.plugin.dataService.getTasksByStatus(columnDef.status);

    const column = container.createDiv({ cls: 'board-column' });
    column.dataset.status = columnDef.status;

    // Column header
    const columnHeader = column.createDiv({ cls: 'board-column-header' });
    columnHeader.style.borderTopColor = columnDef.color;

    const titleEl = columnHeader.createSpan({ cls: 'board-column-title' });
    titleEl.setText(columnDef.title);

    const countEl = columnHeader.createSpan({ cls: 'board-column-count' });
    countEl.setText(`${tasks.length}`);

    // Quick add button
    const quickAddBtn = columnHeader.createSpan({ cls: 'board-column-add', text: '+' });
    quickAddBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.quickAddTask(columnDef.status);
    });

    // Column body (droppable)
    const columnBody = column.createDiv({ cls: 'board-column-body' });
    this.setupDropZone(columnBody, columnDef.status);

    // Render task cards
    tasks.forEach(task => {
      this.renderTaskCard(columnBody, task);
    });

    // Empty state
    if (tasks.length === 0) {
      const emptyEl = columnBody.createDiv({ cls: 'board-column-empty' });
      emptyEl.setText('No tasks');
    }
  }

  private renderTaskCard(container: HTMLElement, task: Task): void {
    const card = container.createDiv({ cls: 'board-card' });
    card.dataset.taskId = task.id;
    card.draggable = true;

    // Priority indicator
    const priorityEl = card.createDiv({ cls: `board-card-priority board-card-priority-${task.priority}` });

    // Title
    const titleEl = card.createDiv({ cls: 'board-card-title' });
    titleEl.setText(task.title);
    titleEl.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.openEntity(task.id);
    });

    // Meta row
    const metaEl = card.createDiv({ cls: 'board-card-meta' });

    // Due date
    if (task.dueDate) {
      const dueEl = metaEl.createSpan({ cls: 'board-card-due' });
      const isOverdue = task.dueDate < new Date() && task.status !== 'completed';
      if (isOverdue) {
        dueEl.addClass('board-card-due-overdue');
      }
      dueEl.setText(`📅 ${this.formatDate(task.dueDate)}`);
    }

    // Assignee
    if (task.assignee) {
      const assigneeEl = metaEl.createSpan({ cls: 'board-card-assignee' });
      assigneeEl.setText(`👤 ${this.extractName(task.assignee)}`);
    }

    // Progress
    if (task.progress > 0 && task.progress < 100) {
      const progressEl = card.createDiv({ cls: 'board-card-progress' });
      const progressBar = progressEl.createDiv({ cls: 'board-card-progress-bar' });
      progressBar.style.width = `${task.progress}%`;
    }

    // Tags
    if (task.tags && task.tags.length > 0) {
      const tagsEl = card.createDiv({ cls: 'board-card-tags' });
      task.tags.slice(0, 3).forEach(tag => {
        tagsEl.createSpan({ cls: 'board-card-tag', text: tag });
      });
    }

    // Drag events
    this.setupDragEvents(card, task);

    // Long press for context menu on mobile
    const longPressCleanup = createLongPressHandler(card, () => {
      hapticFeedback('medium');
      this.showCardContextMenu(task, card);
    });
    this.cleanupFunctions.push(longPressCleanup);
  }

  private setupDragEvents(card: HTMLElement, task: Task): void {
    card.addEventListener('dragstart', (e) => {
      this.draggedTask = task;
      this.draggedElement = card;
      card.classList.add('board-card-dragging');
      e.dataTransfer?.setData('text/plain', task.id);
    });

    card.addEventListener('dragend', () => {
      this.draggedTask = null;
      if (this.draggedElement) {
        this.draggedElement.classList.remove('board-card-dragging');
        this.draggedElement = null;
      }
      // Remove all drag-over classes
      this.contentEl.querySelectorAll('.board-column-body').forEach(el => {
        el.classList.remove('board-column-drag-over');
      });
    });
  }

  private setupDropZone(dropZone: HTMLElement, status: Status): void {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('board-column-drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('board-column-drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('board-column-drag-over');

      if (this.draggedTask && this.draggedTask.status !== status) {
        hapticFeedback('medium');
        await this.moveTaskToStatus(this.draggedTask, status);
      }
    });

    // Touch events for mobile drag-drop
    if (isMobile()) {
      this.setupTouchDragDrop(dropZone, status);
    }
  }

  private setupTouchDragDrop(dropZone: HTMLElement, status: Status): void {
    // Simplified touch drag-drop handling
    // Full implementation would track touch movements and provide visual feedback
    dropZone.addEventListener('touchend', async () => {
      if (this.draggedTask && this.draggedTask.status !== status) {
        hapticFeedback('medium');
        await this.moveTaskToStatus(this.draggedTask, status);
      }
    });
  }

  private async moveTaskToStatus(task: Task, newStatus: Status): Promise<void> {
    await this.plugin.dataService.updateTaskStatus(task.id, newStatus);
    this.plugin.refreshViews();
  }

  private quickAddTask(status: Status): void {
    // For now, open the regular create modal
    // Future: inline input field
    this.plugin.createNewEntity('task');
  }

  private showCardContextMenu(task: Task, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'board-context-menu';
    menu.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 8}px;
      left: ${Math.min(rect.left, window.innerWidth - 160)}px;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 8px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 101;
      min-width: 140px;
    `;

    const menuItems = [
      { label: 'Open', icon: '📄', action: () => this.plugin.openEntity(task.id) },
      { label: 'Edit', icon: '✏️', action: () => this.plugin.editEntity(task.id) },
      { label: 'Complete', icon: '✓', action: () => this.moveTaskToStatus(task, 'completed') },
    ];

    // Add move options
    STATUS_COLUMNS.forEach(col => {
      if (col.status !== task.status) {
        menuItems.push({
          label: `Move to ${col.title}`,
          icon: '→',
          action: () => this.moveTaskToStatus(task, col.status)
        });
      }
    });

    menuItems.forEach(({ label, icon, action }) => {
      const item = menu.createEl('div', { cls: 'board-context-menu-item' });
      item.style.cssText = `
        padding: 10px 16px;
        min-height: 40px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
      `;
      item.createSpan({ text: icon });
      item.createSpan({ text: label });
      item.addEventListener('click', () => {
        hapticFeedback('light');
        action();
        menu.remove();
      });
    });

    document.body.appendChild(menu);

    // Adjust position if off-screen
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = `${rect.top - menuRect.height - 8}px`;
    }

    // Close on outside click
    const closeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('touchstart', closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
      document.addEventListener('touchstart', closeMenu);
    }, 100);
  }

  private addFloatingActionButton(): void {
    const fab = this.contentEl.createEl('button', { cls: 'tv-fab' });
    fab.setText('+');
    fab.setAttribute('aria-label', 'Add task');
    fab.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('task');
    });
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < -1) return `${Math.abs(diff)}d ago`;
    if (diff < 7) return `In ${diff}d`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private extractName(obsidianLink: string): string {
    // Extract name from [[Name]] format
    const match = obsidianLink.match(/\[\[([^\]]+)\]\]/);
    return match ? match[1] : obsidianLink;
  }
}
