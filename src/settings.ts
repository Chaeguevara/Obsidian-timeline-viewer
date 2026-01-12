import { App, PluginSettingTab, Setting } from 'obsidian';
import type TimelineViewerPlugin from './main';

export interface TimelineViewerSettings {
  // Folder settings
  rootFolder: string; // Root folder for all timeline viewer files
  useNestedFolders: boolean; // Whether to use nested folder structure

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
}

export const DEFAULT_SETTINGS: TimelineViewerSettings = {
  rootFolder: 'Timeline Viewer',
  useNestedFolders: true,
  goalsFolder: 'Goals',
  portfoliosFolder: 'Portfolios',
  projectsFolder: 'Projects',
  tasksFolder: 'Tasks',
  defaultView: 'timeline',
  timelineScale: 'week',
  showCompletedItems: true,
  dateFormat: 'yyyy-MM-dd',
  weekStartsOn: 1, // Monday
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
  }
}
