# Timeline Viewer - TODO

## Remaining Tasks

### Week Calendar View Enhancements

- [ ] **Drag tasks horizontally** - Move tasks between days (not just up/down for time)
- [ ] **All-day row for multi-day tasks** - Restore all-day section for tasks spanning multiple days
- [ ] **Drop on all-day to convert** - Dragging a timed task to all-day makes it an all-day task
- [ ] **Drop on time grid to convert** - Dragging all-day task to time slot makes it a 1-hour task

### Dependency Graph

- [ ] **Show dependency graph in sidebar** - Visual representation of task precedence
- [ ] **Highlight dependencies on hover** - When hovering a task, show its predecessors/successors
- [ ] **Remove dependency UI** - Right-click or double-click to remove a dependency

### Task Editing

- [ ] **Inline editing** - Double-click task to edit title
- [ ] **Quick status toggle** - Right-click menu to change status
- [ ] **Delete task from calendar** - Right-click to delete

### Performance & Polish

- [ ] **Virtualized rendering** - Only render visible hour rows for large calendars
- [ ] **Smooth scroll to current time** - Auto-scroll to current time on load
- [ ] **Tooltip on hover** - Show full task details in tooltip
- [ ] **Keyboard navigation** - Arrow keys to navigate, Enter to edit

### Data Improvements

- [ ] **Update task on Obsidian file change** - Listen to vault changes and update calendar
- [ ] **Conflict detection** - Warn when tasks overlap
- [ ] **Recurring tasks** - Support for daily/weekly recurring tasks

---

## Completed Features ✓

### Week Calendar View
- [x] Sunday-Saturday columns with date headers
- [x] 24-hour time grid with scrollable area
- [x] Current time indicator (red line + dot)
- [x] Today column highlighting

### Task Display
- [x] Tasks positioned at correct time slots
- [x] Project color coding for tasks
- [x] Project legend in sidebar
- [x] Time labels on task cards

### Task Interaction
- [x] Drag to move tasks (up/down = change time)
- [x] Resize handles (top/bottom = change duration)
- [x] 15-minute snap increments
- [x] Save changes on drag end

### Dependencies
- [x] Connection handles on task cards
- [x] Drag from right handle to create dependency
- [x] Drop on left handle to complete connection
- [x] Curved SVG lines with arrowheads
- [x] Circular dependency prevention

### Task Creation
- [x] New tasks have current time as start
- [x] Default 1-hour duration
- [x] Sample tasks with realistic times (9 AM, 2 PM, etc.)
