# Material Database Module - Detailed Requirements

**Document Version**: 1.0
**Created**: November 14, 2025
**Status**: Draft - For Review
**Priority**: 🔴 CRITICAL (Phase 1, Module 1 - Build FIRST)

---

## 1. Module Overview

### 1.1 Purpose

The Material Database serves as the central repository for all raw materials and bought-out components used in engineering and manufacturing. It enables:

- Centralized material master data management
- Historical price tracking for accurate cost estimation
- Vendor-material mapping for procurement
- Material property reference for engineering design
- Standardized material specifications across the organization

### 1.2 Business Value

- **Accurate Cost Estimation**: Historical pricing data enables precise BOM costing
- **Faster Proposal Generation**: Pre-populated material costs reduce estimation time by 60%
- **Vendor Management**: Know which vendors supply which materials at what price
- **Engineering Accuracy**: Material properties readily available for design calculations
- **Procurement Efficiency**: Historical data helps negotiate better prices

### 1.3 Dependencies

- **Requires**: Entity Management Module (for vendor linking) ✅ Already exists (80% complete)
- **Enables**:
  - Shape Database (uses materials for weight/cost calculations)
  - BOM Generator (uses materials for costing)
  - Thermal Desalination Module (uses materials for equipment design)
  - Procurement Module (enhanced with material history)

### 1.4 User Permissions

- **CREATE_MATERIAL**: Create new materials
- **EDIT_MATERIAL**: Edit material properties and prices
- **DELETE_MATERIAL**: Delete materials (with cascade checks)
- **VIEW_ALL_MATERIALS**: View complete material database
- **MANAGE_MATERIAL_PRICES**: Add/edit price history

---

## 2. Data Model

### 2.1 Core Entities

**Important**: All materials follow **ASME (American Society of Mechanical Engineers)** and **ASTM (American Society for Testing and Materials)** standards for consistency, traceability, and compliance with engineering requirements.

#### 2.1.1 Material

```typescript
interface Material {
  // Identity
  id: string;
  materialCode: string; // Auto-generated: MAT-YYYY-NNNN or custom
  customCode?: string; // User-defined code (e.g., "SS316-PL")
  name: string; // e.g., "Stainless Steel 316 Plate"
  description: string; // Detailed description

  // Classification
  category: MaterialCategory;
  subCategory?: string; // e.g., "Plates", "Pipes", "Fasteners"
  materialType: 'RAW_MATERIAL' | 'BOUGHT_OUT_COMPONENT' | 'CONSUMABLE';

  // Specifications
  specification: {
    standard?: string; // e.g., "ASTM A240", "IS 2062", "DIN 17440"
    grade?: string; // e.g., "316L", "304", "A36"
    finish?: string; // e.g., "2B", "BA", "No. 4"
    form?: string; // e.g., "Plate", "Sheet", "Bar", "Rod"
    customSpecs?: string; // Additional specifications
  };

  // Physical Properties
  properties: MaterialProperties;

  // Unit of Measurement
  baseUnit: string; // e.g., "kg", "nos", "meter", "liter"
  alternateUnits?: UnitConversion[]; // e.g., kg ↔ ton, meter ↔ feet

  // Procurement
  preferredVendors: string[]; // Array of vendor entity IDs
  leadTimeDays?: number; // Typical lead time
  minimumOrderQuantity?: number;

  // Pricing
  currentPrice?: MaterialPrice; // Latest price
  priceHistory: string[]; // References to MaterialPrice documents

  // Stock Management (Optional)
  trackInventory: boolean;
  currentStock?: number;
  reorderLevel?: number;
  reorderQuantity?: number;

  // Documentation
  datasheetUrl?: string; // Link to datasheet document
  imageUrl?: string; // Material image
  certifications?: string[]; // e.g., "EN 10204 3.1", "Mill Test Certificate"

  // Search & Organization
  tags: string[]; // Searchable tags
  isActive: boolean; // Soft delete flag
  isStandard: boolean; // Frequently used material

  // Substitution
  substituteMaterials?: string[]; // Alternative material IDs
  substituteNotes?: string; // When to use substitutes

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  lastPriceUpdate?: Timestamp;
}
```

#### 2.1.2 MaterialCategory (Enum)

