import { App, Platform, PluginSettingTab, Setting } from 'obsidian';
import type TimelineViewerPlugin from './main';
import type { OrganizationMode } from './models/types';

export interface TimelineViewerSettings {
  // Organization mode
  organizationMode: OrganizationMode; // 'hierarchical' or 'para'

  // Folder settings
  rootFolder: string; // Root folder for all timeline viewer files
  useNestedFolders: boolean; // Whether to use nested folder structure

  // PARA-specific folders (used when organizationMode === 'para')
  paraProjectsFolder: string;
  paraAreasFolder: string;
  paraResourcesFolder: string;
  paraArchivesFolder: string;

  // Legacy flat folder settings (kept for backwards compatibility)
  goalsFolder: string;
  portfoliosFolder: string;
  projectsFolder: string;
  tasksFolder: string;

  // Display settings
  defaultView: 'timeline' | 'wbs';
  timelineScale: 'day' | 'week' | 'month';
  showCompletedItems: boolean;

  // Date settings
  dateFormat: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

  // Mobile settings
  mobileTimelineColumns: number;
  enableHapticFeedback: boolean;
  compactMobileView: boolean;
  showFAB: boolean;

  // Dependency settings
  showDependencies: boolean;
  highlightBlockers: boolean;
  dependencyLineColor: string;
}

export const DEFAULT_SETTINGS: TimelineViewerSettings = {
  organizationMode: 'hierarchical', // Default to hierarchical mode
  rootFolder: 'Timeline Viewer',
  useNestedFolders: true,

  // PARA folders
  paraProjectsFolder: '1. Projects',
  paraAreasFolder: '2. Areas',
  paraResourcesFolder: '3. Resources',
  paraArchivesFolder: '4. Archives',

  // Hierarchical folders (legacy)
  goalsFolder: 'Goals',
  portfoliosFolder: 'Portfolios',
  projectsFolder: 'Projects',
  tasksFolder: 'Tasks',

  defaultView: 'timeline',
  timelineScale: 'week',
  showCompletedItems: true,
  dateFormat: 'yyyy-MM-dd',
  weekStartsOn: 1, // Monday

  // Mobile defaults - optimized for iPhone 15 Pro
  mobileTimelineColumns: 7,
  enableHapticFeedback: true,
  compactMobileView: false,
  showFAB: true,

  // Dependency defaults
  showDependencies: true,
  highlightBlockers: true,
  dependencyLineColor: '#888888',
};

export class TimelineViewerSettingTab extends PluginSettingTab {
  plugin: TimelineViewerPlugin;

