import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { WBSNode, EntityType } from '../models/types';
import {
  isMobile,
  createLongPressHandler,
  createSwipeHandler,
  hapticFeedback,
  preventPullToRefresh
} from '../utils/mobile';

export const WBS_VIEW_TYPE = 'timeline-viewer-wbs';

export class WBSView extends ItemView {
  plugin: TimelineViewerPlugin;
  private contentEl: HTMLElement;
  private treeContainer: HTMLElement | null = null;
  private expandedNodes: Set<string> = new Set();
  private cleanupFunctions: (() => void)[] = [];

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
    this.contentEl = this.containerEl.children[1] as HTMLElement;
    this.contentEl.empty();
    this.contentEl.addClass('wbs-viewer-container');

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
    const header = this.contentEl.createDiv({ cls: 'wbs-header' });
    header.createEl('h2', { text: 'Work Breakdown Structure' });

    // Controls
    const controls = header.createDiv({ cls: 'wbs-controls' });

    const expandAllBtn = controls.createEl('button', { text: 'Expand', cls: 'wbs-btn' });
    expandAllBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.expandAll();
    });

    const collapseAllBtn = controls.createEl('button', { text: 'Collapse', cls: 'wbs-btn' });
    collapseAllBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.collapseAll();
    });

    const addGoalBtn = controls.createEl('button', { text: '+ Goal', cls: 'wbs-btn mod-cta' });
    addGoalBtn.addEventListener('click', () => {
      hapticFeedback('light');
      this.plugin.createNewEntity('goal');
    });

    // WBS tree container
    this.treeContainer = this.contentEl.createDiv({ cls: 'wbs-tree' });

    // Setup touch gestures on tree container
    this.setupTouchGestures();

    this.renderTree();

    // Add FAB for mobile
    if (isMobile()) {
      this.addFloatingActionButton();
    }
  }

  private setupTouchGestures(): void {
    if (!this.treeContainer) return;

    // Prevent pull-to-refresh interference
    const preventPTR = preventPullToRefresh(this.treeContainer);
    this.cleanupFunctions.push(preventPTR);

    // Swipe right on node to expand, left to collapse (handled per-node)
  }

  private renderTree(): void {
    if (!this.treeContainer) return;

    this.treeContainer.empty();

    const nodes = this.plugin.dataService.getWBSTree();

    if (nodes.length === 0) {
      this.renderEmptyState(this.treeContainer);
      return;
    }

    nodes.forEach(node => {
      this.renderNode(this.treeContainer!, node, 0);
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
      hapticFeedback('light');
      this.plugin.createNewEntity('goal');
    });
  }

  private renderNode(container: HTMLElement, node: WBSNode, depth: number): void {
    const nodeEl = container.createDiv({
      cls: `wbs-node wbs-node-${node.type} wbs-depth-${depth}`
    });

    // Use CSS classes for indentation on mobile instead of inline styles
    if (!isMobile()) {
      nodeEl.style.paddingLeft = `${depth * 20}px`;
    }

    // Expand/collapse toggle
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = this.expandedNodes.has(node.id);

    const toggle = nodeEl.createSpan({ cls: 'wbs-toggle' });
    if (hasChildren) {
      toggle.setText(isExpanded ? '▼' : '▶');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        hapticFeedback('light');
        this.toggleNode(node.id);
      });
    } else {
      toggle.setText('○');
      toggle.addClass('wbs-toggle-leaf');
    }

    // Type icon
    const icon = nodeEl.createSpan({ cls: `wbs-icon wbs-icon-${node.type}` });
    icon.setText(this.getTypeIcon(node.type));

    // Title - touch optimized
    const title = nodeEl.createSpan({ cls: 'wbs-title' });
    title.setText(node.title);

    // Tap to open
    title.addEventListener('click', () => {
      hapticFeedback('light');
      this.openEntity(node.id);
    });

    // Long press for context menu
    const longPressCleanup = createLongPressHandler(title, () => {
      hapticFeedback('medium');
      this.showNodeContextMenu(node, title);
    });
    this.cleanupFunctions.push(longPressCleanup);

    // Swipe handlers on each node row
    if (hasChildren) {
      const swipeCleanup = createSwipeHandler(
        nodeEl,
        (result) => {
          if (result.direction === 'right' && !isExpanded) {
            hapticFeedback('light');
            this.expandedNodes.add(node.id);
            this.renderTree();
          } else if (result.direction === 'left' && isExpanded) {
            hapticFeedback('light');
            this.expandedNodes.delete(node.id);
            this.renderTree();
          }
        },
        { horizontal: true }
      );
      this.cleanupFunctions.push(swipeCleanup);
    }

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

    // Actions - always visible on mobile
    const actions = nodeEl.createSpan({ cls: 'wbs-actions' });

    // Add child button (only for non-task nodes)
    if (node.type !== 'task') {
      const addChildBtn = actions.createSpan({ cls: 'wbs-action-btn', text: '+' });
      addChildBtn.setAttribute('title', `Add ${this.getChildType(node.type)}`);
      addChildBtn.setAttribute('aria-label', `Add ${this.getChildType(node.type)}`);
      addChildBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hapticFeedback('light');
        this.addChild(node);
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

  private showNodeContextMenu(node: WBSNode, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'tv-context-menu';
    menu.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 8}px;
      left: ${Math.min(rect.left, window.innerWidth - 180)}px;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 8px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 101;
      min-width: 160px;
    `;

    const menuItems: { label: string; action: () => void; icon?: string }[] = [
      {
        label: 'Open',
        icon: '📄',
        action: () => this.openEntity(node.id)
      },
      {
        label: 'Edit',
        icon: '✏️',
        action: () => this.plugin.editEntity(node.id)
      }
    ];

    // Add child option for non-task nodes
    if (node.type !== 'task') {
      menuItems.push({
        label: `Add ${this.getChildType(node.type)}`,
        icon: '+',
        action: () => this.addChild(node)
      });
    }

    // Expand/collapse for nodes with children
    if (node.children && node.children.length > 0) {
      const isExpanded = this.expandedNodes.has(node.id);
      menuItems.push({
        label: isExpanded ? 'Collapse' : 'Expand',
        icon: isExpanded ? '▲' : '▼',
        action: () => this.toggleNode(node.id)
      });
    }

    menuItems.forEach(({ label, action, icon }) => {
      const item = menu.createEl('div', { cls: 'tv-context-menu-item' });
      item.style.cssText = `
        padding: 12px 16px;
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      `;

      if (icon) {
        item.createSpan({ text: icon, cls: 'tv-context-menu-icon' });
      }
      item.createSpan({ text: label });

      item.addEventListener('click', () => {
        hapticFeedback('light');
        action();
        menu.remove();
      });
    });

    document.body.appendChild(menu);

    // Adjust position if menu goes off screen
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = `${rect.top - menuRect.height - 8}px`;
    }
    if (menuRect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - menuRect.width - 16}px`;
    }

    // Remove on outside click
    const removeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
        document.removeEventListener('touchstart', removeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
      document.addEventListener('touchstart', removeMenu);
    }, 100);
  }

  private addFloatingActionButton(): void {
    const fab = this.contentEl.createEl('button', { cls: 'tv-fab' });
    fab.setText('+');
    fab.setAttribute('aria-label', 'Create new goal');

    fab.addEventListener('click', () => {
      hapticFeedback('light');
      this.showQuickCreateMenu(fab);
    });
  }

  private showQuickCreateMenu(anchor: HTMLElement): void {
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

    const options: { label: string; type: EntityType }[] = [
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
        document.removeEventListener('touchstart', removeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
      document.addEventListener('touchstart', removeMenu);
    }, 100);
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
    this.renderTree();
  }

  private expandAll(): void {
    const nodes = this.plugin.dataService.getWBSTree();
    this.addAllNodeIds(nodes);
    this.renderTree();
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
    this.renderTree();
  }

  private openEntity(id: string): void {
    this.plugin.openEntity(id);
  }

  private addChild(parentNode: WBSNode): void {
    const childType = this.getChildType(parentNode.type);
    // Auto-expand parent when adding child
    this.expandedNodes.add(parentNode.id);
    this.plugin.createNewEntity(childType, parentNode.id);
  }
}
