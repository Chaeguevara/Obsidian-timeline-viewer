import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { TimelineItem, Task, Project } from '../models/types';

export const TIMELINE_VIEW_TYPE = 'timeline-viewer-timeline';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SNAP_MINUTES = 15; // Snap to 15-minute intervals
const HOUR_HEIGHT = 48; // pixels per hour
const TIME_COLUMN_WIDTH = 60;

// Project color palette
const PROJECT_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Light Blue
];

interface DayColumn {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

interface ProjectInfo {
  id: string;
  title: string;
  color: string;
}

export class TimelineView extends ItemView {
  plugin: TimelineViewerPlugin;
  private viewContentEl: HTMLElement;
  private currentWeekStart: Date;
  private taskElements: Map<string, HTMLElement> = new Map();
  private svgLayer: SVGSVGElement | null = null;
  private projectColors: Map<string, string> = new Map();
  private timeGridEl: HTMLElement | null = null;

  // Drag state for dependency creation
  private isDraggingConnection: boolean = false;
  private dragStartTaskId: string | null = null;
  private dragLine: SVGLineElement | null = null;

  // Drag state for task moving/resizing
  private isDraggingTask: boolean = false;
  private isResizingTask: boolean = false;
  private draggedTaskId: string | null = null;
  private dragStartY: number = 0;
  private dragStartX: number = 0;
  private originalStartDate: Date | null = null;
  private originalEndDate: Date | null = null;
  private resizeEdge: 'top' | 'bottom' | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentWeekStart = this.getWeekStart(new Date());
  }

  getViewType(): string {
    return TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Timeline';
  }

  getIcon(): string {
    return 'calendar';
  }

  async onOpen(): Promise<void> {
    this.viewContentEl = this.containerEl.children[1] as HTMLElement;
    this.viewContentEl.empty();
    this.viewContentEl.addClass('timeline-viewer-container');

    // Add global mouse handlers
    this.registerDomEvent(document, 'mousemove', this.handleGlobalMouseMove.bind(this));
    this.registerDomEvent(document, 'mouseup', this.handleGlobalMouseUp.bind(this));

    await this.render();
  }

  async onClose(): Promise<void> {
    this.viewContentEl.empty();
  }

  async render(): Promise<void> {
    this.viewContentEl.empty();
    this.taskElements.clear();
    this.projectColors.clear();

    // Build project color mapping
    this.buildProjectColors();

    // Header with navigation
    this.renderHeader();

    // Main container with legend
    const mainContainer = this.viewContentEl.createDiv({ cls: 'week-main-container' });

    // Week calendar container
    const calendarContainer = mainContainer.createDiv({ cls: 'week-calendar' });

    // SVG layer for dependency lines
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.addClass('dependency-svg-layer');
    calendarContainer.appendChild(this.svgLayer);

    // Render the week calendar
    this.renderWeekCalendar(calendarContainer);

    // Render project legend
    this.renderLegend(mainContainer);

    // Render dependency lines after tasks are positioned
    setTimeout(() => this.renderDependencyLines(), 100);
  }

  private buildProjectColors(): void {
    const items = this.plugin.dataService.getTimelineItems();
    let colorIndex = 0;

    items.forEach(item => {
      if (item.type === 'project') {
        this.projectColors.set(item.id, PROJECT_COLORS[colorIndex % PROJECT_COLORS.length]);
        colorIndex++;
      }
    });
  }

  private getTaskColor(task: TimelineItem): string {
    // Get the task entity to find its project
    const taskEntity = this.plugin.dataService.getEntity(task.id) as Task | undefined;
    if (taskEntity?.projectId) {
      return this.projectColors.get(taskEntity.projectId) || 'var(--interactive-accent)';
    }
    return 'var(--interactive-accent)';
  }

