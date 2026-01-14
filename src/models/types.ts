/**
 * Core types for Timeline Viewer plugin
 * Designed to mirror Asana's project management capabilities
 */

// ==================== Enums & Basic Types ====================

export type Status = 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type EntityType = 'goal' | 'portfolio' | 'project' | 'section' | 'milestone' | 'task' | 'area' | 'resource';

/**
 * PARA Categories for organizational mode
 * Projects: Active work with deadlines
 * Areas: Ongoing responsibilities without deadlines
 * Resources: Reference material and knowledge base
 * Archives: Completed or inactive items
 */
export type PARACategory = 'project' | 'area' | 'resource' | 'archive';

/**
 * Organization mode for the vault
 * - hierarchical: Goal → Portfolio → Project → Task (default)
 * - para: Projects, Areas, Resources, Archives (Tiago Forte's method)
 */
export type OrganizationMode = 'hierarchical' | 'para';

export type DependencyType = 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

// ==================== Base Interfaces ====================

/**
 * Base interface for all entities
 */
export interface BaseEntity {
  id: string;
  title: string;
  description?: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  filePath?: string;
  tags?: string[];
  customFields?: Record<string, CustomFieldValue>;
}

/**
 * Custom field definition
 */
export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'people';
  options?: string[]; // For dropdown type
  required?: boolean;
}

export type CustomFieldValue = string | number | boolean | Date | string[];

// ==================== Hierarchy Entities ====================

/**
 * Goal - Top level objective (like Asana Goals)
 * Represents long-term objectives that portfolios and projects contribute to
 */
export interface Goal extends BaseEntity {
  type: 'goal';
  portfolioIds: string[];
  targetDate?: Date;
  owner?: string; // Obsidian link to person note
  metrics?: GoalMetric[];
}

export interface GoalMetric {
  name: string;
  currentValue: number;
  targetValue: number;
  unit?: string;
}

/**
 * Portfolio - Collection of related projects (like Asana Portfolios)
 * Groups projects for reporting and oversight
 */
export interface Portfolio extends BaseEntity {
  type: 'portfolio';
  goalId?: string;
  projectIds: string[];
  owner?: string;
  color?: string;
}

/**
 * Project - A defined piece of work with timeline (like Asana Projects)
 * Contains sections, milestones, and tasks
 *
 * **PARA Support:**
 * In PARA mode, projects have clear deadlines and end dates.
 * When completed or cancelled, they move to Archives.
 */
export interface Project extends BaseEntity {
  type: 'project';
  portfolioId?: string;
  sectionIds: string[];
  milestoneIds: string[];
  taskIds: string[];
  startDate?: Date;
  endDate?: Date;
  progress: number; // 0-100
  owner?: string;
  members?: string[]; // Team members
  color?: string;
  defaultView?: 'list' | 'board' | 'timeline' | 'calendar';
  template?: boolean; // Is this a project template?

  // PARA-specific fields
  paraCategory?: PARACategory; // 'project' for active, 'archive' for completed
  relatedAreaId?: string; // The area this project belongs to (PARA mode)
  archivedDate?: Date; // When moved to archive
}

/**
 * Section - Grouping within a project (like Asana Sections)
 * Organizes tasks within a project (e.g., "To Do", "In Progress", "Done")
 */
export interface Section extends BaseEntity {
  type: 'section';
  projectId: string;
  taskIds: string[];
  order: number; // Sort order within project
}

/**
 * Milestone - Key date/achievement in a project (like Asana Milestones)
 * Represents important dates with zero duration
 */
export interface Milestone extends BaseEntity {
  type: 'milestone';
  projectId: string;
  dueDate: Date;
  dependencyIds?: string[];
}

/**
 * Task - Atomic unit of work (like Asana Tasks)
 * Can have subtasks, assignees, dependencies
 */
export interface Task extends BaseEntity {
  type: 'task';
  projectId?: string;
  sectionId?: string;
  parentTaskId?: string; // For subtasks
  subtaskIds?: string[]; // Child tasks
  startDate?: Date;
  dueDate?: Date;
  completedDate?: Date;
  priority: Priority;
  assignee?: string; // Obsidian link to person note
  collaborators?: string[]; // Additional people involved
  dependencies: Dependency[];
  dependents?: string[]; // Tasks that depend on this one
  progress: number; // 0-100
  estimatedHours?: number;
  actualHours?: number;
  recurrence?: Recurrence;
  attachments?: string[]; // Links to files
  comments?: Comment[];
  order?: number; // Sort order within section
}

/**
 * Area - Ongoing responsibility without deadline (PARA methodology)
 * Represents ongoing areas of life/work that require maintenance
 * Examples: "Health & Fitness", "Team Management", "Client Relations"
 */