```typescript
enum MaterialCategory {
  // Raw Materials - Plates (ASME/ASTM Standards)
  PLATES_CARBON_STEEL = 'PLATES_CARBON_STEEL', // ASTM A36, A516, etc.
  PLATES_STAINLESS_STEEL = 'PLATES_STAINLESS_STEEL', // ASTM A240 (304, 316, etc.)
  PLATES_ALLOY_STEEL = 'PLATES_ALLOY_STEEL', // ASTM A387, etc.
  PLATES_ALUMINUM = 'PLATES_ALUMINUM', // ASTM B209
  PLATES_COPPER = 'PLATES_COPPER', // ASTM B152
  PLATES_TITANIUM = 'PLATES_TITANIUM', // ASTM B265
  PLATES_NICKEL_ALLOYS = 'PLATES_NICKEL_ALLOYS', // ASTM B168 (Inconel, Monel)

  // Raw Materials - Pipes (ASME/ASTM by Schedule)
  PIPES_SEAMLESS = 'PIPES_SEAMLESS', // ASTM A106, A312 (Sch 10, 40, 80, 160)
  PIPES_WELDED = 'PIPES_WELDED', // ASTM A53, A312 (Sch 10, 40, 80)
  PIPES_STAINLESS = 'PIPES_STAINLESS', // ASTM A312/A358 (Sch 5S, 10S, 40S, 80S)
  PIPES_COPPER = 'PIPES_COPPER', // ASTM B88, B280
  PIPES_ALLOY_STEEL = 'PIPES_ALLOY_STEEL', // ASTM A335 (P11, P22, P91)

  // Bought-Out Components - Fittings (ASME B16.9, B16.11)
  FITTINGS_BUTT_WELD = 'FITTINGS_BUTT_WELD', // ASME B16.9 (Elbows, Tees, Reducers)
  FITTINGS_SOCKET_WELD = 'FITTINGS_SOCKET_WELD', // ASME B16.11
  FITTINGS_THREADED = 'FITTINGS_THREADED', // ASME B16.11
  FITTINGS_FLANGED = 'FITTINGS_FLANGED', // ASME B16.5 (Elbows, Tees)

  // Bought-Out Components - Fasteners (ASME/ASTM Standards)
  FASTENERS_BOLTS = 'FASTENERS_BOLTS', // ASTM A193, A320 (Hex bolts, Stud bolts)
  FASTENERS_NUTS = 'FASTENERS_NUTS', // ASTM A194 (Hex nuts, Heavy hex nuts)
  FASTENERS_WASHERS = 'FASTENERS_WASHERS', // ASME B18.21.1 (Flat, Lock, Spring)
  FASTENERS_BOLT_NUT_WASHER_SETS = 'FASTENERS_BOLT_NUT_WASHER_SETS', // Complete sets
  FASTENERS_STUDS = 'FASTENERS_STUDS', // ASTM A193 (Threaded rods)
  FASTENERS_SCREWS = 'FASTENERS_SCREWS', // ASME B18.3 (Cap screws, Set screws)

  // Bought-Out Components - Other
  VALVES = 'VALVES', // ASME B16.34 (Gate, Globe, Check, Ball)
  FLANGES = 'FLANGES', // ASME B16.5, B16.47 (Slip-on, Weld neck, Blind)
  GASKETS = 'GASKETS', // ASME B16.20, B16.21
  PUMPS = 'PUMPS',
  MOTORS = 'MOTORS',
  INSTRUMENTATION = 'INSTRUMENTATION',
  ELECTRICAL = 'ELECTRICAL',

  // Other Metals
  BARS_AND_RODS = 'BARS_AND_RODS', // ASTM A276 (SS bars), A36 (CS bars)
  SHEETS = 'SHEETS', // ASTM A240, A167
  STRUCTURAL_SHAPES = 'STRUCTURAL_SHAPES', // ASTM A992 (I-beams, Channels, Angles)

  // Plastics & Polymers
  PLASTICS = 'PLASTICS',
  RUBBER = 'RUBBER',
  COMPOSITES = 'COMPOSITES',

  // Consumables
  WELDING_CONSUMABLES = 'WELDING_CONSUMABLES', // AWS D1.1 (Electrodes, Filler wire)
  PAINTS_COATINGS = 'PAINTS_COATINGS',
  LUBRICANTS = 'LUBRICANTS',
  CHEMICALS = 'CHEMICALS',

  // Other
  OTHER = 'OTHER',
}
```

#### 2.1.2.1 Material Category Examples & Standards

**PLATES** (Raw Materials - ASME/ASTM Certified):

| Category               | ASTM Standard  | Common Grades             | Example Materials                                   |
| ---------------------- | -------------- | ------------------------- | --------------------------------------------------- |
| PLATES_CARBON_STEEL    | ASTM A36, A516 | Gr. 60, Gr. 70            | "CS Plate ASTM A36", "CS Plate A516 Gr. 70"         |
| PLATES_STAINLESS_STEEL | ASTM A240      | 304, 304L, 316, 316L, 321 | "SS Plate 316L ASTM A240", "SS Plate 304 2B Finish" |
| PLATES_ALLOY_STEEL     | ASTM A387      | Gr. 11, Gr. 22, Gr. 91    | "Alloy Plate A387 Gr. 22", "P22 Plate"              |
| PLATES_ALUMINUM        | ASTM B209      | 5052, 6061                | "Aluminum Plate 6061-T6"                            |
| PLATES_NICKEL_ALLOYS   | ASTM B168      | Inconel 600, Monel 400    | "Inconel 600 Plate", "Monel 400 Plate"              |

**Specification Fields for Plates**:

- Standard: ASTM A240, ASTM A516, etc.
- Grade: 316L, Gr. 70, etc.
- Finish: 2B, BA, No. 4, Hot Rolled
- Thickness: Available in range (e.g., 3mm to 100mm)

---

**PIPES** (Raw Materials - By Schedule):

| Category          | ASTM Standard             | Schedules             | Example Materials                          |
| ----------------- | ------------------------- | --------------------- | ------------------------------------------ |
| PIPES_SEAMLESS    | ASTM A106 (CS), A312 (SS) | Sch 10, 40, 80, 160   | "CS Seamless Pipe A106 Gr. B Sch 40 DN 50" |
| PIPES_WELDED      | ASTM A53, A312            | Sch 10, 40, 80        | "CS Welded Pipe A53 Gr. B Sch 40 DN 100"   |
| PIPES_STAINLESS   | ASTM A312, A358           | Sch 5S, 10S, 40S, 80S | "SS Seamless Pipe 316L A312 Sch 40S DN 50" |
| PIPES_ALLOY_STEEL | ASTM A335                 | Sch 40, 80, 160       | "Alloy Pipe A335 P11 Sch 80 DN 150"        |

