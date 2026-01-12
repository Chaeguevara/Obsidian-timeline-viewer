import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { TimelineItem } from '../models/types';
import {
  isMobile,
  createSwipeHandler,
  createPinchHandler,
  createLongPressHandler,
  hapticFeedback,
  preventPullToRefresh
} from '../utils/mobile';

export const TIMELINE_VIEW_TYPE = 'timeline-viewer-timeline';

type TimelineScale = 'day' | 'week' | 'month';

export class TimelineView extends ItemView {
  plugin: TimelineViewerPlugin;
  private contentEl: HTMLElement;
  private timelineContainer: HTMLElement | null = null;
  private currentScale: TimelineScale = 'week';
  private currentOffset: number = 0; // Navigation offset
  private cleanupFunctions: (() => void)[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentScale = plugin.settings.timelineScale;
  }

  getViewType(): string {
    return TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Timeline';
  }

  getIcon(): string {
    return 'gantt-chart';
  }

  async onOpen(): Promise<void> {
    this.contentEl = this.containerEl.children[1] as HTMLElement;
    this.contentEl.empty();
    this.contentEl.addClass('timeline-viewer-container');

    await this.render();
  }

  async onClose(): Promise<void> {
    // Cleanup touch handlers
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    this.contentEl.empty();
  }

  async render(): Promise<void> {
    // Cleanup previous handlers
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];

    this.contentEl.empty();

    // Header
    const header = this.contentEl.createDiv({ cls: 'timeline-header' });
    header.createEl('h2', { text: 'Timeline View' });

    // Controls
    const controls = header.createDiv({ cls: 'timeline-controls' });

    // Navigation buttons (visible on mobile)
    if (isMobile()) {
      const prevBtn = controls.createEl('button', { cls: 'timeline-nav-btn', text: '←' });
      prevBtn.addEventListener('click', () => this.navigate(-1));

      const todayBtn = controls.createEl('button', { cls: 'timeline-nav-btn', text: 'Today' });
      todayBtn.addEventListener('click', () => this.navigateToToday());
    }

    const scaleSelect = controls.createEl('select', { cls: 'timeline-scale-select' });
    (['day', 'week', 'month'] as TimelineScale[]).forEach(scale => {
      const option = scaleSelect.createEl('option', { text: scale.charAt(0).toUpperCase() + scale.slice(1) });
      option.value = scale;
      if (scale === this.currentScale) {
        option.selected = true;
      }
    });
    scaleSelect.addEventListener('change', () => {
      this.currentScale = scaleSelect.value as TimelineScale;
      this.currentOffset = 0;
      this.renderTimeline();
    });

    if (isMobile()) {
      const nextBtn = controls.createEl('button', { cls: 'timeline-nav-btn', text: '→' });
      nextBtn.addEventListener('click', () => this.navigate(1));
    }

    // Swipe hint for mobile
    if (isMobile()) {
      const swipeHint = this.contentEl.createDiv({ cls: 'timeline-swipe-hint' });
      swipeHint.setText('← Swipe to navigate • Pinch to zoom →');
    }

    // Timeline container
    this.timelineContainer = this.contentEl.createDiv({ cls: 'timeline-content' });

    // Setup touch gestures
    this.setupTouchGestures();

    this.renderTimeline();

