import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type { TimelineViewerSettings } from '../settings';
import type {
  Entity,
  EntityType,
  Goal,
  Portfolio,
  Project,
  Task,
  TimelineItem,
  WBSNode,
  Status,
  Priority,
  EntityFrontmatter
} from '../models/types';
import { Logger } from '../utils/Logger';

export class DataService {
  private app: App;
  private settings: TimelineViewerSettings;
  private cache: Map<string, Entity> = new Map();

  constructor(app: App, settings: TimelineViewerSettings) {
    this.app = app;
    this.settings = settings;
  }

  updateSettings(settings: TimelineViewerSettings): void {
    this.settings = settings;
  }

  /**
   * Initialize and build cache from vault files
   */
  async initialize(): Promise<void> {
    Logger.info('DataService.initialize() - START');
    await this.refreshCache();
    Logger.success('DataService.initialize() - END');
  }

  /**
   * Refresh the entity cache by scanning vault files
   */
  async refreshCache(): Promise<void> {
    Logger.info('DataService.refreshCache() - START');
    this.cache.clear();

    if (this.settings.useNestedFolders) {
      Logger.debug('Using nested folder structure, root:', this.settings.rootFolder);
      await this.scanFolderRecursive(this.settings.rootFolder);
    } else {
      Logger.debug('Using flat folder structure');
      const folders = [
        { folder: this.settings.goalsFolder, type: 'goal' as EntityType },
        { folder: this.settings.portfoliosFolder, type: 'portfolio' as EntityType },
        { folder: this.settings.projectsFolder, type: 'project' as EntityType },
        { folder: this.settings.tasksFolder, type: 'task' as EntityType },
      ];

      for (const { folder, type } of folders) {
        await this.scanFolder(folder, type);
      }
    }

    Logger.success(`DataService.refreshCache() - END. Found ${this.cache.size} entities`);
    Logger.debug('Cached entities:', Array.from(this.cache.values()).map(e => ({ id: e.id, title: e.title, type: e.type })));
  }

  private async scanFolder(folderPath: string, expectedType: EntityType): Promise<void> {
    Logger.debug(`scanFolder() - Scanning: ${folderPath} for type: ${expectedType}`);
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(folderPath));
    if (!folder || !(folder instanceof TFolder)) {
      Logger.warn(`scanFolder() - Folder not found or not a folder: ${folderPath}`);
      return;
    }

    const files = folder.children.filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
    Logger.debug(`scanFolder() - Found ${files.length} markdown files in ${folderPath}`);

