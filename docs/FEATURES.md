# Feature Specifications

## Core Features

### 1. Timeline/Gantt View

**Description**: Visual representation of projects and tasks on a time axis.

**User Stories**:
- As a user, I want to see all my projects on a timeline so I can understand scheduling
- As a user, I want to drag task bars to adjust dates
- As a user, I want to zoom in/out to see different time scales

**Specifications**:
- Time scales: Day, Week, Month, Quarter, Year
- Color coding by status/priority
- Dependency arrows between tasks
- Today marker
- Milestone markers
- Progress bars within task bars
- Tooltip on hover showing details

**UI Mockup**:
```
┌──────────────────────────────────────────────────────────────┐
│ Timeline View                              [Day|Week|Month]  │
├──────────────────────────────────────────────────────────────┤
│         │ Jan 1  │ Jan 8  │ Jan 15 │ Jan 22 │ Jan 29 │      │
├─────────┼────────┼────────┼────────┼────────┼────────┼──────┤
│Project A│████████████████│        │        │        │      │
│  Task 1 │████████│        │        │        │        │      │
│  Task 2 │        │████████│        │        │        │      │
│Project B│        │        │████████████████████████│      │
│  Task 3 │        │        │████████│        │        │      │
│  Task 4 │        │        │        │████████████████│      │
└──────────────────────────────────────────────────────────────┘
```

---

### 2. WBS (Work Breakdown Structure) View

**Description**: Hierarchical tree view showing the breakdown of work.

**User Stories**:
- As a user, I want to see the hierarchy of my goals/portfolios/projects/tasks
- As a user, I want to expand/collapse sections
- As a user, I want to see aggregated progress

**Specifications**:
- Tree structure with indent levels
- Expand/collapse controls
- Progress percentage at each level
- Status indicators
- Quick actions (add child, edit, delete)
- Drag-and-drop to reorganize

**UI Mockup**:
```
┌──────────────────────────────────────────────────────────────┐
│ WBS View                                        [+ New Goal] │
├──────────────────────────────────────────────────────────────┤
│ ▼ Goal: Career Growth                              [75%] ●   │
│   ▼ Portfolio: Technical Skills                    [80%] ●   │
│     ▼ Project: Learn TypeScript                    [90%] ●   │
│       □ Task: Complete tutorial                   [100%] ✓   │
│       □ Task: Build sample project                 [80%] ●   │
│     ▶ Project: AWS Certification                   [60%] ●   │
│   ▶ Portfolio: Leadership                          [50%] ●   │
│ ▶ Goal: Health & Fitness                           [40%] ○   │
└──────────────────────────────────────────────────────────────┘
```

---

### 3. Entity Management

**Description**: Create, read, update, delete goals, portfolios, projects, and tasks.

**User Stories**:
- As a user, I want to create a new goal/portfolio/project/task
- As a user, I want to edit entity details
- As a user, I want to link entities together
- As a user, I want to set dates, status, and priority

**Specifications**:
- Modal forms for create/edit
- Inline editing for quick changes
- Obsidian links for relationships
- Status workflow (Not Started → In Progress → Complete)
- Priority levels (Low, Medium, High, Critical)
- Date pickers with relative date support

---

### 4. Dashboard View

**Description**: Overview of all active work and metrics.

**User Stories**:
- As a user, I want to see what's due today/this week
- As a user, I want to see overdue items
- As a user, I want to see progress metrics

**Specifications**:
- Today's tasks widget
- Upcoming deadlines widget
- Overdue items alert
- Progress charts
- Quick add task

---

### 5. Obsidian Integration

**Description**: Seamless integration with Obsidian features.

**User Stories**:
- As a user, I want to use Obsidian links between entities
- As a user, I want tasks to appear in graph view
- As a user, I want to use templates for new entities

**Specifications**:
- Wiki-link support (`[[Project Name]]`)
- Tag integration
- Template support
- Dataview compatibility
- Graph view integration
- Backlinks for relationships

---

## Future Features (Roadmap)

### Phase 2: Advanced Timeline
- [ ] Critical path highlighting
- [ ] Resource allocation view
- [ ] Baseline comparison
- [ ] Time tracking integration

### Phase 3: Collaboration
- [ ] Export to PDF/PNG
- [ ] Share view links
- [ ] Comment threads
- [ ] Activity log

### Phase 4: Intelligence
- [ ] Automatic scheduling suggestions
- [ ] Dependency conflict detection
- [ ] Progress predictions
- [ ] Natural language task creation

---

## Non-Functional Requirements

### Performance
- Initial load: < 2 seconds for 1000 tasks
- View switch: < 500ms
- Search: < 100ms

### Compatibility
- Obsidian Desktop: Windows, macOS, Linux
- Obsidian Mobile: iOS, Android
- Minimum Obsidian version: 1.0.0

### Accessibility
- Keyboard navigation
- Screen reader support
- High contrast mode support
