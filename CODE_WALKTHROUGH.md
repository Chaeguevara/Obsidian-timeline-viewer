# Code Walkthrough: Timeline Viewer Plugin

This document provides a guided tour through the codebase, designed to help new developers understand how everything works together.

## Table of Contents

1. [Start Here: main.ts](#start-here-maints)
2. [Data Layer: DataService](#data-layer-dataservice)
3. [Type System: models/types.ts](#type-system-modelstypests)
4. [Views Deep Dive](#views-deep-dive)
5. [Utilities](#utilities)
6. [Settings](#settings)
7. [Styling](#styling)
8. [Build System](#build-system)

---

## Start Here: main.ts

**Location:** `src/main.ts` (686 lines)

**Purpose:** Plugin entry point that orchestrates everything

### What It Does

```typescript
export default class TimelineViewerPlugin extends Plugin {
  settings: TimelineViewerSettings;   // User preferences
  dataService: DataService;            // Core data management

  async onload() {
    // 1. Load settings
    // 2. Initialize DataService
    // 3. Register 6 views
    // 4. Add ribbon icons and commands
    // 5. Set up file watchers
  }

  onunload() {
    // Cleanup all views
  }
}
```

### Key Methods

| Method | Purpose | When Called |
|--------|---------|-------------|
| `onload()` | Initialize plugin | Plugin enabled |
| `onunload()` | Cleanup | Plugin disabled |
| `activateView(viewType)` | Open/focus a view | User clicks ribbon icon or command |
| `refreshViews()` | Update all open views | After data changes |
| `createNewEntity(type, parentId?)` | Open creation modal | User creates Goal/Portfolio/Project/Task |
| `loadSettings()` | Load from data.json | During onload() |
| `saveSettings()` | Persist settings | Settings changed |

### Plugin Initialization Flow

```
onload()
    │
    ├─> loadSettings()
    │
    ├─> new DataService(app, settings)
    │       │
    │       └─> initialize() (first pass - may be incomplete)
    │
    ├─> registerView() × 6 times
    │   ├─ TimelineView
    │   ├─ WBSView
    │   ├─ DependencyGraphView
    │   ├─ BoardView
    │   ├─ ListView
    │   └─ MyTasksView
    │
    ├─> addRibbonIcon() × 6 times
    │
    ├─> addCommand() × 9 times
    │   ├─ Open views (6 commands)
    │   ├─ Create entities (4 commands)
    │   └─ Refresh data (1 command)
    │
    ├─> addSettingTab()
    │
    └─> registerEvent() × 3 times
        ├─ vault.on('modify')
        ├─ vault.on('create')
        └─ vault.on('delete')

workspace.onLayoutReady()
    └─> dataService.initialize() (second pass - complete with metadata)
```

### Important Notes

1. **DataService initializes twice:**
   - First: Immediate init (may miss some entity relationships)
   - Second: After layout ready (has full metadata cache)
   - Why? Obsidian's metadata cache takes time to populate

2. **File events trigger auto-refresh:**
   - Any file modify/create/delete → `dataService.refreshCache()`
   - Keeps views synchronized with vault changes

3. **All views share the same DataService instance:**
   - Ensures data consistency
   - Views query data via `this.plugin.dataService.getEntitiesByType()`

### TODO Items in main.ts

```typescript
// In refreshViews() - line 428
// TODO: Add refresh logic for other views
// - DependencyGraphView
// - BoardView
// - ListView
// - MyTasksView
```

---

## Data Layer: DataService

**Location:** `src/services/DataService.ts` (1158 lines)

**Purpose:** Central data management - CRUD operations, caching, queries

### Architecture

```
┌─────────────────────────────────────────────┐
│            DataService                      │
├─────────────────────────────────────────────┤
│ Properties:                                 │
│ - app: App                                  │
│ - settings: TimelineViewerSettings          │
│ - cache: Map<string, Entity>                │
│                                             │
│ Methods:                                    │
│ - initialize()      # Scan vault           │
│ - refreshCache()    # Rescan on changes    │
│ - getEntity(id)     # Lookup by ID         │
│ - getEntitiesByType<T>() # Filter by type  │
│ - createEntity()    # Create markdown file │
│ - updateEntity()    # Modify frontmatter   │
│ - deleteEntity()    # Move to trash        │
│                                             │
│ Query Methods:                              │
│ - getTimelineItems()    # For Gantt view   │
│ - getWBSTree()          # For WBS view     │
│ - getTasksByStatus()    # Filtering        │
│ - getTasksByProject()   # Grouping         │
│ - getBlockedTasks()     # Dependency logic │
└─────────────────────────────────────────────┘
```

### Data Flow

```
1. INITIALIZATION
   initialize()
      └─> scanVaultForEntities()
           └─> For each .md file:
                ├─ Read frontmatter via metadataCache
                ├─ Parse into Entity object
                ├─ Generate ID if missing
                └─ Store in cache Map

2. QUERYING
   getEntitiesByType('task')
      └─> Filter cache by entity.type === 'task'
      └─> Return Task[]

3. CREATION
   createEntity('task', 'Fix bug', 'project-123')
      ├─> Determine folder path (nested vs. flat)
      ├─> Generate filename (sanitized title + .md)
      ├─> Create frontmatter YAML
      ├─> Write markdown file
      ├─> Add to cache
      └─> Return Entity

4. UPDATING
   updateEntity(id, { status: 'completed' })
      ├─> Get entity from cache
      ├─> Read existing file
      ├─> Update frontmatter fields
      ├─> Write file
      └─> Update cache

5. DELETION
   deleteEntity(id)
      ├─> Get entity from cache
      ├─> Move file to trash (not permanent delete)
      ├─> Remove from cache
      └─> Refresh dependent views
```

### Key Methods Reference

#### Core CRUD

```typescript
/**
 * Initialize cache by scanning all markdown files in vault
 */
async initialize(): Promise<void>

/**
 * Refresh cache (called on file changes)
 */
async refreshCache(): Promise<void>

/**
 * Get entity by ID
 */
getEntity(id: string): Entity | undefined

/**
 * Get all entities of a specific type
 */
getEntitiesByType<T extends Entity>(type: EntityType): T[]

/**
 * Create new entity with frontmatter
 */
async createEntity(
  type: EntityType,
  title: string,
  parentId?: string
): Promise<Entity>

/**
 * Update entity frontmatter
 */
async updateEntity(
  id: string,
  updates: Partial<Entity>
): Promise<void>

/**
 * Delete entity (move to trash)
 */
async deleteEntity(id: string): Promise<void>
```

#### Specialized Queries

```typescript
/**
 * Get timeline items for Gantt chart rendering
 * Includes both projects and tasks with date calculations
 */
getTimelineItems(): TimelineItem[]

/**
 * Build hierarchical tree for WBS view
 * Returns root nodes with nested children
 */
getWBSTree(): WBSNode[]

/**
 * Get tasks grouped by status (for Board view)
 */
getTasksByStatus(): Map<Status, Task[]>

/**
 * Get tasks for a specific project
 */
getTasksByProject(projectId: string): Task[]

/**
 * Get overdue tasks (dueDate < now && status != completed)
 */
getOverdueTasks(): Task[]

/**
 * Get tasks blocked by dependencies
 */
getBlockedTasks(): Task[]

/**
 * Get tasks blocking other tasks
 */
getBlockerTasks(): Task[]
```

### Folder Structure Logic

DataService handles two folder structures based on settings:

**1. Nested Structure** (default):
```
Root/
  Goals/
    Goal 1/
      Portfolios/
        Portfolio A/
          Projects/
            Project X/
              Tasks/
                Task 1.md
                Task 2.md
```

**2. Flat Structure** (legacy):
```
Root/
  Goals/
    Goal 1.md
  Portfolios/
    Portfolio A.md
  Projects/
    Project X.md
  Tasks/
    Task 1.md
    Task 2.md
```

### Entity IDs

- Generated automatically if not in frontmatter
- Format: `type-randomstring` (e.g., `task-a3f9d2`)
- Stored in frontmatter `id:` field
- Used as cache keys

### Sample Data Creation

When creating a new Project, DataService automatically creates 3 sample tasks:
- "Research and Planning" (not-started)
- "Implementation" (in-progress)
- "Testing and Review" (not-started)

This helps new users understand the hierarchy.

---

## Type System: models/types.ts

**Location:** `src/models/types.ts` (343 lines)

**Purpose:** TypeScript interfaces defining all data structures

### Entity Hierarchy

```typescript
// Base entity with common fields
interface BaseEntity {
  id: string;
  type: EntityType;
  title: string;
  filePath?: string;
  parent?: string;        // Link to parent entity
  createdAt?: string;
  updatedAt?: string;
}

// Specific entity types extend BaseEntity
interface Goal extends BaseEntity {
  type: 'goal';
  description?: string;
  status: Status;
  startDate?: string;
  endDate?: string;
  metrics?: string[];
}

interface Portfolio extends BaseEntity {
  type: 'portfolio';
  description?: string;
  status: Status;
  owner?: string;
}

interface Project extends BaseEntity {
  type: 'project';
  description?: string;
  status: Status;
  startDate?: string;
  endDate?: string;
  progress?: number;      // 0-100
  owner?: string;
  team?: string[];
  color?: string;         // Hex color for timeline
}

interface Task extends BaseEntity {
  type: 'task';
  description?: string;
  status: Status;
  priority?: Priority;
  startDate?: string;     // ISO datetime
  dueDate?: string;       // ISO datetime
  completedDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  assignee?: string;
  tags?: string[];
  precedents?: string[];  // Task dependencies (finish-to-start)
  subtasks?: string[];    // Child tasks
  recurrence?: RecurrencePattern;
}
```

### Enums and Types

```typescript
type EntityType = 'goal' | 'portfolio' | 'project' | 'task' | 'section' | 'milestone';

type Status =
  | 'not-started'
  | 'in-progress'
  | 'completed'
  | 'on-hold'
  | 'cancelled';

type Priority = 'low' | 'medium' | 'high' | 'critical';

type DependencyType =
  | 'finish-to-start'  // Task B starts when Task A finishes (default)
  | 'start-to-start'   // Task B starts when Task A starts
  | 'finish-to-finish' // Task B finishes when Task A finishes
  | 'start-to-finish'  // Task B finishes when Task A starts (rare)
```

### View Models

Separate interfaces for view rendering:

```typescript
// For Timeline/Gantt view
interface TimelineItem {
  id: string;
  title: string;
  type: 'project' | 'task';
  startDate: Date;
  endDate: Date;
  progress?: number;
  color?: string;
  parentId?: string;
  dependencies?: string[];
}

// For WBS hierarchical tree
interface WBSNode {
  id: string;
  title: string;
  type: EntityType;
  status: Status;
  progress?: number;
  children: WBSNode[];
  expanded: boolean;
}

// For Board (Kanban) view
interface BoardColumn {
  status: Status;
  title: string;
  tasks: Task[];
}
```

### Usage Example

```typescript
// In a view:
const tasks = this.plugin.dataService.getEntitiesByType<Task>('task');

// TypeScript knows tasks is Task[], so you get autocomplete:
tasks.forEach(task => {
  console.log(task.priority);     // ✅ 'low' | 'medium' | 'high' | 'critical'
  console.log(task.dueDate);      // ✅ string | undefined
  console.log(task.invalidField); // ❌ TypeScript error!
});
```

---

## Views Deep Dive

All views extend Obsidian's `ItemView` class.

### View Lifecycle

```
constructor(leaf, plugin)
    ↓
getViewType()  // Returns unique identifier
    ↓
getDisplayText()  // Returns view title
    ↓
onOpen()
    ├─> Setup container
    ├─> Add event listeners
    └─> render()
    ↓
[User interacts]
    ├─> Event handlers modify data
    ├─> Call dataService methods
    └─> render() to update view
    ↓
onClose()
    └─> Cleanup (remove listeners, clear timers, etc.)
```

### View Template

```typescript
export const MY_VIEW_TYPE = 'timeline-viewer-my-view';

export class MyView extends ItemView {
  plugin: TimelineViewerPlugin;
  private container: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return MY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'My View';
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    this.container = contentEl.createDiv({ cls: 'my-view-container' });
    await this.render();
  }

  async onClose(): Promise<void> {
    // Cleanup: remove listeners, clear intervals, etc.
  }

  async render(): Promise<void> {
    this.container.empty();

    // Fetch data
    const entities = this.plugin.dataService.getEntitiesByType('task');

    // Render UI
    entities.forEach(entity => {
      const el = this.container.createDiv({ cls: 'entity-item' });
      el.createEl('span', { text: entity.title });

      // Add interactivity
      el.addEventListener('click', () => {
        this.plugin.openEntity(entity.id);
      });
    });
  }
}
```

### TimelineView (Gantt Chart)

**Location:** `src/views/TimelineView.ts` (~1000+ lines)

**Complexity:** HIGH

**Key Features:**
- Multi-scale timeline (day, week, month, year)
- Drag-to-move tasks
- Resize task duration
- Dependency arrows
- Project color coding
- Mobile touch support

**Architecture:**

```
render()
  ├─> renderHeader()         # Time scale selector
  ├─> renderTimeline()       # Main Gantt chart
  │    ├─> renderTimeScale() # Date columns
  │    ├─> renderTasks()     # Task bars
  │    └─> renderDependencies() # Arrow lines
  └─> setupEventListeners()  # Drag, resize, click handlers
```

**Complex Logic:**

1. **Time-to-Pixel Conversion:**
```typescript
// Convert date to X coordinate
const pixelsPerDay = 100; // at 'day' scale
const timelineStart = new Date('2026-01-01');
const taskStart = new Date('2026-01-15');

const x = (taskStart.getTime() - timelineStart.getTime())
          / (1000 * 60 * 60 * 24)
          * pixelsPerDay;
```

2. **Drag-and-Drop:**
```typescript
// On mouse down: record start position
// On mouse move: calculate delta, update task position
// On mouse up: calculate new date, update entity
```

3. **Dependency Arrows:**
```typescript
// For each task with precedents:
//   - Find predecessor task element
//   - Calculate start/end points
//   - Draw SVG line with arrow
//   - Apply color (red if critical path)
```

**TODO in TimelineView:**
- Add zoom functionality
- Implement critical path calculation
- Add milestone markers
- Improve performance for large datasets (virtualization)

### WBSView (Hierarchical Tree)

**Location:** `src/views/WBSView.ts` (~200+ lines)

**Complexity:** MEDIUM

**Key Features:**
- Expandable/collapsible tree
- Progress aggregation (children roll up to parent)
- Mobile swipe gestures
- Floating action button (FAB) for quick add
- Breadcrumb navigation

**Architecture:**

```
render()
  └─> renderTree(nodes, depth = 0)
       ├─> For each node:
       │    ├─> Render node element
       │    ├─> Add expand/collapse icon
       │    ├─> If expanded && has children:
       │    │    └─> Recurse: renderTree(node.children, depth + 1)
       │    └─> Add event listeners
       └─> Apply indentation based on depth
```

**Progress Calculation:**
```typescript
// Aggregate progress from children
function calculateProgress(node: WBSNode): number {
  if (node.children.length === 0) {
    return node.progress || 0;
  }

  const childProgress = node.children
    .map(child => calculateProgress(child))
    .reduce((sum, p) => sum + p, 0);

  return childProgress / node.children.length;
}
```

### DependencyGraphView (Force-Directed Graph)

**Location:** `src/views/DependencyGraphView.ts` (~200+ lines)

**Complexity:** HIGH

**Key Features:**
- Physics-based layout (force simulation)
- Draggable nodes
- Zoom and pan
- Critical path highlighting
- Bottleneck detection

**Physics Simulation:**

```typescript
// Simplified force-directed algorithm
function simulate() {
  // 1. Apply repulsive force between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Coulomb's law (repulsion)
      const force = REPULSION_CONSTANT / (distance * distance);
      nodes[i].vx -= (dx / distance) * force;
      nodes[i].vy -= (dy / distance) * force;
      nodes[j].vx += (dx / distance) * force;
      nodes[j].vy += (dy / distance) * force;
    }
  }

  // 2. Apply attractive force along edges (dependencies)
  edges.forEach(edge => {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Hooke's law (spring attraction)
    const force = (distance - IDEAL_EDGE_LENGTH) * SPRING_CONSTANT;
    source.vx += (dx / distance) * force;
    source.vy += (dy / distance) * force;
    target.vx -= (dx / distance) * force;
    target.vy -= (dy / distance) * force;
  });

  // 3. Update positions
  nodes.forEach(node => {
    node.x += node.vx * DAMPING;
    node.y += node.vy * DAMPING;
    node.vx *= DAMPING;
    node.vy *= DAMPING;
  });

  // 4. Repeat until stable (velocity ~0)
}
```

### BoardView, ListView, MyTasksView (Incomplete)

**Location:**
- `src/views/BoardView.ts`
- `src/views/ListView.ts`
- `src/views/MyTasksView.ts`

**Status:** PARTIALLY IMPLEMENTED

**What Exists:**
- View class structure
- Basic rendering (headers, columns)
- Data fetching from DataService

**What's Missing:**
- Drag-and-drop for BoardView
- Sorting/filtering for ListView
- Due date grouping for MyTasksView
- Edit in place
- Batch operations

**TODO:**
```typescript
// BoardView - line 89
// TODO: Implement drag-and-drop between columns
// TODO: Add task counts to column headers
// TODO: Add quick-add button in each column

// ListView - line 67
// TODO: Add column sorting
// TODO: Add inline editing
// TODO: Add bulk actions (multi-select)

// MyTasksView - line 78
// TODO: Add date grouping (Today, Tomorrow, This Week, Later)
// TODO: Add completion checkboxes
// TODO: Add quick reschedule
```

---

## Utilities

### Logger (src/utils/Logger.ts)

Simple logging utility with emoji prefixes:

```typescript
Logger.info('Initializing plugin...');     // ℹ️
Logger.debug('Cache size: 42');            // 🐛
Logger.warn('Missing metadata');           // ⚠️
Logger.error('Failed to load', error);     // ❌
Logger.success('Entity created!');         // ✅

// Structured logging
Logger.group('Entities');
Logger.table(entities);
Logger.groupEnd();
```

All logs are prefixed with `[Timeline Viewer]`.

### Mobile Utilities (src/utils/mobile.ts)

Mobile detection and gesture handling:

```typescript
// Device detection
if (isMobile()) {
  // Mobile-specific UI
}

if (isIOS()) {
  hapticFeedback('medium');
}

// Swipe gesture
const swipeHandler = createSwipeHandler({
  onSwipeLeft: () => console.log('Swiped left'),
  onSwipeRight: () => console.log('Swiped right'),
  threshold: 50, // pixels
});
element.addEventListener('touchstart', swipeHandler);

// Long press
const longPressHandler = createLongPressHandler({
  duration: 500, // ms
  onLongPress: (e) => console.log('Long pressed'),
});
element.addEventListener('touchstart', longPressHandler);
```

**Constants:**
- `TOUCH_TARGET_SIZE = 44px` (iOS Human Interface Guidelines)
- `LONG_PRESS_DURATION = 500ms`
- `SWIPE_THRESHOLD = 50px`

---

## Settings

**Location:** `src/settings.ts` (308 lines)

### Settings Interface

```typescript
interface TimelineViewerSettings {
  // Folder structure
  folderStructure: 'nested' | 'flat';
  rootFolder: string;

  // Default view
  defaultView: 'timeline' | 'wbs' | 'board' | 'list';

  // Timeline settings
  timelineScale: 'day' | 'week' | 'month' | 'year';
  showWeekends: boolean;

  // Date format
  dateFormat: string; // moment.js format
  weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

  // Mobile
  mobileOptimized: boolean;
  mobileColumns: number;
  enableHaptics: boolean;
  showFAB: boolean;

  // Dependencies
  showDependencies: boolean;
  dependencyArrowColor: string;
  highlightCriticalPath: boolean;
}
```

### Settings UI

Built with Obsidian's `Setting` API:

```typescript
new Setting(containerEl)
  .setName('Setting Name')
  .setDesc('Description of what this does')
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.myBooleanSetting)
    .onChange(async (value) => {
      this.plugin.settings.myBooleanSetting = value;
      await this.plugin.saveSettings();
    }));
```

---

## Styling

**Location:** `styles.css` (64 KB)

Organized in sections:

```css
/* === TIMELINE VIEW === */
.timeline-container { }
.timeline-task-bar { }
.timeline-dependency-arrow { }

/* === WBS VIEW === */
.wbs-container { }
.wbs-node { }
.wbs-expand-icon { }

/* === BOARD VIEW === */
.board-container { }
.board-column { }
.board-card { }

/* === MOBILE === */
@media (max-width: 768px) {
  .timeline-task-bar {
    min-height: 44px; /* Touch target size */
  }
}

/* === DARK MODE === */
.theme-dark {
  .timeline-task-bar {
    background: var(--background-primary);
  }
}
```

---

## Build System

### package.json Scripts

```bash
npm run dev      # esbuild watch mode
npm run build    # Production build
npm run lint     # ESLint
npm test         # Vitest (when available)
```

### esbuild Configuration

**Location:** `esbuild.config.mjs`

```javascript
esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian'],  // Don't bundle Obsidian API
  format: 'cjs',
  target: 'es2018',
  sourcemap: 'inline',
  outfile: 'main.js',
})
```

### TypeScript Configuration

**Location:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES6",
    "module": "ESNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
  }
}
```

---

## Debugging Tips

### Console Logging

```typescript
// Use Logger for consistent output
Logger.debug('Task data:', task);

// Check Obsidian console (Ctrl+Shift+I / Cmd+Option+I)
console.log(this.plugin.dataService.cache);
```

### Inspecting Cache

```typescript
// In any view:
console.table(
  Array.from(this.plugin.dataService.cache.values())
);
```

### Breakpoints

Set breakpoints in Chrome DevTools:
1. Open Obsidian console (Ctrl+Shift+I)
2. Go to Sources tab
3. Find your source file (mapped via sourcemaps)
4. Click line number to set breakpoint

---

## Next Steps

Now that you understand the codebase structure:

1. **Pick a TODO** from incomplete views (BoardView, ListView, MyTasksView)
2. **Read CONTRIBUTING.md** for coding conventions
3. **Explore a view file** to see patterns
4. **Make a small change** and test it in Obsidian
5. **Ask questions** if anything is unclear

Happy coding! 🚀