    for (const file of files) {
      const entity = await this.parseFile(file, expectedType);
      if (entity) {
        this.cache.set(entity.id, entity);
        Logger.debug(`scanFolder() - Cached entity: ${entity.title} (${entity.id})`);
      }
    }
  }

  /**
   * Recursively scan folders for entities (for nested structure)
   */
  private async scanFolderRecursive(folderPath: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(folderPath));
    if (!folder || !(folder instanceof TFolder)) {
      Logger.warn(`scanFolderRecursive() - Folder not found: ${folderPath}`);
      return;
    }

    Logger.debug(`scanFolderRecursive() - Scanning: ${folderPath}`);

    // Process all markdown files in this folder
    const files = folder.children.filter((f): f is TFile => f instanceof TFile && f.extension === 'md');
    Logger.debug(`scanFolderRecursive() - Found ${files.length} files in ${folderPath}`);

    for (const file of files) {
      const entity = await this.parseFile(file);
      if (entity) {
        this.cache.set(entity.id, entity);
        Logger.debug(`scanFolderRecursive() - Cached: ${entity.type} "${entity.title}" (${entity.id})`);
      } else {
        Logger.warn(`scanFolderRecursive() - Could not parse file: ${file.path}`);
      }
    }

    // Recursively process subfolders
    const subfolders = folder.children.filter((f): f is TFolder => f instanceof TFolder);
    for (const subfolder of subfolders) {
      await this.scanFolderRecursive(subfolder.path);
    }
  }

  private async parseFile(file: TFile, expectedType?: EntityType): Promise<Entity | null> {
    Logger.debug(`parseFile() - Parsing: ${file.path}`);
    const metadata = this.app.metadataCache.getFileCache(file);

    if (!metadata) {
      Logger.warn(`parseFile() - No metadata cache for: ${file.path} (cache may not be ready)`);
      return null;
    }

    const frontmatter = metadata?.frontmatter as EntityFrontmatter | undefined;

    if (!frontmatter) {
      Logger.warn(`parseFile() - No frontmatter in: ${file.path}`);
      return null;
    }

    Logger.debug(`parseFile() - Frontmatter found: type=${frontmatter.type}, id=${frontmatter.id}`);

    // In nested structure, type comes from frontmatter
    // In flat structure, type is provided as parameter
    const type = frontmatter.type || expectedType;
    if (!type) {
      return null; // Skip files without type information
    }

    const baseEntity = {
      id: frontmatter.id || file.basename,
      title: file.basename,
      description: '',
      status: (frontmatter.status || 'not-started') as Status,
      createdAt: frontmatter.createdAt ? new Date(frontmatter.createdAt) : new Date(file.stat.ctime),
      updatedAt: frontmatter.updatedAt ? new Date(frontmatter.updatedAt) : new Date(file.stat.mtime),
      filePath: file.path,
    };

    switch (type) {
      case 'goal':
        return {
          ...baseEntity,
          type: 'goal',
          portfolioIds: [],
          targetDate: frontmatter.endDate ? new Date(frontmatter.endDate) : undefined,
        } as Goal;

      case 'portfolio':
        return {
          ...baseEntity,
          type: 'portfolio',
          goalId: this.extractLinkId(frontmatter.parent),
          projectIds: [],
        } as Portfolio;

      case 'project':
        return {
          ...baseEntity,
          type: 'project',
          portfolioId: this.extractLinkId(frontmatter.parent),
          taskIds: [],
          startDate: this.parseDate(frontmatter.startDate),
          endDate: this.parseDate(frontmatter.endDate),
          progress: frontmatter.progress || 0,
        } as Project;

      case 'task':
        return {
          ...baseEntity,
          type: 'task',
          projectId: this.extractLinkId(frontmatter.parent),
          startDate: this.parseDate(frontmatter.startDate),
          dueDate: this.parseDate(frontmatter.dueDate),
          priority: (frontmatter.priority || 'medium') as Priority,
          dependencies: frontmatter.dependencies || [],
          progress: frontmatter.progress || 0,
        } as Task;

      default:
        return null;
    }
  }

  private extractLinkId(link: unknown): string | undefined {
    if (!link) return undefined;

    // Handle array (take first element)
    if (Array.isArray(link)) {
      link = link[0];
    }

    // Ensure link is a string
    if (typeof link !== 'string') {
      return undefined;
    }

    // Extract ID from [[link]] format
    const match = link.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    return match ? match[1] : link;
  }

  /**
   * Safely parse a date value from frontmatter
   * YAML can return Date objects, strings, or numbers
   */
  private parseDate(value: unknown): Date | undefined {
    if (!value) return undefined;

    // Already a Date object (YAML might auto-parse dates)
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? undefined : value;
    }

    // String date (e.g., "2026-01-12")
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    }

    // Number (timestamp)
    if (typeof value === 'number') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
  }

  /**
   * Get all entities of a specific type
   */
  getEntitiesByType<T extends Entity>(type: EntityType): T[] {
    return Array.from(this.cache.values()).filter(
      (entity): entity is T => entity.type === type
    );
  }

  /**
   * Get entity by ID
   */
  getEntity(id: string): Entity | undefined {
    return this.cache.get(id);
  }

  /**
   * Get timeline items for visualization
   */
  getTimelineItems(): TimelineItem[] {
    Logger.info('getTimelineItems() - START');
    const items: TimelineItem[] = [];

    // Get projects with dates
    const projects = this.getEntitiesByType<Project>('project');
    Logger.debug(`getTimelineItems() - Found ${projects.length} projects in cache`);

    for (const project of projects) {
      Logger.debug(`getTimelineItems() - Project "${project.title}": startDate=${project.startDate}, endDate=${project.endDate}`);
      if (project.startDate && project.endDate) {
        const children = this.getProjectTasksAsTimelineItems(project.id);
        Logger.debug(`getTimelineItems() - Project "${project.title}" has ${children.length} tasks`);
        items.push({
          id: project.id,
          title: project.title,
          type: 'project',
          startDate: project.startDate,
          endDate: project.endDate,
          progress: project.progress,
          status: project.status,
          children: children,
        });
      } else {
        Logger.warn(`getTimelineItems() - Project "${project.title}" skipped: missing dates`);
      }
    }

    // Get standalone tasks with dates
    const tasks = this.getEntitiesByType<Task>('task');
    Logger.debug(`getTimelineItems() - Found ${tasks.length} tasks in cache`);

    for (const task of tasks) {
      Logger.debug(`getTimelineItems() - Task "${task.title}": projectId=${task.projectId}, startDate=${task.startDate}, dueDate=${task.dueDate}`);
      if (!task.projectId && task.startDate && task.dueDate) {
        items.push({
          id: task.id,
          title: task.title,
          type: 'task',
          startDate: task.startDate,
          endDate: task.dueDate,
          progress: task.progress,
          status: task.status,
        });
      }
    }

    Logger.success(`getTimelineItems() - END. Returning ${items.length} items`);
    return items.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  private getProjectTasksAsTimelineItems(projectId: string): TimelineItem[] {
    const allTasks = this.getEntitiesByType<Task>('task');
    const tasks = allTasks.filter(t => t.projectId === projectId);
    Logger.debug(`getProjectTasksAsTimelineItems() - Project ${projectId}: found ${tasks.length} tasks (total tasks: ${allTasks.length})`);

    const validTasks = tasks.filter(task => task.startDate && task.dueDate);
    Logger.debug(`getProjectTasksAsTimelineItems() - ${validTasks.length} tasks have valid dates`);

    return validTasks.map(task => ({
      id: task.id,
      title: task.title,
      type: 'task' as EntityType,
      startDate: task.startDate!,
      endDate: task.dueDate!,
      progress: task.progress,
      status: task.status,
      projectId: projectId,  // Include parent project ID for color mapping
    }));
  }

  /**
   * Get WBS tree structure
   */
  getWBSTree(): WBSNode[] {
    const goals = this.getEntitiesByType<Goal>('goal');

    return goals.map(goal => this.buildWBSNode(goal));
  }

  private buildWBSNode(entity: Entity): WBSNode {
    const children: WBSNode[] = [];

    switch (entity.type) {
      case 'goal': {
        const portfolios = this.getEntitiesByType<Portfolio>('portfolio')
          .filter(p => p.goalId === entity.id);
        children.push(...portfolios.map(p => this.buildWBSNode(p)));
        break;
      }
      case 'portfolio': {
        const projects = this.getEntitiesByType<Project>('project')
          .filter(p => p.portfolioId === entity.id);
        children.push(...projects.map(p => this.buildWBSNode(p)));
        break;
      }
      case 'project': {
        const tasks = this.getEntitiesByType<Task>('task')
          .filter(t => t.projectId === entity.id);
        children.push(...tasks.map(t => this.buildWBSNode(t)));
        break;
      }
    }

    // Calculate progress from children if available
    let progress = 0;
    if ('progress' in entity) {
      progress = entity.progress;
    }
    if (children.length > 0) {
      progress = Math.round(
        children.reduce((sum, child) => sum + child.progress, 0) / children.length
      );
    }

    return {
      id: entity.id,
      title: entity.title,
      type: entity.type,
      status: entity.status,
      progress,
      children,
      expanded: false,
    };
  }

  /**
   * Create a new entity file
   */
  async createEntity(type: EntityType, title: string, parentId?: string): Promise<Entity | null> {
    Logger.info(`createEntity() - START (type: ${type}, title: "${title}", parentId: ${parentId || 'none'})`);
    const folder = this.getFolderForType(type, parentId);
    const folderPath = normalizePath(folder);
    Logger.debug(`createEntity() - Target folder: ${folderPath}`);

    // Ensure folder exists (creates parent directories recursively)
    try {
      await this.ensureFolderExists(folderPath);
    } catch (error) {
      console.error(`Failed to create folder ${folderPath}:`, error);
      throw new Error(`Could not create folder for ${type}`);
    }

    const id = this.generateId();
    const now = new Date().toISOString();

    const frontmatter: Record<string, unknown> = {
      type,
      id,
      status: 'not-started',
      createdAt: now,
      updatedAt: now,
    };

    if (parentId) {
      frontmatter.parent = `[[${parentId}]]`;
    }

    if (type === 'task') {
      frontmatter.priority = 'medium';
      frontmatter.progress = 0;

      // Set start time to now and end time to 1 hour later (default duration)
      const taskStart = new Date();
      const taskEnd = new Date(taskStart);
      taskEnd.setHours(taskEnd.getHours() + 1); // Default 1 hour duration

      frontmatter.startDate = taskStart.toISOString();
      frontmatter.dueDate = taskEnd.toISOString();
    }

    if (type === 'project') {
      frontmatter.progress = 0;
      frontmatter.status = 'in-progress';

      // Add project timeline dates (26 days total for the sample tasks)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 26);

      frontmatter.startDate = startDate.toISOString().split('T')[0];
      frontmatter.endDate = endDate.toISOString().split('T')[0];
    }

    const content = this.buildFileContent(frontmatter, title);

    // Sanitize filename and ensure uniqueness
    const fileName = this.sanitizeFileName(title);
    const uniqueFilePath = await this.getUniqueFilePath(folderPath, fileName);

    try {
      Logger.debug(`createEntity() - Creating file: ${uniqueFilePath}`);
      await this.app.vault.create(uniqueFilePath, content);
      Logger.success(`createEntity() - File created: ${uniqueFilePath}`);
    } catch (error) {
      Logger.error(`createEntity() - Failed to create file ${uniqueFilePath}`, error);
      throw new Error(`Could not create ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Auto-create sample tasks for new projects
    // Note: We do this BEFORE refreshCache because the metadata cache
    // hasn't indexed the new file yet, so getFolderForType would fail.
    // We pass the project title directly to build the correct folder path.
    if (type === 'project') {
      Logger.info(`createEntity() - Creating sample tasks for project "${title}"...`);
      await this.createSampleTasksForProject(id, title, folderPath);
      Logger.success(`createEntity() - Sample tasks created`);
    }

    // Refresh cache to include new entity and sample tasks
    Logger.info('createEntity() - Refreshing cache...');
    await this.refreshCache();

    const createdEntity = this.cache.get(id);
    Logger.success(`createEntity() - END (entity in cache: ${createdEntity ? 'yes' : 'NO!'})`);
    return createdEntity || null;
  }

  /**
   * Get folder path for an entity type
   * Supports both nested and flat folder structures
   */
  private getFolderForType(type: EntityType, parentId?: string): string {
    if (!this.settings.useNestedFolders) {
      // Flat structure
      switch (type) {
        case 'goal': return this.settings.goalsFolder;
        case 'portfolio': return this.settings.portfoliosFolder;
        case 'project': return this.settings.projectsFolder;
        case 'task': return this.settings.tasksFolder;
      }
    }

    // Nested structure
    const root = this.settings.rootFolder;

    switch (type) {
      case 'goal':
        return `${root}/Goals`;

      case 'portfolio': {
        if (parentId) {
          const parent = this.cache.get(parentId);
          if (parent) {
            return `${root}/Goals/${parent.title}/Portfolios`;
          }
        }
        return `${root}/Portfolios`;
      }

      case 'project': {
        if (parentId) {
          const parent = this.cache.get(parentId);
          if (parent && parent.type === 'portfolio') {
            // Get the portfolio's goal parent
            const portfolio = parent as Portfolio;
            if (portfolio.goalId) {
              const goal = this.cache.get(portfolio.goalId);
              if (goal) {
                return `${root}/Goals/${goal.title}/Portfolios/${parent.title}/Projects`;
              }
            }
            return `${root}/Portfolios/${parent.title}/Projects`;
          }
        }
        return `${root}/Projects`;
      }

      case 'task': {
        if (parentId) {
          const parent = this.cache.get(parentId);
          if (parent && parent.type === 'project') {
            const project = parent as Project;
            // Build the full path through the hierarchy
            let projectPath = '';
            if (project.portfolioId) {
              const portfolio = this.cache.get(project.portfolioId) as Portfolio;
              if (portfolio) {
                if (portfolio.goalId) {
                  const goal = this.cache.get(portfolio.goalId);
                  if (goal) {
                    projectPath = `${root}/Goals/${goal.title}/Portfolios/${portfolio.title}/Projects/${parent.title}`;
                  }
                } else {
                  projectPath = `${root}/Portfolios/${portfolio.title}/Projects/${parent.title}`;
                }
              }
            } else {
              projectPath = `${root}/Projects/${parent.title}`;
            }
            return `${projectPath}/Tasks`;
          }
        }
        return `${root}/Tasks`;
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Recursively create folder and all parent directories if they don't exist
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const existingFolder = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (existingFolder) {
      return; // Folder already exists
    }

    // Split path into parts and create each level
    const parts = normalizedPath.split('/');
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);

      if (!existing) {
        try {
          await this.app.vault.createFolder(currentPath);
        } catch (error) {
          // Folder might have been created by another process, check again
          const checkAgain = this.app.vault.getAbstractFileByPath(currentPath);
          if (!checkAgain) {
            console.error(`Failed to create folder ${currentPath}:`, error);
            throw error;
          }
        }
      }
    }
  }

  /**
   * Sanitize filename by removing/replacing invalid characters
   */
  private sanitizeFileName(fileName: string): string {
    // Remove or replace characters that are invalid in file names
    return fileName
      .replace(/[\\/:*?"<>|]/g, '-') // Replace invalid chars with dash
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 200); // Limit length to avoid filesystem issues
  }

  /**
   * Get a unique file path by adding a number suffix if file exists
   */
  private async getUniqueFilePath(folderPath: string, fileName: string): Promise<string> {
    let filePath = normalizePath(`${folderPath}/${fileName}.md`);
    let counter = 1;

    // Check if file exists and increment counter until we find a unique name
    while (this.app.vault.getAbstractFileByPath(filePath)) {
      const baseName = fileName.replace(/\s*\d+$/, ''); // Remove trailing number if exists
      filePath = normalizePath(`${folderPath}/${baseName} ${counter}.md`);
      counter++;
    }

    return filePath;
  }

  private buildFileContent(frontmatter: Record<string, unknown>, title: string): string {
    const yamlLines = ['---'];
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        yamlLines.push(`${key}:`);
        value.forEach(v => yamlLines.push(`  - ${v}`));
      } else {
        yamlLines.push(`${key}: ${value}`);
      }
    }
    yamlLines.push('---', '');

    // Add template content based on type
    const type = frontmatter.type as EntityType;
    const template = this.getTemplateContent(type, title);

    return yamlLines.join('\n') + template;
  }

  /**
   * Get template content for different entity types
   */
  private getTemplateContent(type: EntityType, title: string): string {
    const sections: string[] = [`# ${title}`, ''];

    switch (type) {
      case 'goal':
        sections.push(
          '## Vision',
          'What do you want to achieve?',
          '',
          '## Success Criteria',
          '- [ ] Criterion 1',
          '- [ ] Criterion 2',
          '',
          '## Key Results',
          '1. ',
          '2. ',
          '',
          '## Portfolios',
          '_Portfolios working towards this goal will appear here_',
          ''
        );
        break;

      case 'portfolio':
        sections.push(
          '## Overview',
          'Brief description of this portfolio',
          '',
          '## Objectives',
          '- ',
          '',
          '## Projects',
          '_Projects in this portfolio will appear here_',
          ''
        );
        break;

      case 'project':
        sections.push(
          '## Description',
          'What is this project about?',
          '',
          '## Goals',
          '- ',
          '',
          '## Timeline',
          '- **Start Date:** ',
          '- **End Date:** ',
          '',
          '## Tasks',
          '_Tasks for this project will appear here_',
          '',
          '## Notes',
          ''
        );
        break;

      case 'task':
        sections.push(
          '## Description',
          'What needs to be done?',
          '',
          '## Acceptance Criteria',
          '- [ ] ',
          '',
          '## Notes',
          ''
        );
        break;
    }

    return sections.join('\n');
  }

  /**
   * Create sample tasks for a newly created project
   * This helps populate the timeline view with initial data
   * @param projectId - The ID of the new project
   * @param projectTitle - The title of the project (used to build folder path)
   * @param projectFolderPath - The folder path where the project was created
   */
  private async createSampleTasksForProject(
    projectId: string,
    projectTitle: string,
    projectFolderPath: string
  ): Promise<void> {
    Logger.info(`createSampleTasksForProject() - START (projectId: ${projectId}, title: "${projectTitle}")`);
    const today = new Date();

    const sampleTasks = [
      {
        title: 'Planning and Requirements',
        startDays: 0,
        startHour: 9, // 9 AM
        durationHours: 3, // 3 hour meeting
        priority: 'high' as const,
        status: 'in-progress' as const,
      },
      {
        title: 'Design and Architecture',
        startDays: 0,
        startHour: 14, // 2 PM
        durationHours: 2,
        priority: 'high' as const,
        status: 'not-started' as const,
      },
      {
        title: 'Implementation',
        startDays: 1,
        startHour: 10, // 10 AM
        durationHours: 4,
        priority: 'medium' as const,
        status: 'not-started' as const,
      },
      {
        title: 'Testing and QA',
        startDays: 2,
        startHour: 9,
        durationHours: 3,
        priority: 'high' as const,
        status: 'not-started' as const,
      },
      {
        title: 'Documentation',
        startDays: 2,
        startHour: 14,
        durationHours: 2,
        priority: 'medium' as const,
        status: 'not-started' as const,
      },
    ];

    Logger.debug(`createSampleTasksForProject() - Creating ${sampleTasks.length} sample tasks`);

    for (const taskSpec of sampleTasks) {
      Logger.debug(`createSampleTasksForProject() - Creating task: "${taskSpec.title}"`);
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + taskSpec.startDays);
      startDate.setHours(taskSpec.startHour, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + taskSpec.durationHours);

      const taskId = this.generateId();
      const now = new Date().toISOString();

      // Build task folder path directly using project info
      // (We can't use getFolderForType because the project isn't in cache yet)
      const sanitizedTitle = this.sanitizeFileName(projectTitle);
      const taskFolderPath = this.settings.useNestedFolders
        ? normalizePath(`${projectFolderPath}/${sanitizedTitle}/Tasks`)
        : normalizePath(this.settings.tasksFolder);
      const folderPath = taskFolderPath;
      Logger.debug(`createSampleTasksForProject() - Task folder: ${folderPath}`);

      // Ensure folder exists (creates parent directories recursively)
      try {
        await this.ensureFolderExists(folderPath);
      } catch (error) {
        Logger.error(`createSampleTasksForProject() - Failed to create task folder ${folderPath}`, error);
        continue;
      }

      const frontmatter: Record<string, unknown> = {
        type: 'task',
        id: taskId,
        status: taskSpec.status,
        priority: taskSpec.priority,
        progress: taskSpec.status === 'in-progress' ? 30 : 0,
        startDate: startDate.toISOString(), // Full ISO with time
        dueDate: endDate.toISOString(), // Full ISO with time
        createdAt: now,
        updatedAt: now,
        parent: `[[${projectId}]]`,
      };

      const content = this.buildFileContent(frontmatter, taskSpec.title);
      const fileName = this.sanitizeFileName(taskSpec.title);
      const uniqueFilePath = await this.getUniqueFilePath(folderPath, fileName);

      try {
        await this.app.vault.create(uniqueFilePath, content);
        Logger.debug(`createSampleTasksForProject() - Task created: ${uniqueFilePath}`);
      } catch (error) {
        Logger.error(`createSampleTasksForProject() - Failed to create task ${taskSpec.title}`, error);
      }
    }

    // Refresh cache after creating all sample tasks
    Logger.info('createSampleTasksForProject() - Refreshing cache after task creation...');
    await this.refreshCache();
    Logger.success(`createSampleTasksForProject() - END (cache size: ${this.cache.size})`);
  }

  /**
   * Delete an entity file
   */
  async deleteEntity(id: string): Promise<boolean> {
    Logger.info(`deleteEntity() - START (id: ${id})`);
    const entity = this.cache.get(id);
    if (!entity || !entity.filePath) {
      Logger.warn(`deleteEntity() - Entity not found or no file path: ${id}`);
      return false;
    }

    const file = this.app.vault.getAbstractFileByPath(entity.filePath);
    if (!file || !(file instanceof TFile)) {
      Logger.warn(`deleteEntity() - File not found: ${entity.filePath}`);
      return false;
    }

    try {
      await this.app.vault.trash(file, true);  // Move to trash
      Logger.success(`deleteEntity() - Deleted: ${entity.filePath}`);
      await this.refreshCache();
      return true;
    } catch (error) {
      Logger.error(`deleteEntity() - Failed to delete: ${entity.filePath}`, error);
      return false;
    }
  }

  /**
   * Update an entity
   */
  async updateEntity(id: string, updates: Partial<Entity>): Promise<void> {
    const entity = this.cache.get(id);
    if (!entity || !entity.filePath) return;

    const file = this.app.vault.getAbstractFileByPath(entity.filePath);
    if (!file || !(file instanceof TFile)) return;

    const content = await this.app.vault.read(file);
    const updatedContent = this.updateFrontmatter(content, updates);
    await this.app.vault.modify(file, updatedContent);

    await this.refreshCache();
  }

  private updateFrontmatter(content: string, updates: Partial<Entity>): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return content;

    const lines = frontmatterMatch[1].split('\n');
    const updatedLines: string[] = [];

    for (const line of lines) {
      const [key] = line.split(':');
      const trimmedKey = key?.trim();
      if (trimmedKey && trimmedKey in updates) {
        const value = updates[trimmedKey as keyof Entity];
        updatedLines.push(`${trimmedKey}: ${value}`);
      } else {
        updatedLines.push(line);
      }
    }

    // Add updatedAt
    const hasUpdatedAt = updatedLines.some(l => l.startsWith('updatedAt:'));
    if (!hasUpdatedAt) {
      updatedLines.push(`updatedAt: ${new Date().toISOString()}`);
    } else {
      const idx = updatedLines.findIndex(l => l.startsWith('updatedAt:'));
      updatedLines[idx] = `updatedAt: ${new Date().toISOString()}`;
    }

    return content.replace(/^---\n[\s\S]*?\n---/, `---\n${updatedLines.join('\n')}\n---`);
  }
}