**Specification Fields for Pipes**:

- Standard: ASTM A106, A312, etc.
- Grade: Gr. B, 316L, P11, etc.
- Schedule: Sch 10, 40, 80, 160, 5S, 10S, 40S, 80S
- Nominal Size (DN): DN 15, DN 50, DN 100, etc. (or NPS for US standards)
- Type: Seamless, Welded (ERW, SAW)

**Common Pipe Schedules**:

- **Sch 10**: Thin wall, low pressure
- **Sch 40**: Standard wall, most common
- **Sch 80**: Extra strong, high pressure
- **Sch 160**: Double extra strong, very high pressure
- **Sch 5S/10S/40S/80S**: Stainless steel schedules

---

**FITTINGS** (Bought-Out Components - ASME B16 Standards):

| Category             | ASME Standard | Types                                   | Example Materials                                      |
| -------------------- | ------------- | --------------------------------------- | ------------------------------------------------------ |
| FITTINGS_BUTT_WELD   | ASME B16.9    | 90° Elbow, 45° Elbow, Tee, Reducer, Cap | "SS 316L Butt Weld Elbow 90° DN 50 Sch 40S ASME B16.9" |
| FITTINGS_SOCKET_WELD | ASME B16.11   | 90° Elbow, Tee, Coupling, Half Coupling | "CS Socket Weld Elbow 90° 3000# DN 25"                 |
| FITTINGS_THREADED    | ASME B16.11   | Elbow, Tee, Coupling, Union, Plug       | "CS Threaded Tee 2000# 1/2 inch NPT"                   |
| FITTINGS_FLANGED     | ASME B16.5    | Flange × Fitting combinations           | "SS 316 Flanged Elbow DN 100 PN 16"                    |

**Specification Fields for Fittings**:

- Standard: ASME B16.9, B16.11
- Material: CS (ASTM A234), SS (ASTM A403)
- Size: DN 15 to DN 600
- Schedule/Rating: Sch 40S, 3000#, etc.
- Type: Long radius (LR), Short radius (SR) for elbows
- Angle: 90°, 45° for elbows

---

**FASTENERS** (Bought-Out Components - Each Type Separate):

**A. BOLTS** (ASTM A193, A320):

| Type            | ASTM Standard | Grades      | Example Materials                    |
| --------------- | ------------- | ----------- | ------------------------------------ |
| Hex Bolts       | ASTM A193     | B7, B8, B8M | "Hex Bolt A193 B7 M16 × 60mm"        |
| Stud Bolts      | ASTM A193     | B7, B16     | "Stud Bolt A193 B7 M20 × 200mm"      |
| Heavy Hex Bolts | ASTM A320     | L7, L7M     | "Heavy Hex Bolt A320 L7 M24 × 100mm" |

**B. NUTS** (ASTM A194):

| Type           | ASTM Standard | Grades    | Example Materials           |
| -------------- | ------------- | --------- | --------------------------- |
| Hex Nuts       | ASTM A194     | 2H, 8, 8M | "Hex Nut A194 2H M16"       |
| Heavy Hex Nuts | ASTM A194     | 2H, 8M    | "Heavy Hex Nut A194 8M M20" |
| Lock Nuts      | ASTM A194     | 2H, 8     | "Lock Nut A194 2H M16"      |

**C. WASHERS** (ASME B18.21.1):

| Type           | ASME Standard | Example Materials                       |
| -------------- | ------------- | --------------------------------------- |
| Flat Washers   | ASME B18.21.1 | "Flat Washer B18.21.1 M16 CS"           |
| Lock Washers   | ASME B18.21.1 | "Lock Washer B18.21.1 M16 Spring Steel" |
| Spring Washers | ASME B18.21.1 | "Spring Washer B18.21.1 M20"            |

**D. BOLT-NUT-WASHER SETS** (Complete Assembly):

| Set Type              | Components                  | Example                                                             |
| --------------------- | --------------------------- | ------------------------------------------------------------------- |
| Complete Fastener Set | 1 Bolt + 2 Nuts + 2 Washers | "Fastener Set A193 B7 M16×60 (1 Bolt + 2 Nuts A194 2H + 2 Washers)" |
| Stud Set              | 1 Stud + 2 Nuts + 2 Washers | "Stud Set A193 B7 M20×200 (1 Stud + 2 Nuts A194 2H + 2 Washers)"    |

**Specification Fields for Fasteners**:

- **Bolts**: Standard (A193, A320), Grade (B7, B8), Thread (M6 to M64), Length (mm)
- **Nuts**: Standard (A194), Grade (2H, 8, 8M), Thread (M6 to M64), Type (Hex, Heavy Hex, Lock)
- **Washers**: Standard (B18.21.1), Type (Flat, Lock, Spring), Size (M6 to M64), Material
- **Sets**: Bolt/Stud spec + Nut spec + Washer spec + Quantity of each

**Important for Sets**:

- Each component tracked separately in BOM
- Set is a convenience for procurement (buy together)
- Pricing can be per set or per component

---

#### 2.1.3 MaterialProperties

