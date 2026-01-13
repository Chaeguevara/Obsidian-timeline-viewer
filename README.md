# Obsidian Timeline Viewer

An Obsidian plugin for project management with timeline visualization and Work Breakdown Structure (WBS) organization.

## Overview

Obsidian Timeline Viewer helps you manage goals, portfolios, projects, and tasks with visual timeline (Gantt) views and hierarchical WBS structures - all within your Obsidian vault.

### Key Features

- **Timeline/Gantt View**: Visualize projects and tasks on an interactive timeline
  - Day, 3-Day, Week, Month, Year, and Timeline scales
  - Drag-and-drop task scheduling
  - Task resizing with 15-minute increments
  - Project color-coding with custom colors
- **Dependency Graph View**: Force-directed graph visualization of task dependencies
  - Physics-based node layout
  - Critical path highlighting
  - Bottleneck detection
- **WBS Structure**: Organize work in a hierarchical breakdown
- **Goal → Portfolio → Project → Task**: Complete hierarchy for project management
- **Obsidian Native**: Data stored as markdown files with frontmatter

## Views

| View | Icon | Description |
|------|------|-------------|
| Timeline | 📊 | Gantt-style calendar with day/week/month/year scales |
| WBS | 🌳 | Hierarchical work breakdown structure |
| Dependency Graph | 🔀 | Force-directed dependency visualization |

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Project context and development guide
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Plugin architecture
- [docs/FEATURES.md](./docs/FEATURES.md) - Feature specifications
- [docs/FRONTMATTER.md](./docs/FRONTMATTER.md) - Frontmatter reference for projects and tasks
- [docs/SKILLS.md](./docs/SKILLS.md) - Required development skills

## Quick Start

### Project with Custom Color
```yaml
---
type: project
color: "#4A90D9"
startDate: 2026-01-13
endDate: 2026-02-15
---
```

### Task with Dependencies
```yaml
---
type: task
parent: "[[My Project]]"
precedents:
  - "[[Task A]]"
  - "[[Task B]]"
---
```

## Installation

*Coming soon - plugin is under development*

## Development

```bash
# Clone the repository
git clone https://github.com/your-username/Obsidian-timeline-viewer.git

# Install dependencies
npm install

# Development build
npm run dev

# Production build
npm run build
```

## License

MIT License - see [LICENSE](./LICENSE)
