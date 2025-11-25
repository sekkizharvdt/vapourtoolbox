# Document Management System - Modern Dashboard UI Mockup

## Overview

This mockup shows a comprehensive redesign of the document management system to handle 100+ documents efficiently.

---

## 1. TOP SECTION: Summary Metrics Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 DOCUMENT OVERVIEW                                    [+ New Document] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 📄 Total     │  │ ⏰ Overdue   │  │ 👁️ In Review │  │ ✅ Completed │ │
│  │    156       │  │     12       │  │     23       │  │     89       │ │
│  │ documents    │  │ ⚠️ Critical  │  │ 🔄 Pending   │  │ This Month   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**

- Click any card to apply instant filter
- Real-time updates as document status changes
- Color-coded indicators (red for overdue, yellow for pending, green for completed)
- Hover shows breakdown by discipline

---

## 2. FILTER & VIEW CONTROLS

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍 Search documents...                                    [⚙️ Filters ▼] │
│                                                                           │
│  Quick Filters:                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ My Docs  │ │ Overdue  │ │ Pending  │ │ Client   │ [+ Create Preset] │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                           │
│  Active Filters: [Status: Pending ×] [Discipline: Mechanical ×]         │
│                                                                           │
│  View: [📊 Table] [📇 Cards] [📋 Kanban]    Group: [Discipline ▼]      │
│  Density: ○ Compact  ● Comfortable  ○ Spacious                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**

- Live search with debouncing
- Saved filter presets for common views
- One-click quick filters
- Active filters shown as removable chips
- Toggle between table/cards/kanban views
- Group by any column (discipline, status, assignee, etc.)
- Adjustable row density

---

## 3. ADVANCED FILTER DRAWER (Opens from ⚙️ Filters button)

```
┌─────────────────────────────────┐
│  Advanced Filters        [Close] │
├─────────────────────────────────┤
│                                  │
│  📝 Document Number              │
│  └─ [Contains: VDT-____]         │
│                                  │
│  📋 Status (Multi-select)        │
│  ☑ Draft                         │
│  ☑ In Progress                   │
│  ☐ Submitted                     │
│  ☑ Under Client Review           │
│  ☐ Accepted                      │
│                                  │
│  🏗️ Discipline                   │
│  ☑ Mechanical                    │
│  ☑ Electrical                    │
│  ☐ Civil                         │
│                                  │
│  👤 Assigned To                  │
│  └─ [Select users... ▼]          │
│                                  │
│  📅 Due Date Range                │
│  From: [____/__/____]            │
│  To:   [____/__/____]            │
│                                  │
│  🔢 Submission Count              │
│  └─ Min: [__] Max: [__]          │
│                                  │
│  👁️ Visibility                   │
│  ○ All                           │
│  ○ Client Visible                │
│  ○ Internal Only                 │
│                                  │
│  [Clear All]     [Apply Filters] │
│                                  │
│  Save as Preset:                 │
│  └─ [Name____] [💾 Save]         │
│                                  │
└─────────────────────────────────┘
```

---

## 4. MAIN TABLE VIEW (Grouped by Discipline)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  [☐] Select All  |  Bulk Actions: [📤 Export] [✏️ Update Status] [👤 Reassign]      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  ▼ MECHANICAL (45 documents) ─────────────────────────────────── [Collapse]         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │ [☐] VDT-MECH-001 │ Equipment Layout Drawing        │ 🟡 Review │ J.Smith │...│  │
│  │ [☐] VDT-MECH-002 │ P&ID - Main Process             │ 🔴 Overdue│ K.Jones │...│  │
│  │ [☐] VDT-MECH-003 │ Stress Analysis Report          │ 🟢 Accepted│ M.Lee  │...│  │
│  │     ... (showing 10 of 45)                                      [Load More]  │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                       │
│  ▼ ELECTRICAL (32 documents) ─────────────────────────────────── [Collapse]         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │ [☐] VDT-ELEC-001 │ Single Line Diagram             │ 🟡 Review │ A.Wong  │...│  │
│  │ [☐] VDT-ELEC-002 │ Motor Control Schedule          │ 🟢 Accepted│ B.Kim  │...│  │
│  │     ... (showing 10 of 32)                                      [Load More]  │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                       │
│  ▶ CIVIL (28 documents) ──────────────────────────────────────── [Expand]           │
│                                                                                       │
│  ▶ INSTRUMENTATION (24 documents) ───────────────────────────── [Expand]            │
│                                                                                       │
│  Showing 156 documents across 4 disciplines                    [←] [1] [2] [3] [→]  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Features:**

