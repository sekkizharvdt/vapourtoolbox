# BOM Generator / Estimation Module Requirements

**Module**: BOM Generator & Cost Estimation
**Priority**: Phase 1, Module 3 (CRITICAL PATH)
**Estimated Effort**: 120-150 hours (3-4 weeks)
**Status**: Not Started
**Dependencies**:

- ✅ Material Database (Phase 1, Module 1) - REQUIRED
- ✅ Shape Database (Phase 1, Module 2) - REQUIRED
- Projects Module (partially implemented)
- Entities Module (implemented)

---

## 1. Overview

### 1.1 Purpose

The BOM Generator is the **heart of the estimation process**, enabling users to:

1. **Create multi-level Bills of Materials** (assemblies → sub-assemblies → parts)
2. **Select components from Shape Database** with automatic weight/volume calculations
3. **Apply materials from Material Database** with real-time pricing
4. **Calculate total cost** (material + fabrication + overhead + margin)
5. **Generate different BOM types** for Engineering, Manufacturing, and Procurement
6. **Export BOMs** to Excel/PDF for client proposals and internal use
7. **Transfer BOM items** to Projects Module for execution

### 1.2 Business Context

**Current State**:

- No BOM generation capability
- Manual estimation in spreadsheets
- No link between engineering design and cost estimation
- Proposal scope of supply created manually

**Target State**:

- Structured BOM creation with shape/material selection
- Automatic weight and cost calculation
- Single source of truth for project estimation
- Seamless transfer from BOM → Proposal → Project → Procurement

### 1.3 Integration Points

```
Material Database ──┐
                    ├──> BOM Generator ──> Proposal Module ──> Projects Module ──> Procurement
Shape Database ────┘                                                               Module
                                           └──> Document Transmittals (PDF/Excel)
```

**Upstream Dependencies**:

- Material Database: Pricing, specifications, vendor mapping
- Shape Database: Geometric calculations, formulas, standard shapes

**Downstream Consumers**:

- Proposal Module: Scope of Supply section
- Projects Module: Procurement Items list, Budget allocation
- Procurement Module: Purchase Requests generation
- Document Management: BOM exports as project documents

---

## 2. Data Model

### 2.1 Core Entities

#### 2.1.1 BOM (Bill of Materials)

```typescript
interface BOM {
  // Identity
  id: string;
  bomCode: string; // BOM-YYYY-NNNN

  // Basic Information
  name: string; // "Heat Exchanger HX-101"
  description?: string;
  category: BOMCategory; // HEAT_EXCHANGER, PRESSURE_VESSEL, etc.

  // Context
  projectId?: string; // If created for a project
  proposalId?: string; // If created for a proposal
  entityId: string; // Organization

  // Structure
  bomType: BOMType; // EBOM, MBOM, PBOM
  rootItemId: string; // Top-level assembly
  items: string[]; // All BOMItem IDs (flat list for indexing)

  // Cost Summary (auto-calculated)
  summary: {
    totalMaterialCost: Money;
    totalFabricationCost: Money;
    totalWeight: number; // kg
    totalSurfaceArea?: number; // m² (for painting/coating)
    itemCount: number; // Total number of items
    assemblyCount: number; // Number of assemblies
    partCount: number; // Number of parts
  };

  // Pricing
  overhead?: {
    percentage?: number; // % of material + fabrication
    fixedAmount?: Money;
  };
  margin?: {
    percentage?: number; // % markup
    targetProfit?: Money;
  };
  finalPrice?: Money; // After overhead + margin

  // Metadata
  version: number;
  status: BOMStatus;
  revisionHistory: BOMRevision[];

  // Standards & Compliance
  applicableStandards?: string[]; // ASME Section VIII, TEMA, etc.
  designPressure?: number; // bar/psi
  designTemperature?: number; // °C
  fluidService?: string; // Steam, Water, Oil, etc.

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
  isActive: boolean;
}

enum BOMCategory {
  // Pressure Equipment
  HEAT_EXCHANGER = 'HEAT_EXCHANGER',
  PRESSURE_VESSEL = 'PRESSURE_VESSEL',
  STORAGE_TANK = 'STORAGE_TANK',
  REACTOR = 'REACTOR',

  // Piping Systems
  PIPING_ASSEMBLY = 'PIPING_ASSEMBLY',
  PIPING_SPOOL = 'PIPING_SPOOL',

  // Structural
  STRUCTURAL_ASSEMBLY = 'STRUCTURAL_ASSEMBLY',
  PLATFORM = 'PLATFORM',
  SUPPORT_STRUCTURE = 'SUPPORT_STRUCTURE',

  // Thermal Desalination (Phase 2)
  THERMAL_DESALINATION_UNIT = 'THERMAL_DESALINATION_UNIT',

  // General
  CUSTOM_ASSEMBLY = 'CUSTOM_ASSEMBLY',
}

enum BOMType {
  EBOM = 'EBOM', // Engineering BOM (design structure)
  MBOM = 'MBOM', // Manufacturing BOM (fabrication sequence)
  PBOM = 'PBOM', // Procurement BOM (purchasing list)
}

enum BOMStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  RELEASED = 'RELEASED', // Released for proposal/project
  ARCHIVED = 'ARCHIVED',
}

interface BOMRevision {
  version: number;
  date: Timestamp;
  changedBy: string;
  changeDescription: string;
  changeType: 'MINOR' | 'MAJOR'; // Minor: quantities, Major: structure
}
```

#### 2.1.2 BOMItem (Hierarchical Structure)

```typescript
interface BOMItem {
  // Identity
  id: string;
  bomId: string; // Parent BOM
  itemNumber: string; // Hierarchical: 1, 1.1, 1.1.1, 1.2, 2, etc.

  // Type
  itemType: BOMItemType; // ASSEMBLY, PART, MATERIAL

  // Hierarchy
  parentItemId?: string; // Null for root, otherwise parent assembly
  childItemIds: string[]; // Sub-assemblies or parts
  level: number; // 0 for root, 1 for children, etc.

  // Description
  name: string; // "Shell Assembly", "Nozzle N1"
  description?: string;
  drawingReference?: string; // Drawing number

  // Component Definition
  component?: {
    // Option 1: Shape-based component
    shapeId?: string; // Reference to Shape Database
    shapeInstanceId?: string; // Reference to ShapeInstance
    materialId?: string; // Reference to Material Database

    // Option 2: Standard bought-out item
    specification?: string; // "Flange ASME B16.5 Class 150 RF 6″ 316L"
    manufacturer?: string;
    partNumber?: string;

    // Dimensions (if custom or shape-based)
    parameters?: Record<string, number>; // {D: 1000, L: 3000, t: 10}
  };

  // Quantities
  quantity: number;
  unit: string; // nos, kg, meter, etc.
  allowWastage: boolean;
  wastagePercentage?: number; // Default 5% for cutting/fabrication
  totalQuantity?: number; // quantity × (1 + wastage%)

  // Calculated Properties (auto-filled from Shape + Material)
  calculatedProperties?: {
    weight?: number; // kg (single unit)
    totalWeight?: number; // weight × totalQuantity
    volume?: number; // m³
    surfaceArea?: number; // m²
  };

  // Costing
  cost?: {
    materialCost?: Money; // From Material Database
    materialCostTotal?: Money; // materialCost × totalQuantity

    fabricationCost?: Money; // Per unit
    fabricationCostTotal?: Money; // fabricationCost × quantity

    itemTotal?: Money; // Material + Fabrication
  };

  // Fabrication Details
  fabrication?: {
    laborHours?: number;
    machiningRequired?: boolean;
    weldingRequired?: boolean;
    weldLength?: number; // meters
    paintingRequired?: boolean;
    heatTreatmentRequired?: boolean;
  };

  // Procurement
  procurement?: {
    procurementType: 'MAKE' | 'BUY';
    leadTime?: number; // days
    preferredVendors?: string[]; // Vendor IDs
    minimumOrderQuantity?: number;
  };

  // Standards & Inspection
  standards?: string[]; // ASME B16.9, ASTM A240, etc.
  inspectionRequired?: boolean;
  inspectionType?: string[]; // RT, UT, PT, MT, VT

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

enum BOMItemType {
  ASSEMBLY = 'ASSEMBLY', // Has children (sub-assemblies/parts)
  PART = 'PART', // Leaf node (no children)
  MATERIAL = 'MATERIAL', // Raw material (plates, pipes)
}
```

