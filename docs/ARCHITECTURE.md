# Architecture

## Overview

Obsidian Timeline Viewer follows a modular architecture designed for extensibility and maintainability within the Obsidian plugin ecosystem.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Obsidian App                           │
├─────────────────────────────────────────────────────────────┤
│                 Timeline Viewer Plugin                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Views    │  │   Models    │  │  Services   │         │
│  │  ─────────  │  │  ─────────  │  │  ─────────  │         │
│  │ TimelineView│  │    Goal     │  │ DataService │         │
│  │   WBSView   │  │  Portfolio  │  │ParserService│         │
│  │ SettingsTab │  │   Project   │  │ IndexService│         │
│  │             │  │    Task     │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│              ┌───────────┴───────────┐                     │
│              │     Plugin Core       │                     │
│              │    (main.ts)          │                     │
│              └───────────────────────┘                     │
├─────────────────────────────────────────────────────────────┤
│                  Obsidian Plugin API                        │
├─────────────────────────────────────────────────────────────┤
│                    Markdown Files                           │
│              (Goals, Portfolios, Projects, Tasks)           │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Plugin Core (`main.ts`)

The entry point that:
- Registers views and commands
- Manages plugin lifecycle (load/unload)
- Initializes services
- Handles settings

```typescript
export default class TimelineViewerPlugin extends Plugin {
  settings: TimelineViewerSettings;
  dataService: DataService;

  async onload() { /* initialization */ }
  async onunload() { /* cleanup */ }
}
```

### 2. Views Layer

#### TimelineView
- Renders Gantt chart visualization
- Handles drag-and-drop for date adjustments
- Supports zoom levels (day/week/month/year)
- Interactive task/project bars

#### WBSView
- Hierarchical tree structure display
- Expand/collapse functionality
- Progress aggregation from children
- Drag-and-drop reorganization

#### SettingsTab
- Plugin configuration UI
- Default date formats
- View preferences
- Data folder settings

### 3. Models Layer

Data structures representing the hierarchy:

```typescript
interface Goal {
  id: string;
  title: string;
  description: string;
  portfolios: Portfolio[];
  status: Status;
}

interface Portfolio {
  id: string;
  title: string;
  goalId: string;
  projects: Project[];
  status: Status;
}

interface Project {
  id: string;
  title: string;
  portfolioId: string;
  tasks: Task[];
  startDate: Date;
  endDate: Date;
  status: Status;
}

interface Task {
  id: string;
  title: string;
  projectId: string;
  startDate: Date;
  dueDate: Date;
  status: Status;
  priority: Priority;
  dependencies: string[]; // Task IDs
}
```

### 4. Services Layer

#### DataService
- CRUD operations for all entities
- Caching layer for performance
- Event emission for updates

#### ParserService
- Parse markdown frontmatter
- Extract metadata from files
- Serialize models to markdown

#### IndexService
- Build and maintain indices
- Fast lookups by type, date, status
- Relationship mapping

## Data Flow

```
User Action → View → Service → Parser → Markdown File
                ↓
            Model Update
                ↓
            View Re-render
```

## File-Based Data Storage

Each entity is a markdown file with YAML frontmatter:

```
vault/
├── Goals/
│   └── goal-name.md
├── Portfolios/
│   └── portfolio-name.md
├── Projects/
│   └── project-name.md
└── Tasks/
    └── task-name.md
```

## Event System

Plugin uses Obsidian's event system plus custom events:

- `file-modified`: Trigger re-parse
- `entity-updated`: Trigger view refresh
- `settings-changed`: Trigger reconfiguration

## Extension Points

1. **Custom Views**: Register new ItemView subclasses
2. **Data Types**: Extend base models
3. **Export Formats**: Add exporters (CSV, JSON, etc.)
4. **Integrations**: Connect to external services

## Performance Considerations

1. **Lazy Loading**: Load data on-demand
2. **Caching**: Cache parsed entities
3. **Debouncing**: Debounce frequent updates
4. **Virtual Scrolling**: For large task lists
