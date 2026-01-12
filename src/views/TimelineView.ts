import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { TimelineItem, Task } from '../models/types';
import { Logger } from '../utils/Logger';

export const TIMELINE_VIEW_TYPE = 'timeline-viewer-timeline';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SNAP_MINUTES = 15;
const HOUR_HEIGHT = 48;
const TIME_COLUMN_WIDTH = 60;
const DAY_WIDTH_MONTH = 30;
const DAY_WIDTH_YEAR = 4;

// Time scale types
type TimeScale = 'day' | '3days' | 'week' | 'month' | 'year' | 'timeline' | 'swimlane';

// Project color palette
const PROJECT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

interface DayColumn {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  monthName?: string;
}

export class TimelineView extends ItemView {
  plugin: TimelineViewerPlugin;
  private viewContentEl: HTMLElement;
  private currentDate: Date;
  private currentScale: TimeScale = 'week';
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
    this.currentDate = new Date();
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
    Logger.info('TimelineView.onOpen() - START');
    this.viewContentEl = this.containerEl.children[1] as HTMLElement;
    this.viewContentEl.empty();
    this.viewContentEl.addClass('timeline-viewer-container');

    this.registerDomEvent(document, 'mousemove', this.handleGlobalMouseMove.bind(this));
    this.registerDomEvent(document, 'mouseup', this.handleGlobalMouseUp.bind(this));

    // Refresh data cache before rendering to ensure we have latest data
    Logger.debug('TimelineView.onOpen() - Refreshing data cache...');
    await this.plugin.dataService.refreshCache();

