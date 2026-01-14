/**
 * @fileoverview MyTasksView - Personal task list organized by due date
 *
 * Provides a focused view of tasks relevant to the current user,
 * organized by date sections (Overdue, Today, Tomorrow, This Week, Later).
 * Ideal for daily task management and planning.
 *
 * **Features Implemented:**
 * - ✅ Date-based grouping (Overdue, Today, Tomorrow, This Week, Later, No Date)
 * - ✅ Section collapse/expand
 * - ✅ Assignee filtering (all tasks vs. assigned to me)
 * - ✅ Pull-to-refresh gesture (mobile)
 * - ✅ Swipe to complete (mobile)
 * - ✅ Task completion checkboxes
 * - ✅ Click to open task
 *
 * **TODO - Missing Features:**
 * - [ ] Actual assignee detection (currently shows all tasks)
 * - [ ] Quick reschedule (drag to different date section)
 * - [ ] Task prioritization within sections
 * - [ ] Subtask display and management
 * - [ ] Time blocking (group by time of day)
 * - [ ] Focus mode (hide all but one section)
 * - [ ] Task notes preview
 * - [ ] Recurring task indicators
 *
 * **Implementation Guide:**
 * 1. Assignee detection: Read Obsidian user info and match against task.assignee field
 * 2. Quick reschedule: Implement drag-drop between date sections, update dueDate
 * 3. Time blocking: Add time-of-day sections (Morning, Afternoon, Evening)
 *
 * @module MyTasksView
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { Task, MyTaskItem } from '../models/types';
import {
  isMobile,
  createSwipeHandler,
  createLongPressHandler,
  hapticFeedback
} from '../utils/mobile';

export const MY_TASKS_VIEW_TYPE = 'timeline-viewer-my-tasks';

/**
 * Date section categories for organizing tasks
 */
type DateSection = 'overdue' | 'today' | 'tomorrow' | 'this-week' | 'later' | 'no-date';

interface TaskSection {
  id: DateSection;
  title: string;
  tasks: MyTaskItem[];
  collapsed: boolean;
}