- Collapsible discipline groups with counts
- Virtual scrolling within each group
- Bulk selection with checkboxes
- Status indicators with color coding:
  - 🔴 Red = Overdue
  - 🟡 Yellow = Pending/In Review
  - 🟢 Green = Completed/Accepted
  - ⚪ Gray = Draft/Not Started
- Lazy loading - "Load More" for groups with many items
- Pagination at bottom for overall list

---

## 5. EXPANDABLE ROW DETAILS (Click any row)

```
│  [☑] VDT-MECH-002 │ P&ID - Main Process │ 🔴 Overdue │ K.Jones │...│ [▼]  │
├────────────────────────────────────────────────────────────────────────┤
│  📋 DETAILS                                                             │
│  ├─ Status: UNDER_CLIENT_REVIEW                                        │
│  ├─ Assigned: K. Jones, M. Smith                                       │
│  ├─ Due Date: 2024-11-20 (4 days overdue) ⚠️                          │
│  ├─ Visibility: Client Visible 👁️                                     │
│  └─ Submissions: 3 (Latest: Rev C - 2024-11-15)                       │
│                                                                         │
│  📝 DESCRIPTION                                                         │
│  └─ Process and Instrumentation Diagram showing main treatment flow    │
│                                                                         │
│  🔗 LINKED DOCUMENTS (2)                                               │
│  └─ VDT-MECH-001, VDT-INST-005                                        │
│                                                                         │
│  💬 RECENT COMMENTS (3)                                                │
│  └─ Client: "Update valve specs" - 2 days ago                         │
│                                                                         │
│  ACTIONS: [👁️ View] [📤 Submit] [🔗 Links] [💬 Comments] [✏️ Edit]   │
└────────────────────────────────────────────────────────────────────────┘
```

**Features:**

- Expand inline without navigation
- See all key details at a glance
- Quick action buttons
- Recent activity preview
- Visual indicators for overdue items

---

## 6. COMPACT TABLE COLUMNS (Default View)

### Essential Columns (Always Visible):

```
┌──────────────┬────────────────────────┬──────────┬──────────┬─────────┐
│ Doc Number   │ Title                  │ Status   │ Assignee │ Actions │
├──────────────┼────────────────────────┼──────────┼──────────┼─────────┤
│ VDT-MECH-001 │ Equipment Layout...    │ 🟡 Review│ J.Smith  │ [≡]     │
└──────────────┴────────────────────────┴──────────┴──────────┴─────────┘
```

### Additional Columns (Show/Hide via Column Picker):

- Discipline
- Sub-code
- Due Date
- Submission Count
- Visibility
- Description
- Last Modified
- Created Date
- Priority

**Column Picker Menu:**

```
┌─────────────────────┐
│ Show/Hide Columns   │
├─────────────────────┤
│ ☑ Document Number   │
│ ☑ Title             │
│ ☑ Status            │
│ ☑ Assignee          │
│ ☐ Discipline        │
│ ☐ Due Date          │
│ ☐ Submissions       │
│ ☐ Visibility        │
│ ☐ Description       │
│                     │
│ [Reset to Default]  │
└─────────────────────┘
```

---

## 7. CARD VIEW (Alternative Layout)

