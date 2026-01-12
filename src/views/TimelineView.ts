import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { TimelineItem } from '../models/types';

export const TIMELINE_VIEW_TYPE = 'timeline-viewer-timeline';

export class TimelineView extends ItemView {
  plugin: TimelineViewerPlugin;
  private contentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
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
    this.contentEl.empty();
  }

  async render(): Promise<void> {
    this.contentEl.empty();

    // Header
    const header = this.contentEl.createDiv({ cls: 'timeline-header' });
    header.createEl('h2', { text: 'Timeline View' });

    // Controls
    const controls = header.createDiv({ cls: 'timeline-controls' });

    const scaleSelect = controls.createEl('select', { cls: 'timeline-scale-select' });
    ['day', 'week', 'month'].forEach(scale => {
      const option = scaleSelect.createEl('option', { text: scale.charAt(0).toUpperCase() + scale.slice(1) });
      option.value = scale;
      if (scale === this.plugin.settings.timelineScale) {
        option.selected = true;
      }
    });
    scaleSelect.addEventListener('change', () => {
      this.renderTimeline(scaleSelect.value as 'day' | 'week' | 'month');
    });

    // Timeline container
    const timelineContainer = this.contentEl.createDiv({ cls: 'timeline-content' });

    this.renderTimeline(this.plugin.settings.timelineScale, timelineContainer);
  }

  private renderTimeline(scale: 'day' | 'week' | 'month', container?: HTMLElement): void {
    const timelineContainer = container || this.contentEl.querySelector('.timeline-content') as HTMLElement;
    if (!timelineContainer) return;

    timelineContainer.empty();

    // Get items from data service
    const items = this.plugin.dataService.getTimelineItems();

    if (items.length === 0) {
      this.renderEmptyState(timelineContainer);
      return;
    }

    // Create timeline grid
    const grid = timelineContainer.createDiv({ cls: 'timeline-grid' });

    // Render header row with dates
    this.renderTimelineHeader(grid, scale);

    // Render items
    items.forEach(item => {
      this.renderTimelineItem(grid, item, scale);
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
      this.plugin.createNewEntity('project');
    });
  }

  private renderTimelineHeader(grid: HTMLElement, scale: 'day' | 'week' | 'month'): void {
    const headerRow = grid.createDiv({ cls: 'timeline-header-row' });

    // Label column
    headerRow.createDiv({ cls: 'timeline-label-cell', text: 'Item' });

    // Date columns - show next 12 periods
    const periods = this.getTimePeriods(scale, 12);
    periods.forEach(period => {
      headerRow.createDiv({ cls: 'timeline-date-cell', text: period.label });
    });
  }

  private renderTimelineItem(grid: HTMLElement, item: TimelineItem, scale: 'day' | 'week' | 'month'): void {
    const row = grid.createDiv({ cls: `timeline-row timeline-row-${item.type}` });

    // Label
    const label = row.createDiv({ cls: 'timeline-label-cell' });
    label.createSpan({ text: item.title, cls: 'timeline-item-title' });

    // Timeline bar area
    const barArea = row.createDiv({ cls: 'timeline-bar-area' });

    // Calculate bar position and width
    const periods = this.getTimePeriods(scale, 12);
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
    }
  }

  private getTimePeriods(scale: 'day' | 'week' | 'month', count: number): { start: Date; end: Date; label: string }[] {
    const periods: { start: Date; end: Date; label: string }[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const start = new Date(now);
      const end = new Date(now);
      let label = '';

      switch (scale) {
        case 'day':
          start.setDate(now.getDate() + i);
          end.setDate(now.getDate() + i);
          label = `${start.getMonth() + 1}/${start.getDate()}`;
          break;
        case 'week':
          start.setDate(now.getDate() + (i * 7));
          end.setDate(now.getDate() + (i * 7) + 6);
          label = `W${this.getWeekNumber(start)}`;
          break;
        case 'month':
          start.setMonth(now.getMonth() + i, 1);
          end.setMonth(now.getMonth() + i + 1, 0);
          label = start.toLocaleDateString('en-US', { month: 'short' });
          break;
      }

      periods.push({ start, end, label });
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
    periods: { start: Date; end: Date; label: string }[]
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
