/**
 * Core types for Timeline Viewer plugin
 */

export type Status = 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type EntityType = 'goal' | 'portfolio' | 'project' | 'task';

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
}

/**
 * Goal - Top level objective
 */
export interface Goal extends BaseEntity {
  type: 'goal';
  portfolioIds: string[];
  targetDate?: Date;
}

/**
 * Portfolio - Collection of related projects
 */
export interface Portfolio extends BaseEntity {
  type: 'portfolio';
  goalId?: string;
  projectIds: string[];
}

/**
 * Project - A defined piece of work with timeline
 */
export interface Project extends BaseEntity {
  type: 'project';
  portfolioId?: string;
  taskIds: string[];
  startDate?: Date;
  endDate?: Date;
  progress: number; // 0-100
}

/**
 * Task - Atomic unit of work
 */
export interface Task extends BaseEntity {
  type: 'task';
  projectId?: string;
  startDate?: Date;
  dueDate?: Date;
  completedDate?: Date;
  priority: Priority;
  dependencies: string[]; // Task IDs
  progress: number; // 0-100
}

/**
 * Union type for all entities
 */
export type Entity = Goal | Portfolio | Project | Task;

/**
 * Frontmatter structure for markdown files
 */
export interface EntityFrontmatter {
  type: EntityType;
  id: string;
  status: Status;
  priority?: Priority;
  parent?: string; // Link to parent entity
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  dependencies?: string[];
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Timeline item for rendering
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
}