  private renderHeader(): void {
    const header = this.viewContentEl.createDiv({ cls: 'timeline-header' });

    // Title
    header.createEl('h2', { text: 'Week View' });

    // Navigation controls
    const nav = header.createDiv({ cls: 'week-nav' });

    // Previous week button
    const prevBtn = nav.createEl('button', { cls: 'week-nav-btn', text: '‹' });
    prevBtn.setAttribute('aria-label', 'Previous week');
    prevBtn.addEventListener('click', () => this.navigateWeek(-1));

    // Date range display
    const weekEnd = new Date(this.currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const dateRange = nav.createDiv({ cls: 'week-date-range' });
    dateRange.setText(this.formatDateRange(this.currentWeekStart, weekEnd));

    // Today button
    const todayBtn = nav.createEl('button', { cls: 'week-nav-btn week-today-btn', text: 'Today' });
    todayBtn.addEventListener('click', () => this.goToToday());

    // Next week button
    const nextBtn = nav.createEl('button', { cls: 'week-nav-btn', text: '›' });
    nextBtn.setAttribute('aria-label', 'Next week');
    nextBtn.addEventListener('click', () => this.navigateWeek(1));

    // Add task button
    const addBtn = header.createEl('button', { cls: 'week-add-btn mod-cta', text: '+ New Task' });
    addBtn.addEventListener('click', () => this.plugin.createNewEntity('task'));
  }

  private renderLegend(container: HTMLElement): void {
    const legend = container.createDiv({ cls: 'week-legend' });
    legend.createEl('h4', { text: 'Projects' });

    const items = this.plugin.dataService.getTimelineItems();
    const projects = items.filter(item => item.type === 'project');

    if (projects.length === 0) {
      legend.createDiv({ cls: 'week-legend-empty', text: 'No projects' });
      return;
    }

    projects.forEach(project => {
      const item = legend.createDiv({ cls: 'week-legend-item' });
      const color = this.projectColors.get(project.id) || 'var(--text-muted)';

      const dot = item.createDiv({ cls: 'week-legend-dot' });
      dot.style.backgroundColor = color;

      item.createSpan({ text: project.title });
    });
  }

  private renderWeekCalendar(container: HTMLElement): void {
    const days = this.getWeekDays();
    const items = this.plugin.dataService.getTimelineItems();
    // Only get tasks, not projects
    const allTasks = this.getTasksOnly(items);

    // Create calendar grid
    const grid = container.createDiv({ cls: 'week-grid' });

    // Header row with day names
    const headerRow = grid.createDiv({ cls: 'week-header-row' });
    headerRow.createDiv({ cls: 'week-time-header' });

    days.forEach(day => {
      const cell = headerRow.createDiv({
        cls: `week-header-cell ${day.isToday ? 'is-today' : ''}`
      });
      cell.createDiv({ cls: 'week-day-name', text: day.dayName });
      cell.createDiv({ cls: 'week-day-number', text: String(day.dayNumber) });
    });

    // Scrollable time grid container
    const timeGridWrapper = grid.createDiv({ cls: 'week-timegrid-wrapper' });
    this.timeGridEl = timeGridWrapper.createDiv({ cls: 'week-timegrid' });

    // Render hour rows
    HOURS.forEach(hour => {
      const hourRow = this.timeGridEl!.createDiv({ cls: 'week-hour-row' });

      // Time label
      const timeLabel = hourRow.createDiv({ cls: 'week-time-cell' });
      const hourStr = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
      timeLabel.createSpan({ cls: 'week-hour-label', text: hourStr });

      // Day cells for this hour
      days.forEach((day, dayIndex) => {
        const cell = hourRow.createDiv({
          cls: `week-hour-cell ${day.isToday ? 'is-today' : ''}`
        });
        cell.setAttribute('data-day-index', String(dayIndex));
        cell.setAttribute('data-hour', String(hour));
      });
    });

    // Render tasks overlaid on the time grid
    this.renderTasks(this.timeGridEl!, days, allTasks);

    // Add current time indicator
    this.renderCurrentTimeIndicator(this.timeGridEl!, days);

    // Empty state if no tasks
    if (allTasks.length === 0) {
      this.renderEmptyState(container);
    }
  }

  private getTasksOnly(items: TimelineItem[]): TimelineItem[] {
    const tasks: TimelineItem[] = [];

    items.forEach(item => {
      // Only include tasks, not projects
      if (item.type === 'task') {
        tasks.push(item);
      }
      // Include children tasks from projects
      if (item.children) {
        tasks.push(...item.children);
      }
    });

    return tasks;
  }

  private renderCurrentTimeIndicator(timeGrid: HTMLElement, days: DayColumn[]): void {
    const now = new Date();
    const todayIndex = days.findIndex(day => day.isToday);

    if (todayIndex === -1) return;

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const topPosition = (hours * HOUR_HEIGHT) + (minutes / 60 * HOUR_HEIGHT);

    const indicator = timeGrid.createDiv({ cls: 'current-time-indicator' });
    indicator.style.top = `${topPosition}px`;
    indicator.style.left = `${TIME_COLUMN_WIDTH}px`;
    indicator.style.width = `calc(100% - ${TIME_COLUMN_WIDTH}px)`;

    const dot = indicator.createDiv({ cls: 'current-time-dot' });
    const dayWidth = `calc((100% - ${TIME_COLUMN_WIDTH}px) / 7)`;
    dot.style.left = `calc(${todayIndex} * ${dayWidth})`;
  }

  private renderTasks(timeGrid: HTMLElement, days: DayColumn[], tasks: TimelineItem[]): void {
    tasks.forEach(task => {
      const card = this.createTaskCard(timeGrid, task, days);
      if (card) {
        this.taskElements.set(task.id, card);
      }
    });
  }

  private createTaskCard(timeGrid: HTMLElement, task: TimelineItem, days: DayColumn[]): HTMLElement | null {
    // Find which day this task belongs to
    const dayIndex = days.findIndex(day => {
      const dayStart = new Date(day.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day.date);
      dayEnd.setHours(23, 59, 59, 999);
      return task.startDate.getTime() >= dayStart.getTime() && task.startDate.getTime() <= dayEnd.getTime();
    });

    if (dayIndex === -1) return null;

    const card = timeGrid.createDiv({
      cls: `week-task-card week-task-card-${task.status}`,
      attr: { 'data-task-id': task.id }
    });

    // Apply project color
    const color = this.getTaskColor(task);
    card.style.borderLeftColor = color;
    card.style.setProperty('--task-color', color);

    // Position the card based on actual task times
    const dayWidth = `calc((100% - ${TIME_COLUMN_WIDTH}px) / 7)`;

    const startHour = task.startDate.getHours();
    const startMinutes = task.startDate.getMinutes();
    const endHour = task.endDate.getHours();
    const endMinutes = task.endDate.getMinutes();

    const topPosition = (startHour * HOUR_HEIGHT) + (startMinutes / 60 * HOUR_HEIGHT);
    const durationMinutes = (endHour * 60 + endMinutes) - (startHour * 60 + startMinutes);
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, HOUR_HEIGHT / 2);

    card.style.left = `calc(${TIME_COLUMN_WIDTH}px + ${dayIndex} * ${dayWidth})`;
    card.style.top = `${topPosition}px`;
    card.style.width = `calc(${dayWidth} - 4px)`;
    card.style.height = `${height}px`;

    // Task title
    card.createDiv({ cls: 'week-task-card-title', text: task.title });

    // Time label
    const timeStr = this.formatTime(task.startDate) + ' - ' + this.formatTime(task.endDate);
    card.createDiv({ cls: 'week-task-card-time', text: timeStr });

    // Resize handles (top and bottom)
    const resizeTop = card.createDiv({ cls: 'resize-handle resize-handle-top' });
    const resizeBottom = card.createDiv({ cls: 'resize-handle resize-handle-bottom' });

    // Connection handles (left and right)
    const leftHandle = card.createDiv({ cls: 'connection-handle connection-handle-left' });
    leftHandle.setAttribute('data-task-id', task.id);

    const rightHandle = card.createDiv({ cls: 'connection-handle connection-handle-right' });
    rightHandle.setAttribute('data-task-id', task.id);

    // Event handlers
    this.setupTaskDragHandlers(card, task, resizeTop, resizeBottom, rightHandle);

    return card;
  }