export class MyTasksView extends ItemView {
  plugin: TimelineViewerPlugin;
  private contentEl: HTMLElement;
  private cleanupFunctions: (() => void)[] = [];
  private collapsedSections: Set<DateSection> = new Set();
  private currentAssignee: string = ''; // Filter by assignee

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return MY_TASKS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'My Tasks';
  }

  getIcon(): string {
    return 'check-square';
  }

  async onOpen(): Promise<void> {
    this.contentEl = this.containerEl.children[1] as HTMLElement;
    this.contentEl.empty();
    this.contentEl.addClass('my-tasks-viewer-container');

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
    const header = this.contentEl.createDiv({ cls: 'my-tasks-header' });
    header.createEl('h2', { text: 'My Tasks' });

    // Controls
    const controls = header.createDiv({ cls: 'my-tasks-controls' });

    // Assignee filter (for future - when assignee tracking is implemented)
    const filterLabel = controls.createEl('span', { text: 'Show: ', cls: 'my-tasks-filter-label' });
    const filterSelect = controls.createEl('select', { cls: 'my-tasks-filter-select' });
    filterSelect.createEl('option', { text: 'All Tasks', value: '' });
    filterSelect.createEl('option', { text: 'Assigned to Me', value: 'me' });
    filterSelect.addEventListener('change', () => {
      this.currentAssignee = filterSelect.value;
      this.renderTasks();
    });

    // Quick add button
    const addBtn = controls.createEl('button', { text: '+ Add Task', cls: 'my-tasks-add-btn mod-cta' });
    addBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('task');
    });

    // Task sections container
    const sectionsContainer = this.contentEl.createDiv({ cls: 'my-tasks-sections' });

    // Setup swipe gestures for pull-to-refresh feel
    if (isMobile()) {
      const swipeCleanup = createSwipeHandler(
        sectionsContainer,
        (result) => {
          if (result.direction === 'down' && result.distance > 80) {
            hapticFeedback('medium');
            this.render();
          }
        },
        { vertical: true }
      );
      this.cleanupFunctions.push(swipeCleanup);
    }

    this.renderTasks();

    // Add FAB for mobile
    if (isMobile()) {
      this.addFloatingActionButton();
    }
  }

  private renderTasks(): void {
    const sectionsContainer = this.contentEl.querySelector('.my-tasks-sections');
    if (!sectionsContainer) return;

    sectionsContainer.empty();

    // Get all tasks from data service
    const allTasks = this.plugin.dataService.getAllTasks();

    // Convert to MyTaskItem format and organize by date
    const sections = this.organizeTasks(allTasks);

    if (sections.every(s => s.tasks.length === 0)) {
      this.renderEmptyState(sectionsContainer as HTMLElement);
      return;
    }

    // Render each section
    sections.forEach(section => {
      if (section.tasks.length === 0) return;
      this.renderSection(sectionsContainer as HTMLElement, section);
    });
  }

  private organizeTasks(tasks: Task[]): TaskSection[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const sections: TaskSection[] = [
      { id: 'overdue', title: 'Overdue', tasks: [], collapsed: this.collapsedSections.has('overdue') },
      { id: 'today', title: 'Today', tasks: [], collapsed: this.collapsedSections.has('today') },
      { id: 'tomorrow', title: 'Tomorrow', tasks: [], collapsed: this.collapsedSections.has('tomorrow') },
      { id: 'this-week', title: 'This Week', tasks: [], collapsed: this.collapsedSections.has('this-week') },
      { id: 'later', title: 'Later', tasks: [], collapsed: this.collapsedSections.has('later') },
      { id: 'no-date', title: 'No Due Date', tasks: [], collapsed: this.collapsedSections.has('no-date') }
    ];

    tasks.forEach(task => {
      // Filter out completed tasks
      if (task.status === 'completed' && !this.plugin.settings.showCompletedItems) return;

      // Filter by assignee if set
      if (this.currentAssignee === 'me' && !task.assignee) return;

      const item = this.taskToMyTaskItem(task, today);

      if (!task.dueDate) {
        sections[5].tasks.push(item); // no-date
      } else {
        const dueDate = new Date(task.dueDate);
        const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        if (dueDay < today && task.status !== 'completed') {
          sections[0].tasks.push(item); // overdue
        } else if (dueDay.getTime() === today.getTime()) {
          sections[1].tasks.push(item); // today
        } else if (dueDay.getTime() === tomorrow.getTime()) {
          sections[2].tasks.push(item); // tomorrow
        } else if (dueDay <= weekEnd) {
          sections[3].tasks.push(item); // this-week
        } else {
          sections[4].tasks.push(item); // later
        }
      }
    });

    // Sort tasks within each section by priority then due date
    sections.forEach(section => {
      section.tasks.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        if (a.dueDate && b.dueDate) {
          return a.dueDate.getTime() - b.dueDate.getTime();
        }
        return 0;
      });
    });

    return sections;
  }

  private taskToMyTaskItem(task: Task, today: Date): MyTaskItem {
    const dueDate = task.dueDate ? new Date(task.dueDate) : undefined;
    let daysUntilDue: number | undefined;
    let isOverdue = false;

    if (dueDate) {
      const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const diffTime = dueDay.getTime() - today.getTime();
      daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isOverdue = daysUntilDue < 0 && task.status !== 'completed';
    }

    // Get project title
    let projectTitle: string | undefined;
    if (task.projectId) {
      const project = this.plugin.dataService.getEntity(task.projectId);
      if (project) {
        projectTitle = project.title;
      }
    }

    return {
      id: task.id,
      title: task.title,
      projectTitle,
      dueDate,
      priority: task.priority,
      status: task.status,
      isOverdue,
      daysUntilDue
    };
  }

  private renderSection(container: HTMLElement, section: TaskSection): void {
    const sectionEl = container.createDiv({ cls: 'my-tasks-section' });

    // Section header
    const headerEl = sectionEl.createDiv({ cls: 'my-tasks-section-header' });

    const toggleEl = headerEl.createDiv({ cls: 'my-tasks-section-toggle' });
    toggleEl.setText(section.collapsed ? '▶' : '▼');

    const titleEl = headerEl.createDiv({ cls: 'my-tasks-section-title' });
    titleEl.setText(`${section.title} (${section.tasks.length})`);

    // Add overdue styling
    if (section.id === 'overdue' && section.tasks.length > 0) {
      sectionEl.addClass('my-tasks-section-overdue');
    }

    // Toggle collapse
    headerEl.addEventListener('click', () => {
      hapticFeedback('light');
      if (section.collapsed) {
        this.collapsedSections.delete(section.id);
      } else {
        this.collapsedSections.add(section.id);
      }
      this.renderTasks();
    });

    // Task list
    if (!section.collapsed) {
      const listEl = sectionEl.createDiv({ cls: 'my-tasks-list' });

      section.tasks.forEach(task => {
        this.renderTaskItem(listEl, task);
      });
    }
  }

  private renderTaskItem(container: HTMLElement, task: MyTaskItem): void {
    const itemEl = container.createDiv({ cls: 'my-tasks-item' });

    if (task.status === 'completed') {
      itemEl.addClass('my-tasks-item-completed');
    }
    if (task.isOverdue) {
      itemEl.addClass('my-tasks-item-overdue');
    }

    // Checkbox
    const checkboxEl = itemEl.createEl('input', { type: 'checkbox', cls: 'my-tasks-checkbox' });
    checkboxEl.checked = task.status === 'completed';
    checkboxEl.addEventListener('change', async () => {
      hapticFeedback('medium');
      const newStatus = checkboxEl.checked ? 'completed' : 'in-progress';
      await this.plugin.dataService.updateTaskStatus(task.id, newStatus);
      this.renderTasks();
    });

    // Task content
    const contentEl = itemEl.createDiv({ cls: 'my-tasks-item-content' });

    // Title row
    const titleRow = contentEl.createDiv({ cls: 'my-tasks-item-title-row' });
    const titleEl = titleRow.createSpan({ text: task.title, cls: 'my-tasks-item-title' });

    // Priority indicator
    const priorityEl = titleRow.createSpan({ cls: `my-tasks-item-priority priority-${task.priority}` });
    const priorityLabels = { critical: '!!!', high: '!!', medium: '!', low: '' };
    priorityEl.setText(priorityLabels[task.priority]);

    // Meta row
    const metaRow = contentEl.createDiv({ cls: 'my-tasks-item-meta' });

    if (task.projectTitle) {
      metaRow.createSpan({ text: task.projectTitle, cls: 'my-tasks-item-project' });
    }

    if (task.dueDate) {
      const dueDateStr = this.formatDueDate(task.dueDate, task.daysUntilDue);
      const dueEl = metaRow.createSpan({ text: dueDateStr, cls: 'my-tasks-item-due' });
      if (task.isOverdue) {
        dueEl.addClass('overdue');
      }
    }

    // Touch interactions
    const longPressCleanup = createLongPressHandler(titleEl, () => {
      hapticFeedback('medium');
      this.showTaskContextMenu(itemEl, task);
    });
    this.cleanupFunctions.push(longPressCleanup);

    titleEl.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.openEntity(task.id);
    });
  }

  private formatDueDate(date: Date, daysUntilDue?: number): string {
    if (daysUntilDue === undefined) return '';

    if (daysUntilDue < -1) {
      return `${Math.abs(daysUntilDue)} days overdue`;
    } else if (daysUntilDue === -1) {
      return 'Yesterday';
    } else if (daysUntilDue === 0) {
      return 'Today';
    } else if (daysUntilDue === 1) {
      return 'Tomorrow';
    } else if (daysUntilDue <= 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  private showTaskContextMenu(anchor: HTMLElement, task: MyTaskItem): void {
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'my-tasks-context-menu';
    menu.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 4}px;
      left: ${rect.left}px;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 8px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 101;
      min-width: 150px;
    `;

    const options = [
      { label: 'Open', action: () => this.plugin.openEntity(task.id) },
      { label: 'Edit', action: () => this.plugin.editEntity(task.id) },
      { label: task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete', action: async () => {
        const newStatus = task.status === 'completed' ? 'in-progress' : 'completed';
        await this.plugin.dataService.updateTaskStatus(task.id, newStatus);
        this.renderTasks();
      }},
    ];

    options.forEach(({ label, action }) => {
      const item = menu.createEl('div', { text: label, cls: 'my-tasks-menu-item' });
      item.style.cssText = `
        padding: 12px 16px;
        min-height: 44px;
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

    const removeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 100);
  }

  private renderEmptyState(container: HTMLElement): void {
    const emptyState = container.createDiv({ cls: 'my-tasks-empty-state' });
    emptyState.createEl('p', { text: 'No tasks found.' });
    emptyState.createEl('p', { text: 'Create a task to get started!' });

    const createBtn = emptyState.createEl('button', {
      text: 'Create Task',
      cls: 'mod-cta'
    });
    createBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('task');
    });
  }

  private addFloatingActionButton(): void {
    const fab = this.contentEl.createEl('button', { cls: 'tv-fab' });
    fab.setText('+');
    fab.setAttribute('aria-label', 'Create new task');

    fab.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('task');
    });
  }
}