```typescript
interface MaterialProperties {
  // Physical Properties
  density?: number; // kg/m³ or g/cm³
  densityUnit?: 'kg/m3' | 'g/cm3';

  // Mechanical Properties
  tensileStrength?: number; // MPa
  yieldStrength?: number; // MPa
  elongation?: number; // %
  hardness?: string; // e.g., "150 HB", "45 HRC"

  // Thermal Properties
  thermalConductivity?: number; // W/(m·K)
  specificHeat?: number; // J/(kg·K)
  meltingPoint?: number; // °C
  maxOperatingTemp?: number; // °C

  // Chemical Properties
  composition?: {
    element: string; // e.g., "C", "Cr", "Ni"
    percentage: number; // %
  }[];
  corrosionResistance?: string; // Descriptive

  // Electrical Properties
  electricalResistivity?: number; // Ω·m

  // Dimensional Properties (for bought-out components)
  nominalSize?: string; // e.g., "DN 50", "M8", "1/2 inch"
  length?: number; // mm
  width?: number; // mm
  thickness?: number; // mm
  diameter?: number; // mm

  // Custom Properties
  customProperties?: {
    propertyName: string;
    value: string | number;
    unit?: string;
  }[];
}
```

#### 2.1.4 MaterialPrice

```typescript
interface MaterialPrice {
  id: string;
  materialId: string; // Parent material

  // Price Details
  pricePerUnit: Money; // Price in base currency
  unit: string; // Must match material baseUnit
  currency: CurrencyCode; // Usually INR

  // Vendor & Source
  vendorId?: string; // If from specific vendor
  vendorName?: string; // Denormalized
  sourceType: 'VENDOR_QUOTE' | 'MARKET_RATE' | 'HISTORICAL' | 'ESTIMATED' | 'CONTRACT_RATE';

  // Validity
  effectiveDate: Timestamp; // When price becomes effective
  expiryDate?: Timestamp; // Quote validity

  // Quantity Tiers (optional)
  quantityBreaks?: {
    minQuantity: number;
    maxQuantity?: number;
    pricePerUnit: Money;
  }[];

  // Context
  remarks?: string; // e.g., "Annual contract rate", "Spot market"
  documentReference?: string; // Quote reference, PO number

  // Status
  isActive: boolean; // Current price?
  isForecast: boolean; // Future estimated price?

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

#### 2.1.5 UnitConversion

```typescript
interface UnitConversion {
  fromUnit: string; // e.g., "kg"
  toUnit: string; // e.g., "ton"
  conversionFactor: number; // e.g., 1000 (1 ton = 1000 kg)
}
```

---

## 3. Functional Requirements

### 3.1 Material Master Data Management

#### 3.1.1 Create Material

**Actor**: User with CREATE_MATERIAL permission
**Trigger**: New material needs to be added to database
**Flow**:

1. Navigate to Materials → New Material
2. Select material category (dropdown)
3. Fill in basic information:
   - Name, description
   - Specification (standard, grade, finish)
   - Material type (raw/bought-out/consumable)
4. Enter physical properties:
   - Density (required for weight calculations)
   - Thermal properties (for thermal design)
   - Mechanical properties (for structural design)
5. Define units:
   - Base unit (kg, nos, meter, etc.)
   - Alternate units (optional conversions)
6. Add vendor mapping:
   - Select preferred vendors from entity database
   - Add lead time, MOQ
7. Upload documentation:
   - Datasheet PDF
   - Material image
   - Certifications
8. Add tags for searchability
9. Save

**Validations**:

- Material code unique (if custom code provided)
- Name required
- Category required
- Base unit required
- Density required if category is metal/plastic
- At least one vendor recommended (warning if none)

**Outputs**:

- Material created with auto-generated MAT-YYYY-NNNN code
- Material added to searchable database
- Audit log entry created

#### 3.1.2 Material List & Search

**Actor**: Users with VIEW_ALL_MATERIALS permission
**Features**:

**List View**:

- Columns: Material Code, Name, Category, Specification, Current Price, Last Updated
- Default sort: Recently updated first
- Pagination: 50/100/200 per page

**Advanced Search**:

- Text search (name, description, custom code, tags)
- Filter by:
  - Category (multi-select dropdown)
  - Material type (raw/bought-out/consumable)
  - Vendor (select from entity list)
  - Price range (min-max)
  - Specification standard (ASTM, IS, DIN, etc.)
  - Has datasheet (yes/no)
  - Is active (active/inactive)
  - Is standard (frequently used)

**Search by Properties**:

- Density range (e.g., 2.7-2.9 g/cm³ for aluminum)
- Operating temperature range
- Corrosion resistance keyword

**Quick Filters**:

- My recent materials (last 10 viewed)
- Standard materials (frequently used)
- Out of stock (if inventory tracking enabled)
- Price updated in last 30 days

**Export**:

- Export search results to Excel
- Include: Code, Name, Category, Spec, Current Price, Vendors

**Bulk Actions**:

- Mark as standard/non-standard
- Activate/deactivate multiple materials
- Bulk tag addition

#### 3.1.3 Material Detail View

**Actor**: Users with VIEW_ALL_MATERIALS permission
**Layout**:

**Tabs**:

1. **Overview Tab**:
   - Material code, name, description
   - Category, type, specification
   - Status badges (Active, Standard, In Stock)
   - Quick stats: Current price, Last updated, Total vendors
   - Image/photo

2. **Properties Tab**:
   - Physical properties (density, etc.)
   - Mechanical properties (tensile strength, etc.)
   - Thermal properties (conductivity, etc.)
   - Chemical composition table
   - Custom properties

3. **Pricing Tab**:
   - Current price card (large, prominent)
   - Price history chart (line graph, last 12 months)
   - Price history table (all prices with vendor, date, source)
   - Add new price button
   - Export price history to Excel

4. **Vendors Tab**:
   - Preferred vendors list
   - Vendor contact info (from entity database)
   - Last purchase from each vendor (if available)
   - Lead time by vendor
   - Add/remove vendor buttons

5. **Specifications Tab**:
   - Standard, grade, finish details
   - Certifications required
   - Datasheet download link
   - Compliance notes

6. **Inventory Tab** (if tracking enabled):
   - Current stock level
   - Reorder level, reorder quantity
   - Stock movement history
   - Add stock adjustment button

7. **Usage Tab**:
   - BOMs using this material (list)
   - Projects using this material (via BOMs)
   - Total quantity used in active projects
   - Usage trend chart

8. **Substitutes Tab**:
   - List of substitute materials
   - Substitute notes (when to use)
   - Add substitute material button

**Actions** (right sidebar):

- Edit material
- Add price
- Upload datasheet
- Add to favorites
- Duplicate material (create similar)
- Deactivate/activate
- Delete (with cascade check)

#### 3.1.4 Edit Material

**Actor**: User with EDIT_MATERIAL permission
**Flow**:

1. Open material detail view
2. Click "Edit"
3. Modify any field (except material code)
4. Save changes

**Change Tracking**:

- Track what changed (field-level audit)
- Show change history in activity log
- Require remarks for price changes

**Validations**:

- Cannot change material code
- Cannot change base unit if material used in BOMs
- Warn if changing category (affects calculations)

#### 3.1.5 Delete Material

**Actor**: User with DELETE_MATERIAL permission
**Flow**:

1. Open material detail view
2. Click "Delete"
3. System checks usage:
   - Is material used in any BOM?
   - Is material used in any active project?
   - Any open purchase requests for this material?
4. If used:
   - Show error: "Cannot delete. Material used in X BOMs, Y projects"
   - Suggest deactivation instead
5. If not used:
   - Confirm deletion dialog
   - Require deletion reason
   - Delete material (soft delete - set isActive = false)

**Outputs**:

- Material marked inactive
- Audit log entry with reason
- Notification to material creator

---

### 3.2 Price Management

#### 3.2.1 Add Material Price

**Actor**: User with MANAGE_MATERIAL_PRICES permission
**Trigger**: New price quote received or market rate updated
**Flow**:

1. Open material detail view → Pricing tab
2. Click "Add Price"
3. Fill in price details:
   - Price per unit (number)
   - Currency (defaults to INR)
   - Unit (auto-filled from material base unit)
   - Effective date (default: today)
   - Expiry date (optional, for vendor quotes)
   - Source type (vendor quote, market rate, etc.)
   - Vendor (if source = vendor quote)
   - Quantity breaks (optional)
   - Remarks
   - Document reference (quote number, etc.)
4. Save

**Business Rules**:

- If effective date is today or past → set as current price
- If effective date is future → mark as forecast price
- Previous current price remains in history
- Cannot have multiple prices with same effective date and vendor

**Validations**:

- Price > 0
- Effective date required
- If source = vendor quote, vendor required
- If quantity breaks provided, must be non-overlapping

**Outputs**:

- New MaterialPrice document created
- Material.currentPrice updated (if effective now)
- Material.lastPriceUpdate timestamp updated
- Price history chart refreshed
- Notification to procurement team (if significant change)

#### 3.2.2 Price History & Trends

**Actor**: Users with VIEW_ALL_MATERIALS permission
**Features**:

**Price History Chart**:

- Line chart showing price over time (last 12 months default)
- X-axis: Date
- Y-axis: Price per unit
- Multiple lines if different vendors
- Toggle vendors on/off
- Hover to see exact price, date, vendor
- Zoom in/out (1 month, 3 months, 6 months, 1 year, all time)

**Price History Table**:

- Columns: Date, Price, Unit, Vendor, Source, Remarks, Added By, Actions
- Sort by date (newest first)
- Filter by vendor
- Export to Excel

**Price Analytics**:

- Average price (last 3 months, 6 months, 12 months)
- Price volatility (standard deviation)
- Highest price (with date)
- Lowest price (with date)
- Current vs average (percentage difference)
- Trend indicator (↑ increasing, ↓ decreasing, → stable)

**Price Alerts** (future):

- Alert if price increases >10% from last price
- Alert if price quote is expiring soon
- Alert if no price update in 6 months

---

### 3.3 Vendor-Material Mapping

#### 3.3.1 Add Vendor to Material

**Actor**: User with EDIT_MATERIAL permission
**Flow**:

1. Open material detail → Vendors tab
2. Click "Add Vendor"
3. Select vendor from entity dropdown (type = VENDOR)
4. Add lead time (days)
5. Add MOQ (optional)
6. Add vendor-specific notes
7. Save

**Outputs**:

- Vendor ID added to material.preferredVendors array
- Vendor card displayed in Vendors tab
- Material appears in vendor's "supplied materials" list

#### 3.3.2 Remove Vendor from Material

**Actor**: User with EDIT_MATERIAL permission
**Flow**:

1. Open material detail → Vendors tab
2. Click "Remove" on vendor card
3. Confirm removal
4. Vendor removed from list

**Business Rule**:

- Cannot remove vendor if there's an active price from that vendor
- Warn if removing last preferred vendor

#### 3.3.3 View Vendor's Materials

**Actor**: Procurement team
**Flow**:

1. Navigate to Entities → Vendors → [Vendor Detail]
2. Tab: "Supplied Materials"
3. See list of materials where this vendor is preferred
4. Click material to view details

**Features**:

- Filter by category
- Export vendor's material catalog
- Compare prices across vendors for same material

---

### 3.4 Material Properties & Specifications

#### 3.4.1 Edit Material Properties

**Actor**: User with EDIT_MATERIAL permission
**Flow**:

1. Open material detail → Properties tab
2. Click "Edit Properties"
3. Update property values:
   - Physical (density, etc.)
   - Mechanical (tensile strength, etc.)
   - Thermal (conductivity, etc.)
   - Chemical (composition)
4. Add custom properties (key-value pairs)
5. Save

**Validations**:

- Numeric properties must be > 0
- Percentages must be 0-100
- Chemical composition total should ≈ 100%

**Outputs**:

- Material properties updated
- Audit log entry
- If density changed → warn that weight calculations in BOMs may be affected

#### 3.4.2 Material Datasheet Management

**Actor**: User with EDIT_MATERIAL permission
**Flow**:

1. Open material detail → Specifications tab
2. Click "Upload Datasheet"
3. Select PDF file
4. System uploads to Document Management
5. Link stored in material.datasheetUrl
6. Datasheet available for download

**Features**:

- Version control (if datasheet updated)
- Datasheet thumbnail preview
- Download button

---

### 3.5 Material Substitution

#### 3.5.1 Add Substitute Material

**Actor**: User with EDIT_MATERIAL permission
**Trigger**: Alternative material identified
**Flow**:

1. Open material detail → Substitutes tab
2. Click "Add Substitute"
3. Search and select substitute material
4. Add substitution notes (when to use, limitations)
5. Save

**Business Rule**:

- Substitute should be same category (warning if not)
- Reciprocal link created (if Material A substitutes Material B, then Material B substitutes Material A)

**Use Case**:

- Material A: SS316 Plate (preferred)
- Material B: SS304 Plate (substitute when SS316 not available)
- BOM Generator can suggest substitute if Material A unavailable

---

### 3.6 Inventory Management (Optional)

#### 3.6.1 Enable Inventory Tracking

**Actor**: User with EDIT_MATERIAL permission
**Flow**:

1. Open material detail → Inventory tab
2. Toggle "Track Inventory" ON
3. Enter initial stock level
4. Set reorder level and quantity
5. Save

**Features**:

- Current stock display
- Stock status indicator (In Stock, Low Stock, Out of Stock)
- Reorder alert when stock < reorder level

#### 3.6.2 Stock Adjustment

**Actor**: User with MANAGE_MATERIAL_PRICES permission
**Flow**:

1. Open material detail → Inventory tab
2. Click "Adjust Stock"
3. Select adjustment type:
   - Increase (purchase, production)
   - Decrease (consumption, wastage)
   - Set (physical count correction)
4. Enter quantity
5. Add reason/remarks
6. Save

**Outputs**:

- Stock level updated
- Stock movement log entry created
- Alert if stock now below reorder level

**Note**: Full inventory management is out of scope for Phase 1. This is basic stock level tracking only.

---

### 3.7 Material Import & Export

#### 3.7.1 Bulk Import from Excel

**Actor**: User with CREATE_MATERIAL permission
**Trigger**: Large material database migration or batch addition
**Flow**:

1. Navigate to Materials → Import
2. Download Excel template
3. Fill template with material data
4. Upload completed Excel file
5. System validates:
   - Required fields present
   - Data types correct
   - No duplicate material codes
   - Vendors exist in entity database
6. Show validation report (errors, warnings)
7. Confirm import
8. System creates materials in batch

**Template Columns**:

- Material Code*, Name*, Description*, Category*, Type\*
- Specification (Standard, Grade, Finish)
- Density, Base Unit\*
- Preferred Vendor Codes (comma-separated)
- Tags (comma-separated)
- Price, Currency, Effective Date

**Validations**:

- Required fields marked with \*
- Density required for metals/plastics
- Vendor codes must match existing entities
- Category must be valid enum value

**Outputs**:

- X materials created successfully
- Y materials failed (with error details)
- Summary report (downloadable)

#### 3.7.2 Export Materials to Excel

**Actor**: Users with VIEW_ALL_MATERIALS permission
**Flow**:

1. Navigate to Materials list
2. Apply filters (if needed)
3. Click "Export to Excel"
4. Select columns to export (checkbox list)
5. Click "Download"

**Export Includes**:

- Material master data
- Current prices
- Vendor mappings
- Properties (optional, separate sheet)

---

## 4. Non-Functional Requirements

### 4.1 Performance

- Material list loading: < 2 seconds for 1000 records
- Search results: < 1 second
- Price history chart rendering: < 1 second
- Bulk import: < 30 seconds for 500 materials

### 4.2 Security

- Role-based access control (CREATE, EDIT, DELETE, VIEW permissions)
- Audit trail for all price changes
- Soft delete (materials never hard-deleted)
- Price history immutable (cannot edit/delete historical prices)

### 4.3 Usability

- Mobile-responsive (view materials on tablet)
- Auto-complete for material search
- Recent materials quick access (last 10 viewed)
- Keyboard shortcuts (Ctrl+F for search, Ctrl+N for new)
- Inline validation with helpful error messages

### 4.4 Integration

- Links to Entity Management (vendor data)
- Used by Shape Database (material selection)
- Used by BOM Generator (material costing)
- Used by Thermal Desalination (material properties for design)
- Used by Procurement (material purchase)

### 4.5 Data Quality

- Unique material codes enforced
- Price validation (no negative prices)
- Property validation (density > 0 for metals)
- Vendor validation (must exist in entity database)
- Category standardization (enum-based)

---

## 5. UI/UX Requirements

### 5.1 Navigation Structure

```
/materials
  /list                     # Material list with search/filter
  /new                      # Create new material
  /import                   # Bulk import from Excel
  /[materialId]
    /overview              # Material detail (default tab)
    /properties            # Physical/mechanical/thermal properties
    /pricing               # Price history and current price
    /vendors               # Preferred vendors
    /specifications        # Standards, datasheet, certifications
    /inventory             # Stock levels (if enabled)
    /usage                 # BOMs and projects using this material
    /substitutes           # Alternative materials
    /edit                  # Edit material
