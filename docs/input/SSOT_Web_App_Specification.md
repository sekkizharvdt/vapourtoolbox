# Process Master Data Management System

## Technical Specification Document

**Version:** 1.0  
**Date:** December 6, 2024  
**Project:** Single Source of Truth (SSOT) Web Application  
**Stack:** Next.js + Firebase (Firestore + Authentication)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Data Model](#3-data-model)
4. [User Interface Design](#4-user-interface-design)
5. [Features & Functionality](#5-features--functionality)
6. [Technical Architecture](#6-technical-architecture)
7. [API Design](#7-api-design)
8. [Security & Access Control](#8-security--access-control)
9. [Implementation Phases](#9-implementation-phases)
10. [Future Enhancements](#10-future-enhancements)

---

## 1. Executive Summary

### 1.1 Purpose

Build a web-based Single Source of Truth (SSOT) system for thermal desalination plant engineering data. The system will replace Excel-based data management with a robust, multi-user web application that ensures data consistency across Process Flow Diagrams (PFDs), Piping & Instrumentation Diagrams (P&IDs), and engineering lists.

### 1.2 Key Benefits

- **Real-time collaboration**: Multiple engineers can work simultaneously
- **Data integrity**: Automatic validation and relationship enforcement
- **Traceability**: Full audit trail of changes
- **Accessibility**: Access from anywhere via web browser
- **Automation**: Auto-calculation of derived values (pipe sizing, velocities)
- **Export capability**: Generate Excel reports matching existing formats

### 1.3 Core Entities

| Entity     | Description                                 | Excel Equivalent    |
| ---------- | ------------------------------------------- | ------------------- |
| Project    | Container for all project data              | Workbook            |
| Stream     | Process stream with flow/pressure/temp data | INPUT_DATA rows     |
| Equipment  | Plant equipment (vessels, pumps, tanks)     | LIST_OF_EQUIPMENT   |
| Line       | Piping lines with sizing calculations       | LIST OF LINES       |
| Instrument | Measurement and control instruments         | LIST OF INSTRUMENTS |
| Valve      | Process and control valves                  | LIST OF VALVES      |
| PipeSpec   | Pipe specification reference data           | Pipe Table          |

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js)                         │
├─────────────────────────────────────────────────────────────────┤
│  Pages/Routes          │  Components           │  State         │
│  - /projects           │  - DataGrid           │  - React Query │
│  - /projects/[id]      │  - FormInputs         │  - Zustand     │
│  - /streams            │  - Charts             │  - Context     │
│  - /equipment          │  - Navigation         │                │
│  - /lines              │  - Modals             │                │
│  - /instruments        │  - ExportPanel        │                │
│  - /valves             │                       │                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FIREBASE SERVICES                          │
├──────────────────┬──────────────────┬───────────────────────────┤
│   Firestore      │  Authentication  │  Cloud Functions          │
│   (Database)     │  (Users/Roles)   │  (Calculations/Export)    │
└──────────────────┴──────────────────┴───────────────────────────┘
```

### 2.2 Technology Stack

| Layer                | Technology               | Purpose                        |
| -------------------- | ------------------------ | ------------------------------ |
| Frontend             | Next.js 14+ (App Router) | Server-side rendering, routing |
| UI Framework         | Tailwind CSS + shadcn/ui | Styling and components         |
| State Management     | React Query + Zustand    | Server state + client state    |
| Database             | Firebase Firestore       | NoSQL document database        |
| Authentication       | Firebase Auth            | User management                |
| Serverless Functions | Firebase Cloud Functions | Backend calculations           |
| File Storage         | Firebase Storage         | Excel export files             |
| Hosting              | Firebase Hosting         | CDN and hosting                |

---

## 3. Data Model

### 3.1 Firestore Collection Structure

```
/projects/{projectId}
    ├── /streams/{streamId}
    ├── /equipment/{equipmentId}
    ├── /lines/{lineId}
    ├── /instruments/{instrumentId}
    ├── /valves/{valveId}
    └── /pipeSpecs/{pipeSpecId}
```

### 3.2 Document Schemas

#### 3.2.1 Project Document

```typescript
interface Project {
  id: string;
  name: string;
  projectNumber: string;
  client: string;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // User ID
  status: 'draft' | 'active' | 'completed' | 'archived';
  settings: {
    defaultUnits: 'metric' | 'imperial';
    velocityLimits: {
      seaWater: { min: number; max: number };
      brine: { min: number; max: number };
      distillate: { min: number; max: number };
      steam: { min: number; max: number };
    };
  };
}
```

#### 3.2.2 Stream Document (INPUT_DATA equivalent)

```typescript
interface Stream {
  id: string;
  projectId: string;

  // Identification
  lineTag: string; // e.g., "SW1", "B1", "D1", "ST1"
  category: FluidCategory; // Enum: SEA_WATER, BRINE, DISTILLATE, STEAM, NCG, FEED_WATER
  description: string;

  // Process Data
  flowRate: {
    kgPerSec: number; // Primary input
    kgPerHour: number; // Calculated: kgPerSec * 3600
    m3PerHour?: number; // Calculated: kgPerHour / density
  };
  pressure: {
    mbarAbs: number; // Primary input
    barAbs: number; // Calculated: mbarAbs / 1000
  };
  temperature: number; // °C
  density: number; // kg/m³
  tds: number; // ppm (Total Dissolved Solids)
  enthalpy: number; // kJ/kg (ref: Pure Water, 0°C, 1 atm)

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;

  // Derived from formula (optional - for special streams)
  derivedFrom?: {
    sourceStreamId: string;
    formula: string; // e.g., "parent / 3"
  };
}

type FluidCategory = 'SEA_WATER' | 'BRINE' | 'DISTILLATE' | 'STEAM' | 'NCG' | 'FEED_WATER';
```

#### 3.2.3 Equipment Document

```typescript
interface Equipment {
  id: string;
  projectId: string;

  // Identification
  name: string; // e.g., "MED Train - 1"
  tagNumber: string; // e.g., "MED - E1"
  type: EquipmentType;

  // Operating Conditions (references to streams)
  operatingPressure: {
    streamRef?: string; // Reference to stream for auto-lookup
    manualValue?: number; // Or manual override
    unit: 'mbar' | 'bar';
  };
  operatingTemperature: {
    streamRef?: string;
    manualValue?: number;
    unit: 'C';
  };

  // Fluid Connections (references to streams)
  fluidsIn: string[]; // Array of stream IDs (up to 5)
  fluidsOut: string[]; // Array of stream IDs (up to 4)

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type EquipmentType =
  | 'FLASH_VESSEL'
  | 'MED_TRAIN'
  | 'CONDENSER'
  | 'HEAT_EXCHANGER'
  | 'PUMP'
  | 'TANK'
  | 'OTHER';
```

#### 3.2.4 Line Document

```typescript
interface Line {
  id: string;
  projectId: string;

  // Identification
  lineNumber: string; // e.g., "200-40-SS-SW-01"
  fluidType: string; // e.g., "Sea water"

  // Reference to Input Data
  streamRef: string; // Reference to stream document

  // Sizing Inputs
  targetVelocity: number; // m/s (user input)

  // Calculated Values (computed on save)
  calculated: {
    flowRate: number; // kg/s (from stream)
    density: number; // kg/m³ (from stream)
    innerDiameter: number; // mm (calculated)
    selectedPipeSize: string; // NB size from pipe spec
    selectedInnerDia: number; // mm (from pipe spec lookup)
    actualVelocity: number; // m/s (recalculated with selected pipe)
  };

  // Material Specification
  material: string; // e.g., "SS" (Stainless Steel)
  schedule: string; // e.g., "40"

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 3.2.5 Instrument Document

```typescript
interface Instrument {
  id: string;
  projectId: string;

  // Identification
  pidNumber: string; // P&ID reference
  tagNumber: string; // e.g., "PIT-101"
  instrumentValveNo: string; // e.g., "IV-101"
  serviceLocation: string;
  instrumentType: InstrumentType;

  // Reference (either line OR equipment)
  referenceType: 'line' | 'equipment';
  lineRef?: string; // Reference to Line document
  equipmentRef?: string; // Reference to Equipment document

  // Fluid
  fluid: string;

  // Operating Conditions (auto-filled from reference, with min/max for user input)
  operatingConditions: {
    pressure: {
      min?: number; // User input
      normal: number; // Auto-calculated from reference
      max?: number; // User input
      unit: 'mbar';
    };
    temperature: {
      min?: number;
      normal: number;
      max?: number;
      unit: 'C';
    };
    flowRate: {
      min?: number;
      normal?: number; // Only for line references
      max?: number;
      unit: 'kg/hr';
    };
    tds: {
      min?: number;
      normal?: number; // Only for line references
      max?: number;
      unit: 'ppm';
    };
  };

  // Instrument Specifications
  instrumentData: {
    range: string;
    type: string;
    endConnection: string;
    moc: string; // Material of Construction
    installation: string;
    accessories: string;
  };

  // Hookup & Signal
  hookupDiagram: string;
  signalType: {
    local: boolean;
    plc: boolean;
    ioType: string;
  };

  // Model & Accessories
  modelNumber: string;
  accessories: string;
  remarks: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type InstrumentType =
  | 'PRESSURE_TRANSMITTER'
  | 'PRESSURE_GAUGE'
  | 'TEMPERATURE_TRANSMITTER'
  | 'TEMPERATURE_ELEMENT'
  | 'FLOW_TRANSMITTER'
  | 'LEVEL_TRANSMITTER'
  | 'LEVEL_GAUGE'
  | 'LEVEL_SWITCH'
  | 'POSITION_TRANSMITTER'
  | 'OTHER';
```

#### 3.2.6 Valve Document

```typescript
interface Valve {
  id: string;
  projectId: string;

  // Identification
  pidNumber: string;
  lineNumber: string; // Display value
  valveTagNo: string; // e.g., "BFV-101"
  serviceLocation: string;

  // Reference (either line OR equipment)
  referenceType: 'line' | 'equipment';
  lineRef?: string;
  equipmentRef?: string;

  // Valve Specification
  valveType: ValveType;
  endConnection: string; // e.g., "FLANGED", "THREADED"
  sizeNB: string; // e.g., "NB200"
  fluid: string;

  // Operating Conditions
  operatingConditions: {
    pressure: {
      min?: number;
      normal: number; // Bar (not mbar)
      max?: number;
      unit: 'bar';
    };
    temperature: {
      min?: number;
      normal: number;
      max?: number;
      unit: 'C';
    };
    flow: {
      min?: number;
      normal?: number; // m³/hr
      max?: number;
      unit: 'm3/hr';
    };
  };
  deltaPressure?: number; // bar

  // Valve Data
  valveData: {
    operation: string; // Manual, Pneumatic, etc.
    type: string;
    endConnection: string;
    body: string;
    trim: string;
    seat: string;
    packingMaterial: string;
    leakageClass: string;
  };

  // Signal
  signalType: {
    local: boolean;
    plc: boolean;
    ioType: string;
  };

  // Model & Accessories
  modelNumber: string;
  accessories: string;
  remarks: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type ValveType =
  | 'BALL_VALVE'
  | 'BUTTERFLY_VALVE'
  | 'GATE_VALVE'
  | 'GLOBE_VALVE'
  | 'CHECK_VALVE'
  | 'CONTROL_VALVE'
  | 'SAFETY_VALVE'
  | 'OTHER';
```

#### 3.2.7 Pipe Specification Document

```typescript
interface PipeSpec {
  id: string;
  projectId: string;

  // Lookup key (rounded ID in mm)
  lookupId: number; // e.g., 20, 30, 40...

  // Dimensions
  innerDiameter: number; // mm
  nominalSize: string; // e.g., "NB25", "NB40"
  outerDiameter: number; // mm
  wallThickness: number; // mm (Schedule 40)

  // Metadata
  schedule: string; // "40"
}
```

### 3.3 Relationship Diagram

```
                    ┌─────────────┐
                    │   PROJECT   │
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   STREAMS   │◄────│  EQUIPMENT  │     │  PIPE_SPECS │
│ (INPUT_DATA)│     │             │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │     ┌─────────────┴─────────────┐     │
       │     │                           │     │
       ▼     ▼                           ▼     ▼
┌─────────────────┐               ┌─────────────────┐
│      LINES      │               │      LINES      │
│  (uses stream   │               │ (uses pipe spec │
│   for sizing)   │               │  for selection) │
└────────┬────────┘               └─────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│INSTRUM.│ │ VALVES │
│        │ │        │
└────────┘ └────────┘

Legend:
──► references (lookup)
```

---

## 4. User Interface Design

### 4.1 Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│  SSOT System                    [Project: ABC-2024] [User ▼]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐                                           │
│  │ 📁 Projects  │ ──► Project list & selection              │
│  ├──────────────┤                                           │
│  │ 📊 Dashboard │ ──► Overview, stats, recent changes       │
│  ├──────────────┤                                           │
│  │ 🌊 Streams   │ ──► INPUT_DATA management                 │
│  ├──────────────┤                                           │
│  │ ⚙️ Equipment │ ──► Equipment list                        │
│  ├──────────────┤                                           │
│  │ 📏 Lines     │ ──► Line sizing & list                    │
│  ├──────────────┤                                           │
│  │ 📐 Instruments│ ──► Instrument list                      │
│  ├──────────────┤                                           │
│  │ 🔧 Valves    │ ──► Valve list                            │
│  ├──────────────┤                                           │
│  │ 📋 Reports   │ ──► Export to Excel                       │
│  ├──────────────┤                                           │
│  │ ⚙️ Settings  │ ──► Pipe specs, units, preferences        │
│  └──────────────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Key UI Components

#### 4.2.1 Data Grid Component

Primary component for viewing and editing tabular data:

- Sortable columns
- Filterable by any column
- Inline editing with validation
- Row selection for bulk operations
- Column visibility toggle
- Export selected rows

#### 4.2.2 Reference Selector

Dropdown component for selecting references:

- Searchable dropdown
- Shows both ID and description
- Groups by category (for streams)
- Preview of selected item's data

#### 4.2.3 Calculated Field Display

Read-only field that shows calculated values:

- Displays formula (on hover/tooltip)
- Shows source reference
- Auto-updates when source changes
- Visual indicator for derived values

#### 4.2.4 Min/Normal/Max Input Group

Triple input for operating conditions:

```
┌─────────────────────────────────────────┐
│ Pressure (bar)                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │   Min   │ │ Normal  │ │   Max   │     │
│ │  [   ]  │ │ [3.50]  │ │  [   ]  │     │
│ │ (input) │ │ (auto)  │ │ (input) │     │
│ └─────────┘ └─────────┘ └─────────┘     │
└─────────────────────────────────────────┘
```

### 4.3 Page Layouts

#### 4.3.1 Streams Page (INPUT_DATA)

```
┌─────────────────────────────────────────────────────────────┐
│ Streams                                    [+ Add Stream]   │
├─────────────────────────────────────────────────────────────┤
│ Category: [All ▼]  Search: [____________]  [Export Excel]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SEA WATER                                        [−/+]  │ │
│ ├─────┬──────────┬────────┬────────┬──────┬───────┬──────┤ │
│ │ Tag │ Flow kg/s│ Flow   │Pressure│ Temp │Density│ TDS  │ │
│ │     │          │ kg/hr  │ bar    │  °C  │ kg/m³ │ ppm  │ │
│ ├─────┼──────────┼────────┼────────┼──────┼───────┼──────┤ │
│ │ SW1 │  32.09   │115,522 │  1.00  │ 30.0 │1026.3 │39504 │ │
│ │ SW2 │  32.09   │115,522 │  3.50  │ 30.1 │1026.4 │39504 │ │
│ │ ... │          │        │        │      │       │      │ │
│ └─────┴──────────┴────────┴────────┴──────┴───────┴──────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ BRINE WATER                                      [−/+]  │ │
│ ├─────┬──────────┬────────┬────────┬──────┬───────┬──────┤ │
│ │ B1  │  ...     │        │        │      │       │      │ │
│ └─────┴──────────┴────────┴────────┴──────┴───────┴──────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3.2 Lines Page (with Sizing Calculator)

```
┌─────────────────────────────────────────────────────────────┐
│ Piping Lines                                  [+ Add Line]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │Line No.        │Stream Ref│Target │Calc ID│Selected│Act.│ │
│ │                │          │Vel m/s│  mm   │  ID mm │Vel │ │
│ ├────────────────┼──────────┼───────┼───────┼────────┼────┤ │
│ │200-40-SS-SW-01 │ SW1 ▼    │ 1.6   │157.74 │ 202.74 │0.97│ │
│ │200-40-SS-SW-02 │ SW2 ▼    │ 1.6   │157.73 │ 202.74 │0.97│ │
│ │100-40-SS-SW-03 │ SW3 ▼    │ 2.0   │ 83.31 │ 102.26 │1.36│ │
│ └────────────────┴──────────┴───────┴───────┴────────┴────┘ │
│                                                             │
│ 📊 Velocity Check: ● Within range  ○ Warning  ○ Error       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Features & Functionality

### 5.1 Core Features

| Feature              | Description                                       | Priority |
| -------------------- | ------------------------------------------------- | -------- |
| Project Management   | Create, edit, archive projects                    | P0       |
| Stream Data Entry    | Add/edit process stream data                      | P0       |
| Equipment Management | Manage equipment with stream references           | P0       |
| Line Sizing          | Auto-calculate pipe sizes from flow/velocity      | P0       |
| Instrument List      | Manage instruments with lookup to lines/equipment | P0       |
| Valve List           | Manage valves with lookup to lines/equipment      | P0       |
| Excel Export         | Export data in original Excel format              | P0       |
| User Authentication  | Login, roles, permissions                         | P0       |

### 5.2 Auto-Calculation Rules

#### 5.2.1 Stream Calculations

```javascript
// On stream save:
flowRate.kgPerHour = flowRate.kgPerSec * 3600;
flowRate.m3PerHour = flowRate.kgPerHour / density;
pressure.barAbs = pressure.mbarAbs / 1000;
```

#### 5.2.2 Line Sizing Calculations

```javascript
// When stream or target velocity changes:
const flow_m3_per_sec = stream.flowRate.kgPerSec / stream.density;
const calculated_diameter_m = Math.sqrt((4 * flow_m3_per_sec) / (Math.PI * targetVelocity));
const calculated_diameter_mm = calculated_diameter_m * 1000;

// Lookup pipe spec
const roundedId = Math.ceil(calculated_diameter_mm / 10) * 10;
const selectedPipe = pipeSpecs.find((p) => p.lookupId >= roundedId);

// Recalculate actual velocity
const actual_velocity =
  (4 * flow_m3_per_sec) / (Math.PI * Math.pow(selectedPipe.innerDiameter / 1000, 2));
```

#### 5.2.3 Instrument/Valve Operating Conditions

```javascript
// When reference changes:
if (referenceType === 'line') {
  const line = getLine(lineRef);
  const stream = getStream(line.streamRef);
  operatingConditions.pressure.normal = stream.pressure.mbarAbs; // or barAbs for valves
  operatingConditions.temperature.normal = stream.temperature;
  operatingConditions.flowRate.normal = stream.flowRate.kgPerHour; // or m3PerHour for valves
  operatingConditions.tds.normal = stream.tds;
} else if (referenceType === 'equipment') {
  const equipment = getEquipment(equipmentRef);
  const pressureStream = getStream(equipment.operatingPressure.streamRef);
  operatingConditions.pressure.normal = pressureStream.pressure.mbarAbs;
  operatingConditions.temperature.normal = pressureStream.temperature;
  // Flow and TDS not applicable for equipment-based instruments
}
```

### 5.3 Validation Rules

| Entity     | Rule                                   | Error Message                        |
| ---------- | -------------------------------------- | ------------------------------------ |
| Stream     | lineTag must be unique within category | "Line tag already exists"            |
| Stream     | flowRate > 0                           | "Flow rate must be positive"         |
| Stream     | density between 500-2000 kg/m³         | "Density out of range"               |
| Line       | lineNumber must be unique              | "Line number already exists"         |
| Line       | targetVelocity between 0.5-5 m/s       | "Velocity outside recommended range" |
| Instrument | tagNumber must be unique               | "Tag number already exists"          |
| Valve      | valveTagNo must be unique              | "Valve tag already exists"           |

---

## 6. Technical Architecture

### 6.1 Project Structure (Next.js App Router)

```
/app
├── (auth)
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)
│   ├── layout.tsx              # Authenticated layout with sidebar
│   ├── page.tsx                # Dashboard home
│   ├── projects/
│   │   ├── page.tsx            # Project list
│   │   └── [projectId]/
│   │       ├── page.tsx        # Project overview
│   │       ├── streams/page.tsx
│   │       ├── equipment/page.tsx
│   │       ├── lines/page.tsx
│   │       ├── instruments/page.tsx
│   │       ├── valves/page.tsx
│   │       └── settings/page.tsx
│   └── reports/page.tsx
├── api/
│   ├── projects/route.ts
│   ├── streams/route.ts
│   ├── calculations/route.ts
│   └── export/route.ts
├── layout.tsx
└── page.tsx                    # Landing page

/components
├── ui/                         # shadcn/ui components
├── data-grid/
│   ├── DataGrid.tsx
│   ├── EditableCell.tsx
│   └── ColumnFilter.tsx
├── forms/
│   ├── StreamForm.tsx
│   ├── EquipmentForm.tsx
│   ├── LineForm.tsx
│   ├── InstrumentForm.tsx
│   └── ValveForm.tsx
├── selectors/
│   ├── StreamSelector.tsx
│   ├── LineSelector.tsx
│   └── EquipmentSelector.tsx
└── layout/
    ├── Sidebar.tsx
    ├── Header.tsx
    └── ProjectSwitcher.tsx

/lib
├── firebase/
│   ├── config.ts               # Firebase initialization
│   ├── auth.ts                 # Auth utilities
│   └── firestore.ts            # Firestore utilities
├── hooks/
│   ├── useProject.ts
│   ├── useStreams.ts
│   ├── useLines.ts
│   └── useCalculations.ts
├── utils/
│   ├── calculations.ts         # Pipe sizing formulas
│   ├── validation.ts           # Validation rules
│   └── export.ts               # Excel export logic
└── types/
    └── index.ts                # TypeScript interfaces

/functions                      # Firebase Cloud Functions
├── src/
│   ├── index.ts
│   ├── calculations.ts         # Server-side calculations
│   ├── export.ts               # Excel generation
│   └── triggers.ts             # Firestore triggers
└── package.json
```

### 6.2 State Management

```typescript
// Zustand store for UI state
interface AppState {
  currentProject: Project | null;
  setCurrentProject: (project: Project) => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Filter states
  streamFilter: {
    category: FluidCategory | 'ALL';
    search: string;
  };
  setStreamFilter: (filter: Partial<StreamFilter>) => void;
}

// React Query for server state
const useStreams = (projectId: string) => {
  return useQuery({
    queryKey: ['streams', projectId],
    queryFn: () => fetchStreams(projectId),
  });
};

const useUpdateStream = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateStream,
    onSuccess: () => {
      queryClient.invalidateQueries(['streams']);
      queryClient.invalidateQueries(['lines']); // Lines depend on streams
    },
  });
};
```

### 6.3 Real-time Updates

```typescript
// Firestore real-time listener
useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, `projects/${projectId}/streams`), (snapshot) => {
    const streams = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setStreams(streams);
  });

  return () => unsubscribe();
}, [projectId]);
```

---

## 7. API Design

### 7.1 REST Endpoints (Next.js API Routes)

| Method | Endpoint                                | Description                |
| ------ | --------------------------------------- | -------------------------- |
| GET    | `/api/projects`                         | List all projects for user |
| POST   | `/api/projects`                         | Create new project         |
| GET    | `/api/projects/[id]`                    | Get project details        |
| PUT    | `/api/projects/[id]`                    | Update project             |
| DELETE | `/api/projects/[id]`                    | Archive project            |
| GET    | `/api/projects/[id]/streams`            | List streams               |
| POST   | `/api/projects/[id]/streams`            | Create stream              |
| PUT    | `/api/projects/[id]/streams/[streamId]` | Update stream              |
| DELETE | `/api/projects/[id]/streams/[streamId]` | Delete stream              |
| POST   | `/api/projects/[id]/calculate-line`     | Calculate line sizing      |
| POST   | `/api/projects/[id]/export`             | Generate Excel export      |

### 7.2 Cloud Functions

```typescript
// Trigger: When stream is updated
export const onStreamUpdate = functions.firestore
  .document('projects/{projectId}/streams/{streamId}')
  .onUpdate(async (change, context) => {
    const { projectId, streamId } = context.params;

    // Recalculate all lines that reference this stream
    const linesSnapshot = await admin
      .firestore()
      .collection(`projects/${projectId}/lines`)
      .where('streamRef', '==', streamId)
      .get();

    const batch = admin.firestore().batch();

    for (const lineDoc of linesSnapshot.docs) {
      const line = lineDoc.data();
      const newStream = change.after.data();

      const calculated = calculateLineSizing(newStream, line.targetVelocity);
      batch.update(lineDoc.ref, { calculated });
    }

    await batch.commit();
  });
```

---

## 8. Security & Access Control

### 8.1 Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isProjectMember(projectId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
    }

    function isProjectAdmin(projectId) {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid)).data.role == 'admin';
    }

    // Project rules
    match /projects/{projectId} {
      allow read: if isProjectMember(projectId);
      allow create: if isAuthenticated();
      allow update, delete: if isProjectAdmin(projectId);

      // Subcollections
      match /streams/{streamId} {
        allow read: if isProjectMember(projectId);
        allow write: if isProjectMember(projectId);
      }

      match /equipment/{equipmentId} {
        allow read: if isProjectMember(projectId);
        allow write: if isProjectMember(projectId);
      }

      match /lines/{lineId} {
        allow read: if isProjectMember(projectId);
        allow write: if isProjectMember(projectId);
      }

      match /instruments/{instrumentId} {
        allow read: if isProjectMember(projectId);
        allow write: if isProjectMember(projectId);
      }

      match /valves/{valveId} {
        allow read: if isProjectMember(projectId);
        allow write: if isProjectMember(projectId);
      }
    }
  }
}
```

### 8.2 User Roles

| Role   | Permissions                                    |
| ------ | ---------------------------------------------- |
| Viewer | Read all project data                          |
| Editor | Read + Write all project data                  |
| Admin  | Read + Write + Manage members + Delete project |
| Owner  | All permissions + Transfer ownership           |

---

## 9. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

- [ ] Set up Next.js project with TypeScript
- [ ] Configure Firebase (Auth, Firestore)
- [ ] Implement authentication (login/register)
- [ ] Create project CRUD operations
- [ ] Basic layout with sidebar navigation

### Phase 2: Core Data Entry (Weeks 3-4)

- [ ] Streams page with DataGrid
- [ ] Stream form with validation
- [ ] Equipment page and form
- [ ] Reference selector component

### Phase 3: Line Sizing (Weeks 5-6)

- [ ] Lines page with calculations
- [ ] Pipe specification management
- [ ] Auto-calculation on stream reference change
- [ ] Velocity validation warnings

### Phase 4: Instruments & Valves (Weeks 7-8)

- [ ] Instruments page with dual-reference support
- [ ] Valves page with unit conversions
- [ ] Min/Normal/Max input component
- [ ] Auto-lookup for Normal values

### Phase 5: Export & Polish (Weeks 9-10)

- [ ] Excel export matching original format
- [ ] Dashboard with project statistics
- [ ] Real-time updates
- [ ] Performance optimization
- [ ] User testing and bug fixes

### Phase 6: Advanced Features (Weeks 11-12)

- [ ] Audit trail / change history
- [ ] Bulk import from Excel
- [ ] Print-friendly reports
- [ ] Mobile responsiveness

---

## 10. Future Enhancements

### 10.1 Planned Features

- **P&ID Viewer Integration**: Upload and annotate P&ID drawings
- **3D Model Link**: Integration with plant 3D models
- **Revision Control**: Track document revisions like engineering software
- **Approval Workflow**: Route changes for review and approval
- **API Access**: REST API for third-party integrations
- **Mobile App**: Native mobile app for field access

### 10.2 Integration Possibilities

- **AutoCAD**: Direct sync with P&ID drawings
- **HTRI / Aspen**: Import heat exchanger data
- **SAP**: Sync with materials management
- **Document Management**: Integration with SharePoint/PDM systems

---

## Appendix A: Excel Export Format

The export should match the original Excel structure:

```
Sheet 1: INPUT_DATA
- Columns: Line Tag, Description, Flow Rate (kg/s), Flow Rate (kg/hr),
           Pressure (mbar), Pressure (bar), Temperature, Density, TDS, Enthalpy

Sheet 2: LIST_OF_EQUIPMENT
- Columns: Equipment Name, Equipment Tag No., Operating Pressure,
           Operating Temperature, Fluid_In_1...5, Fluid_Out_1...4

Sheet 3: LIST OF LINES
- Columns: S.No, Line No, Fluid, Input Data, Flow Rate, Density,
           Calculated Velocity, Calculated ID, Selected ID, Actual Velocity

Sheet 4: LIST OF INSTRUMENTS
- Columns: S.No, P&ID No, Line No., TAG NO., Instrument Valve No.,
           Service Location, Instrument Type, Fluid,
           Operation Condition (Pressure/Temp/Flow/TDS × Min/Nor/Max),
           Instrument Data, Hookup, Signal Type, Model No, Accessories, Remarks

Sheet 5: LIST OF VALVES
- Similar structure to Instruments with valve-specific fields

Sheet 6: Pipe Table
- Reference data (read-only)
```

---

## Appendix B: Named Ranges Equivalent

In the web app, these become computed properties or derived queries:

| Excel Named Range | Web App Implementation                           |
| ----------------- | ------------------------------------------------ |
| LineTags          | `streams.map(s => s.lineTag)`                    |
| FlowRates_kgs     | `streams.map(s => s.flowRate.kgPerSec)`          |
| Pressures_bar     | `streams.map(s => s.pressure.barAbs)`            |
| LOL_LineNumbers   | `lines.map(l => l.lineNumber)`                   |
| LOL_LineTags      | `lines.map(l => getStream(l.streamRef).lineTag)` |

---

_End of Specification Document_
