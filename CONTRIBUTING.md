# Contributing to Timeline Viewer

Welcome! This guide will help you understand the codebase and start contributing effectively, whether you're a junior or senior developer.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Architecture](#project-architecture)
3. [Code Organization](#code-organization)
4. [Development Workflow](#development-workflow)
5. [Coding Conventions](#coding-conventions)
6. [Testing Your Changes](#testing-your-changes)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)
9. [Getting Help](#getting-help)

---

## Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)
- **Obsidian** (for testing the plugin)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Chaeguevara/Obsidian-timeline-viewer.git
cd Obsidian-timeline-viewer

# 2. Install dependencies
npm install

# 3. Start development build (auto-reloads on changes)
npm run dev

# 4. Link plugin to Obsidian vault for testing
# Create a symlink from your vault's .obsidian/plugins/ folder to this directory
# Example (adjust paths as needed):
ln -s /path/to/Obsidian-timeline-viewer /path/to/your-vault/.obsidian/plugins/timeline-viewer

# 5. Enable the plugin in Obsidian
# Settings → Community Plugins → Timeline Viewer → Enable
```

---

## Project Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────┐
│          TimelineViewerPlugin (main.ts)         │
│  - Plugin lifecycle management                  │
│  - View registration                            │
│  - Command registration                         │
└──────────────┬──────────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────────┐  ┌──────────────────────────────┐
│  DataService │  │          Settings            │
│  - Entity    │  │  - User preferences          │
│    CRUD      │  │  - Folder structure config   │
│  - Caching   │  │  - Display options           │
│  - Queries   │  └──────────────────────────────┘
└──────┬───────┘
       │
       │ provides data to
       │
       ▼
┌────────────────────────────────────────────────┐
│                    Views                       │
├────────────────────────────────────────────────┤
│ TimelineView       │ Gantt chart visualization │
│ WBSView            │ Hierarchical tree         │
│ DependencyGraphView│ Force-directed graph      │
│ BoardView          │ Kanban board (partial)    │
│ ListView           │ Table view (partial)      │
│ MyTasksView        │ Personal tasks (partial)  │
└────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────────┐
│ Markdown Files  │ (stored in vault with YAML frontmatter)
│ - Goals         │
│ - Portfolios    │
│ - Projects      │
│ - Tasks         │
└────────┬────────┘
         │
         │ scanned by
         │
         ▼
┌─────────────────┐
│  DataService    │
│  Cache (Map)    │ ← refreshCache() on file changes
└────────┬────────┘
         │
         │ queried by
         │
         ▼
┌─────────────────┐
│     Views       │
│  - render()     │
│  - event        │
│    handlers     │
└─────────────────┘
```

---

## Code Organization

### Directory Structure

```
Obsidian-timeline-viewer/
├── src/
│   ├── main.ts                      # Plugin entry point (START HERE!)
│   ├── settings.ts                  # Settings UI and configuration
│   ├── models/
│   │   └── types.ts                 # TypeScript interfaces for all entities
│   ├── views/
│   │   ├── TimelineView.ts          # Gantt chart (1000+ lines, complex)
│   │   ├── WBSView.ts               # Hierarchical tree view
│   │   ├── DependencyGraphView.ts    # Force-directed graph
│   │   ├── BoardView.ts             # Kanban board (INCOMPLETE)
│   │   ├── ListView.ts              # Table view (INCOMPLETE)
│   │   └── MyTasksView.ts           # Personal task list (INCOMPLETE)
│   ├── services/
│   │   └── DataService.ts           # Core data management (1158 lines)
│   └── utils/
│       ├── Logger.ts                # Logging utility
│       └── mobile.ts                # Mobile gesture handlers
├── docs/
│   ├── ARCHITECTURE.md              # Detailed system design
│   ├── FEATURES.md                  # Feature specifications
│   ├── FRONTMATTER.md               # YAML field reference
│   └── SKILLS.md                    # Required skills
├── styles.css                       # Plugin styles (64KB)
├── manifest.json                    # Plugin metadata
├── package.json                     # Dependencies and scripts
└── tsconfig.json                    # TypeScript configuration
```

### Key Files to Understand

| File | Lines | Purpose | Complexity |
|------|-------|---------|------------|
| `src/main.ts` | 686 | Plugin lifecycle, view/command registration | Low |
| `src/services/DataService.ts` | 1158 | Entity CRUD, caching, queries | Medium |
| `src/views/TimelineView.ts` | 1000+ | Gantt chart with drag-drop | High |
| `src/views/DependencyGraphView.ts` | 200+ | Force-directed graph simulation | High |
| `src/models/types.ts` | 343 | Type definitions | Low |

**Recommendation:** Start with `main.ts` to understand plugin initialization, then move to `DataService.ts` to understand data management, finally explore individual views.

---

## Development Workflow

### 1. Making Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# The build will auto-reload in Obsidian (if using npm run dev)

# Test in Obsidian
# Open your test vault and verify changes work as expected
```

### 2. Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint -- --fix

# Run tests (when available)
npm test

# Build for production
npm run build
```

### 3. Committing Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "feat: Add task filtering by priority"

# Commit message format:
# - feat: New feature
# - fix: Bug fix
# - docs: Documentation changes
# - refactor: Code refactoring
# - test: Adding tests
# - chore: Build/tooling changes
```

### 4. Submitting Changes

```bash
# Push your branch
git push origin feature/your-feature-name

# Create a pull request on GitHub
# Describe what you changed and why
```

---

## Coding Conventions

### TypeScript Style

#### 1. Naming Conventions

```typescript
// Classes: PascalCase
class DataService { }
class TimelineView { }

// Functions/Methods: camelCase
function createEntity() { }
async loadSettings() { }

// Variables: camelCase
const entityCache = new Map();
let currentView = null;

// Constants: UPPER_SNAKE_CASE
const DEFAULT_SETTINGS = { };
const TIMELINE_VIEW_TYPE = 'timeline-viewer-timeline';

// Interfaces/Types: PascalCase
interface Task { }
type EntityType = 'goal' | 'portfolio' | 'project' | 'task';

// Private members: prefix with _
private _internalCache: Map<string, Entity>;
```

#### 2. Type Safety

```typescript
// ✅ GOOD: Explicit types
function getEntity(id: string): Entity | undefined {
  return this.cache.get(id);
}

// ❌ BAD: Implicit any
function getEntity(id) {
  return this.cache.get(id);
}

// ✅ GOOD: Strict null checks
if (entity?.filePath) {
  // Safe to use entity.filePath
}

// ❌ BAD: Assuming non-null
const path = entity.filePath; // Could be undefined!
```

#### 3. Documentation (JSDoc)

```typescript
/**
 * Create a new entity with frontmatter
 *
 * Creates a markdown file in the appropriate folder based on:
 * - Entity type
 * - Settings (nested vs. flat structure)
 * - Parent entity (if specified)
 *
 * @param type - Entity type to create
 * @param title - Entity title
 * @param parentId - Optional parent entity ID
 * @returns The created entity
 * @throws Error if file creation fails
 *
 * @example
 * const task = await createEntity('task', 'Fix bug', 'project-123');
 */
async createEntity(
  type: EntityType,
  title: string,
  parentId?: string
): Promise<Entity> {
  // Implementation...
}
```

**When to add JSDoc:**
- All public methods and functions
- Complex private methods
- Non-obvious logic (e.g., drag-drop calculations)
- Any method that could confuse a new developer

#### 4. Comments

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Wait for metadata cache to ensure all frontmatter is loaded
// Without this, entity relationships might be missing
await this.app.workspace.onLayoutReady();

// ❌ BAD: Redundant comment
// Call onLayoutReady
await this.app.workspace.onLayoutReady();

// ✅ GOOD: Explain complex logic
// Calculate task position using time-to-pixel conversion
// Assumes 1 day = 100px at day scale
const x = (task.startDate - timelineStart) * pixelsPerDay;

// ❌ BAD: Obvious comment
// Set x to task position
const x = (task.startDate - timelineStart) * pixelsPerDay;
```

#### 5. Error Handling

```typescript
// ✅ GOOD: Specific error handling
try {
  const entity = await this.createEntity(type, title, parentId);
  Logger.success(`Entity created: ${entity.id}`);
  return entity;
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  Logger.error(`Failed to create entity: ${msg}`, error);
  throw new Error(`Entity creation failed: ${msg}`);
}

// ❌ BAD: Silent failure
try {
  const entity = await this.createEntity(type, title, parentId);
  return entity;
} catch (error) {
  return undefined; // Developer won't know what went wrong!
}
```

### Code Organization

#### 1. File Structure

```typescript
// Order:
// 1. Imports (grouped)
// 2. Constants
// 3. Interfaces/Types (if small)
// 4. Class definition

// === IMPORTS ===
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { Task, Project } from '../models/types';
import { Logger } from '../utils/Logger';

// === CONSTANTS ===
export const TIMELINE_VIEW_TYPE = 'timeline-viewer-timeline';
const PIXELS_PER_DAY = 100;

// === CLASS ===
export class TimelineView extends ItemView {
  // ...
}
```

#### 2. Method Order

```typescript
class TimelineView {
  // 1. Properties
  private container: HTMLElement;
  private plugin: TimelineViewerPlugin;

  // 2. Constructor
  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) { }

  // 3. Obsidian lifecycle methods
  getViewType(): string { }
  getDisplayText(): string { }
  async onOpen(): Promise<void> { }
  async onClose(): Promise<void> { }

  // 4. Public methods
  async render(): Promise<void> { }

  // 5. Private methods (alphabetical or logical grouping)
  private renderTimeline(): void { }
  private handleTaskClick(taskId: string): void { }
}
```

---

## Testing Your Changes

### Manual Testing Checklist

Before submitting a PR, test the following:

#### 1. Basic Functionality

- [ ] Plugin loads without errors
- [ ] Settings can be opened and modified
- [ ] All 6 views can be opened without errors
- [ ] Entity creation dialog works (Goal, Portfolio, Project, Task)

#### 2. View-Specific Testing

**Timeline View:**
- [ ] Tasks render correctly
- [ ] Drag-to-move works
- [ ] Resize duration works
- [ ] Dependency arrows render
- [ ] Time scale switching works (day/week/month/year)

**WBS View:**
- [ ] Hierarchy renders correctly
- [ ] Expand/collapse works
- [ ] Progress aggregation is accurate
- [ ] Mobile swipe gestures work (on mobile device)

**Dependency Graph:**
- [ ] Nodes render
- [ ] Force simulation stabilizes
- [ ] Critical path highlighting works
- [ ] Zoom/pan works

#### 3. Data Integrity

- [ ] Creating entities creates files with correct frontmatter
- [ ] Modifying entity files updates views automatically
- [ ] Deleting entities removes them from views
- [ ] Parent-child relationships work correctly

#### 4. Mobile Testing (if applicable)

- [ ] Touch gestures work (swipe, long-press, pinch)
- [ ] UI is responsive and readable
- [ ] Floating action buttons work
- [ ] No horizontal scrolling issues

### Automated Tests (Future)

```bash
# Run unit tests (when available)
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

---

## Common Tasks

### Adding a New View

1. **Create view file** in `src/views/MyNewView.ts`:

```typescript
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type TimelineViewerPlugin from '../main';

export const MY_NEW_VIEW_TYPE = 'timeline-viewer-my-new-view';

export class MyNewView extends ItemView {
  plugin: TimelineViewerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: TimelineViewerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return MY_NEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'My New View';
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h1', { text: 'My New View' });
    await this.render();
  }

  async onClose(): Promise<void> {
    // Cleanup
  }

  async render(): Promise<void> {
    // Rendering logic
    const data = this.plugin.dataService.getEntitiesByType('task');
    // ... render data ...
  }
}
```

2. **Register view** in `src/main.ts`:

```typescript
// Add import
import { MyNewView, MY_NEW_VIEW_TYPE } from './views/MyNewView';

// In onload():
this.registerView(
  MY_NEW_VIEW_TYPE,
  (leaf) => new MyNewView(leaf, this)
);

// Add ribbon icon
this.addRibbonIcon('icon-name', 'Open My New View', () => {
  this.activateView(MY_NEW_VIEW_TYPE);
});

// Add command
this.addCommand({
  id: 'open-my-new-view',
  name: 'Open My New View',
  callback: () => this.activateView(MY_NEW_VIEW_TYPE),
});

// In onunload():
this.app.workspace.detachLeavesOfType(MY_NEW_VIEW_TYPE);
```

3. **Add refresh logic** in `main.ts` `refreshViews()` method

### Adding a New Entity Type

1. **Update types** in `src/models/types.ts`:

```typescript
export type EntityType = 'goal' | 'portfolio' | 'project' | 'task' | 'milestone';

export interface Milestone extends BaseEntity {
  type: 'milestone';
  date: string;
  // ... other fields
}
```

2. **Update DataService** in `src/services/DataService.ts`:
   - Add creation template in `createEntity()`
   - Add folder structure logic
   - Add query methods if needed

3. **Update views** to handle new entity type

### Adding a New Setting

1. **Update settings interface** in `src/settings.ts`:

```typescript
export interface TimelineViewerSettings {
  // ... existing settings
  myNewSetting: boolean;
}

export const DEFAULT_SETTINGS: TimelineViewerSettings = {
  // ... existing defaults
  myNewSetting: false,
};
```

2. **Add UI control** in `TimelineViewerSettingTab.display()`:

```typescript
new Setting(containerEl)
  .setName('My New Setting')
  .setDesc('Description of what this does')
  .addToggle(toggle => toggle
    .setValue(this.plugin.settings.myNewSetting)
    .onChange(async (value) => {
      this.plugin.settings.myNewSetting = value;
      await this.plugin.saveSettings();
    }));
```

3. **Use setting** in your code:

```typescript
if (this.plugin.settings.myNewSetting) {
  // Do something
}
```

---

## Troubleshooting

### Common Issues

#### "Plugin is not loading"

**Cause:** Build failed or symlink is incorrect

**Solution:**
```bash
# Check build output
npm run dev
# Look for errors in terminal

# Verify symlink
ls -la /path/to/vault/.obsidian/plugins/timeline-viewer
# Should point to your project directory

# Check Obsidian console (Ctrl+Shift+I or Cmd+Option+I)
# Look for errors
```

#### "Views are not updating"

**Cause:** DataService cache not refreshing

**Solution:**
```typescript
// Ensure you're calling refreshCache() after data changes
await this.plugin.dataService.refreshCache();
await this.plugin.refreshViews();
```

#### "TypeScript errors"

**Cause:** Missing types or strict mode violations

**Solution:**
```bash
# Check TypeScript errors
npm run build

# Common fixes:
// Add type annotations
const entity: Entity = ...

// Handle undefined cases
if (entity?.filePath) { }

// Use type guards
if (entity.type === 'task') {
  // TypeScript knows entity is a Task here
}
```

#### "Metadata cache is empty"

**Cause:** Accessing data before layout ready

**Solution:**
```typescript
// Wait for layout ready
this.app.workspace.onLayoutReady(async () => {
  await this.dataService.initialize();
});
```

---

## Getting Help

### Resources

- **Documentation:** Check `docs/` folder for detailed architecture docs
- **Code Comments:** Read JSDoc comments in source files
- **CLAUDE.md:** Project context and conventions
- **Issues:** https://github.com/Chaeguevara/Obsidian-timeline-viewer/issues

### Before Asking for Help

1. **Check existing issues** on GitHub
2. **Read the error message** carefully (use Logger for debugging)
3. **Check Obsidian console** (Ctrl+Shift+I / Cmd+Option+I)
4. **Verify your setup** (node version, dependencies installed)
5. **Try a clean rebuild**: `rm -rf node_modules && npm install && npm run build`

### How to Ask for Help

When creating an issue:

1. **Describe what you're trying to do**
2. **Show what you tried**
3. **Include error messages** (full stack trace)
4. **Provide context** (OS, Obsidian version, plugin version)
5. **Include relevant code snippets**

**Good Issue:**
```
Title: "TimelineView not rendering tasks after parent change"

I'm trying to update a task's parent project, but the timeline view doesn't refresh.

Steps to reproduce:
1. Create task with project A as parent
2. Change frontmatter to project B
3. Timeline view still shows task under project A

Expected: Task moves to project B
Actual: Task stays under project A

Error in console:
[Timeline Viewer] Error: Cannot find project B in cache

Code:
// In DataService.ts line 456
const parent = this.cache.get(parentId); // Returns undefined

Environment:
- OS: macOS 14.2
- Obsidian: 1.4.14
- Plugin version: 1.0.0
```

---

## Next Steps

1. **Read CODE_WALKTHROUGH.md** for a guided tour of the codebase
2. **Explore ARCHITECTURE.md** for detailed system design
3. **Look at TODO comments** in the code for areas needing work
4. **Check GitHub Issues** for beginner-friendly tasks (labeled "good first issue")

Happy coding! 🚀