    await this.render();
    Logger.success('TimelineView.onOpen() - END');
  }

  async onClose(): Promise<void> {
    this.viewContentEl.empty();
  }

  async render(): Promise<void> {
    Logger.info(`TimelineView.render() - START (scale: ${this.currentScale})`);
    this.viewContentEl.empty();
    this.taskElements.clear();
    this.projectColors.clear();

    this.buildProjectColors();
    this.renderHeader();

    const mainContainer = this.viewContentEl.createDiv({ cls: 'week-main-container' });
    const calendarContainer = mainContainer.createDiv({ cls: 'week-calendar' });

    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.addClass('dependency-svg-layer');
    calendarContainer.appendChild(this.svgLayer);

    // Render based on current scale
    switch (this.currentScale) {
      case 'day':
        this.renderDayView(calendarContainer);
        break;
      case '3days':
        this.render3DaysView(calendarContainer);
        break;
      case 'week':
        this.renderWeekView(calendarContainer);
        break;
      case 'month':
        this.renderMonthView(calendarContainer);
        break;
      case 'year':
        this.renderYearView(calendarContainer);
        break;
      case 'timeline':
        this.renderTimelineView(calendarContainer);
        break;
    }

    this.renderLegend(mainContainer);
    setTimeout(() => this.renderDependencyLines(), 100);
    Logger.success(`TimelineView.render() - END (taskElements: ${this.taskElements.size})`);
  }

  private async renderPreservingScroll(): Promise<void> {
    const scrollWrapper = this.viewContentEl.querySelector('.week-timegrid-wrapper') as HTMLElement | null;
    const savedScrollTop = scrollWrapper?.scrollTop ?? 0;
    const savedScrollLeft = scrollWrapper?.scrollLeft ?? 0;

    await this.render();

    const newScrollWrapper = this.viewContentEl.querySelector('.week-timegrid-wrapper') as HTMLElement | null;
    if (newScrollWrapper) {
      newScrollWrapper.scrollTop = savedScrollTop;
      newScrollWrapper.scrollLeft = savedScrollLeft;
    }
  }

  private buildProjectColors(): void {
    Logger.info('buildProjectColors() - START');
    const items = this.plugin.dataService.getTimelineItems();
    Logger.debug(`buildProjectColors() - Got ${items.length} timeline items`);
    let colorIndex = 0;
    items.forEach(item => {
      Logger.debug(`buildProjectColors() - Item: "${item.title}" (type: ${item.type}, children: ${item.children?.length || 0})`);
      if (item.type === 'project') {
        this.projectColors.set(item.id, PROJECT_COLORS[colorIndex % PROJECT_COLORS.length]);
        colorIndex++;
      }
    });
    Logger.success(`buildProjectColors() - END (${this.projectColors.size} projects)`);
  }

  private getTaskColor(task: TimelineItem): string {
    // First try to use projectId from the TimelineItem directly (for child tasks)
    if (task.projectId) {
      const color = this.projectColors.get(task.projectId);
      if (color) {
        Logger.debug(`getTaskColor() - Task "${task.title}" using projectId ${task.projectId} -> ${color}`);
        return color;
      }
    }
    // Fallback: lookup from cache
    const taskEntity = this.plugin.dataService.getEntity(task.id) as Task | undefined;
    if (taskEntity?.projectId) {
      const color = this.projectColors.get(taskEntity.projectId);
      if (color) {
        Logger.debug(`getTaskColor() - Task "${task.title}" using cached projectId ${taskEntity.projectId} -> ${color}`);
        return color;
      }
    }
    Logger.debug(`getTaskColor() - Task "${task.title}" using default color`);
    return 'var(--interactive-accent)';
  }

  private renderHeader(): void {
    const header = this.viewContentEl.createDiv({ cls: 'timeline-header' });

    // Title and scale selector row
    const titleRow = header.createDiv({ cls: 'timeline-title-row' });
    titleRow.createEl('h2', { text: 'Timeline' });

    // Scale selector
    const scaleSelector = titleRow.createDiv({ cls: 'scale-selector' });
    const scales: { key: TimeScale; label: string }[] = [
      { key: 'day', label: 'Day' },
      { key: '3days', label: '3 Days' },
      { key: 'week', label: 'Week' },
      { key: 'month', label: 'Month' },
      { key: 'year', label: 'Year' },
      { key: 'timeline', label: 'Timeline' },
    ];

    scales.forEach(scale => {
      const btn = scaleSelector.createEl('button', {
        cls: `scale-btn ${this.currentScale === scale.key ? 'is-active' : ''}`,
        text: scale.label
      });
      btn.addEventListener('click', () => this.setScale(scale.key));
    });

    // Navigation controls
    const nav = header.createDiv({ cls: 'week-nav' });

    const prevBtn = nav.createEl('button', { cls: 'week-nav-btn', text: '‹' });
    prevBtn.setAttribute('aria-label', 'Previous');
    prevBtn.addEventListener('click', () => this.navigate(-1));

    const dateRange = nav.createDiv({ cls: 'week-date-range' });
    dateRange.setText(this.getDateRangeText());

    const todayBtn = nav.createEl('button', { cls: 'week-nav-btn week-today-btn', text: 'Today' });
    todayBtn.addEventListener('click', () => this.goToToday());

    const nextBtn = nav.createEl('button', { cls: 'week-nav-btn', text: '›' });
    nextBtn.setAttribute('aria-label', 'Next');
    nextBtn.addEventListener('click', () => this.navigate(1));

    // Action buttons - always show both
    const actionBtns = header.createDiv({ cls: 'timeline-action-btns' });

    const addProjectBtn = actionBtns.createEl('button', { cls: 'mod-cta', text: '+ Project' });
    addProjectBtn.addEventListener('click', () => this.plugin.createNewEntity('project'));

    const addTaskBtn = actionBtns.createEl('button', { cls: 'week-add-btn', text: '+ Task' });
    addTaskBtn.addEventListener('click', () => this.plugin.createNewEntity('task'));
  }

  private setScale(scale: TimeScale): void {
    this.currentScale = scale;
    this.render();
  }

  private navigate(direction: number): void {
    switch (this.currentScale) {
      case 'day':
        this.currentDate.setDate(this.currentDate.getDate() + direction);
        break;
      case '3days':
        this.currentDate.setDate(this.currentDate.getDate() + (direction * 3));
        break;
      case 'week':
        this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
        break;
      case 'month':
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        break;
      case 'year':
        this.currentDate.setFullYear(this.currentDate.getFullYear() + direction);
        break;
      case 'timeline':
      case 'swimlane':
        this.currentDate.setMonth(this.currentDate.getMonth() + (direction * 3));
        break;
    }
    this.render();
  }

  private goToToday(): void {
    this.currentDate = new Date();
    this.render();
  }

  private getDateRangeText(): string {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const optsWithYear: Intl.DateTimeFormatOptions = { ...opts, year: 'numeric' };

    switch (this.currentScale) {
      case 'day':
        return this.currentDate.toLocaleDateString('en-US', { weekday: 'long', ...optsWithYear });
      case '3days': {
        const end = new Date(this.currentDate);
        end.setDate(end.getDate() + 2);
        return `${this.currentDate.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', optsWithYear)}`;
      }
      case 'week': {
        const start = this.getWeekStart(this.currentDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', optsWithYear)}`;
      }
      case 'month':
        return this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'year':
        return String(this.currentDate.getFullYear());
      case 'timeline':
        return `${this.currentDate.getFullYear()} Timeline`;
    }
  }

  // ==================== DAY VIEW ====================
  private renderDayView(container: HTMLElement): void {
    const days = [this.createDayColumn(this.currentDate)];
    const tasks = this.getTasksForDays(days);
    this.renderTimeGrid(container, days, tasks, 1);
  }

  // ==================== 3 DAYS VIEW ====================
  private render3DaysView(container: HTMLElement): void {
    const days: DayColumn[] = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(this.currentDate);
      date.setDate(date.getDate() + i);
      days.push(this.createDayColumn(date));
    }
    const tasks = this.getTasksForDays(days);
    this.renderTimeGrid(container, days, tasks, 3);
  }

  // ==================== WEEK VIEW ====================
  private renderWeekView(container: HTMLElement): void {
    Logger.info('renderWeekView() - START');
    const weekStart = this.getWeekStart(this.currentDate);
    Logger.debug(`renderWeekView() - Week starts on: ${weekStart.toISOString()}`);
    const days: DayColumn[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      days.push(this.createDayColumn(date));
    }
    const tasks = this.getTasksForDays(days);
    Logger.debug(`renderWeekView() - Got ${tasks.length} tasks for this week`);
    this.renderTimeGrid(container, days, tasks, 7);
    Logger.success('renderWeekView() - END');
  }

  // ==================== MONTH VIEW ====================
  private renderMonthView(container: HTMLElement): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const grid = container.createDiv({ cls: 'month-grid' });

    // Header with day names
    const headerRow = grid.createDiv({ cls: 'month-header-row' });
    DAY_NAMES.forEach(name => {
      headerRow.createDiv({ cls: 'month-header-cell', text: name });
    });

    // Calendar cells
    const calendarBody = grid.createDiv({ cls: 'month-body' });
    let currentWeek = calendarBody.createDiv({ cls: 'month-week-row' });

    // Padding for first week
    const startDayOfWeek = firstDay.getDay();
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.createDiv({ cls: 'month-day-cell month-day-empty' });
    }

    const items = this.plugin.dataService.getTimelineItems();
    const allTasks = this.getTasksOnly(items);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      if ((startDayOfWeek + day - 1) % 7 === 0 && day !== 1) {
        currentWeek = calendarBody.createDiv({ cls: 'month-week-row' });
      }

      const cellDate = new Date(year, month, day);
      const isToday = cellDate.getTime() === today.getTime();
      const cell = currentWeek.createDiv({
        cls: `month-day-cell ${isToday ? 'is-today' : ''}`
      });

      cell.createDiv({ cls: 'month-day-number', text: String(day) });

      // Find tasks for this day
      const dayTasks = allTasks.filter(task => {
        const taskStart = new Date(task.startDate);
        taskStart.setHours(0, 0, 0, 0);
        const taskEnd = new Date(task.endDate);
        taskEnd.setHours(23, 59, 59, 999);
        return cellDate >= taskStart && cellDate <= taskEnd;
      });

      const taskContainer = cell.createDiv({ cls: 'month-day-tasks' });
      dayTasks.slice(0, 3).forEach(task => {
        const taskDot = taskContainer.createDiv({ cls: 'month-task-dot' });
        taskDot.style.backgroundColor = this.getTaskColor(task);
        taskDot.setAttribute('title', task.title);
        this.taskElements.set(task.id, taskDot);
      });

      if (dayTasks.length > 3) {
        taskContainer.createDiv({ cls: 'month-task-more', text: `+${dayTasks.length - 3}` });
      }
    }

    // Empty state
    if (allTasks.length === 0) {
      this.renderEmptyState(container);
    }
  }

  // ==================== YEAR VIEW ====================
  private renderYearView(container: HTMLElement): void {
    const year = this.currentDate.getFullYear();
    const grid = container.createDiv({ cls: 'year-grid' });

    const items = this.plugin.dataService.getTimelineItems();
    const allTasks = this.getTasksOnly(items);

    for (let month = 0; month < 12; month++) {
      const monthCard = grid.createDiv({ cls: 'year-month-card' });
      monthCard.createDiv({ cls: 'year-month-name', text: MONTH_NAMES[month] });

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const miniCal = monthCard.createDiv({ cls: 'year-mini-calendar' });

      // Mini calendar header
      const miniHeader = miniCal.createDiv({ cls: 'year-mini-header' });
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
        miniHeader.createDiv({ cls: 'year-mini-day-name', text: d });
      });

      // Days
      const firstDayOfWeek = new Date(year, month, 1).getDay();
      const daysContainer = miniCal.createDiv({ cls: 'year-mini-days' });

      for (let i = 0; i < firstDayOfWeek; i++) {
        daysContainer.createDiv({ cls: 'year-mini-day year-mini-day-empty' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const isToday = cellDate.getTime() === today.getTime();

        const hasTask = allTasks.some(task => {
          const taskStart = new Date(task.startDate);
          taskStart.setHours(0, 0, 0, 0);
          const taskEnd = new Date(task.endDate);
          taskEnd.setHours(23, 59, 59, 999);
          return cellDate >= taskStart && cellDate <= taskEnd;
        });

        const dayEl = daysContainer.createDiv({
          cls: `year-mini-day ${isToday ? 'is-today' : ''} ${hasTask ? 'has-task' : ''}`
        });
        dayEl.setText(String(day));
      }
    }

    if (allTasks.length === 0) {
      this.renderEmptyState(container);
    }
  }

  // ==================== TIMELINE VIEW (Gantt-style) ====================
  private renderTimelineView(container: HTMLElement): void {
    const items = this.plugin.dataService.getTimelineItems();
    const allTasks = this.getTasksOnly(items);

    if (allTasks.length === 0) {
      this.renderEmptyState(container);
      return;
    }

    // Calculate date range
    let minDate = new Date();
    let maxDate = new Date();
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 3);

    allTasks.forEach(task => {
      if (task.startDate < minDate) minDate = new Date(task.startDate);
      if (task.endDate > maxDate) maxDate = new Date(task.endDate);
    });

    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = 20;

    const grid = container.createDiv({ cls: 'gantt-container' });

    // Header with months
    const header = grid.createDiv({ cls: 'gantt-header' });
    const taskNamesHeader = header.createDiv({ cls: 'gantt-task-names-header', text: 'Tasks' });
    const timelineHeader = header.createDiv({ cls: 'gantt-timeline-header' });
    timelineHeader.style.width = `${totalDays * dayWidth}px`;

    // Render month headers
    let currentMonth = -1;
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(minDate);
      date.setDate(date.getDate() + i);

      if (date.getMonth() !== currentMonth) {
        currentMonth = date.getMonth();
        const monthHeader = timelineHeader.createDiv({ cls: 'gantt-month-header' });
        monthHeader.setText(`${MONTH_NAMES[currentMonth]} ${date.getFullYear()}`);

        // Calculate width until next month or end
        let monthDays = 0;
        const checkDate = new Date(date);
        while (checkDate <= maxDate && checkDate.getMonth() === currentMonth) {
          monthDays++;
          checkDate.setDate(checkDate.getDate() + 1);
        }
        monthHeader.style.width = `${monthDays * dayWidth}px`;
      }
    }

    // Task rows
    const body = grid.createDiv({ cls: 'gantt-body' });
    const taskNames = body.createDiv({ cls: 'gantt-task-names' });
    const timelineBody = body.createDiv({ cls: 'gantt-timeline-body' });
    timelineBody.style.width = `${totalDays * dayWidth}px`;

    // Today line
    const today = new Date();
    const todayOffset = Math.ceil((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    if (todayOffset >= 0 && todayOffset <= totalDays) {
      const todayLine = timelineBody.createDiv({ cls: 'gantt-today-line' });
      todayLine.style.left = `${todayOffset * dayWidth}px`;
    }

    // Grid lines (weekly)
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(minDate);
      date.setDate(date.getDate() + i);
      if (date.getDay() === 0) {
        const gridLine = timelineBody.createDiv({ cls: 'gantt-grid-line' });
        gridLine.style.left = `${i * dayWidth}px`;
      }
    }

    // Render each task
    allTasks.forEach((task, index) => {
      const nameRow = taskNames.createDiv({ cls: 'gantt-task-name' });
      nameRow.setText(task.title);

      const timelineRow = timelineBody.createDiv({ cls: 'gantt-timeline-row' });

      const taskStart = Math.max(0, Math.ceil((task.startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
      const taskEnd = Math.ceil((task.endDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      const taskWidth = Math.max(taskEnd - taskStart, 1);

      const bar = timelineRow.createDiv({
        cls: `gantt-bar gantt-bar-${task.status}`,
        attr: { 'data-task-id': task.id }
      });
      bar.style.left = `${taskStart * dayWidth}px`;
      bar.style.width = `${taskWidth * dayWidth - 4}px`;
      bar.style.backgroundColor = this.getTaskColor(task);

      // Progress indicator
      if (task.progress > 0) {
        const progress = bar.createDiv({ cls: 'gantt-bar-progress' });
        progress.style.width = `${task.progress}%`;
      }

      bar.setAttribute('title', `${task.title}\n${task.startDate.toLocaleDateString()} - ${task.endDate.toLocaleDateString()}\nProgress: ${task.progress}%`);

      this.taskElements.set(task.id, bar);

      bar.addEventListener('click', () => this.plugin.openEntity(task.id));
    });
  }

  // ==================== SHARED TIME GRID (for day, 3days, week) ====================
  private renderTimeGrid(container: HTMLElement, days: DayColumn[], tasks: TimelineItem[], numDays: number): void {
    const grid = container.createDiv({ cls: 'week-grid' });

    // Header row
    const headerRow = grid.createDiv({ cls: 'week-header-row' });
    headerRow.createDiv({ cls: 'week-time-header' });

    days.forEach(day => {
      const cell = headerRow.createDiv({
        cls: `week-header-cell ${day.isToday ? 'is-today' : ''}`
      });
      cell.createDiv({ cls: 'week-day-name', text: day.dayName });
      cell.createDiv({ cls: 'week-day-number', text: String(day.dayNumber) });
    });

    // Time grid
    const timeGridWrapper = grid.createDiv({ cls: 'week-timegrid-wrapper' });
    this.timeGridEl = timeGridWrapper.createDiv({ cls: 'week-timegrid' });

    HOURS.forEach(hour => {
      const hourRow = this.timeGridEl!.createDiv({ cls: 'week-hour-row' });
      const timeLabel = hourRow.createDiv({ cls: 'week-time-cell' });
      const hourStr = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
      timeLabel.createSpan({ cls: 'week-hour-label', text: hourStr });

      days.forEach((day, dayIndex) => {
        const cell = hourRow.createDiv({
          cls: `week-hour-cell ${day.isToday ? 'is-today' : ''}`
        });
        cell.setAttribute('data-day-index', String(dayIndex));
        cell.setAttribute('data-hour', String(hour));
      });
    });

    this.renderTaskCards(this.timeGridEl!, days, tasks, numDays);
    this.renderCurrentTimeIndicator(this.timeGridEl!, days, numDays);

    if (tasks.length === 0) {
      this.renderEmptyState(container);
    }
  }

  private renderTaskCards(timeGrid: HTMLElement, days: DayColumn[], tasks: TimelineItem[], numDays: number): void {
    Logger.info(`renderTaskCards() - START (${tasks.length} tasks, ${numDays} days)`);
    tasks.forEach(task => {
      const dayIndex = days.findIndex(day => {
        const dayStart = new Date(day.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day.date);
        dayEnd.setHours(23, 59, 59, 999);
        return task.startDate >= dayStart && task.startDate <= dayEnd;
      });

      if (dayIndex === -1) {
        Logger.warn(`renderTaskCards() - Task "${task.title}" not in visible day range, skipping`);
        return;
      }
      Logger.debug(`renderTaskCards() - Rendering task "${task.title}" on day ${dayIndex}`);

      const card = timeGrid.createDiv({
        cls: `week-task-card week-task-card-${task.status}`,
        attr: { 'data-task-id': task.id }
      });

      const color = this.getTaskColor(task);
      card.style.borderLeftColor = color;
      card.style.setProperty('--task-color', color);

      const dayWidth = `calc((100% - ${TIME_COLUMN_WIDTH}px) / ${numDays})`;
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

      const cardHeader = card.createDiv({ cls: 'week-task-card-header' });
      cardHeader.createDiv({ cls: 'week-task-card-title', text: task.title });

      // Delete button
      const deleteBtn = cardHeader.createDiv({ cls: 'week-task-delete-btn', text: '×' });
      deleteBtn.setAttribute('title', 'Delete task');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (confirm(`Delete task "${task.title}"?`)) {
          Logger.info(`Deleting task: ${task.id}`);
          const success = await this.plugin.dataService.deleteEntity(task.id);
          if (success) {
            await this.render();
          }
        }
      });

      const timeStr = this.formatTime(task.startDate) + ' - ' + this.formatTime(task.endDate);
      card.createDiv({ cls: 'week-task-card-time', text: timeStr });

      // Resize handles
      const resizeTop = card.createDiv({ cls: 'resize-handle resize-handle-top' });
      const resizeBottom = card.createDiv({ cls: 'resize-handle resize-handle-bottom' });

      // Connection handles
      const leftHandle = card.createDiv({ cls: 'connection-handle connection-handle-left' });
      leftHandle.setAttribute('data-task-id', task.id);
      const rightHandle = card.createDiv({ cls: 'connection-handle connection-handle-right' });
      rightHandle.setAttribute('data-task-id', task.id);

      this.setupTaskDragHandlers(card, task, resizeTop, resizeBottom, rightHandle);
      this.taskElements.set(task.id, card);
    });
    Logger.success(`renderTaskCards() - END (rendered ${this.taskElements.size} task elements)`);
  }

  private renderCurrentTimeIndicator(timeGrid: HTMLElement, days: DayColumn[], numDays: number): void {
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
    const dayWidth = `calc((100% - ${TIME_COLUMN_WIDTH}px) / ${numDays})`;
    dot.style.left = `calc(${todayIndex} * ${dayWidth})`;
  }

  // ==================== LEGEND ====================
  private renderLegend(container: HTMLElement): void {
    const legend = container.createDiv({ cls: 'week-legend' });
    legend.createEl('h4', { text: 'Projects' });

    const items = this.plugin.dataService.getTimelineItems();
    const projects = items.filter(item => item.type === 'project');

    if (projects.length === 0) {
      legend.createDiv({ cls: 'week-legend-empty', text: 'No projects yet' });

      const createBtn = legend.createEl('button', {
        cls: 'week-legend-create-btn',
        text: '+ Create Project'
      });
      createBtn.addEventListener('click', () => this.plugin.createNewEntity('project'));
      return;
    }

    projects.forEach(project => {
      const item = legend.createDiv({ cls: 'week-legend-item' });
      const color = this.projectColors.get(project.id) || 'var(--text-muted)';
      const dot = item.createDiv({ cls: 'week-legend-dot' });
      dot.style.backgroundColor = color;
      item.createSpan({ text: project.title });
    });

    // Always show create project option
    const createBtn = legend.createEl('button', {
      cls: 'week-legend-create-btn',
      text: '+ Add Project'
    });
    createBtn.addEventListener('click', () => this.plugin.createNewEntity('project'));
  }

  // ==================== DEPENDENCY LINES ====================
  private renderDependencyLines(): void {
    if (!this.svgLayer) return;

    // Clear existing lines (except drag line)
    Array.from(this.svgLayer.children).forEach(child => {
      if (!child.classList.contains('dependency-drag-line')) {
        this.svgLayer?.removeChild(child);
      }
    });

    // Add defs for markers
    let defs = this.svgLayer.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svgLayer.appendChild(defs);
    }

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

    // Check if elements are visible
    if (fromRect.width === 0 || toRect.width === 0) return;

    const x1 = fromRect.right - containerRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
    const x2 = toRect.left - containerRect.left;
    const y2 = toRect.top + toRect.height / 2 - containerRect.top;

    // Create unique marker
    const markerId = `arrow-${fromId}-${toId}`.replace(/[^a-zA-Z0-9-]/g, '-');

    let defs = this.svgLayer.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svgLayer.appendChild(defs);
    }

    // Check if marker already exists
    if (!defs.querySelector(`#${markerId}`)) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', markerId);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '8');
      marker.setAttribute('orient', 'auto-start-reverse');

      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      arrowPath.setAttribute('fill', 'var(--text-accent)');
      marker.appendChild(arrowPath);
      defs.appendChild(marker);
    }

    // Draw curved path
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midX = (x1 + x2) / 2;
    const controlOffset = Math.min(Math.abs(x2 - x1) / 2, 50);

    const path = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
    line.setAttribute('d', path);
    line.setAttribute('class', 'dependency-line');
    line.setAttribute('marker-end', `url(#${markerId})`);
    line.setAttribute('data-from', fromId);
    line.setAttribute('data-to', toId);

    this.svgLayer.appendChild(line);
  }

  // ==================== EMPTY STATE ====================
  private renderEmptyState(container: HTMLElement): void {
    const emptyState = container.createDiv({ cls: 'week-empty-state' });
    emptyState.createEl('p', { text: 'No tasks scheduled for this period.' });
    emptyState.createEl('p', { text: 'Create a project to get started!' });

    const btnContainer = emptyState.createDiv({ cls: 'empty-state-buttons' });

    const createProjectBtn = btnContainer.createEl('button', {
      text: 'Create Project',
      cls: 'mod-cta'
    });
    createProjectBtn.addEventListener('click', () => this.plugin.createNewEntity('project'));

    const createTaskBtn = btnContainer.createEl('button', {
      text: 'Create Task'
    });
    createTaskBtn.addEventListener('click', () => this.plugin.createNewEntity('task'));
  }

  // ==================== DRAG HANDLERS ====================
  private setupTaskDragHandlers(
    card: HTMLElement,
    task: TimelineItem,
    resizeTop: HTMLElement,
    resizeBottom: HTMLElement,
    rightHandle: HTMLElement
  ): void {
    card.addEventListener('click', (e) => {
      if (!this.isDraggingTask && !this.isResizingTask && !this.isDraggingConnection) {
        e.stopPropagation();
        this.plugin.openEntity(task.id);
      }
    });

    card.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('resize-handle') || target.classList.contains('connection-handle')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      this.startTaskDrag(task.id, e);
    });

    resizeTop.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startTaskResize(task.id, 'top', e);
    });

    resizeBottom.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startTaskResize(task.id, 'bottom', e);
    });

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
    if (this.isDraggingConnection && this.dragLine && this.svgLayer) {
      const containerRect = this.svgLayer.getBoundingClientRect();
      this.dragLine.setAttribute('x2', String(e.clientX - containerRect.left));
      this.dragLine.setAttribute('y2', String(e.clientY - containerRect.top));
      return;
    }

    if (this.isDraggingTask && this.draggedTaskId && this.originalStartDate && this.originalEndDate) {
      const deltaY = e.clientY - this.dragStartY;
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES;

      const taskEl = this.taskElements.get(this.draggedTaskId);
      if (taskEl) {
        const newStartDate = new Date(this.originalStartDate);
        newStartDate.setMinutes(newStartDate.getMinutes() + deltaMinutes);

        const topPosition = (newStartDate.getHours() * HOUR_HEIGHT) + (newStartDate.getMinutes() / 60 * HOUR_HEIGHT);
        taskEl.style.top = `${topPosition}px`;
      }
      return;
    }

    if (this.isResizingTask && this.draggedTaskId && this.originalStartDate && this.originalEndDate) {
      const deltaY = e.clientY - this.dragStartY;
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES;

      const taskEl = this.taskElements.get(this.draggedTaskId);
      if (taskEl) {
        // Calculate original positions from dates, not from DOM (which may be stale)
        const originalTop = (this.originalStartDate.getHours() * HOUR_HEIGHT) + (this.originalStartDate.getMinutes() / 60 * HOUR_HEIGHT);
        const originalDuration = (this.originalEndDate.getTime() - this.originalStartDate.getTime()) / 60000;
        const originalHeight = (originalDuration / 60) * HOUR_HEIGHT;

        if (this.resizeEdge === 'top') {
          const newStartDate = new Date(this.originalStartDate);
          newStartDate.setMinutes(newStartDate.getMinutes() + deltaMinutes);

          const topPosition = (newStartDate.getHours() * HOUR_HEIGHT) + (newStartDate.getMinutes() / 60 * HOUR_HEIGHT);
          const originalBottom = originalTop + originalHeight;
          const newHeight = originalBottom - topPosition;

          if (newHeight >= HOUR_HEIGHT / 4 && newStartDate < this.originalEndDate) {
            taskEl.style.top = `${topPosition}px`;
            taskEl.style.height = `${newHeight}px`;
          }
        } else if (this.resizeEdge === 'bottom') {
          const newDuration = originalDuration + deltaMinutes;

          if (newDuration >= 15) {
            const newHeight = (newDuration / 60) * HOUR_HEIGHT;
            taskEl.style.height = `${newHeight}px`;
          }
        }
      }
      return;
    }
  }

  private async handleGlobalMouseUp(e: MouseEvent): Promise<void> {
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

        await this.renderPreservingScroll();
      }

      this.endTaskDrag();
      return;
    }

    if (this.isResizingTask && this.draggedTaskId && this.originalStartDate && this.originalEndDate) {
      const deltaY = e.clientY - this.dragStartY;
      const deltaMinutes = Math.round(deltaY / (HOUR_HEIGHT / 60) / SNAP_MINUTES) * SNAP_MINUTES;

      if (deltaMinutes !== 0) {
        if (this.resizeEdge === 'top') {
          const newStartDate = new Date(this.originalStartDate);
          newStartDate.setMinutes(newStartDate.getMinutes() + deltaMinutes);

          if (newStartDate < this.originalEndDate) {
            await this.plugin.dataService.updateEntity(this.draggedTaskId, {
              startDate: newStartDate
            });
          }
        } else if (this.resizeEdge === 'bottom') {
          const newEndDate = new Date(this.originalEndDate);
          newEndDate.setMinutes(newEndDate.getMinutes() + deltaMinutes);

          if (newEndDate > this.originalStartDate) {
            await this.plugin.dataService.updateEntity(this.draggedTaskId, {
              dueDate: newEndDate
            });
          }
        }

        await this.renderPreservingScroll();
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
        await this.renderPreservingScroll();
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

  // ==================== HELPERS ====================
  private createDayColumn(date: Date): DayColumn {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return {
      date: new Date(date),
      dayName: DAY_NAMES[date.getDay()],
      dayNumber: date.getDate(),
      isToday: checkDate.getTime() === today.getTime(),
      monthName: MONTH_NAMES[date.getMonth()]
    };
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getTasksForDays(days: DayColumn[]): TimelineItem[] {
    Logger.info(`getTasksForDays() - START (${days.length} days)`);
    const items = this.plugin.dataService.getTimelineItems();
    Logger.debug(`getTasksForDays() - Got ${items.length} timeline items from dataService`);
    const allTasks = this.getTasksOnly(items);
    Logger.debug(`getTasksForDays() - Extracted ${allTasks.length} tasks total`);

    const startOfRange = new Date(days[0].date);
    startOfRange.setHours(0, 0, 0, 0);
    const endOfRange = new Date(days[days.length - 1].date);
    endOfRange.setHours(23, 59, 59, 999);

    Logger.debug(`getTasksForDays() - Date range: ${startOfRange.toISOString()} to ${endOfRange.toISOString()}`);

    const filteredTasks = allTasks.filter(task => {
      const inRange = task.startDate <= endOfRange && task.endDate >= startOfRange;
      Logger.debug(`getTasksForDays() - Task "${task.title}": ${task.startDate.toISOString()} to ${task.endDate.toISOString()} - inRange: ${inRange}`);
      return inRange;
    });

    Logger.success(`getTasksForDays() - END (${filteredTasks.length} tasks in range)`);
    return filteredTasks;
  }

  private getTasksOnly(items: TimelineItem[]): TimelineItem[] {
    Logger.debug(`getTasksOnly() - Processing ${items.length} items`);
    const tasks: TimelineItem[] = [];
    items.forEach(item => {
      if (item.type === 'task') {
        Logger.debug(`getTasksOnly() - Found standalone task: "${item.title}"`);
        tasks.push(item);
      }
      if (item.children) {
        Logger.debug(`getTasksOnly() - Project "${item.title}" has ${item.children.length} child tasks`);
        item.children.forEach(child => {
          Logger.debug(`getTasksOnly() - Child task: "${child.title}"`);
        });
        tasks.push(...item.children);
      }
    });
    Logger.debug(`getTasksOnly() - Total tasks extracted: ${tasks.length}`);
    return tasks;
  }

  private formatTime(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes.toString().padStart(2, '0');
    return `${h}:${m} ${ampm}`;
  }
}
