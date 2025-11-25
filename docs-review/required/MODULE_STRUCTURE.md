# Vapour Toolbox - Module Structure

**Total Modules:** 10 (8 Active + 2 Coming Soon)
**Status:** All modules defined in `@vapour/constants`

---

## 📊 Module Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     VAPOUR TOOLBOX DASHBOARD                    │
│                                                                 │
│  User logs in → Sees module icons based on their roles         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Core Modules (4 - Foundation)

### 1. User Management

- **ID:** `user-management`
- **Icon:** People
- **Status:** Active ✅
- **Access:** SUPER_ADMIN, HR_ADMIN, DIRECTOR
- **Purpose:** Manage users, roles, permissions

### 2. Entity Management

- **ID:** `entity-management`
- **Icon:** Business
- **Status:** Active ✅
- **Access:** SUPER_ADMIN, ADMIN, ACCOUNTS, PURCHASE, ESTIMATION
- **Purpose:** Vendors, customers, partners (95% unified from existing apps)

### 3. Project Management

- **ID:** `project-management`
- **Icon:** Folder
- **Status:** Active ✅
- **Access:** All roles (with different permissions)
- **Purpose:** Project creation, team assignment, RBAC, tracking

### 4. Company Settings

- **ID:** `company-settings`
- **Icon:** Settings
- **Status:** Active ✅
- **Access:** SUPER_ADMIN, DIRECTOR
- **Purpose:** Company-wide configurations, branding, preferences

---

## 📱 Application Modules (4 - Active Applications)

### 5. Time Tracking

- **ID:** `time-tracking`
- **Icon:** AccessTime
- **Status:** Active ✅
- **Access:** All team members (time entry), MANAGER+ (reports)
- **Purpose:** Time entry across 8 work phases, analytics, reporting
- **Original App:** Time Tracker (rebuilt)

### 6. Accounting

- **ID:** `accounting`
- **Icon:** AccountBalance
- **Status:** Active ✅
- **Access:** SUPER_ADMIN, ACCOUNTS, DIRECTOR
- **Purpose:** Invoices, payments, ledger, financial reports
- **Original App:** Accounting (rebuilt)

### 7. Procurement

- **ID:** `procurement`
- **Icon:** ShoppingCart
- **Status:** Active ✅
- **Access:** SUPER_ADMIN, PURCHASE, MANAGER
- **Purpose:** Purchase orders, quotations, vendor management
- **Original App:** Procurement (rebuilt)

### 8. Estimation

- **ID:** `estimation`
- **Icon:** Calculate
- **Status:** Active ✅
- **Access:** SUPER_ADMIN, ESTIMATION, MANAGER
- **Purpose:** Cost estimates, BOQ, proposal generation
- **Original App:** Estimation (rebuilt)

---

## 🚀 Coming Soon Modules (2 - Placeholders)

### 9. Thermal Desalination Design

- **ID:** `thermal-desal`
- **Icon:** Science (TBD)
- **Status:** Coming Soon 🔜
- **Estimated Release:** Q2 2026
- **Access:** Engineering roles (TBD)
- **Purpose:** Design calculations, simulations, technical drawings

### 10. Document Management System

- **ID:** `document-management`
- **Icon:** Description (TBD)
- **Status:** Coming Soon 🔜
- **Estimated Release:** Q2 2026
- **Access:** All roles (with different permissions)
- **Purpose:** Document storage, version control, approval workflows

---

## 🎨 Dashboard Layout (Desktop-First)

### Desktop View (1920×1080+) - PRIMARY ⭐

