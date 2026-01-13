import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { Task, Status, Priority, SortOptions } from '../models/types';
import {
  isMobile,
  createLongPressHandler,
  hapticFeedback
} from '../utils/mobile';

export const LIST_VIEW_TYPE = 'timeline-viewer-list';

interface ListColumn {
  key: keyof Task | 'checkbox';
  label: string;
  width: string;
  sortable: boolean;
}

const COLUMNS: ListColumn[] = [
  { key: 'checkbox', label: '', width: '40px', sortable: false },
  { key: 'title', label: 'Task', width: '1fr', sortable: true },
  { key: 'projectId', label: 'Project', width: '120px', sortable: true },
  { key: 'assignee', label: 'Assignee', width: '100px', sortable: true },
  { key: 'dueDate', label: 'Due', width: '100px', sortable: true },
  { key: 'priority', label: 'Priority', width: '80px', sortable: true },
  { key: 'status', label: 'Status', width: '100px', sortable: true },
];

const PRIORITY_ICONS: Record<Priority, string> = {
  'critical': '🔴',
  'high': '🟠',
  'medium': '🟡',
  'low': '🟢'
};

const STATUS_LABELS: Record<Status, string> = {
  'not-started': 'To Do',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  'completed': 'Done',
  'cancelled': 'Cancelled'
};

export class ListView extends ItemView {
  plugin: TimelineViewerPlugin;
  private contentEl: HTMLElement;
  private sortOptions: SortOptions = { field: 'dueDate', direction: 'asc' };
  private selectedTasks: Set<string> = new Set();
  private cleanupFunctions: (() => void)[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'List';
  }

  getIcon(): string {
    return 'list';
  }

