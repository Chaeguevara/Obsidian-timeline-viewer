import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { WBSNode, EntityType } from '../models/types';

export const WBS_VIEW_TYPE = 'timeline-viewer-wbs';

export class WBSView extends ItemView {
  plugin: TimelineViewerPlugin;
  private viewContentEl: HTMLElement;
  private expandedNodes: Set<string> = new Set();

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return WBS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'WBS';
  }

  getIcon(): string {
    return 'list-tree';
  }

  async onOpen(): Promise<void> {
    this.viewContentEl = this.containerEl.children[1] as HTMLElement;
    this.viewContentEl.empty();
    this.viewContentEl.addClass('wbs-viewer-container');

    await this.render();
  }

  async onClose(): Promise<void> {
    this.viewContentEl.empty();
  }

  async render(): Promise<void> {
    this.viewContentEl.empty();

    // Header
    const header = this.viewContentEl.createDiv({ cls: 'wbs-header' });
    header.createEl('h2', { text: 'Work Breakdown Structure' });

    // Controls
    const controls = header.createDiv({ cls: 'wbs-controls' });

    const expandAllBtn = controls.createEl('button', { text: 'Expand All', cls: 'wbs-btn' });
    expandAllBtn.addEventListener('click', () => this.expandAll());

    const collapseAllBtn = controls.createEl('button', { text: 'Collapse All', cls: 'wbs-btn' });
    collapseAllBtn.addEventListener('click', () => this.collapseAll());

    const addGoalBtn = controls.createEl('button', { text: '+ Goal', cls: 'wbs-btn mod-cta' });
    addGoalBtn.addEventListener('click', () => this.plugin.createNewEntity('goal'));

    // WBS tree container
    const treeContainer = this.viewContentEl.createDiv({ cls: 'wbs-tree' });

    this.renderTree(treeContainer);
  }

  private renderTree(container: HTMLElement): void {
    container.empty();

    const nodes = this.plugin.dataService.getWBSTree();

    if (nodes.length === 0) {
      this.renderEmptyState(container);
      return;
    }

    nodes.forEach(node => {
      this.renderNode(container, node, 0);
    });
  }

  private renderEmptyState(container: HTMLElement): void {
    const emptyState = container.createDiv({ cls: 'wbs-empty-state' });
    emptyState.createEl('p', { text: 'No goals defined yet.' });
    emptyState.createEl('p', { text: 'Start by creating your first goal!' });

    const createBtn = emptyState.createEl('button', {
      text: 'Create Goal',
      cls: 'mod-cta'
    });
    createBtn.addEventListener('click', () => {
      this.plugin.createNewEntity('goal');
    });
  }

  private renderNode(container: HTMLElement, node: WBSNode, depth: number): void {
    const nodeEl = container.createDiv({
      cls: `wbs-node wbs-node-${node.type} wbs-depth-${depth}`
    });
    nodeEl.style.paddingLeft = `${depth * 20}px`;

    // Expand/collapse toggle
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = this.expandedNodes.has(node.id);

    const toggle = nodeEl.createSpan({ cls: 'wbs-toggle' });
    if (hasChildren) {
      toggle.setText(isExpanded ? '▼' : '▶');
      toggle.addEventListener('click', () => this.toggleNode(node.id));
    } else {
      toggle.setText('○');
      toggle.addClass('wbs-toggle-leaf');
    }

    // Type icon
    const icon = nodeEl.createSpan({ cls: `wbs-icon wbs-icon-${node.type}` });
    icon.setText(this.getTypeIcon(node.type));

    // Title
    const title = nodeEl.createSpan({ cls: 'wbs-title' });
    title.setText(node.title);
    title.addEventListener('click', () => this.openEntity(node.id));

    // Progress
    const progressContainer = nodeEl.createSpan({ cls: 'wbs-progress-container' });
    const progressBar = progressContainer.createSpan({ cls: 'wbs-progress-bar' });
    const progressFill = progressBar.createSpan({ cls: 'wbs-progress-fill' });
    progressFill.style.width = `${node.progress}%`;
    const progressText = progressContainer.createSpan({ cls: 'wbs-progress-text' });
    progressText.setText(`${node.progress}%`);

    // Status indicator
    const status = nodeEl.createSpan({ cls: `wbs-status wbs-status-${node.status}` });
    status.setText(this.getStatusIcon(node.status));

    // Actions
    const actions = nodeEl.createSpan({ cls: 'wbs-actions' });

    // Add child button (only for non-task nodes)
    if (node.type !== 'task') {
      const addChildBtn = actions.createSpan({ cls: 'wbs-action-btn', text: '+' });
      addChildBtn.setAttribute('title', `Add ${this.getChildType(node.type)}`);
      addChildBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addChildNode(node);
      });
    }

    // Render children if expanded
    if (hasChildren && isExpanded) {
      const childrenContainer = container.createDiv({ cls: 'wbs-children' });
      node.children.forEach(child => {
        this.renderNode(childrenContainer, child, depth + 1);
      });
    }
  }

  private getTypeIcon(type: EntityType): string {
    switch (type) {
      case 'goal': return '🎯';
      case 'portfolio': return '📁';
      case 'project': return '📋';
      case 'task': return '☐';
      default: return '•';
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✓';
      case 'in-progress': return '●';
      case 'on-hold': return '⏸';
      case 'cancelled': return '✗';
      default: return '○';
    }
  }

  private getChildType(parentType: EntityType): EntityType {
    switch (parentType) {
      case 'goal': return 'portfolio';
      case 'portfolio': return 'project';
      case 'project': return 'task';
      default: return 'task';
    }
  }

  private toggleNode(nodeId: string): void {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }
    this.render();
  }

  private expandAll(): void {
    const nodes = this.plugin.dataService.getWBSTree();
    this.addAllNodeIds(nodes);
    this.render();
  }

  private addAllNodeIds(nodes: WBSNode[]): void {
    nodes.forEach(node => {
      this.expandedNodes.add(node.id);
      if (node.children) {
        this.addAllNodeIds(node.children);
      }
    });
  }

  private collapseAll(): void {
    this.expandedNodes.clear();
    this.render();
  }

  private openEntity(id: string): void {
    this.plugin.openEntity(id);
  }

  private addChildNode(parentNode: WBSNode): void {
    const childType = this.getChildType(parentNode.type);
    this.plugin.createNewEntity(childType, parentNode.id);
  }
}