#### 2.1.3 BOMTemplate (Reusable Structures)

```typescript
interface BOMTemplate {
  id: string;
  templateCode: string; // TPL-YYYY-NNNN
  name: string; // "Standard Shell & Tube Heat Exchanger"
  category: BOMCategory;
  description?: string;

  // Template Structure (JSON of BOMItem hierarchy)
  structure: BOMItemTemplate[];

  // Parameterization
  parameters: TemplateParameter[]; // User inputs when using template

  // Usage
  usageCount: number;
  entityId: string;
  isPublic: boolean; // Available to all entities or private

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}

interface BOMItemTemplate {
  itemNumber: string;
  itemType: BOMItemType;
  name: string;
  description?: string;
  parentItemNumber?: string;

  // Parameterized values (e.g., "{SHELL_DIAMETER}", "{TUBE_LENGTH}")
  shapeReference?: string;
  materialReference?: string;
  quantityFormula?: string; // "TUBE_COUNT * 2" for tube sheets

  // Static values
  unit?: string;
  wastagePercentage?: number;
  fabrication?: {
    laborHours?: number;
    machiningRequired?: boolean;
    weldingRequired?: boolean;
  };
}

interface TemplateParameter {
  name: string; // "SHELL_DIAMETER"
  label: string; // "Shell Inside Diameter"
  dataType: 'NUMBER' | 'SELECT' | 'TEXT';
  unit?: string; // "mm"
  defaultValue?: any;
  options?: string[]; // For SELECT type
  required: boolean;
}
```

### 2.2 Permissions

```typescript
// Use existing Permission system from @vapour/types
enum Permission {
  // BOM Management
  CREATE_BOM = 524288, // Create new BOMs
  EDIT_BOM = 1048576, // Edit BOM structure and items
  DELETE_BOM = 2097152, // Delete/archive BOMs
  APPROVE_BOM = 4194304, // Approve BOM for release
  VIEW_BOM_COST = 8388608, // View cost details (may be restricted)

  // Template Management
  CREATE_BOM_TEMPLATE = 16777216, // Create reusable templates
  EDIT_BOM_TEMPLATE = 33554432, // Edit templates

  // Integration
  TRANSFER_BOM_TO_PROPOSAL = 67108864, // Push BOM to Proposal
  TRANSFER_BOM_TO_PROJECT = 134217728, // Push BOM to Project
}
```

---

## 3. Functional Requirements

### 3.1 BOM Creation & Management

#### 3.1.1 Create New BOM

**Actor**: User with `CREATE_BOM` permission

**Flow**:

1. Navigate to BOM Generator module
2. Click "Create New BOM"
3. Select creation method:
   - **Start from Scratch**: Create empty BOM
   - **Use Template**: Select from available templates
   - **Copy Existing BOM**: Clone and modify
4. Fill basic information:
   - BOM name
   - Category (Heat Exchanger, Pressure Vessel, etc.)
   - BOM Type (EBOM, MBOM, PBOM)
   - Link to Project/Proposal (optional)
5. Add root assembly item
6. System generates `bomCode` (BOM-2025-0001)
7. BOM created with status = DRAFT

**Validation**:

- BOM name required (max 200 characters)
- Category required
- BOM Type required
- If projectId provided, verify project exists and user has access

**Output**: New BOM record created, redirect to BOM Editor

#### 3.1.2 Add BOM Items

**Actor**: User with `EDIT_BOM` permission

**Flow**:

1. Open BOM in Editor
2. Select parent item (or root if adding top-level assembly)
3. Click "Add Item"
4. Select item type:
   - **Assembly**: Sub-assembly with children
   - **Part**: Single component (shape-based or standard)
   - **Material**: Raw material (plates, pipes, etc.)
5. Fill item details based on type:

**For Shape-based Part**:

- Select Shape from Shape Database
- Fill shape parameters (D, L, t, etc.)
- Select Material from Material Database
- System auto-calculates: weight, volume, surface area
- System auto-fills: material cost (price × weight)

**For Standard Bought-out Part**:

- Enter specification (e.g., "Flange ASME B16.5 Class 150 RF 6″ 316L")
- Enter manufacturer, part number
- Enter unit price manually or link to Material Database entry

**For Raw Material**:

- Select Material from Material Database
- Enter quantity and unit (e.g., "100 kg", "5 meter")
- System auto-fills: material cost

6. Enter quantity
7. Optional: Set wastage percentage (default 5%)
8. Optional: Add fabrication details (labor hours, welding, machining)
9. System assigns item number (hierarchical: 1.1, 1.1.1, etc.)
10. Item added to BOM structure

**Validation**:

- Item name required (max 200 characters)
- Quantity > 0
- If shape-based: shapeId and materialId required
- Wastage percentage: 0-50%

**Auto-calculations**:

- Total quantity = quantity × (1 + wastage%)
- Total weight = unit weight × total quantity
- Material cost total = material cost × total quantity
- Fabrication cost total = fabrication cost × quantity
- Item total = material cost total + fabrication cost total

#### 3.1.3 Edit BOM Structure

**Actor**: User with `EDIT_BOM` permission

**Operations**:

- **Move item**: Drag & drop to change parent
- **Delete item**: Remove item (cascades to children)
- **Reorder items**: Change sequence within same parent
- **Duplicate item**: Clone item with all properties
- **Change quantity**: Update quantity (triggers cost recalculation)
- **Update parameters**: Modify shape parameters (triggers weight/cost recalculation)

**Constraints**:

- Cannot delete root item (must delete entire BOM)
- Cannot move item to its own descendant (circular reference)
- Status must be DRAFT or UNDER_REVIEW

#### 3.1.4 BOM Cost Calculation

**Trigger**: Any change to BOM items (quantity, material, shape parameters)

**Calculation Logic**:

```
For each BOM item (bottom-up traversal):
  1. Material Cost (if shape-based):
     - Get material price from Material Database
     - Weight = Shape formula (volume × material density)
     - Material cost = weight × price per kg
     - Material cost total = material cost × total quantity

  2. Fabrication Cost:
     - Labor cost = labor hours × labor rate
     - Welding cost = weld length × welding rate
     - Machining cost (if applicable)
     - Fabrication cost total = fabrication cost × quantity

  3. Item Total:
     - Item total = material cost total + fabrication cost total

  4. Assembly Total (if assembly):
     - Assembly total = SUM(child item totals) + assembly fabrication cost

BOM Summary:
  Total material cost = SUM(all item material costs)
  Total fabrication cost = SUM(all item fabrication costs)
  Total weight = SUM(all item weights)

  Subtotal = Total material + Total fabrication

  Overhead cost = Subtotal × overhead% OR fixed overhead
  Price before margin = Subtotal + Overhead

  Margin = Price before margin × margin%
  Final price = Price before margin + Margin
```

**Performance**:

- Recalculation triggered on debounced input (500ms delay)
- Calculate only affected subtree if single item changed
- Full recalculation if overhead/margin changed

