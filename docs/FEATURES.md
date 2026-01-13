# Feature Specifications

## Asana Feature Comparison

This plugin aims to bring Asana-like project management capabilities to Obsidian, with the advantage of local-first, markdown-based storage.

| Feature | Asana | This Plugin | Status |
|---------|-------|-------------|--------|
| **Hierarchy** |
| Goals | ✅ | ✅ | Implemented |
| Portfolios | ✅ | ✅ | Implemented |
| Projects | ✅ | ✅ | Implemented |
| Sections | ✅ | ✅ | Designed |
| Milestones | ✅ | ✅ | Designed |
| Tasks | ✅ | ✅ | Implemented |
| Subtasks | ✅ | ✅ | Designed |
| **Views** |
| List View | ✅ | 🔲 | Planned |
| Board/Kanban | ✅ | 🔲 | Planned |
| Timeline/Gantt | ✅ | ✅ | Implemented |
| Calendar | ✅ | 🔲 | Planned |
| Dashboard | ✅ | 🔲 | Planned |
| My Tasks | ✅ | 🔲 | Planned |
| **Task Features** |
| Assignees | ✅ | ✅ | Designed |
| Due Dates | ✅ | ✅ | Implemented |
| Start Dates | ✅ | ✅ | Implemented |
| Dependencies | ✅ | ✅ | Designed |
| Priority | ✅ | ✅ | Implemented |
| Tags/Labels | ✅ | ✅ | Designed |
| Custom Fields | ✅ | ✅ | Designed |
| Attachments | ✅ | ✅ | Via Obsidian links |
| Comments | ✅ | 🔲 | Planned |
| Recurring Tasks | ✅ | ✅ | Designed |
| Time Tracking | ✅ | ✅ | Designed |
| **Collaboration** |
| Team Members | ✅ | ✅ | Via person notes |
| Activity Feed | ✅ | 🔲 | Planned |
| Notifications | ✅ | 🔲 | Planned |
| **Integration** |
| Graph View | ❌ | ✅ | Native Obsidian |
| Backlinks | ❌ | ✅ | Native Obsidian |
| Templates | ✅ | ✅ | Native Obsidian |
| Dataview | ❌ | ✅ | Compatible |
| Mobile | ✅ | ✅ | Optimized |

---

## Core Features

### 1. Timeline/Gantt View

**Description**: Visual representation of projects and tasks on a time axis, similar to Asana's Timeline view.

**User Stories**:
- As a user, I want to see all my projects on a timeline so I can understand scheduling
- As a user, I want to drag task bars to adjust dates
- As a user, I want to zoom in/out to see different time scales
- As a user, I want to see dependency arrows between tasks
- As a user, I want to identify blockers at a glance

**Specifications**:
- Time scales: Day, Week, Month, Quarter, Year
- Color coding by status/priority/project
- Dependency arrows between tasks (finish-to-start, etc.)
- Today marker
- Milestone markers (diamond shapes)
- Progress bars within task bars
- Blocker highlighting (red outline)
- Tooltip on hover/tap showing details
- Mobile: swipe to navigate, pinch to zoom

**UI Mockup**:
```
┌──────────────────────────────────────────────────────────────┐
│ Timeline View                    [◀ Today ▶] [Day|Week|Month]│
├──────────────────────────────────────────────────────────────┤
│         │ Jan 1  │ Jan 8  │ Jan 15 │ Jan 22 │ Jan 29 │      │
├─────────┼────────┼────────┼────────┼────────┼────────┼──────┤
│Project A│████████████████│        │        │        │      │
│  Task 1 │████████│───────┐        │        │        │      │
│  Task 2 │        │███████┴►       │        │        │      │
│  ◆ M1   │        │        │◆      │        │        │      │
│Project B│        │        │████████████████████████│      │
│  Task 3 │        │        │████████│        │        │      │
│  Task 4 │        │        │   ┌────┴►██████████████│      │
└──────────────────────────────────────────────────────────────┘
Legend: ████ Task bar  ──► Dependency  ◆ Milestone
```

