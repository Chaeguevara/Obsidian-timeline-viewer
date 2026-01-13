import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';
import type { Task, TimelineItem } from '../models/types';

export const DEPENDENCY_GRAPH_VIEW_TYPE = 'timeline-viewer-dependency-graph';

interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  dependencies: string[];
  dependents: string[];
  isCritical: boolean;
  isBottleneck: boolean;
  level: number;
  status: string;
  progress: number;
  color: string;
}

interface GraphEdge {
  from: string;
  to: string;
  isCritical: boolean;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const LEVEL_GAP = 200;
const NODE_GAP = 80;

const PROJECT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

export class DependencyGraphView extends ItemView {
  plugin: TimelineViewerPlugin;
  private viewContentEl: HTMLElement;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private criticalPath: Set<string> = new Set();
  private projectColors: Map<string, string> = new Map();
  private svgEl: SVGSVGElement | null = null;
  private graphContainer: HTMLElement | null = null;
  private scale: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return DEPENDENCY_GRAPH_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Dependency Graph';
  }

  getIcon(): string {
    return 'git-branch';
  }

  async onOpen(): Promise<void> {
    this.viewContentEl = this.containerEl.children[1] as HTMLElement;
    this.viewContentEl.empty();
    this.viewContentEl.addClass('dependency-graph-container');

    await this.render();
  }

  async onClose(): Promise<void> {
    this.viewContentEl.empty();
  }

  async render(): Promise<void> {
    this.viewContentEl.empty();
    this.nodes.clear();
    this.edges = [];
    this.criticalPath.clear();

    this.buildProjectColors();
    this.buildGraph();
    this.calculateLayout();
    this.findCriticalPath();
    this.identifyBottlenecks();

    this.renderHeader();
    this.renderGraph();
    this.renderLegend();
  }

  private buildProjectColors(): void {
    const items = this.plugin.dataService.getTimelineItems();
    let colorIndex = 0;
    items.forEach(item => {
      if (item.type === 'project') {
        this.projectColors.set(item.id, PROJECT_COLORS[colorIndex % PROJECT_COLORS.length]);
        colorIndex++;
      }
    });
  }

  private getTaskColor(taskId: string): string {
    const task = this.plugin.dataService.getEntity(taskId) as Task | undefined;
    if (task?.projectId) {
      return this.projectColors.get(task.projectId) || 'var(--interactive-accent)';
    }
    return 'var(--interactive-accent)';
  }

