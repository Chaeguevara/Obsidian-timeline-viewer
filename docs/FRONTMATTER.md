# Frontmatter Reference

This document describes the frontmatter fields supported by the Timeline Viewer plugin for different entity types.

## Project Frontmatter

```yaml
---
type: project
id: project-123
status: in-progress
startDate: 2026-01-13
endDate: 2026-02-15
progress: 25
color: "#4A90D9"  # Custom project color (hex format)
parent: "[[Portfolio Name]]"
createdAt: 2026-01-13T10:00:00
updatedAt: 2026-01-13T10:00:00
---
```

### Color Field
The `color` field accepts hex color codes (e.g., `"#FF5733"`, `"#4ECDC4"`). When set, this color:
- Displays in the project legend in the timeline view
- Automatically propagates to all tasks under this project
- Used for visual differentiation in Gantt view

## Task Frontmatter

```yaml
---
type: task
id: task-456
status: not-started
priority: high
startDate: 2026-01-13T09:00:00
dueDate: 2026-01-13T12:00:00
progress: 0
parent: "[[Project Name]]"
precedents:          # Tasks this task depends on
  - "[[Task A]]"
  - "[[Task B]]"
descendants:         # Tasks that depend on this task
  - "[[Task C]]"
createdAt: 2026-01-13T10:00:00
updatedAt: 2026-01-13T10:00:00
---
```

### Dependency Fields

#### `precedents` (array)
Lists tasks that must complete **before** this task can start (similar to Obsidian Tasks `dependsOn`):
- Uses Obsidian link format: `[[Task Name]]`
- Supports multiple dependencies
- Creates arrows in the Dependency Graph view

#### `descendants` (array)
Lists tasks that depend on **this** task (reverse dependencies):
- Helps visualize what's blocked if this task is delayed
- Optional - you can manage dependencies with `precedents` only

### Compatibility with Obsidian Tasks
This plugin's dependency format is inspired by the [Obsidian Tasks plugin](https://publish.obsidian.md/tasks/Getting+Started/Task+Dependencies):
- Both use the concept of `id` and dependencies
- Similar finish-to-start dependency model
- Link-based references for task identification

## Status Values
All entities support these status values:
- `not-started`
- `in-progress`
- `completed`
- `on-hold`
- `cancelled`

## Priority Values (Tasks only)
- `low`
- `medium`
- `high`
- `critical`