```
┌────────┬───────────────────────────────────────────────────┐
│ [Logo] │ Vapour Toolbox            [🌓][🔔][👤][⚙️]        │
├────────┼───────────────────────────────────────────────────┤
│        │  Dashboard Home                                   │
│ 👥 User│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│ Mgmt   │  │  User  │ │ Entity │ │Project │ │Company │    │
│        │  │  Mgmt  │ │  Mgmt  │ │  Mgmt  │ │Settings│    │
│ 🏢 Entity│ └────────┘ └────────┘ └────────┘ └────────┘    │
│ Mgmt   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│        │  │  Time  │ │Account │ │Procure │ │Estimate│    │
│ 📋 Proj │  │ Track  │ │  ing   │ │  ment  │ │  ion   │    │
│ Mgmt   │  └────────┘ └────────┘ └────────┘ └────────┘    │
│        │  ┌────────┐ ┌────────┐                           │
│ 🏛️ Co  │  │Thermal │ │Document│                           │
│ Settings│  │ Desal  │ │  Mgmt  │                           │
│        │  │(Soon)  │ │(Soon)  │                           │
│━━━━━━━ │  └────────┘ └────────┘                           │
│        │                                                   │
│ ⏱️ Time │  Module cards show:                              │
│ Track  │  - Icon + Name                                    │
│        │  - Status (Active/Coming Soon)                    │
│ 💰 Acct │  - Description                                    │
│ ounting│  - "Coming Soon" badge if applicable             │
│        │                                                   │
│ 🛒 Proc │  User only sees modules they have access to      │
│ urement│                                                   │
│        │                                                   │
│ 📊 Estim│                                                   │
│ ation  │                                                   │
└────────┴───────────────────────────────────────────────────┘
  ↑ Full sidebar (240px) - Always visible
```

**Desktop Features:**

- 4-column grid for module cards
- Full sidebar with icons + labels
- Hover effects on module cards
- Tooltips for descriptions
- Role-based visibility

---

## 📱 Tablet View (900-1200px) - Occasional

```
┌──┬────────────────────────────────┐
│  │ Vapour Toolbox    [🌓][🔔][👤] │
├──┼────────────────────────────────┤
│👥│  Dashboard Home                │
│📋│  ┌──────┐ ┌──────┐ ┌──────┐   │
│💰│  │User  │ │Entity│ │Proj  │   │
│⏱️│  │Mgmt  │ │Mgmt  │ │Mgmt  │   │
│⚙️│  └──────┘ └──────┘ └──────┘   │
└──┴────────────────────────────────┘
   ↑ Icon-only (64px)
```

**Tablet Features:**

- 3-column grid
- Icon-only sidebar
- Tooltips for sidebar items

---

## 📱 Mobile View (<600px) - Rare

```
┌──────────────────────────┐
│ [☰] Vapour   [🔔][👤]    │
├──────────────────────────┤
│  Dashboard Home          │
│  ┌────────────────────┐  │
│  │ User Management    │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ Entity Management  │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ Project Management │  │
│  └────────────────────┘  │
├──────────────────────────┤
│ [👥][📋][⏱️][💰][⚙️]      │
└──────────────────────────┘
```

**Mobile Features:**

- 1-column stack
- Hamburger menu
- Bottom navigation for quick access

---

## 🔐 Role-Based Module Access

### SUPER_ADMIN

- ✅ All 10 modules (full access)

### DIRECTOR

- ✅ User Management
- ✅ Entity Management
- ✅ Project Management
- ✅ Company Settings
- ✅ Time Tracking (view all)
- ✅ Accounting (view all)
- ✅ Procurement (view all)
- ✅ Estimation (view all)

### MANAGER

- ✅ Project Management (assigned projects)
- ✅ Time Tracking (team view)
- ✅ Procurement
- ✅ Estimation

### ACCOUNTS

- ✅ Entity Management
- ✅ Accounting
- ✅ Time Tracking (view only)

### PURCHASE

- ✅ Entity Management (vendors)
- ✅ Procurement

### ESTIMATION

- ✅ Entity Management (customers)
- ✅ Estimation
- ✅ Procurement (view only)

### ENGINEERING, FINANCE, HR_ADMIN, DEVELOPER