```
┌────────────────────────────────────────────────────────────────────────┐
│  MECHANICAL (45)                                            [Collapse ▲]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────┐  ┌───────────────────────┐                 │
│  │ VDT-MECH-001          │  │ VDT-MECH-002  🔴     │                 │
│  │ Equipment Layout      │  │ P&ID - Main Process   │                 │
│  │ ─────────────────────  │  │ ─────────────────────  │                 │
│  │ 🟡 Review              │  │ 🔴 Overdue (4d)        │                 │
│  │ 👤 J. Smith            │  │ 👤 K. Jones            │                 │
│  │ 📅 Due: Nov 25         │  │ 📅 Due: Nov 20         │                 │
│  │ 📤 3 submissions       │  │ 📤 3 submissions       │                 │
│  │                       │  │                       │                 │
│  │ [👁️ View] [✏️ Edit]   │  │ [👁️ View] [✏️ Edit]   │                 │
│  └───────────────────────┘  └───────────────────────┘                 │
│                                                                          │
│  ┌───────────────────────┐  ┌───────────────────────┐                 │
│  │ VDT-MECH-003          │  │ VDT-MECH-004          │                 │
│  │ Stress Analysis       │  │ Material Specs        │                 │
│  │ ...                   │  │ ...                   │                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. KANBAN VIEW (Status-based)

```
┌──────────────┬──────────────┬──────────────┬──────────────┬────────────┐
│ DRAFT (12)   │ IN REVIEW(23)│ SUBMITTED(18)│ ACCEPTED(89) │ REJECTED(2)│
├──────────────┼──────────────┼──────────────┼──────────────┼────────────┤
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌────────┐ │
│ │VDT-MECH  │ │ │VDT-ELEC  │ │ │VDT-CIVIL │ │ │VDT-INST  │ │ │VDT-... │ │
│ │-001      │ │ │-005  🔴  │ │ │-012      │ │ │-003      │ │ │        │ │
│ │J.Smith   │ │ │K.Jones   │ │ │A.Wong    │ │ │B.Kim     │ │ └────────┘ │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘ │            │
│              │              │              │              │            │
│ ┌──────────┐ │ ┌──────────┐ │              │ ┌──────────┐ │            │
│ │VDT-...   │ │ │VDT-...   │ │              │ │VDT-...   │ │            │
│ └──────────┘ │ └──────────┘ │              │ └──────────┘ │            │
│              │              │              │              │            │
│ [+ Add]      │              │              │              │            │
└──────────────┴──────────────┴──────────────┴──────────────┴────────────┘
```

**Features:**

- Drag and drop cards between columns to update status
- Column counts show total in each status
- Scroll within each column for many items
- Red indicator for overdue items
- Quick add button in each column

---

## 9. BULK ACTIONS

When items are selected:

```
┌────────────────────────────────────────────────────────────────────┐
│  ✓ 12 documents selected                                           │
│                                                                     │
│  Actions:                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ Update Status│ │ Reassign     │ │ Set Due Date │              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ Export CSV   │ │ Export PDF   │ │ Generate CRT │              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
│                                                                     │
│  ┌──────────────┐                                                 │
│  │ Bulk Submit  │                                                 │
│  └──────────────┘                                                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 10. SAVED FILTER PRESETS

```
┌──────────────────────────────────────────────┐
│ My Saved Views                    [+ Create] │
├──────────────────────────────────────────────┤
│ ⭐ My Documents                              │
│    └─ Assigned to me, not completed          │
│                                              │
│ 🔥 Overdue Items                             │
│    └─ Past due date, any status              │
│                                              │
│ 👁️ Client Visible                           │
│    └─ Visibility: Client, All statuses       │
│                                              │
│ 📋 Pending My Review                         │
│    └─ Status: Submitted, Assigned to me      │
│                                              │
│ 📅 Due This Week                             │
│    └─ Due date: Next 7 days                  │
│                                              │
│ [Edit] [Delete] [Share Link]                │
└──────────────────────────────────────────────┘
```

---

## 11. PERFORMANCE OPTIMIZATIONS

### Virtual Scrolling

