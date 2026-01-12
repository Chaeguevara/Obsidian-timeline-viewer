# Required Skills & Technologies

## Core Development Skills

### 1. TypeScript
**Priority**: Essential

**Required Knowledge**:
- Type system (interfaces, types, generics)
- Classes and decorators
- Async/await patterns
- Module system (ES modules)
- Strict mode best practices

**Resources**:
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

### 2. Obsidian Plugin Development
**Priority**: Essential

**Required Knowledge**:
- Plugin lifecycle (onload, onunload)
- Obsidian API components:
  - `Plugin` class
  - `ItemView` for custom views
  - `Modal` for dialogs
  - `Setting` for configuration
  - `MarkdownView` integration
  - `Vault` API for file operations
  - `MetadataCache` for frontmatter
  - `Workspace` for view management
- Event handling and callbacks
- Plugin settings persistence
- Command palette integration

**Resources**:
- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian API Reference](https://docs.obsidian.md/Reference/TypeScript+API)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)

---

### 3. HTML/CSS/DOM Manipulation
**Priority**: Essential

**Required Knowledge**:
- DOM API (createElement, appendChild, etc.)
- CSS Flexbox and Grid
- CSS Custom Properties (variables)
- Responsive design
- CSS animations for transitions
- Shadow DOM (optional, for encapsulation)

**Obsidian-Specific**:
- Obsidian CSS variables for theming
- `styles.css` integration
- Theme compatibility

---

### 4. Data Visualization
**Priority**: High

**Required Knowledge**:
- Canvas API or SVG for rendering
- Timeline/Gantt chart concepts
- Tree visualization
- Drag-and-drop interactions
- Zoom and pan functionality

**Libraries to Consider**:
- `vis-timeline` - Timeline visualization
- `d3.js` - Low-level visualization
- Custom Canvas/SVG implementation

---

### 5. YAML/Frontmatter Parsing
**Priority**: High

**Required Knowledge**:
- YAML syntax
- Obsidian frontmatter conventions
- Parsing and serialization
- Schema validation

**Libraries**:
- `js-yaml` - YAML parsing
- Obsidian's built-in metadata parser

---

## Supporting Skills

### 6. Build Tools
**Priority**: Medium

**Required Knowledge**:
- esbuild configuration
- npm scripts
- Development/production builds
- Source maps
- Hot reload setup

---

### 7. Testing
**Priority**: Medium

**Required Knowledge**:
- Unit testing with Jest/Vitest
- Mocking Obsidian API
- Integration testing strategies
- Test coverage

---

### 8. Version Control
**Priority**: Medium

**Required Knowledge**:
- Git workflows
- Semantic versioning
- Changelog maintenance
- GitHub releases

---

### 9. Date/Time Handling
**Priority**: Medium

**Required Knowledge**:
- JavaScript Date API
- Timezone handling
- Date formatting
- Date arithmetic

**Libraries**:
- `date-fns` - Lightweight date utilities
- `luxon` - Modern date library

---

## Project Management Concepts

### 10. Domain Knowledge
**Priority**: High

**Understanding Required**:
- Work Breakdown Structure (WBS) methodology
- Gantt chart conventions
- Project management terminology
- Task dependencies (FS, FF, SS, SF)
- Critical path method
- Milestone tracking
- Resource allocation basics

---

## Skill Development Priorities

### Phase 1 (Foundation)
1. TypeScript fundamentals
2. Obsidian Plugin API basics
3. DOM manipulation

### Phase 2 (Core Features)
4. Data visualization (timeline rendering)
5. YAML/frontmatter parsing
6. Date handling

### Phase 3 (Polish)
7. Testing
8. Build optimization
9. Accessibility

---

## Recommended Learning Path

```
Week 1-2: TypeScript + Obsidian Plugin Basics
    ↓
Week 3-4: Build basic plugin skeleton
    ↓
Week 5-6: Data models + file operations
    ↓
Week 7-8: Timeline visualization
    ↓
Week 9-10: WBS view implementation
    ↓
Week 11-12: Testing + polish
```

---

## Tools & Environment

### Development Environment
- **IDE**: VS Code with TypeScript extensions
- **Node.js**: v18+ (LTS)
- **Package Manager**: npm or pnpm
- **Browser DevTools**: For debugging

### VS Code Extensions
- TypeScript + JavaScript
- ESLint
- Prettier
- Obsidian Tools (if available)

### Debugging
- Obsidian Developer Console (Ctrl+Shift+I)
- Source maps for TypeScript debugging
- Console logging strategies