---

### 2. Board/Kanban View

**Description**: Drag-and-drop board for managing task status, like Asana's Board view.

**User Stories**:
- As a user, I want to see tasks organized by status/section
- As a user, I want to drag tasks between columns
- As a user, I want to see task details at a glance
- As a user, I want to set WIP limits on columns

**Specifications**:
- Columns by status (default) or sections
- Drag-and-drop between columns
- Task cards showing: title, assignee, due date, priority
- WIP limits with visual warning
- Quick add at top/bottom of column
- Swimlanes by project (optional)

**UI Mockup**:
```
┌──────────────────────────────────────────────────────────────┐
│ Board View                              [By: Status ▾] [+ Add]│
├─────────────────┬─────────────────┬─────────────────┬────────┤
│ To Do (3)       │ In Progress (2) │ Review (1)      │ Done   │
├─────────────────┼─────────────────┼─────────────────┼────────┤
│ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │        │
│ │ Task A      │ │ │ Task D      │ │ │ Task F      │ │        │
│ │ 👤 John     │ │ │ 👤 Jane     │ │ │ 👤 Bob      │ │        │
│ │ 📅 Jan 15   │ │ │ 📅 Jan 12   │ │ │ 📅 Jan 10   │ │        │
│ │ 🔴 High     │ │ │ 🟡 Medium   │ │ │ 🟢 Low      │ │        │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │        │
│ ┌─────────────┐ │ ┌─────────────┐ │                 │        │
│ │ Task B      │ │ │ Task E      │ │                 │        │
│ └─────────────┘ │ └─────────────┘ │                 │        │
└─────────────────┴─────────────────┴─────────────────┴────────┘
```

---

### 3. WBS (Work Breakdown Structure) View

**Description**: Hierarchical tree view showing the breakdown of work.

**User Stories**:
- As a user, I want to see the hierarchy of my goals/portfolios/projects/tasks
- As a user, I want to expand/collapse sections
- As a user, I want to see aggregated progress
- As a user, I want to see overdue items highlighted

**Specifications**:
- Tree structure with indent levels
- Expand/collapse controls
- Progress percentage at each level (auto-calculated from children)
- Status indicators with colors
- Assignee avatars
- Due date with overdue warning
- Quick actions (add child, edit, complete)
- Drag-and-drop to reorganize (mobile: swipe gestures)

**UI Mockup**:
```
┌──────────────────────────────────────────────────────────────┐
│ WBS View                           [Expand All] [+ New Goal] │
├──────────────────────────────────────────────────────────────┤
│ ▼ 🎯 Goal: Career Growth                    👤 Me    [75%] ● │
│   ▼ 📁 Portfolio: Technical Skills          👤 Me    [80%] ● │
│     ▼ 📋 Project: Learn TypeScript          👤 Me    [90%] ● │
│       ☑ Task: Complete tutorial    📅 Jan 5 👤 Me   [100%] ✓ │
│       ☐ Task: Build sample project 📅 Jan 20👤 Me    [80%] ● │
│         ☐ Subtask: Setup repo      📅 Jan 12👤 Me   [100%] ✓ │
│         ☐ Subtask: Write tests     📅 Jan 18👤 Me    [50%] ● │
│     ▶ 📋 Project: AWS Certification                  [60%] ● │
│   ▶ 📁 Portfolio: Leadership                         [50%] ● │
│ ▶ 🎯 Goal: Health & Fitness                          [40%] ○ │
└──────────────────────────────────────────────────────────────┘
```

---

### 4. List View

**Description**: Simple table/list view of tasks with sorting and filtering.

**User Stories**:
- As a user, I want a spreadsheet-like view of all tasks
- As a user, I want to sort by any column
- As a user, I want to filter tasks
- As a user, I want to inline edit values