- ✅ Project-specific access
- ✅ Time Tracking (own entries)
- ✅ Limited module visibility based on role

---

## 📦 Module States

```typescript
type ModuleStatus = 'active' | 'coming_soon' | 'maintenance';

interface ModuleDefinition {
  id: string;
  name: string;
  description?: string;
  icon: string;
  path: string;
  status: ModuleStatus;
  roles: UserRole[];
  estimatedRelease?: string; // For 'coming_soon'
  maintenanceEnd?: string; // For 'maintenance'
}
```

### Active Modules (8)

- Show with full color
- Clickable navigation
- Normal functionality

### Coming Soon Modules (2)

- Show with "Coming Soon" badge
- Muted colors (opacity: 0.6)
- Display estimated release date
- Click shows modal: "This module is under development"

### Maintenance (None currently)

- Show with "Maintenance" badge
- Display expected end time
- Click shows modal: "Module temporarily unavailable"

---

## 🎯 Module Card Design

### Desktop Card (Active Module)

```
┌────────────────────────────┐
│                            │
│        [ICON 48px]         │
│                            │
│    Module Name (H5)        │
│                            │
│  Short description text    │
│  (body2)                   │
│                            │
│      [View Module →]       │
│                            │
└────────────────────────────┘
```

**Hover Effect:**

- Subtle elevation increase
- Icon color shift to primary
- Cursor pointer

### Desktop Card (Coming Soon)

```
┌────────────────────────────┐
│  ┌──────────────────────┐  │
│  │ Coming Soon Q2 2026  │  │ ← Badge
│  └──────────────────────┘  │
│                            │
│    [ICON 48px] (muted)     │
│                            │
│    Module Name (muted)     │
│                            │
│  Available soon...         │
│                            │
└────────────────────────────┘
```

**Hover Effect:**

- Shows tooltip: "Estimated release: Q2 2026"
- No click action

---

## 🔄 Module Loading States

### Initial Dashboard Load

1. Show skeleton cards (8-10 placeholders)
2. Fetch user's CustomClaims from Firebase
3. Filter modules based on roles
4. Render only accessible modules

### Module Navigation

1. Click module card
2. Show loading overlay
3. Load module-specific code (lazy loading)
4. Navigate to module route

---

## 🎨 Color Coding (Optional)

Modules can be color-coded by category:

- **Core Modules:** Cyan (#0891B2) - Brand primary
- **Time & Projects:** Blue (#3B82F6) - Vapour blue
- **Finance:** Green (#10B981) - Money/success
- **Coming Soon:** Grey (#6B7280) - Muted

---

## 📂 File Structure Reference

```typescript
// Location: packages/constants/src/modules.ts
export const MODULES: Record<string, ModuleDefinition> = {
  USER_MANAGEMENT: {
    /* ... */
  },
  ENTITY_MANAGEMENT: {
    /* ... */
  },
  PROJECT_MANAGEMENT: {
    /* ... */
  },
  COMPANY_SETTINGS: {
    /* ... */
  },
  TIME_TRACKING: {
    /* ... */
  },
  ACCOUNTING: {
    /* ... */
  },
  PROCUREMENT: {
    /* ... */
  },
  ESTIMATION: {
    /* ... */
  },
  THERMAL_DESAL: {
    /* ... */
  },
  DOCUMENT_MANAGEMENT: {
    /* ... */
  },
};
```

---

## ✅ Current Status

- ✅ All 10 modules defined in constants
- ✅ Role-based access configured
- ✅ Icons selected (Material UI icons)
- ✅ Descriptions drafted
- ✅ Paths defined
- ⏳ Module cards component (pending)
- ⏳ Dashboard layout component (pending)
- ⏳ Module navigation logic (pending)

---

**Next Steps:** Build the Next.js dashboard to display these modules based on user roles!

---

**Created:** October 28, 2025
**Version:** 1.0
**Status:** Module registry complete, ready for implementation