```

### 5.2 Key Screens

#### 5.2.1 Material List Page

- Header: "Materials" + New Material + Import buttons
- Search bar (full-text search)
- Filters (collapsible left sidebar):
  - Category (tree view)
  - Type (checkboxes)
  - Vendor (dropdown)
  - Price range (slider)
  - Other filters (has datasheet, is active, is standard)
- Table:
  - Columns: Code, Image (thumbnail), Name, Category, Spec, Current Price, Vendors, Last Updated, Actions
  - Sort by any column
  - Pagination
  - Bulk select checkboxes
- Quick stats (top): Total materials, Standard materials, Out of stock (if inventory enabled)

#### 5.2.2 Material Detail Page

- Header: Material Code + Name + Status badges
- Image (left sidebar)
- Tabs (main content area):
  - Overview, Properties, Pricing, Vendors, Specifications, Inventory, Usage, Substitutes
- Actions (right sidebar):
  - Edit, Add Price, Upload Datasheet, Add to Favorites, Duplicate, Delete

#### 5.2.3 New/Edit Material Form

- Wizard-style multi-step form:
  - Step 1: Basic Info (name, description, category, type)
  - Step 2: Specifications (standard, grade, finish)
  - Step 3: Properties (density, thermal, mechanical)
  - Step 4: Units (base unit, conversions)
  - Step 5: Vendors (preferred vendors, lead time, MOQ)
  - Step 6: Documentation (datasheet, image, certifications)
  - Step 7: Review & Save
- Auto-save draft every 60 seconds
- Save as Draft / Publish buttons

#### 5.2.4 Price History Chart (Component)

- Line chart (using Recharts or similar)
- X-axis: Date (last 12 months)
- Y-axis: Price per unit
- Multiple series (one per vendor)
- Legend with vendor colors
- Hover tooltip (date, price, vendor, source)
- Zoom controls (1M, 3M, 6M, 1Y, All)
- Export chart as image button

#### 5.2.5 Add Price Dialog

- Modal dialog
- Fields:
  - Price per unit (number input)
  - Currency (dropdown, default INR)
  - Unit (read-only, from material)
  - Effective date (date picker)
  - Expiry date (date picker, optional)
  - Source type (dropdown)
  - Vendor (dropdown, if source = vendor quote)
  - Quantity breaks (expandable section)
  - Remarks (text area)
  - Document reference (text input)
- Save / Cancel buttons
- Validation messages inline

---

## 6. Technical Architecture

### 6.1 Firestore Collections

```
/materials/{materialId}
  - Material document