**Specifications**:
- Table columns: Task, Project, Assignee, Due Date, Priority, Status, Tags
- Column sorting (click header)
- Column resizing
- Inline editing
- Multi-select actions
- Filters: status, priority, assignee, date range, tags
- Group by: project, assignee, status, priority

**UI Mockup**:
```
┌──────────────────────────────────────────────────────────────┐
│ List View        [Filter ▾] [Group: None ▾] [+ Add Task]     │
├──────────────────────────────────────────────────────────────┤
│ ☐ │ Task              │ Project    │ Assignee│ Due    │ Pri │
├───┼───────────────────┼────────────┼─────────┼────────┼─────┤
│ ☐ │ Write docs        │ Plugin Dev │ @John   │ Jan 15 │ 🔴  │
│ ☐ │ Fix timeline bug  │ Plugin Dev │ @Jane   │ Jan 12 │ 🟡  │
│ ☑ │ Setup CI/CD       │ Plugin Dev │ @Bob    │ Jan 10 │ 🟢  │
│ ☐ │ User testing      │ Plugin Dev │ @John   │ Jan 20 │ 🔴  │
│ ☐ │ Release v1.0      │ Plugin Dev │ @Team   │ Jan 25 │ 🔴  │
└──────────────────────────────────────────────────────────────┘
```

---

### 5. Calendar View

**Description**: Tasks displayed on a calendar, similar to Asana's Calendar view.

**User Stories**:
- As a user, I want to see tasks on a calendar by due date
- As a user, I want to drag tasks to reschedule
- As a user, I want to see multi-day tasks as spans

**Specifications**:
- Month, week, and day views
- Tasks placed on due dates
- Multi-day tasks span across days
- Drag to reschedule
- Color coding by project/priority
- Milestones shown as markers

---

### 6. My Tasks View

**Description**: Personal task list showing tasks assigned to me, like Asana's My Tasks.

**User Stories**:
- As a user, I want to see all tasks assigned to me
- As a user, I want to see tasks grouped by due date
- As a user, I want quick access to overdue items

**Specifications**:
- Sections: Overdue, Today, Upcoming, Later, No Date
- Task count per section
- Quick complete action
- Priority indicators
- Project context

---

### 7. Dashboard View

**Description**: Overview of all active work and metrics.

**User Stories**:
- As a user, I want to see what's due today/this week
- As a user, I want to see overdue items
- As a user, I want to see progress metrics
- As a user, I want a quick summary of my projects

**Specifications**:
- Today's tasks widget
- Upcoming deadlines widget
- Overdue items alert
- Progress charts (by goal/portfolio)
- Recent activity feed
- Quick add task
- Project health summary

---

### 8. Dependencies & Critical Path

**Description**: Task dependencies with visual representation and critical path analysis.

**User Stories**:
- As a user, I want to set dependencies between tasks
- As a user, I want to see what's blocking my work
- As a user, I want to identify the critical path

**Specifications**:
- Dependency types: Finish-to-Start (default), Start-to-Start, Finish-to-Finish, Start-to-Finish
- Lag time (positive or negative days)
- Visual arrows in timeline view
- Blocked task highlighting
- Critical path highlighting
- Circular dependency detection
- Impact analysis (what happens if this slips?)

**Frontmatter Example**:
```yaml
---
type: task
dependencies:
  - task: "[[Setup Database]]"
    type: finish-to-start
    lag: 1
  - task: "[[API Design]]"
    type: start-to-start
---
```

---

### 9. Entity Management

**Description**: Create, read, update, delete all entity types.

**User Stories**:
- As a user, I want to create a new goal/portfolio/project/section/milestone/task
- As a user, I want to edit entity details with a form or inline
- As a user, I want to link entities together
- As a user, I want to assign tasks to people
- As a user, I want to set dates, status, and priority

**Specifications**:
- Modal forms for create/edit (mobile optimized)
- Inline editing for quick changes
- Obsidian links for relationships
- Status workflow (Not Started → In Progress → Complete)
- Priority levels (Low, Medium, High, Critical)
- Date pickers with relative date support
- Assignee picker (from People folder)
- Tag autocomplete
- Custom field support