#### 3.1.5 BOM Approval Workflow

**Actor**: User with `APPROVE_BOM` permission

**Flow**:

1. User with EDIT_BOM completes BOM, sets status = UNDER_REVIEW
2. Notification sent to users with APPROVE_BOM permission
3. Approver reviews BOM structure and costs
4. Approver can:
   - **Approve**: Status → APPROVED
   - **Request Changes**: Add comments, status → DRAFT
   - **Reject**: Add rejection reason, status → DRAFT
5. Once APPROVED, BOM can be:
   - Released to Proposal (status → RELEASED)
   - Released to Project (status → RELEASED)
   - Kept as reference (status → APPROVED)

**Constraints**:

- Cannot edit BOM structure after APPROVED (must create new version)
- Can update costs if material prices change (maintain version history)

### 3.2 BOM Templates

#### 3.2.1 Create Template from BOM

**Actor**: User with `CREATE_BOM_TEMPLATE` permission

**Flow**:

1. Open existing BOM (APPROVED or RELEASED)
2. Click "Save as Template"
3. Identify parameterizable values:
   - Select which shape parameters should be user inputs
   - Select which material selections should be user choices
   - Define quantity formulas (e.g., "TUBE_COUNT × 2" for tube sheets)
4. Define template parameters:
   - Parameter name (e.g., "SHELL_DIAMETER")
   - Display label ("Shell Inside Diameter")
   - Data type (NUMBER, SELECT, TEXT)
   - Unit (mm, kg, etc.)
   - Default value
   - Validation rules (min, max)
5. System converts BOM structure to template structure
6. Assign template name and category
7. Set visibility (public or private to entity)
8. Template created

**Example Template**: "Shell & Tube Heat Exchanger TEMA Type BEM"

**Parameters**:

- SHELL_DIAMETER (number, mm, default 600)
- SHELL_LENGTH (number, mm, default 3000)
- TUBE_OUTER_DIAMETER (select, options: [19.05, 25.4], default 25.4)
- TUBE_LENGTH (number, mm, default 2900)
- TUBE_COUNT (number, nos, default 100)
- SHELL_MATERIAL (select, options: [CS A516 Gr 70, SS 316L], default CS A516)
- TUBE_MATERIAL (select, options: [SS 316L, Titanium Gr 2], default SS 316L)

**Template Structure**:

```
1. Shell Assembly
   1.1. Cylindrical Shell (Shape: SHELL_CYLINDRICAL, Material: {SHELL_MATERIAL}, D={SHELL_DIAMETER}, L={SHELL_LENGTH}, t=10)
   1.2. Front Tube Sheet (Shape: PLATE_CIRCULAR, Material: {SHELL_MATERIAL}, D={SHELL_DIAMETER}, t=50)
   1.3. Rear Tube Sheet (Shape: PLATE_CIRCULAR, Material: {SHELL_MATERIAL}, D={SHELL_DIAMETER}, t=50)
   1.4. Front Head (Shape: HEAD_HEMISPHERICAL, Material: {SHELL_MATERIAL}, D={SHELL_DIAMETER}, t=10)
   1.5. Rear Head (Shape: HEAD_HEMISPHERICAL, Material: {SHELL_MATERIAL}, D={SHELL_DIAMETER}, t=10)
2. Tube Bundle
   2.1. Tubes (Shape: PIPE_STRAIGHT, Material: {TUBE_MATERIAL}, OD={TUBE_OUTER_DIAMETER}, L={TUBE_LENGTH}, Qty={TUBE_COUNT})
3. Nozzles
   3.1. Shell Inlet (Specification: "Nozzle 6″ Sch 40 316L", Qty=1)
   3.2. Shell Outlet (Specification: "Nozzle 6″ Sch 40 316L", Qty=1)
   3.3. Tube Inlet (Specification: "Nozzle 4″ Sch 40 316L", Qty=1)
   3.4. Tube Outlet (Specification: "Nozzle 4″ Sch 40 316L", Qty=1)
```

#### 3.2.2 Use Template to Create BOM

**Actor**: User with `CREATE_BOM` permission

**Flow**:

1. Click "Create BOM from Template"
2. Browse/search template library
3. Filter by category (Heat Exchanger, Pressure Vessel, etc.)
4. Select template
5. Preview template structure
6. Fill template parameters (form with validation)
7. System instantiates BOM:
   - Replaces parameter placeholders with user values
   - Creates Shape instances for all shape-based items
   - Calculates weights, costs based on selected materials
   - Generates hierarchical item structure
8. BOM created with status = DRAFT
9. User can review and modify as needed

**Validation**:

- All required parameters must be filled
- Numeric parameters must be within min/max ranges
- SELECT parameters must be from allowed options

#### 3.2.3 Template Library Management

**Features**:

- **Public Templates**: Shared across all entities (created by super admin)
- **Private Templates**: Available only within entity
- **Template Versioning**: Track changes to templates
- **Usage Statistics**: Show how many times template used
- **Template Categories**: Organize by equipment type

**Pre-built Templates** (to be included in v1.0):

1. Shell & Tube Heat Exchanger (TEMA BEM, AES, NEN types)
2. Vertical Pressure Vessel
3. Horizontal Storage Tank
4. Piping Spool (straight run with elbows)

### 3.3 BOM Views & Exports

#### 3.3.1 BOM Views

**Hierarchical Tree View** (default):

- Expandable/collapsible tree structure
- Show item number, name, quantity, weight, cost
- Color coding by item type (assembly, part, material)
- Inline editing of quantities
- Drag & drop to restructure

**Flat List View**:

- Table with all items in single list
- Indentation to show hierarchy
- Sortable columns (item number, name, weight, cost)
- Filterable (by item type, material category, procurement type)
- Show/hide columns

**Cost Breakdown View**:

- Pie chart: Material cost vs Fabrication cost
- Bar chart: Cost by assembly
- Pareto chart: Most expensive items (80/20 analysis)
- Summary cards: Total weight, total cost, item count

**Procurement View** (PBOM):

- Group items by procurement type (MAKE vs BUY)
- Group BUY items by preferred vendor
- Show lead times
- Flag items requiring urgent procurement

#### 3.3.2 Export to Excel

**Actor**: User with `VIEW_BOM` permission (and `VIEW_BOM_COST` for cost details)

**Export Formats**:

**1. Engineering BOM (EBOM)**:

```
Columns: Item No | Name | Description | Drawing Ref | Specification | Material | Quantity | Unit | Weight (kg) | Standards
```

**2. Manufacturing BOM (MBOM)**:

```
Columns: Item No | Name | Specification | Material | Quantity | Unit | Weight | Fabrication Details | Labor Hours
```

**3. Procurement BOM (PBOM)**:

```
Columns: Item No | Description | Specification | Quantity | Unit | Procurement Type | Preferred Vendor | Lead Time
```

**4. Costed BOM** (requires VIEW_BOM_COST):

```
Columns: Item No | Name | Quantity | Unit | Unit Weight | Total Weight | Material Cost | Fabrication Cost | Total Cost
Summary Row: Totals, Overhead, Margin, Final Price
```

**Features**:

- Multi-sheet Excel file (Summary, Hierarchical BOM, Flat BOM, Cost Breakdown)
- Formatted headers, freeze panes
- Auto-filter enabled
- Formulas for totals
- Conditional formatting (highlight expensive items)

#### 3.3.3 Export to PDF

**Templates**:

**1. Standard BOM Report**:

- Header: BOM name, code, date, project/proposal reference
- Summary: Total weight, total cost, item count
- Hierarchical BOM table (max 3-4 levels deep)
- Cost breakdown chart (if user has VIEW_BOM_COST)
- Footer: Prepared by, approved by, page numbers