/materials/{materialId}/prices/{priceId}
  - MaterialPrice sub-collection (price history)

/materials/{materialId}/stockMovements/{movementId}
  - Stock adjustment history (if inventory tracking enabled)
```

### 6.2 Firestore Indexes

```json
[
  {
    "collectionGroup": "materials",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "category", "order": "ASCENDING" },
      { "fieldPath": "updatedAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "materials",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isActive", "order": "ASCENDING" },
      { "fieldPath": "isStandard", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "materials",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "preferredVendors", "arrayConfig": "CONTAINS" },
      { "fieldPath": "updatedAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "prices",
    "queryScope": "COLLECTION_GROUP",
    "fields": [
      { "fieldPath": "materialId", "order": "ASCENDING" },
      { "fieldPath": "effectiveDate", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "prices",
    "queryScope": "COLLECTION_GROUP",
    "fields": [
      { "fieldPath": "materialId", "order": "ASCENDING" },
      { "fieldPath": "isActive", "order": "DESCENDING" }
    ]
  }
]
```

### 6.3 Services

```typescript
// packages/firebase/src/materialService.ts
- createMaterial()
- updateMaterial()
- deleteMaterial() // Soft delete
- getMaterialById()
- listMaterials(filters)
- searchMaterials(query)
- addMaterialPrice()
- getMaterialPriceHistory()
- getCurrentPrice()
- addPreferredVendor()
- removePreferredVendor()
- addSubstituteMaterial()
- bulkImportMaterials()
- exportMaterialsToExcel()
- updateMaterialStock()
- getMaterialStockHistory()

// packages/firebase/src/materialSearchService.ts
- searchByProperties(propertyFilters)
- searchByCategory(category)
- searchByVendor(vendorId)
- getMaterialsByIds(materialIds[])
```

### 6.4 Types

```typescript
// packages/types/src/material.ts
-Material -
  MaterialCategory -
  MaterialProperties -
  MaterialPrice -
  UnitConversion -
  MaterialFilter -
  MaterialSearchQuery;
```

### 6.5 Validation

```typescript
// packages/validation/src/schemas.ts
export const materialSchema = z.object({
  materialCode: z.string().optional(),
  customCode: z.string().optional(),
  name: z.string().min(3).max(200),
  description: z.string().min(10),
  category: z.nativeEnum(MaterialCategory),
  materialType: z.enum(['RAW_MATERIAL', 'BOUGHT_OUT_COMPONENT', 'CONSUMABLE']),
  specification: materialSpecificationSchema,
  properties: materialPropertiesSchema,
  baseUnit: z.string().min(1),
  preferredVendors: z.array(z.string()).optional(),
  tags: z.array(z.string()),
  isActive: z.boolean().default(true),
});

export const materialPriceSchema = z.object({
  pricePerUnit: moneySchema,
  unit: z.string(),
  currency: z.nativeEnum(CurrencyCode),
  effectiveDate: z.date(),
  expiryDate: z.date().optional(),
  sourceType: z.enum(['VENDOR_QUOTE', 'MARKET_RATE', 'HISTORICAL', 'ESTIMATED', 'CONTRACT_RATE']),
  vendorId: z.string().optional(),
  remarks: z.string().optional(),
});
```

### 6.6 UI Components

```typescript
// apps/web/src/app/materials/page.tsx
- MaterialListPage

// apps/web/src/app/materials/[id]/page.tsx
- MaterialDetailPage

// apps/web/src/app/materials/new/page.tsx
- MaterialFormPage (wizard)

// apps/web/src/components/materials/
- MaterialCard.tsx
- MaterialTable.tsx
- MaterialSearchFilters.tsx
- MaterialPriceChart.tsx (Recharts integration)
- MaterialPropertyEditor.tsx
- AddPriceDialog.tsx
- VendorMappingList.tsx
- SubstituteMaterialsList.tsx
- MaterialImportDialog.tsx
```

---

## 7. Implementation Phases

### Phase 1: Core Material CRUD (Week 1 - 15-20 hours)

- [ ] Data model (Material type)
- [ ] Firestore collection and indexes
- [ ] Service functions (CRUD)
- [ ] Validation schemas
- [ ] Material list page with search
- [ ] Material detail page (overview tab only)
- [ ] Create/edit material form (basic fields)

**Deliverable**: Can create and view materials with basic info

### Phase 2: Price Management (Week 1-2 - 15-20 hours)

- [ ] MaterialPrice data model
- [ ] Price history sub-collection
- [ ] Add price function
- [ ] Price history service
- [ ] Pricing tab UI
- [ ] Price history chart (Recharts)
- [ ] Add price dialog

**Deliverable**: Can track material prices over time

### Phase 3: Advanced Features (Week 2 - 15-20 hours)

- [ ] Material properties tab
- [ ] Vendor mapping (add/remove vendors)
- [ ] Specifications tab (datasheet upload)
- [ ] Material substitution
- [ ] Advanced search filters
- [ ] Material import from Excel
- [ ] Export to Excel

**Deliverable**: Complete material database functionality

### Phase 4: Integration & Polish (Week 2 - 10-15 hours)

- [ ] Integration with Entity Management (vendors)
- [ ] Integration tests
- [ ] UI polish and responsive design
- [ ] Performance optimization (pagination, lazy loading)
- [ ] Documentation

**Deliverable**: Production-ready material database

---

## 8. Total Effort Estimate

| Phase                         | Hours           | Deliverable               |
| ----------------------------- | --------------- | ------------------------- |
| Phase 1: Core CRUD            | 15-20           | Basic material management |
| Phase 2: Price Management     | 15-20           | Price tracking & history  |
| Phase 3: Advanced Features    | 15-20           | Complete feature set      |
| Phase 4: Integration & Polish | 10-15           | Production-ready          |
| **TOTAL**                     | **55-75 hours** | -                         |

**Recommended Team**: 1 developer
**Timeline**: 2 weeks (at 30-35 hours/week)

**Note**: Original estimate was 60-80 hours. Refined estimate: 55-75 hours.

---

## 9. Success Criteria

- [ ] 100+ materials in database
- [ ] Price history for top 20 materials (at least 3 months)
- [ ] Search results in < 1 second
- [ ] Can filter by category, vendor, price range
- [ ] Price history chart renders smoothly
- [ ] Export to Excel works correctly
- [ ] Vendor mapping functional
- [ ] Material used by Shape Database (integration test)
- [ ] Material used by BOM Generator (integration test)
- [ ] User adoption: Procurement team uses for price checks

---

## 10. Future Enhancements (Post Phase 1)

- Material approval workflow (draft → review → approved)
- Price forecast based on historical trends (ML)
- Auto-reorder when stock below reorder level
- Material comparison tool (compare properties side-by-side)
- Material recommendations (based on requirements)
- QR code generation for materials (warehouse tracking)
- Multi-language support (Hindi, Tamil, etc.)
- Integration with external material databases (MatWeb, etc.)

---

**End of Document**
