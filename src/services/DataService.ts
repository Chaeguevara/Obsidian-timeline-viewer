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
    await this.refreshCache();
  }

  /**
   * Refresh the entity cache by scanning vault files
   */
  async refreshCache(): Promise<void> {
    this.cache.clear();

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

  private async scanFolder(folderPath: string, expectedType: EntityType): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(folderPath));
    if (!folder || !(folder instanceof TFolder)) {
      return;
    }

    const files = folder.children.filter((f): f is TFile => f instanceof TFile && f.extension === 'md');

    for (const file of files) {
      const entity = await this.parseFile(file, expectedType);
      if (entity) {
        this.cache.set(entity.id, entity);
      }
    }
  }

  private async parseFile(file: TFile, expectedType: EntityType): Promise<Entity | null> {
    const metadata = this.app.metadataCache.getFileCache(file);
    const frontmatter = metadata?.frontmatter as EntityFrontmatter | undefined;

    if (!frontmatter) {
      return null;
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

    const type = frontmatter.type || expectedType;

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
          startDate: frontmatter.startDate ? new Date(frontmatter.startDate) : undefined,
          endDate: frontmatter.endDate ? new Date(frontmatter.endDate) : undefined,
          progress: frontmatter.progress || 0,
        } as Project;

      case 'task':
        return {
          ...baseEntity,
          type: 'task',
          projectId: this.extractLinkId(frontmatter.parent),
          startDate: frontmatter.startDate ? new Date(frontmatter.startDate) : undefined,
          dueDate: frontmatter.dueDate ? new Date(frontmatter.dueDate) : undefined,
          priority: (frontmatter.priority || 'medium') as Priority,
          dependencies: frontmatter.dependencies || [],
          progress: frontmatter.progress || 0,
        } as Task;

      default:
        return null;
    }
  }

  private extractLinkId(link: string | undefined): string | undefined {
    if (!link) return undefined;
    // Extract ID from [[link]] format
    const match = link.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    return match ? match[1] : link;
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
    const items: TimelineItem[] = [];

    // Get projects with dates
    const projects = this.getEntitiesByType<Project>('project');
    for (const project of projects) {
      if (project.startDate && project.endDate) {
        items.push({
          id: project.id,
          title: project.title,
          type: 'project',
          startDate: project.startDate,
          endDate: project.endDate,
          progress: project.progress,
          status: project.status,
          children: this.getProjectTasksAsTimelineItems(project.id),
        });
      }
    }

    // Get standalone tasks with dates
    const tasks = this.getEntitiesByType<Task>('task');
    for (const task of tasks) {
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

    return items.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  private getProjectTasksAsTimelineItems(projectId: string): TimelineItem[] {
    const tasks = this.getEntitiesByType<Task>('task').filter(t => t.projectId === projectId);

    return tasks
      .filter(task => task.startDate && task.dueDate)
      .map(task => ({
        id: task.id,
        title: task.title,
        type: 'task' as EntityType,
        startDate: task.startDate!,
        endDate: task.dueDate!,
        progress: task.progress,
        status: task.status,
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
    const folder = this.getFolderForType(type);
    const folderPath = normalizePath(folder);

    // Ensure folder exists
    const existingFolder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!existingFolder) {
      await this.app.vault.createFolder(folderPath);
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
    }

    if (type === 'project') {
      frontmatter.progress = 0;
    }

    const content = this.buildFileContent(frontmatter, title);
    const filePath = normalizePath(`${folderPath}/${title}.md`);

    await this.app.vault.create(filePath, content);

    // Refresh cache to include new entity
    await this.refreshCache();

    return this.cache.get(id) || null;
  }

  private getFolderForType(type: EntityType): string {
    switch (type) {
      case 'goal': return this.settings.goalsFolder;
      case 'portfolio': return this.settings.portfoliosFolder;
      case 'project': return this.settings.projectsFolder;
      case 'task': return this.settings.tasksFolder;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    yamlLines.push('---', '', `# ${title}`, '', '');
    return yamlLines.join('\n');
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