    // Add FAB for mobile
    if (isMobile()) {
      this.addFloatingActionButton();
    }
  }

  private setupTouchGestures(): void {
    if (!this.timelineContainer) return;

    // Prevent pull-to-refresh interference
    const preventPTR = preventPullToRefresh(this.timelineContainer);
    this.cleanupFunctions.push(preventPTR);

    // Horizontal swipe for navigation
    const swipeCleanup = createSwipeHandler(
      this.timelineContainer,
      (result) => {
        if (result.direction === 'left') {
          hapticFeedback('light');
          this.navigate(1);
        } else if (result.direction === 'right') {
          hapticFeedback('light');
          this.navigate(-1);
        }
      },
      { horizontal: true }
    );
    this.cleanupFunctions.push(swipeCleanup);

    // Pinch to change scale
    const scales: TimelineScale[] = ['day', 'week', 'month'];
    let lastScale = 1;

    const pinchCleanup = createPinchHandler(
      this.timelineContainer,
      (scale) => {
        const scaleChange = scale - lastScale;

        // Zoom out (pinch in) -> larger time scale
        // Zoom in (pinch out) -> smaller time scale
        if (Math.abs(scaleChange) > 0.3) {
          const currentIndex = scales.indexOf(this.currentScale);

          if (scaleChange < -0.3 && currentIndex < scales.length - 1) {
            // Pinch in -> zoom out -> larger scale (week -> month)
            this.currentScale = scales[currentIndex + 1];
            hapticFeedback('medium');
            this.renderTimeline();
            lastScale = scale;
          } else if (scaleChange > 0.3 && currentIndex > 0) {
            // Pinch out -> zoom in -> smaller scale (month -> week)
            this.currentScale = scales[currentIndex - 1];
            hapticFeedback('medium');
            this.renderTimeline();
            lastScale = scale;
          }
        }
      },
      { minScale: 0.5, maxScale: 2 }
    );
    this.cleanupFunctions.push(pinchCleanup);
  }

  private navigate(direction: number): void {
    this.currentOffset += direction;
    this.renderTimeline();
  }

  private navigateToToday(): void {
    this.currentOffset = 0;
    hapticFeedback('light');
    this.renderTimeline();
  }

  private addFloatingActionButton(): void {
    const fab = this.contentEl.createEl('button', { cls: 'tv-fab' });
    fab.setText('+');
    fab.setAttribute('aria-label', 'Create new project');

    // Long press for menu, tap for quick create
    const longPressCleanup = createLongPressHandler(fab, () => {
      hapticFeedback('medium');
      this.showQuickCreateMenu(fab);
    });
    this.cleanupFunctions.push(longPressCleanup);

    fab.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('project');
    });
  }

  private showQuickCreateMenu(anchor: HTMLElement): void {
    // Simple menu - could be enhanced with a proper modal
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'tv-quick-menu';
    menu.style.cssText = `
      position: fixed;
      bottom: ${window.innerHeight - rect.top + 8}px;
      right: 16px;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 8px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 101;
    `;

    const options: { label: string; type: 'goal' | 'portfolio' | 'project' | 'task' }[] = [
      { label: '🎯 Goal', type: 'goal' },
      { label: '📁 Portfolio', type: 'portfolio' },
      { label: '📋 Project', type: 'project' },
      { label: '☐ Task', type: 'task' }
    ];

    options.forEach(({ label, type }) => {
      const item = menu.createEl('div', {
        text: label,
        cls: 'tv-quick-menu-item'
      });
      item.style.cssText = `
        padding: 12px 16px;
        min-height: 44px;
        display: flex;
        align-items: center;
        cursor: pointer;
      `;
      item.addEventListener('click', () => {
        hapticFeedback('light');
        this.plugin.createNewEntity(type);
        menu.remove();
      });
    });

    document.body.appendChild(menu);

    // Remove on outside click
    const removeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 100);
  }

  private renderTimeline(): void {
    if (!this.timelineContainer) return;

    this.timelineContainer.empty();

    // Update scale select if exists
    const scaleSelect = this.contentEl.querySelector('.timeline-scale-select') as HTMLSelectElement;
    if (scaleSelect) {
      scaleSelect.value = this.currentScale;
    }

    // Get items from data service
    const items = this.plugin.dataService.getTimelineItems();

    if (items.length === 0) {
      this.renderEmptyState(this.timelineContainer);
      return;
    }

    // Create timeline grid
    const grid = this.timelineContainer.createDiv({ cls: 'timeline-grid' });

    // Determine number of columns based on device
    const columnCount = isMobile() ? 7 : 12;

    // Render header row with dates
    this.renderTimelineHeader(grid, columnCount);

    // Render items
    items.forEach(item => {
      this.renderTimelineItem(grid, item, columnCount);
    });
  }

  private renderEmptyState(container: HTMLElement): void {
    const emptyState = container.createDiv({ cls: 'timeline-empty-state' });
    emptyState.createEl('p', { text: 'No projects or tasks found.' });
    emptyState.createEl('p', { text: 'Create your first project to get started!' });

    const createBtn = emptyState.createEl('button', {
      text: 'Create Project',
      cls: 'mod-cta'
    });
    createBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('project');
    });
  }

  private renderTimelineHeader(grid: HTMLElement, columnCount: number): void {
    const headerRow = grid.createDiv({ cls: 'timeline-header-row' });

    // Label column
    headerRow.createDiv({ cls: 'timeline-label-cell', text: 'Item' });

    // Date columns
    const periods = this.getTimePeriods(columnCount);
    periods.forEach(period => {
      const cell = headerRow.createDiv({ cls: 'timeline-date-cell', text: period.label });

      // Highlight today/current period
      if (period.isCurrent) {
        cell.addClass('timeline-date-current');
      }
    });

    // Update grid template
    grid.style.gridTemplateColumns = `${isMobile() ? '120px' : '150px'} repeat(${columnCount}, minmax(${isMobile() ? '50px' : '60px'}, 1fr))`;
  }

  private renderTimelineItem(grid: HTMLElement, item: TimelineItem, columnCount: number): void {
    const row = grid.createDiv({ cls: `timeline-row timeline-row-${item.type}` });

    // Label with touch feedback
    const label = row.createDiv({ cls: 'timeline-label-cell' });
    const titleSpan = label.createSpan({ text: item.title, cls: 'timeline-item-title' });

    // Long press to open, tap for details
    const longPressCleanup = createLongPressHandler(titleSpan, () => {
      hapticFeedback('medium');
      this.plugin.openEntity(item.id);
    });
    this.cleanupFunctions.push(longPressCleanup);

    titleSpan.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.openEntity(item.id);
    });

    // Timeline bar area
    const barArea = row.createDiv({ cls: 'timeline-bar-area' });
    barArea.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;

    // Calculate bar position and width
    const periods = this.getTimePeriods(columnCount);
    const { startCol, endCol } = this.calculateBarPosition(item, periods);

    if (startCol >= 0 && endCol >= 0) {
      const bar = barArea.createDiv({
        cls: `timeline-bar timeline-bar-${item.status}`,
      });
      bar.style.gridColumnStart = String(startCol + 1);
      bar.style.gridColumnEnd = String(endCol + 2);

      // Progress indicator
      const progress = bar.createDiv({ cls: 'timeline-bar-progress' });
      progress.style.width = `${item.progress}%`;

      // Touch feedback for bar
      bar.addEventListener('click', () => {
        hapticFeedback('light');
        this.plugin.openEntity(item.id);
      });
    }
  }

  private getTimePeriods(count: number): { start: Date; end: Date; label: string; isCurrent: boolean }[] {
    const periods: { start: Date; end: Date; label: string; isCurrent: boolean }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = 0; i < count; i++) {
      const offsetIndex = i + this.currentOffset * count;
      const start = new Date(now);
      const end = new Date(now);
      let label = '';
      let isCurrent = false;

      switch (this.currentScale) {
        case 'day':
          start.setDate(now.getDate() + offsetIndex);
          end.setDate(now.getDate() + offsetIndex);
          label = `${start.getMonth() + 1}/${start.getDate()}`;
          isCurrent = start.getTime() === today.getTime();
          break;
        case 'week':
          start.setDate(now.getDate() + (offsetIndex * 7));
          end.setDate(now.getDate() + (offsetIndex * 7) + 6);
          label = `W${this.getWeekNumber(start)}`;
          isCurrent = today >= start && today <= end;
          break;
        case 'month':
          start.setMonth(now.getMonth() + offsetIndex, 1);
          end.setMonth(now.getMonth() + offsetIndex + 1, 0);
          label = start.toLocaleDateString('en-US', { month: 'short' });
          isCurrent = now.getMonth() === start.getMonth() && now.getFullYear() === start.getFullYear();
          break;
      }

      periods.push({ start, end, label, isCurrent });
    }

    return periods;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private calculateBarPosition(
    item: TimelineItem,
    periods: { start: Date; end: Date; label: string; isCurrent: boolean }[]
  ): { startCol: number; endCol: number } {
    let startCol = -1;
    let endCol = -1;

    const itemStart = item.startDate.getTime();
    const itemEnd = item.endDate.getTime();

    periods.forEach((period, index) => {
      const periodStart = period.start.getTime();
      const periodEnd = period.end.getTime();

      // Check if item overlaps with this period
      if (itemStart <= periodEnd && itemEnd >= periodStart) {
        if (startCol === -1) startCol = index;
        endCol = index;
      }
    });

    return { startCol, endCol };
  }
}