---

### 10. Obsidian Integration

**Description**: Seamless integration with Obsidian features.

**User Stories**:
- As a user, I want to use Obsidian links between entities
- As a user, I want tasks to appear in graph view
- As a user, I want to use templates for new entities
- As a user, I want to query tasks with Dataview

**Specifications**:
- Wiki-link support (`[[Project Name]]`)
- Tag integration (`#tag`)
- Template support for each entity type
- Dataview compatibility
- Graph view integration (entities as nodes, relationships as edges)
- Backlinks for relationships
- Embed tasks in other notes

**Dataview Query Examples**:
```dataview
TASK
WHERE type = "task" AND assignee = "[[John]]" AND status != "completed"
SORT dueDate ASC
```

---

## Roadmap

### Phase 1: Foundation ✅ (Current)
- [x] Project structure and documentation
- [x] Basic plugin skeleton
- [x] Data models (Asana-compatible)
- [x] Timeline view (basic)
- [x] WBS view (basic)
- [x] Mobile optimization (iPhone 15 Pro)
- [x] Settings panel

### Phase 2: Core Features
- [ ] List view
- [ ] Board/Kanban view
- [ ] Dependencies with visual arrows
- [ ] Sections within projects
- [ ] Milestones
- [ ] Subtasks
- [ ] Assignee support (People folder)
- [ ] Tags system

### Phase 3: Enhanced Views
- [ ] Calendar view
- [ ] My Tasks view
- [ ] Dashboard view
- [ ] Critical path analysis
- [ ] Drag-and-drop editing
- [ ] Inline editing

### Phase 4: Advanced Features
- [ ] Recurring tasks
- [ ] Time tracking
- [ ] Custom fields
- [ ] Project templates
- [ ] Activity log
- [ ] Filters and saved views

### Phase 5: Intelligence
- [ ] Automatic scheduling suggestions
- [ ] Dependency conflict detection
- [ ] Progress predictions
- [ ] Natural language task creation
- [ ] AI-powered insights

---

## Non-Functional Requirements

### Performance
- Initial load: < 2 seconds for 1000 tasks
- View switch: < 500ms
- Search: < 100ms

### Compatibility
- Obsidian Desktop: Windows, macOS, Linux
- Obsidian Mobile: iOS (optimized for iPhone 15 Pro), Android
- Minimum Obsidian version: 1.0.0

### Accessibility
- Keyboard navigation
- Screen reader support
- High contrast mode support
- Reduced motion support
- Touch targets: 44px minimum (Apple HIG)

---

## Data Model

### File Structure
```
vault/
├── Goals/
│   └── career-growth.md
├── Portfolios/
│   └── technical-skills.md
├── Projects/
│   └── learn-typescript.md
├── Tasks/
│   ├── complete-tutorial.md
│   └── build-sample.md
├── People/
│   ├── john.md
│   └── jane.md
└── Templates/
    ├── goal.md
    ├── project.md
    └── task.md
```

### Frontmatter Schema

**Task Example**:
```yaml
---
type: task
id: task-001
status: in-progress
priority: high
project: "[[Learn TypeScript]]"
section: "[[Development]]"
parent: null
assignee: "[[John]]"
collaborators:
  - "[[Jane]]"
startDate: 2024-01-10
dueDate: 2024-01-20
dependencies:
  - task: "[[Setup Development Environment]]"
    type: finish-to-start
progress: 50
estimatedHours: 8
actualHours: 4
tags:
  - coding
  - learning
createdAt: 2024-01-01T00:00:00Z
updatedAt: 2024-01-15T10:30:00Z
---

# Build Sample Project

Build a complete TypeScript project to practice learned concepts.

## Checklist
- [x] Initialize repo
- [ ] Setup testing
- [ ] Write main logic
- [ ] Add documentation
```