  private setupTaskDragHandlers(
    card: HTMLElement,
    task: TimelineItem,
    resizeTop: HTMLElement,
    resizeBottom: HTMLElement,
    rightHandle: HTMLElement
  ): void {
    // Click to open
    card.addEventListener('click', (e) => {
      if (!this.isDraggingTask && !this.isResizingTask && !this.isDraggingConnection) {
        e.stopPropagation();
        this.plugin.openEntity(task.id);
      }
    });

    // Drag to move (on the card body)
    card.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('resize-handle') || target.classList.contains('connection-handle')) {
        return; // Don't start drag if clicking on handles
      }
      e.preventDefault();
      e.stopPropagation();
      this.startTaskDrag(task.id, e);
    });

    // Resize top (change start time)
    resizeTop.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startTaskResize(task.id, 'top', e);
    });

    // Resize bottom (change end time)
    resizeBottom.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startTaskResize(task.id, 'bottom', e);
    });

    // Connection drag (right handle)
    rightHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startConnectionDrag(task.id, e);
    });
  }

  private startTaskDrag(taskId: string, e: MouseEvent): void {
    const task = this.plugin.dataService.getEntity(taskId) as Task | undefined;
    if (!task) return;

    this.isDraggingTask = true;
    this.draggedTaskId = taskId;
    this.dragStartY = e.clientY;
    this.dragStartX = e.clientX;
    this.originalStartDate = task.startDate ? new Date(task.startDate) : null;
    this.originalEndDate = task.dueDate ? new Date(task.dueDate) : null;

    document.body.addClass('is-dragging-task');
  }

  private startTaskResize(taskId: string, edge: 'top' | 'bottom', e: MouseEvent): void {
    const task = this.plugin.dataService.getEntity(taskId) as Task | undefined;
    if (!task) return;

    this.isResizingTask = true;
    this.draggedTaskId = taskId;
    this.resizeEdge = edge;
    this.dragStartY = e.clientY;
    this.originalStartDate = task.startDate ? new Date(task.startDate) : null;
    this.originalEndDate = task.dueDate ? new Date(task.dueDate) : null;

    document.body.addClass('is-resizing-task');
  }

  private startConnectionDrag(fromTaskId: string, e: MouseEvent): void {
    this.isDraggingConnection = true;
    this.dragStartTaskId = fromTaskId;

    if (this.svgLayer) {
      this.dragLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.dragLine.setAttribute('class', 'dependency-drag-line');

      const fromEl = this.taskElements.get(fromTaskId);
      if (fromEl) {
        const rect = fromEl.getBoundingClientRect();
        const containerRect = this.svgLayer.getBoundingClientRect();
        const startX = rect.right - containerRect.left;
        const startY = rect.top + rect.height / 2 - containerRect.top;

        this.dragLine.setAttribute('x1', String(startX));
        this.dragLine.setAttribute('y1', String(startY));
        this.dragLine.setAttribute('x2', String(e.clientX - containerRect.left));
        this.dragLine.setAttribute('y2', String(e.clientY - containerRect.top));
      }

      this.svgLayer.appendChild(this.dragLine);
    }

    document.body.addClass('is-dragging-connection');
  }

  private handleGlobalMouseMove(e: MouseEvent): void {
    // Handle connection drag
    if (this.isDraggingConnection && this.dragLine && this.svgLayer) {
      const containerRect = this.svgLayer.getBoundingClientRect();
      this.dragLine.setAttribute('x2', String(e.clientX - containerRect.left));
      this.dragLine.setAttribute('y2', String(e.clientY - containerRect.top));
      return;
    }

    // Handle task drag (move)
    if (this.isDraggingTask && this.draggedTaskId && this.originalStartDate && this.originalEndDate) {
      const deltaY = e.clientY - this.dragStartY;
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES;

      // Update visual position
      const taskEl = this.taskElements.get(this.draggedTaskId);
      if (taskEl) {
        const newStartDate = new Date(this.originalStartDate);
        newStartDate.setMinutes(newStartDate.getMinutes() + deltaMinutes);

        const topPosition = (newStartDate.getHours() * HOUR_HEIGHT) + (newStartDate.getMinutes() / 60 * HOUR_HEIGHT);
        taskEl.style.top = `${topPosition}px`;
      }
      return;
    }

    // Handle task resize
    if (this.isResizingTask && this.draggedTaskId && this.originalStartDate && this.originalEndDate) {
      const deltaY = e.clientY - this.dragStartY;
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES;

      const taskEl = this.taskElements.get(this.draggedTaskId);
      if (taskEl) {
        if (this.resizeEdge === 'top') {
          const newStartDate = new Date(this.originalStartDate);
          newStartDate.setMinutes(newStartDate.getMinutes() + deltaMinutes);

          const topPosition = (newStartDate.getHours() * HOUR_HEIGHT) + (newStartDate.getMinutes() / 60 * HOUR_HEIGHT);
          const originalBottom = parseFloat(taskEl.style.top) + parseFloat(taskEl.style.height);
          const newHeight = originalBottom - topPosition;

          if (newHeight >= HOUR_HEIGHT / 4) { // Minimum 15 min
            taskEl.style.top = `${topPosition}px`;
            taskEl.style.height = `${newHeight}px`;
          }
        } else if (this.resizeEdge === 'bottom') {
          const durationChange = deltaMinutes;
          const originalDuration = (this.originalEndDate.getTime() - this.originalStartDate.getTime()) / 60000;
          const newDuration = originalDuration + durationChange;

          if (newDuration >= 15) { // Minimum 15 min
            const newHeight = (newDuration / 60) * HOUR_HEIGHT;
            taskEl.style.height = `${newHeight}px`;
          }
        }
      }
      return;
    }
  }

  private async handleGlobalMouseUp(e: MouseEvent): Promise<void> {
    // Handle connection drop
    if (this.isDraggingConnection) {
      const target = e.target as HTMLElement;
      const leftHandle = target.closest('.connection-handle-left');

      if (leftHandle && this.dragStartTaskId) {
        const targetTaskId = leftHandle.getAttribute('data-task-id');
        if (targetTaskId && targetTaskId !== this.dragStartTaskId) {
          await this.createDependency(this.dragStartTaskId, targetTaskId);
        }
      }

      this.endConnectionDrag();
      return;
    }

    // Handle task drag end (save new position)
    if (this.isDraggingTask && this.draggedTaskId && this.originalStartDate && this.originalEndDate) {
      const deltaY = e.clientY - this.dragStartY;
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES;

      if (deltaMinutes !== 0) {
        const newStartDate = new Date(this.originalStartDate);
        newStartDate.setMinutes(newStartDate.getMinutes() + deltaMinutes);

        const newEndDate = new Date(this.originalEndDate);
        newEndDate.setMinutes(newEndDate.getMinutes() + deltaMinutes);

        await this.plugin.dataService.updateEntity(this.draggedTaskId, {
          startDate: newStartDate,
          dueDate: newEndDate
        });

        await this.render();
      }

      this.endTaskDrag();
      return;
    }

    // Handle resize end (save new duration)
    if (this.isResizingTask && this.draggedTaskId && this.originalStartDate && this.originalEndDate) {
      const deltaY = e.clientY - this.dragStartY;
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES;

      if (deltaMinutes !== 0) {
        if (this.resizeEdge === 'top') {
          const newStartDate = new Date(this.originalStartDate);
          newStartDate.setMinutes(newStartDate.getMinutes() + deltaMinutes);

          // Ensure start < end
          if (newStartDate < this.originalEndDate) {
            await this.plugin.dataService.updateEntity(this.draggedTaskId, {
              startDate: newStartDate
            });
          }
        } else if (this.resizeEdge === 'bottom') {
          const newEndDate = new Date(this.originalEndDate);
          newEndDate.setMinutes(newEndDate.getMinutes() + deltaMinutes);

          // Ensure end > start
          if (newEndDate > this.originalStartDate) {
            await this.plugin.dataService.updateEntity(this.draggedTaskId, {
              dueDate: newEndDate
            });
          }
        }

        await this.render();
      }

      this.endTaskResize();
      return;
    }
  }

  private endTaskDrag(): void {
    this.isDraggingTask = false;
    this.draggedTaskId = null;
    this.originalStartDate = null;
    this.originalEndDate = null;
    document.body.removeClass('is-dragging-task');
  }

  private endTaskResize(): void {
    this.isResizingTask = false;
    this.draggedTaskId = null;
    this.resizeEdge = null;
    this.originalStartDate = null;
    this.originalEndDate = null;
    document.body.removeClass('is-resizing-task');
  }

  private endConnectionDrag(): void {
    this.isDraggingConnection = false;
    this.dragStartTaskId = null;

    if (this.dragLine && this.svgLayer) {
      if (this.dragLine.parentNode === this.svgLayer) {
        this.svgLayer.removeChild(this.dragLine);
      }
      this.dragLine = null;
    }

    document.body.removeClass('is-dragging-connection');
  }

  private async createDependency(fromTaskId: string, toTaskId: string): Promise<void> {
    const task = this.plugin.dataService.getEntity(toTaskId) as Task | undefined;
    if (task && task.type === 'task') {
      if (this.wouldCreateCircularDependency(fromTaskId, toTaskId)) {
        console.warn('Cannot create circular dependency');
        return;
      }

      const dependencies = [...(task.dependencies || [])];
      if (!dependencies.includes(fromTaskId)) {
        dependencies.push(fromTaskId);
        await this.plugin.dataService.updateEntity(toTaskId, { dependencies });
        await this.render();
      }
    }
  }

  private wouldCreateCircularDependency(fromId: string, toId: string): boolean {
    const visited = new Set<string>();
    const checkDependencies = (taskId: string): boolean => {
      if (visited.has(taskId)) return false;
      if (taskId === toId) return true;
      visited.add(taskId);

      const task = this.plugin.dataService.getEntity(taskId) as Task | undefined;
      if (task?.dependencies) {
        for (const depId of task.dependencies) {
          if (checkDependencies(depId)) return true;
        }
      }
      return false;
    };

    return checkDependencies(fromId);
  }

  private renderDependencyLines(): void {
    if (!this.svgLayer) return;

    const children = Array.from(this.svgLayer.children);
    children.forEach(child => {
      if (!child.classList.contains('dependency-drag-line')) {
        this.svgLayer?.removeChild(child);
      }
    });

    const items = this.plugin.dataService.getTimelineItems();
    const allTasks = this.getTasksOnly(items);

    allTasks.forEach(task => {
      const taskEntity = this.plugin.dataService.getEntity(task.id) as Task | undefined;
      if (taskEntity?.dependencies) {
        taskEntity.dependencies.forEach(depId => {
          this.drawDependencyLine(depId, task.id);
        });
      }
    });
  }

  private drawDependencyLine(fromId: string, toId: string): void {
    const fromEl = this.taskElements.get(fromId);
    const toEl = this.taskElements.get(toId);

    if (!fromEl || !toEl || !this.svgLayer) return;

    const containerRect = this.svgLayer.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const x1 = fromRect.right - containerRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
    const x2 = toRect.left - containerRect.left;
    const y2 = toRect.top + toRect.height / 2 - containerRect.top;

    const markerId = `arrowhead-${fromId}-${toId}`.replace(/[^a-zA-Z0-9-]/g, '');
    let defs = this.svgLayer.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svgLayer.appendChild(defs);
    }

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');

    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrowPath.setAttribute('fill', 'var(--text-muted)');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midX = (x1 + x2) / 2;
    const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

    line.setAttribute('d', path);
    line.setAttribute('class', 'dependency-line');
    line.setAttribute('marker-end', `url(#${markerId})`);

    this.svgLayer.appendChild(line);
  }

  private renderEmptyState(container: HTMLElement): void {
    const emptyState = container.createDiv({ cls: 'week-empty-state' });
    emptyState.createEl('p', { text: 'No tasks scheduled for this week.' });
    emptyState.createEl('p', { text: 'Create a project to add tasks!' });

    const createBtn = emptyState.createEl('button', {
      text: 'Create Project',
      cls: 'mod-cta'
    });
    createBtn.addEventListener('click', () => {
      this.plugin.createNewEntity('project');
    });
  }

  // ==================== Helper Methods ====================

  private formatTime(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes.toString().padStart(2, '0');
    return `${h}:${m} ${ampm}`;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getWeekDays(): DayColumn[] {
    const days: DayColumn[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);

      days.push({
        date,
        dayName: DAY_NAMES[i],
        dayNumber: date.getDate(),
        isToday: date.getTime() === today.getTime()
      });
    }

    return days;
  }

  private navigateWeek(direction: number): void {
    this.currentWeekStart.setDate(this.currentWeekStart.getDate() + (direction * 7));
    this.render();
  }

  private goToToday(): void {
    this.currentWeekStart = this.getWeekStart(new Date());
    this.render();
  }

  private formatDateRange(start: Date, end: Date): string {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }
}