  constructor(app: App, plugin: TimelineViewerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Timeline Viewer Settings' });

    // Organization Mode
    containerEl.createEl('h3', { text: 'Organization Mode' });

    new Setting(containerEl)
      .setName('Organization method')
      .setDesc('Choose how to organize your work: Hierarchical (Goal→Portfolio→Project→Task) or PARA (Projects, Areas, Resources, Archives)')
      .addDropdown(dropdown => dropdown
        .addOption('hierarchical', 'Hierarchical (Goal → Portfolio → Project → Task)')
        .addOption('para', 'PARA (Projects, Areas, Resources, Archives)')
        .setValue(this.plugin.settings.organizationMode)
        .onChange(async (value: OrganizationMode) => {
          this.plugin.settings.organizationMode = value;
          await this.plugin.saveSettings();
          // Re-display to show/hide relevant sections
          this.display();
        }));

    // Folder Settings
    containerEl.createEl('h3', { text: 'Folders' });

    new Setting(containerEl)
      .setName('Root folder')
      .setDesc('Root folder for all Timeline Viewer files')
      .addText(text => text
        .setPlaceholder('Timeline Viewer')
        .setValue(this.plugin.settings.rootFolder)
        .onChange(async (value) => {
          this.plugin.settings.rootFolder = value;
          await this.plugin.saveSettings();
        }));

    // Conditional folders based on organization mode
    if (this.plugin.settings.organizationMode === 'hierarchical') {
      new Setting(containerEl)
        .setName('Use nested folders')
        .setDesc('Organize files hierarchically: Goals > Portfolios > Projects > Tasks')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.useNestedFolders)
          .onChange(async (value) => {
            this.plugin.settings.useNestedFolders = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Goals folder')
        .setDesc('Folder where goal files are stored (flat structure only)')
        .addText(text => text
          .setPlaceholder('Goals')
          .setValue(this.plugin.settings.goalsFolder)
          .onChange(async (value) => {
            this.plugin.settings.goalsFolder = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Portfolios folder')
        .setDesc('Folder where portfolio files are stored')
        .addText(text => text
          .setPlaceholder('Portfolios')
          .setValue(this.plugin.settings.portfoliosFolder)
          .onChange(async (value) => {
            this.plugin.settings.portfoliosFolder = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Projects folder')
        .setDesc('Folder where project files are stored')
        .addText(text => text
          .setPlaceholder('Projects')
          .setValue(this.plugin.settings.projectsFolder)
          .onChange(async (value) => {
            this.plugin.settings.projectsFolder = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Tasks folder')
        .setDesc('Folder where task files are stored')
        .addText(text => text
          .setPlaceholder('Tasks')
          .setValue(this.plugin.settings.tasksFolder)
          .onChange(async (value) => {
            this.plugin.settings.tasksFolder = value;
            await this.plugin.saveSettings();
          }));
    } else {
      // PARA folders
      new Setting(containerEl)
        .setName('Projects folder')
        .setDesc('Active work with clear deadlines (PARA: Projects)')
        .addText(text => text
          .setPlaceholder('1. Projects')
          .setValue(this.plugin.settings.paraProjectsFolder)
          .onChange(async (value) => {
            this.plugin.settings.paraProjectsFolder = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Areas folder')
        .setDesc('Ongoing responsibilities without deadlines (PARA: Areas)')
        .addText(text => text
          .setPlaceholder('2. Areas')
          .setValue(this.plugin.settings.paraAreasFolder)
          .onChange(async (value) => {
            this.plugin.settings.paraAreasFolder = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Resources folder')
        .setDesc('Reference material and knowledge base (PARA: Resources)')
        .addText(text => text
          .setPlaceholder('3. Resources')
          .setValue(this.plugin.settings.paraResourcesFolder)
          .onChange(async (value) => {
            this.plugin.settings.paraResourcesFolder = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Archives folder')
        .setDesc('Completed or inactive items (PARA: Archives)')
        .addText(text => text
          .setPlaceholder('4. Archives')
          .setValue(this.plugin.settings.paraArchivesFolder)
          .onChange(async (value) => {
            this.plugin.settings.paraArchivesFolder = value;
            await this.plugin.saveSettings();
          }));
    }

    // Display Settings
    containerEl.createEl('h3', { text: 'Display' });

    new Setting(containerEl)
      .setName('Default view')
      .setDesc('Which view to show by default')
      .addDropdown(dropdown => dropdown
        .addOption('timeline', 'Timeline')
        .addOption('wbs', 'WBS')
        .setValue(this.plugin.settings.defaultView)
        .onChange(async (value: 'timeline' | 'wbs') => {
          this.plugin.settings.defaultView = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Timeline scale')
      .setDesc('Default time scale for timeline view')
      .addDropdown(dropdown => dropdown
        .addOption('day', 'Day')
        .addOption('week', 'Week')
        .addOption('month', 'Month')
        .setValue(this.plugin.settings.timelineScale)
        .onChange(async (value: 'day' | 'week' | 'month') => {
          this.plugin.settings.timelineScale = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show completed items')
      .setDesc('Show completed tasks and projects in views')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showCompletedItems)
        .onChange(async (value) => {
          this.plugin.settings.showCompletedItems = value;
          await this.plugin.saveSettings();
        }));

    // Dependencies Settings
    containerEl.createEl('h3', { text: 'Dependencies' });

    new Setting(containerEl)
      .setName('Show dependencies')
      .setDesc('Display dependency lines between connected tasks')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showDependencies)
        .onChange(async (value) => {
          this.plugin.settings.showDependencies = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Highlight blockers')
      .setDesc('Highlight tasks that are blocking other tasks')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.highlightBlockers)
        .onChange(async (value) => {
          this.plugin.settings.highlightBlockers = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Dependency line color')
      .setDesc('Color for dependency connection lines')
      .addText(text => text
        .setPlaceholder('#888888')
        .setValue(this.plugin.settings.dependencyLineColor)
        .onChange(async (value) => {
          this.plugin.settings.dependencyLineColor = value;
          await this.plugin.saveSettings();
        }));

    // Date Settings
    containerEl.createEl('h3', { text: 'Dates' });

    new Setting(containerEl)
      .setName('Date format')
      .setDesc('Format for displaying dates (uses date-fns format)')
      .addText(text => text
        .setPlaceholder('yyyy-MM-dd')
        .setValue(this.plugin.settings.dateFormat)
        .onChange(async (value) => {
          this.plugin.settings.dateFormat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Week starts on')
      .setDesc('First day of the week')
      .addDropdown(dropdown => dropdown
        .addOption('0', 'Sunday')
        .addOption('1', 'Monday')
        .addOption('2', 'Tuesday')
        .addOption('3', 'Wednesday')
        .addOption('4', 'Thursday')
        .addOption('5', 'Friday')
        .addOption('6', 'Saturday')
        .setValue(String(this.plugin.settings.weekStartsOn))
        .onChange(async (value) => {
          this.plugin.settings.weekStartsOn = parseInt(value) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
          await this.plugin.saveSettings();
        }));

    // Mobile Settings - only show on mobile or always for testing
    containerEl.createEl('h3', { text: 'Mobile (iPhone Optimized)' });

    new Setting(containerEl)
      .setName('Timeline columns on mobile')
      .setDesc('Number of date columns to show on mobile (default: 7 for weekly view)')
      .addSlider(slider => slider
        .setLimits(5, 14, 1)
        .setValue(this.plugin.settings.mobileTimelineColumns)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.mobileTimelineColumns = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Haptic feedback')
      .setDesc('Enable haptic feedback for touch interactions (iOS)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableHapticFeedback)
        .onChange(async (value) => {
          this.plugin.settings.enableHapticFeedback = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Compact mobile view')
      .setDesc('Use smaller touch targets and tighter spacing on mobile')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.compactMobileView)
        .onChange(async (value) => {
          this.plugin.settings.compactMobileView = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show floating action button')
      .setDesc('Show a floating + button for quick creation on mobile')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showFAB)
        .onChange(async (value) => {
          this.plugin.settings.showFAB = value;
          await this.plugin.saveSettings();
        }));

    // Mobile tips
    if (Platform.isMobile) {
      containerEl.createEl('h3', { text: 'Mobile Gestures' });
      const tipsEl = containerEl.createDiv({ cls: 'setting-item-description' });
      tipsEl.innerHTML = `
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li><strong>Swipe left/right</strong> on timeline to navigate dates</li>
          <li><strong>Pinch</strong> to zoom in/out (change time scale)</li>
          <li><strong>Swipe right</strong> on WBS node to expand</li>
          <li><strong>Swipe left</strong> on WBS node to collapse</li>
          <li><strong>Long press</strong> on item for context menu</li>
          <li><strong>Tap</strong> floating + button for quick create</li>
        </ul>
      `;
    }
  }
}
