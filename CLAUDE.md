# CLAUDE.md - Project Context for Claude

## Project Overview

**Obsidian Timeline Viewer** is an Obsidian plugin for project management that enables users to achieve their goals through portfolio, project, and task organization. The distinguishing feature is the **timeline view** and **WBS (Work Breakdown Structure)** that connects tasks visually.

## Core Concepts

### Hierarchy
```
Goal → Portfolio → Project → Task
```

- **Goal**: High-level objectives the user wants to achieve
- **Portfolio**: Collection of related projects aligned to a goal
- **Project**: A defined piece of work with start/end dates
- **Task**: Atomic unit of work within a project

### Key Features (Planned)
1. **Timeline/Gantt View**: Visual representation of projects and tasks over time
2. **WBS Structure**: Hierarchical breakdown of work
3. **Obsidian Integration**: Leverage Obsidian's linking and markdown capabilities
4. **Status Tracking**: Track progress at all hierarchy levels

## Technology Stack

- **Language**: TypeScript
- **Platform**: Obsidian Plugin API
- **Build Tool**: esbuild (recommended for Obsidian plugins)
- **Testing**: Jest or Vitest

## Project Structure (Target)

```
Obsidian-timeline-viewer/
├── CLAUDE.md                 # This file - Claude context
├── README.md                 # Project overview
├── LICENSE                   # MIT License
├── docs/
│   ├── ARCHITECTURE.md       # Plugin architecture
│   ├── FEATURES.md           # Feature specifications
│   └── SKILLS.md             # Required skills
├── src/
│   ├── main.ts               # Plugin entry point
│   ├── settings.ts           # Plugin settings
│   ├── views/
│   │   ├── TimelineView.ts   # Gantt/Timeline view
│   │   └── WBSView.ts        # WBS structure view
│   ├── models/
│   │   ├── Goal.ts
│   │   ├── Portfolio.ts
│   │   ├── Project.ts
│   │   └── Task.ts
│   ├── services/
│   │   ├── DataService.ts    # Data persistence
│   │   └── ParserService.ts  # Markdown parsing
│   └── utils/
├── styles.css                # Plugin styles
├── manifest.json             # Obsidian plugin manifest
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── versions.json
```

## Development Commands

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Coding Conventions

1. **TypeScript**: Strict mode enabled, explicit types preferred
2. **Naming**:
   - Classes: PascalCase
   - Functions/variables: camelCase
   - Constants: UPPER_SNAKE_CASE
   - Files: PascalCase for classes, camelCase for utilities
3. **Obsidian API**: Follow Obsidian plugin best practices
4. **Comments**: JSDoc for public APIs

## Data Storage Strategy

Tasks and projects stored as:
1. **Frontmatter**: YAML metadata in markdown files
2. **Plugin Data**: `data.json` for plugin settings and indices

Example task file:
```markdown
---
type: task
project: "[[Project Name]]"
status: in-progress
start: 2024-01-15
due: 2024-01-20
priority: high
---

# Task Title

Task description and notes...
```

## Current Development Phase

**Phase 1: Foundation** (Current)
- [ ] Initialize project structure
- [ ] Set up build system
- [ ] Create basic plugin skeleton
- [ ] Implement data models

## Important Notes for Claude

1. This is an **Obsidian plugin** - use the Obsidian Plugin API
2. Focus on **timeline visualization** as the core differentiator
3. Keep data in **markdown files** for Obsidian compatibility
4. Design for **extensibility** - WBS features will grow over time
5. Consider **mobile compatibility** (Obsidian Mobile)

## References

- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