  async onOpen(): Promise<void> {
    this.contentEl = this.containerEl.children[1] as HTMLElement;
    this.contentEl.empty();
    this.contentEl.addClass('list-viewer-container');

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
    const header = this.contentEl.createDiv({ cls: 'list-header' });
    header.createEl('h2', { text: 'List View' });

    const controls = header.createDiv({ cls: 'list-controls' });

    // Filter dropdown (simplified)
    const filterSelect = controls.createEl('select', { cls: 'list-filter-select' });
    filterSelect.createEl('option', { text: 'All Tasks', value: 'all' });
    filterSelect.createEl('option', { text: 'Active', value: 'active' });
    filterSelect.createEl('option', { text: 'Completed', value: 'completed' });
    filterSelect.createEl('option', { text: 'Overdue', value: 'overdue' });

    const addTaskBtn = controls.createEl('button', {
      text: '+ Task',
      cls: 'list-btn mod-cta'
    });
    addTaskBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('task');
    });

    // Table container
    const tableContainer = this.contentEl.createDiv({ cls: 'list-table-container' });

    // Render table
    this.renderTable(tableContainer);

    // Add FAB for mobile
    if (isMobile()) {
      this.addFloatingActionButton();
    }
  }

  private renderTable(container: HTMLElement): void {
    const tasks = this.getSortedTasks();

    // Create table
    const table = container.createDiv({ cls: 'list-table' });

    // Set grid template
    const gridCols = isMobile()
      ? '40px 1fr 80px 60px' // Simplified for mobile
      : COLUMNS.map(c => c.width).join(' ');
    table.style.gridTemplateColumns = gridCols;

    // Header row
    const headerRow = table.createDiv({ cls: 'list-header-row' });

    const visibleColumns = isMobile()
      ? COLUMNS.filter(c => ['checkbox', 'title', 'dueDate', 'priority'].includes(c.key as string))
      : COLUMNS;

    visibleColumns.forEach(col => {
      const cell = headerRow.createDiv({ cls: 'list-header-cell' });

      if (col.key === 'checkbox') {
        const selectAll = cell.createEl('input', { type: 'checkbox', cls: 'list-checkbox' });
        selectAll.addEventListener('change', () => this.toggleSelectAll(selectAll.checked, tasks));
      } else {
        cell.setText(col.label);

        if (col.sortable) {
          cell.addClass('list-header-sortable');
          if (this.sortOptions.field === col.key) {
            cell.addClass(`list-header-sorted-${this.sortOptions.direction}`);
          }
          cell.addEventListener('click', () => this.handleSort(col.key as keyof Task));
        }
      }
    });

    // Data rows
    if (tasks.length === 0) {
      const emptyRow = table.createDiv({ cls: 'list-empty-row' });
      emptyRow.style.gridColumn = `1 / -1`;
      emptyRow.setText('No tasks found. Create your first task!');
    } else {
      tasks.forEach(task => {
        this.renderRow(table, task, visibleColumns);
      });
    }
  }

  private renderRow(table: HTMLElement, task: Task, columns: ListColumn[]): void {
    const row = table.createDiv({ cls: 'list-row' });
    row.dataset.taskId = task.id;

    if (task.status === 'completed') {
      row.addClass('list-row-completed');
    }

    const isOverdue = task.dueDate && task.dueDate < new Date() && task.status !== 'completed';
    if (isOverdue) {
      row.addClass('list-row-overdue');
    }

    columns.forEach(col => {
      const cell = row.createDiv({ cls: 'list-cell' });

      switch (col.key) {
        case 'checkbox':
          const checkbox = cell.createEl('input', { type: 'checkbox', cls: 'list-checkbox' });
          checkbox.checked = this.selectedTasks.has(task.id);
          checkbox.addEventListener('change', () => this.toggleSelect(task.id, checkbox.checked));
          break;

        case 'title':
          const titleWrapper = cell.createDiv({ cls: 'list-cell-title' });

          // Complete button
          const completeBtn = titleWrapper.createSpan({ cls: 'list-complete-btn' });
          completeBtn.setText(task.status === 'completed' ? '✓' : '○');
          completeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hapticFeedback('light');
            this.toggleComplete(task);
          });

          const titleText = titleWrapper.createSpan({ cls: 'list-title-text', text: task.title });
          titleText.addEventListener('click', () => {
            hapticFeedback('light');
            this.plugin.openEntity(task.id);
          });

          // Long press for context menu
          const longPressCleanup = createLongPressHandler(cell, () => {
            hapticFeedback('medium');
            this.showRowContextMenu(task, cell);
          });
          this.cleanupFunctions.push(longPressCleanup);
          break;

        case 'projectId':
          if (task.projectId) {
            const project = this.plugin.dataService.getEntity(task.projectId);
            cell.setText(project?.title || '—');
          } else {
            cell.setText('—');
          }
          break;

        case 'assignee':
          if (task.assignee) {
            cell.setText(this.extractName(task.assignee));
          } else {
            cell.setText('—');
          }
          break;

        case 'dueDate':
          if (task.dueDate) {
            cell.setText(this.formatDate(task.dueDate));
            if (isOverdue) {
              cell.addClass('list-cell-overdue');
            }
          } else {
            cell.setText('—');
          }
          break;

        case 'priority':
          cell.setText(PRIORITY_ICONS[task.priority]);
          cell.setAttribute('title', task.priority);
          break;

        case 'status':
          cell.setText(STATUS_LABELS[task.status]);
          cell.addClass(`list-cell-status-${task.status}`);
          break;
      }
    });
  }

  private getSortedTasks(): Task[] {
    const tasks = this.plugin.dataService.getAllTasks();

    return tasks.sort((a, b) => {
      let comparison = 0;
      const field = this.sortOptions.field;

      switch (field) {
        case 'dueDate':
          const dateA = a.dueDate?.getTime() || Infinity;
          const dateB = b.dueDate?.getTime() || Infinity;
          comparison = dateA - dateB;
          break;
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'status':
          const statusOrder = { 'in-progress': 0, 'not-started': 1, 'on-hold': 2, 'completed': 3, 'cancelled': 4 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = 0;
      }

      return this.sortOptions.direction === 'asc' ? comparison : -comparison;
    });
  }

  private handleSort(field: keyof Task): void {
    if (this.sortOptions.field === field) {
      this.sortOptions.direction = this.sortOptions.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortOptions.field = field as SortOptions['field'];
      this.sortOptions.direction = 'asc';
    }
    hapticFeedback('light');
    this.render();
  }

  private toggleSelect(taskId: string, selected: boolean): void {
    if (selected) {
      this.selectedTasks.add(taskId);
    } else {
      this.selectedTasks.delete(taskId);
    }
  }

  private toggleSelectAll(selected: boolean, tasks: Task[]): void {
    if (selected) {
      tasks.forEach(t => this.selectedTasks.add(t.id));
    } else {
      this.selectedTasks.clear();
    }
    this.render();
  }

  private async toggleComplete(task: Task): Promise<void> {
    const newStatus: Status = task.status === 'completed' ? 'not-started' : 'completed';
    await this.plugin.dataService.updateTaskStatus(task.id, newStatus);
    this.plugin.refreshViews();
  }

  private showRowContextMenu(task: Task, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'list-context-menu';
    menu.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 4}px;
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
      { label: 'Open', action: () => this.plugin.openEntity(task.id) },
      { label: 'Edit', action: () => this.plugin.editEntity(task.id) },
      { label: task.status === 'completed' ? 'Reopen' : 'Complete', action: () => this.toggleComplete(task) },
    ];

    menuItems.forEach(({ label, action }) => {
      const item = menu.createEl('div', { cls: 'list-context-menu-item', text: label });
      item.style.cssText = `
        padding: 10px 16px;
        min-height: 40px;
        display: flex;
        align-items: center;
        cursor: pointer;
      `;
      item.addEventListener('click', () => {
        hapticFeedback('light');
        action();
        menu.remove();
      });
    });

    document.body.appendChild(menu);

    const closeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
  }

  private addFloatingActionButton(): void {
    const fab = this.contentEl.createEl('button', { cls: 'tv-fab' });
    fab.setText('+');
    fab.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('task');
    });
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private extractName(obsidianLink: string): string {
    const match = obsidianLink.match(/\[\[([^\]]+)\]\]/);
    return match ? match[1] : obsidianLink;
  }
}