**2. Client-facing BOM** (sanitized):

- Hide cost columns (material cost, fabrication cost)
- Show only: Item description, quantity, weight
- Professional formatting for inclusion in proposals

**3. Procurement BOM**:

- Group by procurement type and vendor
- Include lead times and minimum order quantities
- Suitable for sending to procurement team

**Features**:

- Company logo, letterhead
- Watermark for DRAFT/UNDER_REVIEW status
- Digital signature for APPROVED status
- Page breaks at assembly boundaries
- Table of contents for large BOMs (>100 items)

### 3.4 Integration with Other Modules

#### 3.4.1 Transfer BOM to Proposal

**Actor**: User with `TRANSFER_BOM_TO_PROPOSAL` permission

**Trigger**: BOM status = APPROVED or RELEASED

**Flow**:

1. Open BOM (APPROVED status)
2. Click "Add to Proposal"
3. Select existing proposal or create new
4. Select BOM items to include (can exclude internal assemblies)
5. Choose what to transfer:
   - Item descriptions
   - Quantities
   - Weights
   - Cost details (if user has permission)
6. System creates entries in Proposal → Scope of Supply:
   ```typescript
   {
     itemNumber: "1.1",
     description: "Cylindrical Shell CS A516 Gr 70",
     quantity: 1,
     unit: "nos",
     weight: 1250,
     unitPrice: 125000,  // If cost included
     totalPrice: 125000,
     specifications: "ASME Section VIII Div 1, ASTM A516 Gr 70",
     drawingReference: "DRG-HX-101-01"
   }
   ```
7. Proposal updated, link created: `proposal.bomId = bom.id`
8. BOM status → RELEASED

**Sync**:

- If BOM updated after transfer, show warning in Proposal
- Option to re-sync (overwrites proposal items)
- Track BOM version in Proposal

#### 3.4.2 Transfer BOM to Project

**Actor**: User with `TRANSFER_BOM_TO_PROJECT` permission

**Trigger**:

- Proposal awarded → Project created
- OR directly create project from BOM

**Flow**:

1. BOM (RELEASED) linked to Proposal
2. Proposal awarded → Create Project
3. System transfers BOM items to Project:

**Create Procurement Items**:

```typescript
// For each BOM item with procurement.procurementType = 'BUY'
{
  itemNumber: "3.1",
  description: "Shell Inlet Nozzle 6″ Sch 40 316L",
  specification: "ASME B16.9, ASTM A312 316L",
  quantity: 1,
  unit: "nos",
  estimatedCost: 15000,
  preferredVendors: ["VEN-2025-0042", "VEN-2025-0087"],
  leadTime: 30,
  status: "PENDING",  // Ready for Purchase Request creation
}
```

**Create Document Requirements**:

```typescript
// For assemblies requiring fabrication drawings
{
  documentType: "FABRICATION_DRAWING",
  description: "Shell Assembly Fabrication Drawing",
  reference: "DRG-HX-101-SHELL-FAB",
  assignedTo: "USER-WITH-ENGINEERING-PERMISSION",
  dueDate: project.startDate + 14 days,
  status: "PENDING",
}
```

**Create Budget Line Items**:

```typescript
{
  category: "MATERIAL",
  description: "Raw Materials (Plates, Pipes, Fittings)",
  budgetedAmount: bom.summary.totalMaterialCost,
  source: "BOM",
  bomReference: bom.id,
}
{
  category: "FABRICATION",
  description: "Fabrication & Assembly",
  budgetedAmount: bom.summary.totalFabricationCost,
  source: "BOM",
  bomReference: bom.id,
}
```

4. Project created with:
   - Budget from BOM cost breakdown
   - Procurement items list
   - Document deliverables list
   - Tasks (auto-generated for procurement, engineering, fabrication)

**Tracking**:

- Maintain link: `project.bomId = bom.id`
- Show BOM vs Actual cost variance in Project
- Alert if actual procurement costs exceed BOM estimates by >10%

#### 3.4.3 Integration with Thermal Desalination Module (Phase 2)

**Future Integration** (after Thermal Desalination module built):

**Scenario**: User designs thermal desalination unit using Thermal Desalination module

**Flow**:

1. Thermal Desalination module outputs design parameters:
   - Number of effects
   - Heat exchanger sizes (per effect)
   - Evaporator dimensions
   - Condenser specifications
   - Piping sizes and lengths
   - Instrumentation list

2. Click "Generate BOM" in Thermal Desalination module
3. System creates BOM using templates:
   - For each effect: Use "Heat Exchanger" template with calculated parameters
   - For evaporator: Use "Pressure Vessel" template
   - For piping: Use "Piping Assembly" template with calculated lengths
   - Add instrumentation as standard bought-out items

4. BOM auto-generated with status = DRAFT
5. User reviews and modifies as needed
6. Approve and transfer to Proposal

**Benefits**:

- Eliminates manual BOM creation for thermal units
- Ensures design consistency (BOM matches thermal calculations)
- Faster proposal turnaround

---

## 4. Non-Functional Requirements

### 4.1 Performance

- **BOM Loading**: < 2 seconds for BOM with 500 items
- **Cost Recalculation**: < 1 second for 100 item changes
- **Template Instantiation**: < 3 seconds for 200-item template
- **Excel Export**: < 5 seconds for 1000-item BOM
- **PDF Generation**: < 10 seconds for 1000-item BOM

### 4.2 Scalability

- Support BOMs with up to **5,000 items**
- Support hierarchy depth of **10 levels**
- Support **500 templates** in library
- Concurrent editing: **10 users** editing different BOMs simultaneously

### 4.3 Usability

- **Keyboard shortcuts**:
  - `Ctrl+N`: New item
  - `Ctrl+D`: Duplicate item
  - `Delete`: Remove item
  - `Tab`: Indent (move to child of previous item)
  - `Shift+Tab`: Outdent (move to parent level)
  - `↑/↓`: Navigate items
  - `Enter`: Edit item

- **Drag & drop**: Move items to restructure hierarchy
- **Inline editing**: Click to edit quantity, name
- **Contextual help**: Tooltips for shape parameters, material selection
- **Undo/Redo**: Support undo for last 50 actions

### 4.4 Data Integrity

- **Foreign key validation**: Verify shapeId, materialId exist before saving
- **Circular reference check**: Prevent item being its own ancestor
- **Orphan prevention**: If parent deleted, cascade delete children OR move to parent's parent
- **Cost consistency**: Recalculate totals on every item change
- **Version control**: Maintain revision history for all changes

### 4.5 Security

- **Permission checks**: Enforce CREATE_BOM, EDIT_BOM, APPROVE_BOM, VIEW_BOM_COST
- **Data isolation**: Users can only see BOMs for their entity (unless super admin)
- **Audit trail**: Log all BOM changes (who, when, what changed)
- **Cost visibility**: Hide cost columns if user lacks VIEW_BOM_COST permission

---

## 5. User Interface Design

### 5.1 BOM List Page

**URL**: `/boms`

**Layout**:

```
┌─────────────────────────────────────────────────────────────┐
│  BOM Generator                                   [+ New BOM] │
├─────────────────────────────────────────────────────────────┤
│  Filters: [Status ▼] [Category ▼] [Project ▼] [Search...]  │
├──────────┬──────────────┬──────────┬──────────┬─────────────┤
│ BOM Code │ Name         │ Category │ Status   │ Total Cost  │ Actions
├──────────┼──────────────┼──────────┼──────────┼─────────────┤
│ BOM-2025-│ Heat Exch.   │ HEAT_    │ APPROVED │ ₹12,50,000  │ [View] [Edit] [Export ▼]
│ 0042     │ HX-101       │ EXCHANGER│          │             │
├──────────┼──────────────┼──────────┼──────────┼─────────────┤
│ BOM-2025-│ Pressure     │ PRESSURE_│ DRAFT    │ ₹8,75,000   │ [View] [Edit] [Delete]
│ 0041     │ Vessel PV-201│ VESSEL   │          │             │
└──────────┴──────────────┴──────────┴──────────┴─────────────┘
Pagination: [← Prev] [1] [2] [3] ... [Next →]
```