  private buildGraph(): void {
    const items = this.plugin.dataService.getTimelineItems();
    const allTasks = this.getTasksOnly(items);

    // Build nodes
    allTasks.forEach(task => {
      const taskEntity = this.plugin.dataService.getEntity(task.id) as Task | undefined;
      const dependencies = taskEntity?.dependencies || [];

      this.nodes.set(task.id, {
        id: task.id,
        title: task.title,
        x: 0,
        y: 0,
        dependencies: dependencies,
        dependents: [],
        isCritical: false,
        isBottleneck: false,
        level: 0,
        status: task.status,
        progress: task.progress,
        color: this.getTaskColor(task.id),
      });
    });

    // Build dependents (reverse links) and edges
    this.nodes.forEach((node, nodeId) => {
      node.dependencies.forEach(depId => {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(nodeId);
          this.edges.push({
            from: depId,
            to: nodeId,
            isCritical: false,
          });
        }
      });
    });
  }

  private calculateLayout(): void {
    // Calculate levels using topological sort
    const inDegree = new Map<string, number>();
    this.nodes.forEach((node, id) => {
      inDegree.set(id, node.dependencies.filter(d => this.nodes.has(d)).length);
    });

    // Find root nodes (no dependencies)
    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
        const node = this.nodes.get(id);
        if (node) node.level = 0;
      }
    });

    // BFS to assign levels
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = this.nodes.get(currentId)!;

      currentNode.dependents.forEach(depId => {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.level = Math.max(depNode.level, currentNode.level + 1);
          const newDegree = (inDegree.get(depId) || 0) - 1;
          inDegree.set(depId, newDegree);
          if (newDegree === 0) {
            queue.push(depId);
          }
        }
      });
    }

    // Group nodes by level
    const levels = new Map<number, GraphNode[]>();
    this.nodes.forEach(node => {
      const level = node.level;
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(node);
    });

    // Assign x, y positions
    levels.forEach((nodesAtLevel, level) => {
      const totalHeight = nodesAtLevel.length * (NODE_HEIGHT + NODE_GAP) - NODE_GAP;
      const startY = -totalHeight / 2;

      nodesAtLevel.forEach((node, index) => {
        node.x = level * LEVEL_GAP + 100;
        node.y = startY + index * (NODE_HEIGHT + NODE_GAP) + 200;
      });
    });
  }

  private findCriticalPath(): void {
    // Find tasks with longest path (critical path)
    // Also consider tasks that have no slack (must be done on time)

    // Find all end nodes (no dependents)
    const endNodes: GraphNode[] = [];
    this.nodes.forEach(node => {
      if (node.dependents.length === 0) {
        endNodes.push(node);
      }
    });

    // For each end node, trace back the longest path
    let longestPath: string[] = [];
    let maxLength = 0;

    endNodes.forEach(endNode => {
      const path = this.traceLongestPath(endNode.id, []);
      if (path.length > maxLength) {
        maxLength = path.length;
        longestPath = path;
      }
    });

    // Mark critical path nodes
    longestPath.forEach(nodeId => {
      this.criticalPath.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node) {
        node.isCritical = true;
      }
    });

    // Mark critical path edges
    this.edges.forEach(edge => {
      if (this.criticalPath.has(edge.from) && this.criticalPath.has(edge.to)) {
        edge.isCritical = true;
      }
    });
  }

  private traceLongestPath(nodeId: string, currentPath: string[]): string[] {
    const node = this.nodes.get(nodeId);
    if (!node) return currentPath;

    const newPath = [...currentPath, nodeId];

    if (node.dependencies.length === 0) {
      return newPath;
    }

    let longestSubPath: string[] = newPath;

    node.dependencies.forEach(depId => {
      if (this.nodes.has(depId)) {
        const subPath = this.traceLongestPath(depId, newPath);
        if (subPath.length > longestSubPath.length) {
          longestSubPath = subPath;
        }
      }
    });

    return longestSubPath;
  }

  private identifyBottlenecks(): void {
    // A bottleneck is a task that many other tasks depend on
    this.nodes.forEach(node => {
      if (node.dependents.length >= 3) {
        node.isBottleneck = true;
      }
    });
  }

  private renderHeader(): void {
    const header = this.viewContentEl.createDiv({ cls: 'graph-header' });

    const titleRow = header.createDiv({ cls: 'graph-title-row' });
    titleRow.createEl('h2', { text: 'Dependency Graph' });

    const stats = titleRow.createDiv({ cls: 'graph-stats' });

    const totalTasks = this.nodes.size;
    const criticalTasks = Array.from(this.nodes.values()).filter(n => n.isCritical).length;
    const bottlenecks = Array.from(this.nodes.values()).filter(n => n.isBottleneck).length;
    const blockedTasks = Array.from(this.nodes.values()).filter(n => {
      return n.dependencies.some(depId => {
        const dep = this.nodes.get(depId);
        return dep && dep.status !== 'completed';
      });
    }).length;

    stats.createSpan({ cls: 'graph-stat', text: `${totalTasks} tasks` });
    stats.createSpan({ cls: 'graph-stat graph-stat-critical', text: `${criticalTasks} critical` });
    stats.createSpan({ cls: 'graph-stat graph-stat-bottleneck', text: `${bottlenecks} bottlenecks` });
    stats.createSpan({ cls: 'graph-stat graph-stat-blocked', text: `${blockedTasks} blocked` });

    // Controls
    const controls = header.createDiv({ cls: 'graph-controls' });

    const zoomIn = controls.createEl('button', { cls: 'graph-control-btn', text: '+' });
    zoomIn.addEventListener('click', () => this.zoom(1.2));

    const zoomReset = controls.createEl('button', { cls: 'graph-control-btn', text: 'Reset' });
    zoomReset.addEventListener('click', () => this.resetView());

    const zoomOut = controls.createEl('button', { cls: 'graph-control-btn', text: '-' });
    zoomOut.addEventListener('click', () => this.zoom(0.8));

    const refreshBtn = controls.createEl('button', { cls: 'graph-control-btn', text: 'Refresh' });
    refreshBtn.addEventListener('click', () => this.render());
  }

  private renderGraph(): void {
    this.graphContainer = this.viewContentEl.createDiv({ cls: 'graph-canvas-container' });

    if (this.nodes.size === 0) {
      this.renderEmptyState();
      return;
    }

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + NODE_WIDTH);
      maxY = Math.max(maxY, node.y + NODE_HEIGHT);
    });

    const width = Math.max(maxX - minX + 200, 800);
    const height = Math.max(maxY - minY + 200, 600);

    // Create SVG
    this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgEl.setAttribute('width', String(width));
    this.svgEl.setAttribute('height', String(height));
    this.svgEl.addClass('graph-svg');
    this.graphContainer.appendChild(this.svgEl);

    // Create group for zoom/pan
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'graph-group');
    this.svgEl.appendChild(g);

    // Add arrow marker definitions
    this.addMarkerDefs(g);

    // Draw edges first (behind nodes)
    this.edges.forEach(edge => {
      this.drawEdge(g, edge);
    });

    // Draw nodes
    this.nodes.forEach(node => {
      this.drawNode(g, node);
    });

    // Add pan/zoom handlers
    this.setupPanZoom();
  }

  private addMarkerDefs(g: SVGGElement): void {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Normal arrow
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto-start-reverse');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', 'var(--text-muted)');
    marker.appendChild(path);
    defs.appendChild(marker);

    // Critical arrow
    const criticalMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    criticalMarker.setAttribute('id', 'arrow-critical');
    criticalMarker.setAttribute('viewBox', '0 0 10 10');
    criticalMarker.setAttribute('refX', '9');
    criticalMarker.setAttribute('refY', '5');
    criticalMarker.setAttribute('markerWidth', '8');
    criticalMarker.setAttribute('markerHeight', '8');
    criticalMarker.setAttribute('orient', 'auto-start-reverse');

    const criticalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    criticalPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    criticalPath.setAttribute('fill', 'var(--color-red)');
    criticalMarker.appendChild(criticalPath);
    defs.appendChild(criticalMarker);

    g.appendChild(defs);
  }

  private drawEdge(g: SVGGElement, edge: GraphEdge): void {
    const fromNode = this.nodes.get(edge.from);
    const toNode = this.nodes.get(edge.to);
    if (!fromNode || !toNode) return;

    const x1 = fromNode.x + NODE_WIDTH;
    const y1 = fromNode.y + NODE_HEIGHT / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + NODE_HEIGHT / 2;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Create curved path
    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    path.setAttribute('d', d);
    path.setAttribute('class', edge.isCritical ? 'graph-edge graph-edge-critical' : 'graph-edge');
    path.setAttribute('marker-end', edge.isCritical ? 'url(#arrow-critical)' : 'url(#arrow)');

    g.appendChild(path);
  }

  private drawNode(g: SVGGElement, node: GraphNode): void {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'graph-node-group');
    group.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    // Node rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', String(NODE_WIDTH));
    rect.setAttribute('height', String(NODE_HEIGHT));
    rect.setAttribute('rx', '8');
    rect.setAttribute('ry', '8');

    let nodeClass = 'graph-node';
    if (node.isCritical) nodeClass += ' graph-node-critical';
    if (node.isBottleneck) nodeClass += ' graph-node-bottleneck';
    if (node.status === 'completed') nodeClass += ' graph-node-completed';
    if (node.status === 'in-progress') nodeClass += ' graph-node-in-progress';
    rect.setAttribute('class', nodeClass);

    // Color indicator
    const colorBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    colorBar.setAttribute('x', '0');
    colorBar.setAttribute('y', '0');
    colorBar.setAttribute('width', '6');
    colorBar.setAttribute('height', String(NODE_HEIGHT));
    colorBar.setAttribute('rx', '8');
    colorBar.setAttribute('ry', '8');
    colorBar.setAttribute('fill', node.color);
    colorBar.setAttribute('class', 'graph-node-color');

    // Title text
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', '16');
    title.setAttribute('y', '24');
    title.setAttribute('class', 'graph-node-title');
    title.textContent = node.title.length > 18 ? node.title.substring(0, 16) + '...' : node.title;

    // Progress bar
    const progressBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    progressBg.setAttribute('x', '16');
    progressBg.setAttribute('y', '36');
    progressBg.setAttribute('width', String(NODE_WIDTH - 32));
    progressBg.setAttribute('height', '6');
    progressBg.setAttribute('rx', '3');
    progressBg.setAttribute('class', 'graph-node-progress-bg');

    const progressFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    progressFill.setAttribute('x', '16');
    progressFill.setAttribute('y', '36');
    progressFill.setAttribute('width', String((NODE_WIDTH - 32) * (node.progress / 100)));
    progressFill.setAttribute('height', '6');
    progressFill.setAttribute('rx', '3');
    progressFill.setAttribute('class', 'graph-node-progress-fill');

    // Status indicator
    const status = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    status.setAttribute('x', '16');
    status.setAttribute('y', '54');
    status.setAttribute('class', 'graph-node-status');
    status.textContent = `${node.progress}%`;

    // Badges
    if (node.isCritical) {
      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      badge.setAttribute('x', String(NODE_WIDTH - 10));
      badge.setAttribute('y', '16');
      badge.setAttribute('class', 'graph-node-badge graph-node-badge-critical');
      badge.textContent = '!';
      group.appendChild(badge);
    }

    if (node.isBottleneck) {
      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      badge.setAttribute('cx', String(NODE_WIDTH - 24));
      badge.setAttribute('cy', '12');
      badge.setAttribute('r', '6');
      badge.setAttribute('class', 'graph-node-badge-bottleneck');
      group.appendChild(badge);
    }

    group.appendChild(rect);
    group.appendChild(colorBar);
    group.appendChild(title);
    group.appendChild(progressBg);
    group.appendChild(progressFill);
    group.appendChild(status);

    // Click handler
    group.addEventListener('click', () => {
      this.plugin.openEntity(node.id);
    });

    g.appendChild(group);
  }

  private setupPanZoom(): void {
    if (!this.graphContainer || !this.svgEl) return;

    this.graphContainer.addEventListener('mousedown', (e) => {
      if (e.target === this.svgEl || (e.target as Element).closest('.graph-svg')) {
        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.graphContainer!.style.cursor = 'grabbing';
      }
    });

    this.graphContainer.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.panX += dx;
        this.panY += dy;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.updateTransform();
      }
    });

    this.graphContainer.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.graphContainer!.style.cursor = 'grab';
    });

    this.graphContainer.addEventListener('mouseleave', () => {
      this.isPanning = false;
      this.graphContainer!.style.cursor = 'grab';
    });

    this.graphContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom(delta);
    });

    this.graphContainer.style.cursor = 'grab';
  }

  private zoom(factor: number): void {
    this.scale *= factor;
    this.scale = Math.max(0.3, Math.min(3, this.scale));
    this.updateTransform();
  }

  private resetView(): void {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }

  private updateTransform(): void {
    if (!this.svgEl) return;
    const g = this.svgEl.querySelector('.graph-group');
    if (g) {
      g.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.scale})`);
    }
  }

  private renderLegend(): void {
    const legend = this.viewContentEl.createDiv({ cls: 'graph-legend' });

    const items = [
      { label: 'Critical Path', cls: 'legend-critical' },
      { label: 'Bottleneck', cls: 'legend-bottleneck' },
      { label: 'Completed', cls: 'legend-completed' },
      { label: 'In Progress', cls: 'legend-in-progress' },
    ];

    items.forEach(item => {
      const itemEl = legend.createDiv({ cls: 'graph-legend-item' });
      itemEl.createDiv({ cls: `graph-legend-indicator ${item.cls}` });
      itemEl.createSpan({ text: item.label });
    });
  }

  private renderEmptyState(): void {
    const empty = this.graphContainer!.createDiv({ cls: 'graph-empty-state' });
    empty.createEl('p', { text: 'No tasks with dependencies found.' });
    empty.createEl('p', { text: 'Create tasks and connect them to see the dependency graph.' });

    const createBtn = empty.createEl('button', { cls: 'mod-cta', text: 'Create Project' });
    createBtn.addEventListener('click', () => this.plugin.createNewEntity('project'));
  }

  private getTasksOnly(items: TimelineItem[]): TimelineItem[] {
    const tasks: TimelineItem[] = [];
    items.forEach(item => {
      if (item.type === 'task') {
        tasks.push(item);
      }
      if (item.children) {
        tasks.push(...item.children);
      }
    });
    return tasks;
  }
}