export interface Area extends BaseEntity {
  type: 'area';
  paraCategory: 'area';
  taskIds?: string[]; // Related tasks
  standard?: string; // The standard to maintain (e.g., "Exercise 3x/week")
  reviewFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  lastReviewDate?: Date;
  owner?: string;
  relatedProjectIds?: string[]; // Projects spawned from this area
}

/**
 * Resource - Reference material and knowledge base (PARA methodology)
 * Non-actionable information organized by topic
 * Examples: "Design Systems", "API Documentation", "Meeting Templates"
 */
export interface Resource extends BaseEntity {
  type: 'resource';
  paraCategory: 'resource';
  category?: string; // Topic category
  sourceUrl?: string; // External reference
  relatedAreas?: string[]; // Areas this resource supports
  relatedProjects?: string[]; // Projects this resource supports
  resourceType?: 'documentation' | 'template' | 'reference' | 'tool' | 'learning';
  lastAccessedDate?: Date;
}

// ==================== Supporting Types ====================

/**
 * Dependency relationship between tasks
 */
export interface Dependency {
  taskId: string; // The task this depends on
  type: DependencyType;
  lag?: number; // Days of lag (positive or negative)
}

/**
 * Recurrence pattern for repeating tasks
 */
export interface Recurrence {
  type: RecurrenceType;
  interval: number; // Every N days/weeks/months/years
  daysOfWeek?: number[]; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  endDate?: Date;
  count?: number; // Number of occurrences
}

/**
 * Comment on a task
 */
export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  reactions?: Record<string, string[]>; // emoji -> authors
}

/**
 * Activity log entry
 */
export interface Activity {
  id: string;
  entityId: string;
  entityType: EntityType;
  action: 'created' | 'updated' | 'completed' | 'commented' | 'assigned' | 'moved';
  actor: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

// ==================== Union Types ====================

/**
 * Union type for all entities
 */
export type Entity = Goal | Portfolio | Project | Section | Milestone | Task | Area | Resource;

// ==================== Frontmatter ====================

/**
 * Frontmatter structure for markdown files
 */
export interface EntityFrontmatter {
  type: EntityType;
  id: string;
  status: Status;
  priority?: Priority;
  parent?: string; // Link to parent entity
  project?: string; // Link to project
  section?: string; // Link to section
  assignee?: string; // Link to person
  collaborators?: string[];
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  completedDate?: string;
  dependencies?: DependencyFrontmatter[];
  progress?: number;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DependencyFrontmatter {
  task: string; // Obsidian link
  type?: DependencyType;
  lag?: number;
}

// ==================== View Models ====================

/**
 * Timeline item for rendering in Gantt view
 */
export interface TimelineItem {
  id: string;
  title: string;
  type: EntityType;
  startDate: Date;
  endDate: Date;
  progress: number;
  status: Status;
  projectId?: string;  // Parent project ID for tasks
  children?: TimelineItem[];
  color?: string;
}

/**
 * WBS node for tree rendering
 */
export interface WBSNode {
  id: string;
  title: string;
  type: EntityType;
  status: Status;
  progress: number;
  children: WBSNode[];
  expanded: boolean;
  assignee?: string;
  dueDate?: Date;
  priority?: Priority;
  isOverdue?: boolean;
}

/**
 * Board column for Kanban view
 */
export interface BoardColumn {
  id: string;
  title: string;
  status?: Status;
  sectionId?: string;
  taskIds: string[];
  color?: string;
  limit?: number; // WIP limit
}

/**
 * Calendar event for calendar view
 */
export interface CalendarEvent {
  id: string;
  title: string;
  type: EntityType;
  date: Date;
  endDate?: Date;
  allDay: boolean;
  color?: string;
  status: Status;
}

/**
 * My Tasks item for personal task list
 */
export interface MyTaskItem {
  id: string;
  title: string;
  projectTitle?: string;
  dueDate?: Date;
  priority: Priority;
  status: Status;
  isOverdue: boolean;
  daysUntilDue?: number;
}

// ==================== Filtering & Search ====================

/**
 * Filter criteria for task queries
 */
export interface TaskFilter {
  status?: Status[];
  priority?: Priority[];
  assignee?: string[];
  projectId?: string;
  sectionId?: string;
  tags?: string[];
  dueBefore?: Date;
  dueAfter?: Date;
  isOverdue?: boolean;
  hasNoDueDate?: boolean;
  isBlocked?: boolean;
  searchText?: string;
}

/**
 * Sort options
 */
export interface SortOptions {
  field: 'dueDate' | 'priority' | 'status' | 'title' | 'createdAt' | 'updatedAt' | 'order';
  direction: 'asc' | 'desc';
}