- Only renders visible rows + small buffer
- Handles 1000+ documents smoothly
- Lazy loads data as user scrolls

### Smart Grouping

- Collapses groups by default
- Loads group data on expand
- Shows counts without loading all items

### Debounced Search

- 300ms delay before search executes
- Cancels previous searches
- Shows loading indicator

### Pagination

- Load 50 items per group initially
- "Load More" button for additional items
- Infinite scroll option

---

## 12. RESPONSIVE DESIGN

### Desktop (> 1200px)

- Full table with all columns
- Side-by-side filter drawer
- 4-column card grid

### Tablet (768px - 1200px)

- Condensed table (hide less important columns)
- Overlay filter drawer
- 2-column card grid

### Mobile (< 768px)

- Card view only (table too complex)
- Full-screen filter drawer
- 1-column card grid
- Sticky header with search and filter button

---

## 13. KEYBOARD SHORTCUTS

```
Global:
- / : Focus search
- Ctrl+F : Open advanced filters
- Ctrl+N : New document
- Esc : Clear selections/close dialogs

Navigation:
- ↑↓ : Navigate rows
- Enter : Expand/collapse row
- Space : Select/deselect row

Selection:
- Ctrl+A : Select all visible
- Shift+Click : Range select
- Ctrl+Click : Multi-select

Views:
- Ctrl+1 : Table view
- Ctrl+2 : Card view
- Ctrl+3 : Kanban view
```

---

## 14. VISUAL MOCKUP KEY

**Status Colors:**

- 🔴 Red: Overdue, Critical, Rejected
- 🟡 Yellow: In Progress, Under Review, Pending
- 🟢 Green: Completed, Accepted, Approved
- ⚪ Gray: Draft, Not Started, Inactive
- 🔵 Blue: Submitted, Client Visible

**Icons:**

- 📄 Document
- ⏰ Time/Due Date
- 👤 Person/Assignee
- 📤 Submission/Send
- 💬 Comment
- 🔗 Link/Relationship
- ✏️ Edit
- 👁️ View
- 🔍 Search
- ⚙️ Settings/Filters
- 📊 Dashboard/Analytics
- 📋 List/Kanban
- 📇 Cards

---

## IMPLEMENTATION PRIORITY

### Phase 1: Essential (Week 1)

✅ Summary metrics cards
✅ Enhanced search and filters
✅ Grouping by discipline
✅ Collapsible groups
✅ Better status indicators
✅ Compact view option

### Phase 2: Productivity (Week 2)

⏳ Bulk selection and actions
⏳ Saved filter presets
⏳ Column show/hide
⏳ Row expansion for details
⏳ Export functionality

### Phase 3: Advanced (Week 3)

⏳ Card view layout
⏳ Kanban board view
⏳ Virtual scrolling
⏳ Advanced filter drawer
⏳ Keyboard shortcuts

### Phase 4: Polish (Week 4)

⏳ Drag and drop (Kanban)
⏳ Responsive mobile view
⏳ View persistence (save in URL)
⏳ Performance optimizations

---

## TECHNICAL STACK RECOMMENDATIONS

### For Virtual Scrolling:

- `react-window` or `react-virtuoso`
- Handles 10,000+ rows efficiently

### For Data Grid:

- MUI DataGrid Pro (if budget allows)
- Or custom implementation with MUI Table + react-window

### For Drag & Drop (Kanban):

- `@dnd-kit/core` (modern, performant)
- Or `react-beautiful-dnd` (more mature)

### For State Management:

- Continue with React useState for filters
- Consider `zustand` for complex cross-component state
- Persist filters in URL with `next/navigation`

---

## NEXT STEPS

1. **Review this mockup** - Does this align with your vision?
2. **Prioritize features** - Which features are must-haves?
3. **Confirm approach** - Start with Phase 1 essentials?
4. **Data concerns** - Any specific fields/filters we should add?
5. **User feedback** - Any team members who should review this?

Let me know your thoughts and I'll start implementation!