### 5.2 BOM Editor Page

**URL**: `/boms/[bomId]/edit`

**Layout**: Three-panel design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOM: Heat Exchanger HX-101 (BOM-2025-0042)          [Save] [Approve] [Export ▼] │
├──────────────────────────┬──────────────────────────┬────────────────────────┤
│  BOM Tree (Left Panel)   │  Item Details (Center)   │  Summary (Right)       │
│                          │                          │                        │
│  [+ Add Item] [⋮ More]   │  Item: 1.1 Shell Assy    │  Total Weight:         │
│                          │  ─────────────────────── │  1,250 kg              │
│  ▼ 1. Shell Assembly     │  Item Number: 1.1        │                        │
│    • 1.1 Cylindrical...  │  Type: [Assembly ▼]      │  Total Material Cost:  │
│    • 1.2 Front Tube...   │  Name: [Cylindrical...  ]│  ₹8,50,000             │
│    • 1.3 Rear Tube...    │  Qty: [1] [nos]          │                        │
│  ▼ 2. Tube Bundle        │                          │  Total Fab. Cost:      │
│    • 2.1 Tubes (100x)    │  Component Type:         │  ₹4,00,000             │
│  ▶ 3. Nozzles (4 items)  │  ◉ Shape-based           │                        │
│  ▶ 4. Supports (6 items) │  ○ Standard Item         │  Overhead (10%):       │
│                          │                          │  ₹1,25,000             │
│  Cost Summary:           │  Shape: [Cylindrical...▼]│                        │
│  Material: ₹8,50,000     │  Material: [CS A516 Gr..▼│  Margin (15%):         │
│  Fabrication: ₹4,00,000  │                          │  ₹2,06,250             │
│  ───────────────         │  Parameters:             │                        │
│  Subtotal: ₹12,50,000    │  D (ID): [1000] mm       │  ──────────────        │
│  Overhead: ₹1,25,000     │  L: [3000] mm            │  Final Price:          │
│  Margin: ₹2,06,250       │  t: [10] mm              │  ₹15,81,250            │
│  ───────────────         │                          │                        │
│  Final: ₹15,81,250       │  Calculated:             │  Item Count: 24        │
│                          │  Weight: 2,450 kg        │  Assemblies: 4         │
│  [Export Tree View]      │  Material Cost: ₹2,45,000│  Parts: 20             │
│                          │                          │                        │
│                          │  [Calculate] [Save Item] │  [View Cost Breakdown] │
└──────────────────────────┴──────────────────────────┴────────────────────────┘
```

**Left Panel Features**:

- Hierarchical tree (collapsible)
- Right-click context menu: Add child, Delete, Duplicate, Move
- Drag & drop to reorder/restructure
- Item icons: 📦 Assembly, 🔧 Part, 📏 Material
- Quick cost summary at bottom

**Center Panel Features**:

- Item type selector (Assembly, Part, Material)
- Shape-based component: Shape + Material dropdowns with live preview
- Standard item: Free-text specification + price
- Parameter inputs with validation (min/max, units)
- Real-time calculation on parameter change
- Fabrication details (labor hours, welding length)
- Drawing reference upload

**Right Panel Features**:

- Live cost summary (updates on any change)
- Weight rollup
- Item count by type
- Cost breakdown chart (Material vs Fabrication)
- Overhead and margin inputs
- Export options

### 5.3 Template Library Page

**URL**: `/boms/templates`

**Layout**:

```
┌─────────────────────────────────────────────────────────────┐
│  BOM Templates                          [+ Create Template] │
├─────────────────────────────────────────────────────────────┤
│  Filter: [Category ▼] [Public/Private ▼] [Search...]        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │ Heat Exchanger TEMA  │  │ Vertical Pressure    │         │
│  │ Type BEM             │  │ Vessel               │         │
│  │ ──────────────────── │  │ ──────────────────── │         │
│  │ Category: Heat Exch. │  │ Category: Pressure   │         │
│  │ Items: 15            │  │ Items: 8             │         │
│  │ Used: 42 times       │  │ Used: 18 times       │         │
│  │ [Use Template]       │  │ [Use Template]       │         │
│  └──────────────────────┘  └──────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Use Template Dialog

**Triggered**: Click "Use Template" on any template

**Layout**:

```
┌─────────────────────────────────────────────────────────────┐
│  Create BOM from Template: Heat Exchanger TEMA Type BEM     │
├─────────────────────────────────────────────────────────────┤
│  BOM Name: [Heat Exchanger HX-101                        ]  │
│  Link to Project: [Select Project ▼] (optional)             │
│  ───────────────────────────────────────────────────────────│
│  Template Parameters:                                        │
│  ───────────────────────────────────────────────────────────│
│  Shell Inside Diameter (mm): [1000        ]                  │
│  Shell Length (mm):           [3000        ]                 │
│  Tube Outer Diameter (mm):    [25.4 ▼]                       │
│  Tube Length (mm):            [2900        ]                 │
│  Tube Count (nos):            [100         ]                 │
│  Shell Material:              [CS A516 Gr 70 ▼]              │
│  Tube Material:               [SS 316L ▼]                    │
│  ───────────────────────────────────────────────────────────│
│  Preview:                                                    │
│  Total Weight (estimated): 3,250 kg                          │
│  Total Cost (estimated): ₹18,50,000                          │
│  ───────────────────────────────────────────────────────────│
│                                   [Cancel] [Create BOM]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Technical Architecture

### 6.1 Firestore Collections

#### `/boms/{bomId}`

```typescript
{
  id: string;
  bomCode: string;
  name: string;
  category: BOMCategory;
  bomType: BOMType;
  projectId?: string;
  proposalId?: string;
  entityId: string;
  rootItemId: string;
  items: string[];  // Flat list for querying
  summary: { /* ... */ };
  overhead?: { /* ... */ };
  margin?: { /* ... */ };
  finalPrice?: Money;
  version: number;
  status: BOMStatus;
  revisionHistory: BOMRevision[];
  applicableStandards?: string[];
  designPressure?: number;
  designTemperature?: number;
  fluidService?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
  isActive: boolean;
}
```

#### `/boms/{bomId}/items/{itemId}` (subcollection)

```typescript
{
  id: string;
  bomId: string;
  itemNumber: string;
  itemType: BOMItemType;
  parentItemId?: string;
  childItemIds: string[];
  level: number;
  name: string;
  description?: string;
  drawingReference?: string;
  component?: { /* ... */ };
  quantity: number;
  unit: string;
  allowWastage: boolean;
  wastagePercentage?: number;
  totalQuantity?: number;
  calculatedProperties?: { /* ... */ };
  cost?: { /* ... */ };
  fabrication?: { /* ... */ };
  procurement?: { /* ... */ };
  standards?: string[];
  inspectionRequired?: boolean;
  inspectionType?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `/bomTemplates/{templateId}`

```typescript
{
  id: string;
  templateCode: string;
  name: string;
  category: BOMCategory;
  description?: string;
  structure: BOMItemTemplate[];
  parameters: TemplateParameter[];
  usageCount: number;
  entityId: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}
```

### 6.2 Firestore Indexes

**Required Composite Indexes**:

```json
{
  "indexes": [
    {
      "collectionGroup": "boms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "boms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "boms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "boms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "proposalId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "items",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "bomId", "order": "ASCENDING" },
        { "fieldPath": "itemNumber", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "items",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "bomId", "order": "ASCENDING" },
        { "fieldPath": "parentItemId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "bomTemplates",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "entityId", "order": "ASCENDING" },
        { "fieldPath": "isPublic", "order": "ASCENDING" },
        { "fieldPath": "category", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 6.3 Firestore Security Rules

```javascript
match /boms/{bomId} {
  // Read: User in same entity OR super admin
  allow read: if isAuthenticated() &&
                (resource.data.entityId == request.auth.token.entityId ||
                 isSuperAdmin());

  // Create: User with CREATE_BOM permission
  allow create: if isAuthenticated() &&
                   hasPermission(524288) &&  // CREATE_BOM
                   request.resource.data.entityId == request.auth.token.entityId;

  // Update: User with EDIT_BOM permission (if DRAFT) OR APPROVE_BOM (if UNDER_REVIEW)
  allow update: if isAuthenticated() &&
                   resource.data.entityId == request.auth.token.entityId &&
                   (
                     (resource.data.status == 'DRAFT' && hasPermission(1048576)) ||  // EDIT_BOM
                     (resource.data.status == 'UNDER_REVIEW' && hasPermission(4194304))  // APPROVE_BOM
                   );

  // Delete: User with DELETE_BOM permission AND status = DRAFT
  allow delete: if isAuthenticated() &&
                   resource.data.entityId == request.auth.token.entityId &&
                   hasPermission(2097152) &&  // DELETE_BOM
                   resource.data.status == 'DRAFT';

  // Subcollection: items
  match /items/{itemId} {
    allow read: if isAuthenticated() &&
                   (get(/databases/$(database)/documents/boms/$(bomId)).data.entityId == request.auth.token.entityId ||
                    isSuperAdmin());

    allow write: if isAuthenticated() &&
                    get(/databases/$(database)/documents/boms/$(bomId)).data.entityId == request.auth.token.entityId &&
                    hasPermission(1048576);  // EDIT_BOM
  }
}

match /bomTemplates/{templateId} {
  // Read: Public templates OR private templates in same entity
  allow read: if isAuthenticated() &&
                (resource.data.isPublic == true ||
                 resource.data.entityId == request.auth.token.entityId);

  // Create: User with CREATE_BOM_TEMPLATE permission
  allow create: if isAuthenticated() &&
                   hasPermission(16777216);  // CREATE_BOM_TEMPLATE

  // Update: Template owner OR super admin
  allow update: if isAuthenticated() &&
                   (resource.data.createdBy == request.auth.uid || isSuperAdmin());

  // Delete: Template owner OR super admin
  allow delete: if isAuthenticated() &&
                   (resource.data.createdBy == request.auth.uid || isSuperAdmin());
}
```

### 6.4 Service Layer

**Location**: `/apps/web/src/lib/bom/bomService.ts`

**Key Functions**:

```typescript
// CRUD Operations
export async function createBOM(data: Partial<BOM>): Promise<BOM>;
export async function getBOMById(bomId: string): Promise<BOM | null>;
export async function updateBOM(bomId: string, data: Partial<BOM>): Promise<void>;
export async function deleteBOM(bomId: string): Promise<void>;
export async function listBOMs(filters: BOMFilters): Promise<BOM[]>;

// BOM Items
export async function addBOMItem(bomId: string, item: Partial<BOMItem>): Promise<BOMItem>;
export async function updateBOMItem(
  bomId: string,
  itemId: string,
  data: Partial<BOMItem>
): Promise<void>;
export async function deleteBOMItem(bomId: string, itemId: string): Promise<void>;
export async function getBOMItems(bomId: string): Promise<BOMItem[]>;
export async function moveBOMItem(
  bomId: string,
  itemId: string,
  newParentId: string
): Promise<void>;

// Cost Calculation
export async function calculateBOMCost(bomId: string): Promise<BOMSummary>;
export async function calculateItemCost(item: BOMItem): Promise<ItemCost>;
export async function recalculateSubtree(bomId: string, rootItemId: string): Promise<void>;

// Templates
export async function createTemplate(
  bomId: string,
  templateData: Partial<BOMTemplate>
): Promise<BOMTemplate>;
export async function instantiateTemplate(
  templateId: string,
  parameters: Record<string, any>
): Promise<BOM>;
export async function listTemplates(filters: TemplateFilters): Promise<BOMTemplate[]>;

// Integration
export async function transferBOMToProposal(bomId: string, proposalId: string): Promise<void>;
export async function transferBOMToProject(bomId: string, projectId: string): Promise<void>;

// Export
export async function exportBOMToExcel(
  bomId: string,
  format: 'EBOM' | 'MBOM' | 'PBOM'
): Promise<Blob>;
export async function exportBOMToPDF(
  bomId: string,
  template: 'STANDARD' | 'CLIENT' | 'PROCUREMENT'
): Promise<Blob>;

// Approval Workflow
export async function submitForApproval(bomId: string): Promise<void>;
export async function approveBOM(bomId: string): Promise<void>;
export async function rejectBOM(bomId: string, reason: string): Promise<void>;
```

**Cost Calculation Algorithm** (bomCalculations.ts):

```typescript
export function calculateItemCost(item: BOMItem, material: Material, shape: Shape): ItemCost {
  let materialCost = 0;
  let weight = 0;

  if (item.component?.shapeId && item.component?.materialId) {
    // Calculate weight using shape formula
    const shapeInstance = evaluateShapeFormulas(shape, item.component.parameters);
    weight = shapeInstance.weight * (material.properties.density / 7850); // Normalize to material density

    // Calculate material cost
    const pricePerKg = material.currentPrice?.pricePerUnit || 0;
    const totalQuantity = item.quantity * (1 + (item.wastagePercentage || 0) / 100);
    materialCost = weight * pricePerKg * totalQuantity;
  }

  // Calculate fabrication cost
  let fabricationCost = 0;
  if (item.fabrication) {
    fabricationCost += (item.fabrication.laborHours || 0) * LABOR_RATE_PER_HOUR;
    fabricationCost += (item.fabrication.weldLength || 0) * WELDING_RATE_PER_METER;
    // Add machining, painting, heat treatment costs...
  }

  const fabricationCostTotal = fabricationCost * item.quantity;

  return {
    weight,
    totalWeight: weight * item.totalQuantity,
    materialCost,
    materialCostTotal: materialCost,
    fabricationCost,
    fabricationCostTotal,
    itemTotal: materialCost + fabricationCostTotal,
  };
}

export async function calculateBOMCost(bomId: string): Promise<BOMSummary> {
  const items = await getBOMItems(bomId);

  // Build tree structure
  const tree = buildItemTree(items);

  // Calculate bottom-up (leaves first, then assemblies)
  const costs = await calculateTreeCost(tree);

  const totalMaterialCost = costs.reduce((sum, c) => sum + c.materialCostTotal, 0);
  const totalFabricationCost = costs.reduce((sum, c) => sum + c.fabricationCostTotal, 0);
  const totalWeight = costs.reduce((sum, c) => sum + c.totalWeight, 0);

  return {
    totalMaterialCost,
    totalFabricationCost,
    totalWeight,
    itemCount: items.length,
    assemblyCount: items.filter((i) => i.itemType === 'ASSEMBLY').length,
    partCount: items.filter((i) => i.itemType === 'PART').length,
  };
}
```

### 6.5 Validation (Zod Schemas)

**Location**: `/packages/validation/src/schemas.ts`

```typescript
import { z } from 'zod';

export const BOMCategorySchema = z.enum([
  'HEAT_EXCHANGER',
  'PRESSURE_VESSEL',
  'STORAGE_TANK',
  'REACTOR',
  'PIPING_ASSEMBLY',
  'PIPING_SPOOL',
  'STRUCTURAL_ASSEMBLY',
  'PLATFORM',
  'SUPPORT_STRUCTURE',
  'THERMAL_DESALINATION_UNIT',
  'CUSTOM_ASSEMBLY',
]);

export const BOMTypeSchema = z.enum(['EBOM', 'MBOM', 'PBOM']);

export const BOMStatusSchema = z.enum([
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'RELEASED',
  'ARCHIVED',
]);

export const BOMItemTypeSchema = z.enum(['ASSEMBLY', 'PART', 'MATERIAL']);

export const BOMSchema = z.object({
  id: z.string().optional(),
  bomCode: z.string().regex(/^BOM-\d{4}-\d{4}$/),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: BOMCategorySchema,
  bomType: BOMTypeSchema,
  projectId: z.string().optional(),
  proposalId: z.string().optional(),
  entityId: z.string(),
  rootItemId: z.string(),
  items: z.array(z.string()),
  summary: z.object({
    totalMaterialCost: z.number().nonnegative(),
    totalFabricationCost: z.number().nonnegative(),
    totalWeight: z.number().nonnegative(),
    totalSurfaceArea: z.number().nonnegative().optional(),
    itemCount: z.number().int().nonnegative(),
    assemblyCount: z.number().int().nonnegative(),
    partCount: z.number().int().nonnegative(),
  }),
  overhead: z
    .object({
      percentage: z.number().min(0).max(100).optional(),
      fixedAmount: z.number().nonnegative().optional(),
    })
    .optional(),
  margin: z
    .object({
      percentage: z.number().min(0).max(100).optional(),
      targetProfit: z.number().nonnegative().optional(),
    })
    .optional(),
  finalPrice: z.number().nonnegative().optional(),
  version: z.number().int().positive(),
  status: BOMStatusSchema,
  revisionHistory: z.array(
    z.object({
      version: z.number().int().positive(),
      date: z.any(), // Timestamp
      changedBy: z.string(),
      changeDescription: z.string().max(500),
      changeType: z.enum(['MINOR', 'MAJOR']),
    })
  ),
  applicableStandards: z.array(z.string()).optional(),
  designPressure: z.number().optional(),
  designTemperature: z.number().optional(),
  fluidService: z.string().max(100).optional(),
  createdBy: z.string(),
  createdAt: z.any(), // Timestamp
  updatedBy: z.string(),
  updatedAt: z.any(), // Timestamp
  isActive: z.boolean(),
});

export const BOMItemSchema = z.object({
  id: z.string().optional(),
  bomId: z.string(),
  itemNumber: z.string().regex(/^\d+(\.\d+)*$/), // 1, 1.1, 1.1.1
  itemType: BOMItemTypeSchema,
  parentItemId: z.string().optional(),
  childItemIds: z.array(z.string()),
  level: z.number().int().nonnegative(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  drawingReference: z.string().max(100).optional(),
  component: z
    .object({
      shapeId: z.string().optional(),
      shapeInstanceId: z.string().optional(),
      materialId: z.string().optional(),
      specification: z.string().max(500).optional(),
      manufacturer: z.string().max(200).optional(),
      partNumber: z.string().max(100).optional(),
      parameters: z.record(z.number()).optional(),
    })
    .optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(20),
  allowWastage: z.boolean(),
  wastagePercentage: z.number().min(0).max(50).optional(),
  totalQuantity: z.number().positive().optional(),
  calculatedProperties: z
    .object({
      weight: z.number().nonnegative().optional(),
      totalWeight: z.number().nonnegative().optional(),
      volume: z.number().nonnegative().optional(),
      surfaceArea: z.number().nonnegative().optional(),
    })
    .optional(),
  cost: z
    .object({
      materialCost: z.number().nonnegative().optional(),
      materialCostTotal: z.number().nonnegative().optional(),
      fabricationCost: z.number().nonnegative().optional(),
      fabricationCostTotal: z.number().nonnegative().optional(),
      itemTotal: z.number().nonnegative().optional(),
    })
    .optional(),
  fabrication: z
    .object({
      laborHours: z.number().nonnegative().optional(),
      machiningRequired: z.boolean().optional(),
      weldingRequired: z.boolean().optional(),
      weldLength: z.number().nonnegative().optional(),
      paintingRequired: z.boolean().optional(),
      heatTreatmentRequired: z.boolean().optional(),
    })
    .optional(),
  procurement: z
    .object({
      procurementType: z.enum(['MAKE', 'BUY']),
      leadTime: z.number().int().nonnegative().optional(),
      preferredVendors: z.array(z.string()).optional(),
      minimumOrderQuantity: z.number().positive().optional(),
    })
    .optional(),
  standards: z.array(z.string()).optional(),
  inspectionRequired: z.boolean().optional(),
  inspectionType: z.array(z.string()).optional(),
  createdAt: z.any(), // Timestamp
  updatedAt: z.any(), // Timestamp
});
```

---

## 7. Implementation Phases

### Phase 1: Core BOM CRUD (40-50 hours)

**Deliverables**:

- [ ] Data model types (`/packages/types/src/bom.ts`)
- [ ] Validation schemas (`/packages/validation/src/schemas.ts`)
- [ ] Firestore indexes
- [ ] Security rules
- [ ] Service layer (bomService.ts)
- [ ] BOM list page (view, filter, search)
- [ ] BOM editor page (tree view, add/edit/delete items)
- [ ] Basic cost calculation (material cost only)

**Testing**:

- [ ] Unit tests for service functions (15 tests)
- [ ] BOM creation with items (3-level hierarchy)
- [ ] Cost calculation accuracy
- [ ] Permission enforcement

### Phase 2: Shape & Material Integration (25-30 hours)

**Deliverables**:

- [ ] Shape selection in BOM items
- [ ] Material selection in BOM items
- [ ] Parameter inputs for shapes
- [ ] Real-time weight calculation (shape formulas + material density)
- [ ] Real-time cost calculation (weight × material price)
- [ ] Wastage calculation
- [ ] Fabrication cost inputs

**Testing**:

- [ ] Integration tests with Material Database (10 tests)
- [ ] Integration tests with Shape Database (10 tests)
- [ ] Weight calculation accuracy (compare with manual calculations)
- [ ] Cost calculation accuracy

### Phase 3: Templates & Advanced Features (30-35 hours)

**Deliverables**:

- [ ] BOM template creation
- [ ] Template parameterization
- [ ] Template instantiation
- [ ] Template library UI
- [ ] Pre-built templates (Heat Exchanger, Pressure Vessel, Tank, Piping Spool)
- [ ] Overhead and margin calculations
- [ ] BOM approval workflow (submit, approve, reject)
- [ ] Version control (revision history)

**Testing**:

- [ ] Template instantiation (parameter substitution)
- [ ] Template validation (required parameters)
- [ ] Approval workflow (status transitions)

### Phase 4: Export & Integration (25-35 hours)

**Deliverables**:

- [ ] Export to Excel (EBOM, MBOM, PBOM, Costed BOM)
- [ ] Export to PDF (Standard, Client-facing, Procurement)
- [ ] Transfer BOM to Proposal (scope of supply)
- [ ] Transfer BOM to Project (procurement items, budget, document requirements)
- [ ] Cost breakdown visualizations (charts)
- [ ] BOM comparison (v1 vs v2)

**Testing**:

- [ ] Excel export format validation
- [ ] PDF generation (visual check)
- [ ] Proposal integration (BOM items → Proposal items)
- [ ] Project integration (BOM items → Procurement items)

**Total Estimated Effort**: **120-150 hours** (3-4 weeks)

---

## 8. Success Metrics

### 8.1 Functional Metrics

- [ ] **BOM Creation Time**: < 30 minutes for 100-item BOM (using templates)
- [ ] **Cost Accuracy**: ±5% variance between BOM estimate and actual project cost
- [ ] **Template Reuse**: 60%+ of BOMs created from templates (after 3 months)
- [ ] **Proposal Integration**: 100% of proposals include BOM-generated scope of supply

### 8.2 User Adoption

- [ ] **User Training**: All users with CREATE_BOM permission trained within 2 weeks
- [ ] **Active Usage**: 80%+ of new proposals use BOM Generator (after 2 months)
- [ ] **User Satisfaction**: >4.0/5.0 rating on usability survey

### 8.3 Data Quality

- [ ] **BOM Completeness**: 95%+ of BOMs have all required fields filled
- [ ] **Cost Data**: 90%+ of BOM items have cost data (not zero)
- [ ] **Material Linkage**: 80%+ of shape-based items linked to Material Database

---

## 9. Dependencies & Risks

### 9.1 Dependencies

**Critical (Blocking)**:

- ✅ Material Database (Phase 1, Module 1) - COMPLETE
- ✅ Shape Database (Phase 1, Module 2) - COMPLETE

**Important (Non-blocking)**:

- Projects Module (partially implemented) - for BOM-to-Project transfer
- Proposal Module (implemented) - for BOM-to-Proposal transfer

### 9.2 Risks

**Technical Risks**:
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Formula evaluation performance slow for large BOMs | Medium | High | Use memoization, calculate on-demand, cache results |
| Firestore read costs high (deeply nested items) | Medium | Medium | Denormalize item count/cost in BOM document |
| Excel export fails for 1000+ item BOMs | Low | Medium | Implement pagination, warn user for large exports |

**Business Risks**:
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users prefer spreadsheets over BOM Generator | Medium | High | Excel import/export, make UI faster than spreadsheets |
| Fabrication cost formulas inaccurate | Medium | Medium | Allow manual override, refine formulas based on actuals |
| Template parameters too rigid | Low | Medium | Allow template customization after instantiation |

**Data Risks**:
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Material/Shape database incomplete | Medium | High | Import standard materials/shapes before BOM rollout |
| Cost data outdated (material prices change) | High | Medium | Price history tracking, alert when prices >90 days old |

---

## 10. Future Enhancements (Post-v1.0)

### 10.1 Phase 2 Enhancements

**Integration with Thermal Desalination Module**:

- Auto-generate BOM from thermal design calculations
- Link thermal parameters to BOM items (heat transfer area → tube count)

**Advanced Costing**:

- Learning algorithms: Improve fabrication cost estimates based on actual project data
- Vendor quote integration: Import vendor quotes directly into BOM items
- Multi-currency support: Handle imported components in USD/EUR

### 10.2 Future Features

**BOM Optimization**:

- Material substitution suggestions (cheaper alternatives with similar properties)
- Bulk discount calculations (order quantity optimization)
- Weight optimization (reduce material usage while meeting design requirements)

**Collaboration**:

- Real-time collaborative editing (multiple users editing same BOM)
- Comments & discussions on BOM items
- Change tracking (who changed what, when)

**AI/ML Features**:

- Auto-suggest shapes based on item description
- Predict fabrication cost based on historical data
- Anomaly detection (unusually high/low costs)

**Advanced Exports**:

- 3D model export (STEP/IGES) for CAD integration
- MRP/ERP integration (export to SAP, Oracle)
- Custom export templates (user-defined Excel formats)

---

## 11. Glossary

**ASME**: American Society of Mechanical Engineers
**ASTM**: American Society for Testing and Materials
**BOM**: Bill of Materials
**EBOM**: Engineering BOM (design structure)
**MBOM**: Manufacturing BOM (fabrication sequence)
**PBOM**: Procurement BOM (purchasing list)
**TEMA**: Tubular Exchanger Manufacturers Association
**Schedule**: Pipe wall thickness designation (Sch 10, 40, 80, etc.)
**Wastage**: Additional material allowance for cutting, fabrication losses
**Fabrication Cost**: Labor and process costs (welding, machining, painting)
**Overhead**: Indirect costs (admin, utilities, facility)
**Margin**: Profit percentage on top of costs

---

**Document Version**: 1.0
**Last Updated**: November 14, 2025
**Next Review**: After Phase 1, Module 2 (Shape Database) completion

---

## Appendix A: Example BOM Structure

**Equipment**: Shell & Tube Heat Exchanger HX-101 (TEMA Type BEM)

```
BOM-2025-0042: Heat Exchanger HX-101
├─ 1. Shell Assembly (2,450 kg, ₹5,20,000)
│  ├─ 1.1 Cylindrical Shell (1,250 kg, ₹2,50,000)
│  │   Shape: SHELL_CYLINDRICAL, Material: CS A516 Gr 70
│  │   Parameters: ID=1000mm, L=3000mm, t=10mm
│  ├─ 1.2 Front Tube Sheet (350 kg, ₹87,500)
│  │   Shape: PLATE_CIRCULAR, Material: CS A516 Gr 70
│  │   Parameters: D=1000mm, t=50mm
│  ├─ 1.3 Rear Tube Sheet (350 kg, ₹87,500)
│  │   Shape: PLATE_CIRCULAR, Material: CS A516 Gr 70
│  ├─ 1.4 Front Head (250 kg, ₹62,500)
│  │   Shape: HEAD_HEMISPHERICAL, Material: CS A516 Gr 70
│  │   Parameters: ID=1000mm, t=10mm
│  └─ 1.5 Rear Head (250 kg, ₹62,500)
│      Shape: HEAD_HEMISPHERICAL, Material: CS A516 Gr 70
│
├─ 2. Tube Bundle (850 kg, ₹2,55,000)
│  ├─ 2.1 Tubes (100 nos, 800 kg, ₹2,40,000)
│  │   Shape: PIPE_STRAIGHT, Material: SS 316L
│  │   Parameters: OD=25.4mm, Schedule=10S, L=2900mm
│  └─ 2.2 Tie Rods (6 nos, 50 kg, ₹15,000)
│      Shape: ROD_ROUND, Material: SS 316
│
├─ 3. Nozzles (120 kg, ₹90,000)
│  ├─ 3.1 Shell Inlet (1 nos, 30 kg, ₹25,000)
│  │   Specification: Nozzle 6″ Sch 40 CS A106 Gr B with RF flange
│  ├─ 3.2 Shell Outlet (1 nos, 30 kg, ₹25,000)
│  ├─ 3.3 Tube Inlet (1 nos, 20 kg, ₹20,000)
│  │   Specification: Nozzle 4″ Sch 40 316L with RF flange
│  └─ 3.4 Tube Outlet (1 nos, 20 kg, ₹20,000)
│
└─ 4. Supports (180 kg, ₹45,000)
   ├─ 4.1 Saddles (2 nos, 160 kg, ₹40,000)
   │   Shape: CUSTOM (welded assembly), Material: CS IS 2062
   └─ 4.2 Anchor Bolts (8 nos, 20 kg, ₹5,000)
       Specification: Hex Bolt A193 B7 M20 × 100mm with nuts & washers

Total Weight: 3,600 kg
Total Material Cost: ₹9,10,000
Total Fabrication Cost: ₹4,50,000
Subtotal: ₹13,60,000
Overhead (10%): ₹1,36,000
Margin (15%): ₹2,24,400
Final Price: ₹17,20,400
```

---

**End of Document**
