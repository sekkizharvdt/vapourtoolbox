# Shape Database Module - Detailed Requirements

**Document Version**: 1.1
**Created**: November 14, 2025
**Last Updated**: November 14, 2025
**Status**: Draft - For Review
**Priority**: 🔴 CRITICAL (Phase 1, Module 2 - Build SECOND)

**Version 1.1 Updates**:

- Added comprehensive surface area calculations (inner, outer, wetted area)
- Added blank material definitions and scrap percentage calculations
- Added detailed examples for dished heads with blank requirements
- Added Section 3.9: Blank Material & Scrap Management (comprehensive guide)
- Added scrap cost impact calculations and optimization strategies

---

## 1. Module Overview

### 1.1 Purpose

The Shape Database serves as a repository of standard geometric shapes and components with dimensional data, weight calculation formulas, and material compatibility rules. It enables:

- Automated weight and surface area calculations for BOMs
- Standard component selection for equipment design
- Material quantity calculations based on dimensions
- Cost estimation (material + fabrication)
- Engineering accuracy through standardized shapes

### 1.2 Business Value

- **Automated Calculations**: Weight and area calculated automatically, saving hours of manual work
- **Engineering Accuracy**: Standard shapes reduce calculation errors by 80%
- **Faster BOM Generation**: Pre-defined shapes speed up BOM creation by 50%
- **Cost Estimation**: Fabrication cost formulas enable accurate pricing
- **Design Standardization**: Promotes use of standard components, reducing custom fabrication

### 1.3 Dependencies

- **Requires**:
  - Material Database Module ✅ (Must complete first - uses material density, pricing)
  - Entity Management Module ✅ (Already exists - for vendor linking)
- **Enables**:
  - BOM Generator (uses shapes to build equipment lists)
  - Thermal Desalination Module (uses shapes for heat exchanger design)
  - Cost estimation in Proposal Module

### 1.4 User Permissions

- **CREATE_SHAPE**: Create new shapes
- **EDIT_SHAPE**: Edit shape definitions and formulas
- **DELETE_SHAPE**: Delete shapes (with cascade checks)
- **VIEW_ALL_SHAPES**: View complete shape database
- **MANAGE_SHAPE_FORMULAS**: Add/edit calculation formulas

---

## 2. Data Model

### 2.1 Core Entities

**Important**: All shapes follow **ASME (American Society of Mechanical Engineers)** standards for pressure vessels, piping components, and structural shapes. Dimensional standards follow ASME B16 series, ASME Section VIII, and AISC (American Institute of Steel Construction) specifications.

#### 2.1.1 Shape

```typescript
interface Shape {
  // Identity
  id: string;
  shapeCode: string; // Auto-generated: SHP-YYYY-NNNN or custom
  customCode?: string; // User-defined code (e.g., "HX-SHELL-1000")
  name: string; // e.g., "Cylindrical Shell", "Rectangular Plate"
  description: string; // Detailed description

  // Classification
  category: ShapeCategory;
  subCategory?: string; // e.g., "Horizontal", "Vertical"
  shapeType: 'STANDARD' | 'PARAMETRIC' | 'CUSTOM';

  // Standard Reference (if applicable)
  standard?: {
    code: string; // e.g., "ASME B16.9", "ASME Section VIII Div 1"
    figureNumber?: string; // e.g., "UG-27", "Figure 1-1"
    edition?: string; // Standard edition/year
  };

  // Dimensional Parameters
  parameters: ShapeParameter[]; // List of dimensional inputs (D, L, t, etc.)

  // Material Compatibility
  allowedMaterialCategories: MaterialCategory[]; // Which materials can be used
  defaultMaterialCategory?: MaterialCategory;

  // Calculation Formulas
  formulas: {
    volume?: FormulaDefinition; // Volume calculation (material volume)
    weight?: FormulaDefinition; // Weight = Volume × Density

    // Surface Area Calculations
    surfaceArea?: FormulaDefinition; // Total surface area (for coating/painting)
    innerSurfaceArea?: FormulaDefinition; // Internal surface (for process contact)
    outerSurfaceArea?: FormulaDefinition; // External surface (for insulation)
    wettedArea?: FormulaDefinition; // Process-side surface (for heat transfer)

    // Blank/Stock Material Calculations (for cutting from stock)
    blankDimensions?: BlankDefinition; // Blank shape required (e.g., square plate for circular head)
    blankArea?: FormulaDefinition; // Blank area (before cutting)
    finishedArea?: FormulaDefinition; // Finished part area (after cutting)
    scrapPercentage?: FormulaDefinition; // (Blank area - Finished area) / Blank area × 100

    customFormulas?: {
      name: string; // e.g., "Moment of Inertia", "Weld Length"
      formula: FormulaDefinition;
      unit: string;
    }[];
  };

  // Fabrication Cost Estimation
  fabricationCost?: {
    baseCost?: number; // Fixed cost component
    costPerKg?: number; // Cost per kg of material
    costPerSurfaceArea?: number; // Cost per m² of surface (for welding, painting)
    laborHours?: number; // Estimated fabrication hours
    setupCost?: number; // One-time setup cost
    formula?: string; // Custom cost formula
  };

  // Visualization
  imageUrl?: string; // Shape diagram/drawing
  threeDModelUrl?: string; // 3D CAD model (optional)
  sketchUrl?: string; // Dimensional sketch with labels

  // Usage & Organization
  tags: string[]; // Searchable tags
  isStandard: boolean; // Frequently used shape
  isActive: boolean; // Soft delete flag
  usageCount: number; // Times used in BOMs

  // Validation Rules
  validationRules?: {
    parameterName: string;
    rule: 'MIN' | 'MAX' | 'RANGE' | 'REQUIRED' | 'CUSTOM';
    value: number | number[] | string;
    errorMessage: string;
  }[];

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

#### 2.1.2 ShapeCategory (Enum)

```typescript
enum ShapeCategory {
  // Plates & Sheets
  PLATE_RECTANGULAR = 'PLATE_RECTANGULAR', // ASME Section VIII
  PLATE_CIRCULAR = 'PLATE_CIRCULAR',
  PLATE_CUSTOM = 'PLATE_CUSTOM',

  // Pipes & Tubes (As Per ASME B36.10M, B36.19M)
  PIPE_STRAIGHT = 'PIPE_STRAIGHT', // Standard pipe lengths
  PIPE_SPOOL = 'PIPE_SPOOL', // Custom pipe assembly
  TUBE_STRAIGHT = 'TUBE_STRAIGHT', // Heat exchanger tubes

  // Pressure Vessel Components (ASME Section VIII)
  SHELL_CYLINDRICAL = 'SHELL_CYLINDRICAL', // UG-27 (Cylindrical shells)
  SHELL_CONICAL = 'SHELL_CONICAL', // UG-32 (Conical shells)
  HEAD_HEMISPHERICAL = 'HEAD_HEMISPHERICAL', // UG-32(c) (Hemisphere)
  HEAD_ELLIPSOIDAL = 'HEAD_ELLIPSOIDAL', // UG-32(d) (2:1 Elliptical)
  HEAD_TORISPHERICAL = 'HEAD_TORISPHERICAL', // UG-32(e) (Flanged & dished)
  HEAD_FLAT = 'HEAD_FLAT', // UG-34 (Flat heads)
  HEAD_CONICAL = 'HEAD_CONICAL', // UG-32(f) (Conical heads)

  // Heat Exchanger Components (TEMA Standards)
  HX_SHELL = 'HX_SHELL', // Heat exchanger shell
  HX_TUBE_BUNDLE = 'HX_TUBE_BUNDLE', // Tube bundle assembly
  HX_TUBE_SHEET = 'HX_TUBE_SHEET', // Tube sheet (plate with holes)
  HX_BAFFLE = 'HX_BAFFLE', // Baffle plate
  HX_CHANNEL = 'HX_CHANNEL', // Channel/bonnet

  // Fittings (ASME B16.9, B16.11)
  ELBOW_90_DEG = 'ELBOW_90_DEG', // 90° elbow (LR/SR)
  ELBOW_45_DEG = 'ELBOW_45_DEG', // 45° elbow
  TEE_STRAIGHT = 'TEE_STRAIGHT', // Straight tee
  TEE_REDUCING = 'TEE_REDUCING', // Reducing tee
  REDUCER_CONCENTRIC = 'REDUCER_CONCENTRIC', // Concentric reducer
  REDUCER_ECCENTRIC = 'REDUCER_ECCENTRIC', // Eccentric reducer
  CAP = 'CAP', // Pipe cap

  // Flanges (ASME B16.5, B16.47)
  FLANGE_WELD_NECK = 'FLANGE_WELD_NECK', // Weld neck flange
  FLANGE_SLIP_ON = 'FLANGE_SLIP_ON', // Slip-on flange
  FLANGE_BLIND = 'FLANGE_BLIND', // Blind flange
  FLANGE_THREADED = 'FLANGE_THREADED', // Threaded flange
  FLANGE_LAP_JOINT = 'FLANGE_LAP_JOINT', // Lap joint flange

  // Structural Shapes (AISC Standards)
  BEAM_I = 'BEAM_I', // I-beam (W-shapes)
  BEAM_H = 'BEAM_H', // H-beam
  CHANNEL = 'CHANNEL', // Channel (C-shapes)
  ANGLE = 'ANGLE', // Angle (L-shapes)
  TUBE_RECTANGULAR = 'TUBE_RECTANGULAR', // Rectangular hollow section
  TUBE_SQUARE = 'TUBE_SQUARE', // Square hollow section

  // Nozzles & Connections
  NOZZLE_CYLINDRICAL = 'NOZZLE_CYLINDRICAL', // Vessel nozzle
  NOZZLE_REINFORCEMENT_PAD = 'NOZZLE_REINFORCEMENT_PAD',

  // Gaskets (ASME B16.20, B16.21)
  GASKET_FULL_FACE = 'GASKET_FULL_FACE',
  GASKET_RING = 'GASKET_RING',
  GASKET_SPIRAL_WOUND = 'GASKET_SPIRAL_WOUND',

  // Custom Shapes
  CUSTOM_ASSEMBLY = 'CUSTOM_ASSEMBLY', // User-defined assembly
  OTHER = 'OTHER',
}
```

#### 2.1.3 ShapeParameter

```typescript
interface ShapeParameter {
  name: string; // e.g., "D" (Diameter), "L" (Length), "t" (Thickness)
  label: string; // e.g., "Shell Diameter", "Length"
  description?: string; // "Inside diameter of the shell"
  unit: string; // e.g., "mm", "m", "inch"
  dataType: 'NUMBER' | 'SELECT' | 'BOOLEAN';

  // For NUMBER type
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;

  // For SELECT type (e.g., pipe schedule)
  options?: {
    value: string; // e.g., "Sch 40"
    label: string;
    numericValue?: number; // Wall thickness for calculation
  }[];

  // Display
  order: number; // Display order in form
  required: boolean;
  helpText?: string; // Guidance for user

  // Formula dependency
  usedInFormulas: string[]; // Which formulas use this parameter
}
```

#### 2.1.4 FormulaDefinition

```typescript
interface FormulaDefinition {
  expression: string; // Math expression (e.g., "PI * D * D / 4 * L")
  variables: string[]; // Variables used (e.g., ["D", "L"])
  constants?: {
    name: string; // e.g., "PI"
    value: number; // 3.14159
  }[];
  unit: string; // Result unit (e.g., "m³", "kg", "m²")
  description?: string; // Formula explanation

  // For weight calculation
  requiresDensity?: boolean; // If true, material density is multiplied

  // Validation
  expectedRange?: {
    min: number;
    max: number;
    warning?: string; // Warning if outside range
  };
}
```

#### 2.1.4.1 BlankDefinition (New)

```typescript
interface BlankDefinition {
  blankType: 'RECTANGULAR' | 'CIRCULAR' | 'CUSTOM';

  // For RECTANGULAR blank
  blankLength?: FormulaDefinition; // Length of rectangular blank (mm)
  blankWidth?: FormulaDefinition; // Width of rectangular blank (mm)

  // For CIRCULAR blank
  blankDiameter?: FormulaDefinition; // Diameter of circular blank (mm)

  // Thickness (usually same as part thickness)
  blankThickness?: string; // Parameter name (e.g., "t")

  // Scrap calculation
  scrapFormula?: FormulaDefinition; // Scrap percentage calculation

  // Explanation
  description?: string; // "Circular head cut from square plate"
  diagram?: string; // URL to diagram showing blank layout
}
```

#### 2.1.5 ShapeInstance (Used in BOM)

```typescript
interface ShapeInstance {
  id: string;
  shapeId: string; // Reference to Shape
  shapeName: string; // Denormalized
  shapeCategory: ShapeCategory; // Denormalized

  // Material Selection
  materialId: string; // Selected material
  materialName: string; // Denormalized
  materialDensity: number; // kg/m³ (from material)
  materialPricePerKg: number; // Latest price

  // Dimensional Values (User Input)
  parameterValues: {
    parameterName: string;
    value: number | string;
    unit: string;
  }[];

  // Calculated Results
  calculatedValues: {
    volume: number; // m³ (material volume)
    weight: number; // kg

    // Surface Areas
    surfaceArea: number; // m² (total surface)
    innerSurfaceArea?: number; // m² (internal)
    outerSurfaceArea?: number; // m² (external)
    wettedArea?: number; // m² (process-side, for heat transfer)

    // Blank/Stock Material
    blankDimensions?: {
      type: string; // RECTANGULAR, CIRCULAR
      length?: number; // mm (for rectangular)
      width?: number; // mm (for rectangular)
      diameter?: number; // mm (for circular)
      thickness?: number; // mm
      area: number; // mm² (blank area)
    };
    finishedArea?: number; // mm² (part area after cutting)
    scrapPercentage?: number; // % (material waste)
    scrapWeight?: number; // kg (weight of scrap material)

    customCalculations?: {
      name: string;
      value: number;
      unit: string;
    }[];
  };

  // Cost Estimation
  costEstimate: {
    materialCost: number; // Weight × Price per kg
    fabricationCost: number; // Calculated using fabrication formula
    totalCost: number; // Material + Fabrication
    currency: CurrencyCode;
  };

  // Quantity
  quantity: number; // Number of this shape instance
  totalWeight: number; // Weight × Quantity
  totalCost: number; // Cost × Quantity

  // Notes
  remarks?: string;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
}
```

---

## 3. Standard Shapes Library

### 3.1 Plates & Sheets

#### 3.1.1 Rectangular Plate (ASME Section VIII)

**Category**: PLATE_RECTANGULAR
**Parameters**:

- Length (L): mm
- Width (W): mm
- Thickness (t): mm

**Formulas**:

- Volume = L × W × t × 10⁻⁹ (m³)
- Weight = Volume × Density (kg)
- Surface Area = 2 × (L × W + L × t + W × t) × 10⁻⁶ (m²)

**Material Compatibility**: All plate materials (CS, SS, Alloy, Aluminum, etc.)

---

#### 3.1.2 Circular Plate

**Category**: PLATE_CIRCULAR
**Parameters**:

- Diameter (D): mm
- Thickness (t): mm

**Formulas**:

- **Finished Part**:
  - Volume = π × (D/2)² × t × 10⁻⁹ (m³)
  - Weight = Volume × Density (kg)
  - Finished Area = π × (D/2)² × 10⁻⁶ (m²)
  - Surface Area (total) = 2 × π × (D/2)² + π × D × t × 10⁻⁶ (m²)

- **Blank/Stock Material**:
  - Blank Type: RECTANGULAR (square plate)
  - Blank Length = D + 50 mm (cutting allowance)
  - Blank Width = D + 50 mm (cutting allowance)
  - Blank Area = (D + 50)² × 10⁻⁶ (m²)
  - Scrap Percentage = ((Blank Area - Finished Area) / Blank Area) × 100
  - Scrap Percentage ≈ **21.5%** (for square blank with 50mm allowance)
  - Scrap Weight = (Blank Area - Finished Area) × t × Density × 10⁻³ (kg)

**Material Compatibility**: All plate materials

**Example**:

- Circular plate: D = 1000 mm, t = 10 mm, Material = CS A516 Gr 70 (density = 7850 kg/m³)
- Finished weight = 61.6 kg
- Blank required = 1050 × 1050 × 10 mm plate
- Blank weight = 85.6 kg
- Scrap = 24.0 kg (28.0%)

---

### 3.2 Pipes & Tubes

#### 3.2.1 Straight Pipe (ASME B36.10M)

**Category**: PIPE_STRAIGHT
**Parameters**:

- Nominal Diameter (DN): Select (DN 15, 25, 50, 100, 150, 200, 250, 300, etc.)
- Schedule: Select (Sch 10, 20, 40, 60, 80, 100, 120, 140, 160)
- Length (L): mm
- Outside Diameter (OD): mm (auto-filled based on DN)
- Wall Thickness (wt): mm (auto-filled based on Schedule)

**Formulas**:

- Inside Diameter (ID) = OD - 2 × wt
- Volume = π × ((OD/2)² - (ID/2)²) × L × 10⁻⁹ (m³)
- Weight = Volume × Density (kg)
- Outer Surface Area = π × OD × L × 10⁻⁶ (m²)
- Inner Surface Area = π × ID × L × 10⁻⁶ (m²)

**Material Compatibility**: PIPES_SEAMLESS, PIPES_WELDED, PIPES_STAINLESS

**Standard Reference**: ASME B36.10M (Welded and Seamless Wrought Steel Pipe)

---

### 3.3 Pressure Vessel Components (ASME Section VIII)

#### 3.3.1 Cylindrical Shell (UG-27)

**Category**: SHELL_CYLINDRICAL
**Parameters**:

- Inside Diameter (Di): mm
- Thickness (t): mm
- Length (L): mm (straight length, excluding heads)

**Formulas**:

- Outside Diameter (Do) = Di + 2 × t
- Volume = π × ((Do/2)² - (Di/2)²) × L × 10⁻⁹ (m³)
- Weight = Volume × Density (kg)
- Outer Surface Area = π × Do × L × 10⁻⁶ (m²)
- Inner Surface Area = π × Di × L × 10⁻⁶ (m²)

**Material Compatibility**: PLATES_CARBON_STEEL, PLATES_STAINLESS_STEEL, PLATES_ALLOY_STEEL

**Standard Reference**: ASME Section VIII Division 1, UG-27

---

#### 3.3.2 Hemispherical Head (UG-32c)

**Category**: HEAD_HEMISPHERICAL
**Parameters**:

- Inside Diameter (Di): mm (must match shell Di)
- Thickness (t): mm

**Formulas**:

- **Finished Part**:
  - Outside Diameter (Do) = Di + 2 × t
  - Radius (R) = Di / 2
  - Volume = (2/3) × π × ((Do/2)³ - (Di/2)³) × 10⁻⁹ (m³)
  - Weight = Volume × Density (kg)
  - Outer Surface Area = 2 × π × (Do/2)² × 10⁻⁶ (m²)
  - Inner Surface Area = 2 × π × (Di/2)² × 10⁻⁶ (m²)
  - Wetted Area = Inner Surface Area (for process calculations)

- **Blank/Stock Material**:
  - Blank Type: CIRCULAR (circular blank plate)
  - Blank Diameter (Db) = Do + 2 × straight flange + trim allowance
  - For standard hemispherical head: Db ≈ Do × 1.15 (approx 15% trim allowance)
  - Blank Area = π × (Db/2)² × 10⁻⁶ (m²)
  - Finished Projected Area = π × (Do/2)² × 10⁻⁶ (m²)
  - Scrap Percentage = ((Blank Area - Finished Projected Area) / Blank Area) × 100
  - Scrap Percentage ≈ **24-28%** (typical for hemispherical heads)
  - Scrap Weight = (Blank Area - Finished Projected Area) × t × Density × 10⁻³ (kg)

**Material Compatibility**: PLATES_CARBON_STEEL, PLATES_STAINLESS_STEEL, PLATES_ALLOY_STEEL

**Standard Reference**: ASME Section VIII Division 1, UG-32(c)

**Example**:

- Hemispherical head: Di = 1000 mm, t = 10 mm, Material = CS A516 Gr 70
- Do = 1020 mm
- Finished weight ≈ 125 kg
- Blank diameter required ≈ 1175 mm (circular blank)
- Blank weight ≈ 170 kg
- Scrap ≈ 45 kg (26.5%)

---

#### 3.3.3 Ellipsoidal Head (2:1) (UG-32d)

**Category**: HEAD_ELLIPSOIDAL
**Parameters**:

- Inside Diameter (Di): mm
- Thickness (t): mm
- Aspect Ratio: Fixed at 2:1 (Major axis = Di, Minor axis = Di/2)

**Formulas**:

- **Finished Part**:
  - Outside Diameter (Do) = Di + 2 × t
  - Major Axis (a) = Di / 2
  - Minor Axis (b) = Di / 4
  - Approximate Volume = (π/6) × Di × ((Di/2)² - (Di/2 - t)²) × 10⁻⁹ (m³)
  - Weight = Volume × Density (kg)
  - Outer Surface Area (approx) = π × a × sqrt(2 × (a² + b²)) × 10⁻⁶ (m²)
  - Inner Surface Area (approx) = same formula with inner dimensions
  - Wetted Area = Inner Surface Area

- **Blank/Stock Material**:
  - Blank Type: CIRCULAR (circular blank plate)
  - Blank Diameter (Db) = Do × 1.1 (approx 10% trim allowance for 2:1 ellipsoidal)
  - Blank Area = π × (Db/2)² × 10⁻⁶ (m²)
  - Finished Projected Area = π × (Do/2)² × 10⁻⁶ (m²)
  - Scrap Percentage = ((Blank Area - Finished Projected Area) / Blank Area) × 100
  - Scrap Percentage ≈ **18-22%** (typical for 2:1 ellipsoidal heads)
  - Scrap Weight = (Blank Area - Finished Projected Area) × t × Density × 10⁻³ (kg)

**Material Compatibility**: PLATES_CARBON_STEEL, PLATES_STAINLESS_STEEL, PLATES_ALLOY_STEEL

**Standard Reference**: ASME Section VIII Division 1, UG-32(d)

**Note**: 2:1 Ellipsoidal heads are most common in pressure vessel design (less scrap than hemispherical, stronger than torispherical).

**Example**:

- Ellipsoidal head: Di = 1000 mm, t = 10 mm, Material = CS A516 Gr 70
- Do = 1020 mm
- Finished weight ≈ 92 kg
- Blank diameter required ≈ 1120 mm (circular blank)
- Blank weight ≈ 115 kg
- Scrap ≈ 23 kg (20%)

---

#### 3.3.4 Torispherical Head (Flanged & Dished) (UG-32e)

**Category**: HEAD_TORISPHERICAL
**Parameters**:

- Inside Diameter (Di): mm
- Thickness (t): mm
- Crown Radius (L): mm (typically = Di)
- Knuckle Radius (r): mm (typically = 0.06 × Di, min 3 × t)

**Formulas**:

- **Finished Part**:
  - Outside Diameter (Do) = Di + 2 × t
  - Volume = Approximated using crown and knuckle geometry (complex formula)
  - Weight = Volume × Density (kg)
  - Outer Surface Area ≈ π × L × h (approx, where h = head depth)
  - Inner Surface Area = similar calculation with inner dimensions
  - Wetted Area = Inner Surface Area

- **Blank/Stock Material**:
  - Blank Type: CIRCULAR (circular blank plate)
  - Blank Diameter (Db) = Do + straight flange (typically 25-40mm) + trim allowance
  - Blank Diameter (Db) ≈ Do × 1.08 (approx 8% for standard F&D head)
  - Blank Area = π × (Db/2)² × 10⁻⁶ (m²)
  - Finished Projected Area = π × (Do/2)² × 10⁻⁶ (m²)
  - Scrap Percentage = ((Blank Area - Finished Projected Area) / Blank Area) × 100
  - Scrap Percentage ≈ **15-18%** (lowest among dished heads)
  - Scrap Weight = (Blank Area - Finished Projected Area) × t × Density × 10⁻³ (kg)

**Material Compatibility**: PLATES_CARBON_STEEL, PLATES_STAINLESS_STEEL

**Standard Reference**: ASME Section VIII Division 1, UG-32(e)

**Note**: This is the most common type of head for pressure vessels due to:

- Lower cost (less scrap than ellipsoidal or hemispherical)
- Easier fabrication
- Good pressure resistance for most applications

**Example**:

- Torispherical (F&D) head: Di = 1000 mm, t = 10 mm, L = 1000 mm, r = 60 mm, Material = CS A516 Gr 70
- Do = 1020 mm
- Finished weight ≈ 78 kg
- Blank diameter required ≈ 1100 mm (circular blank)
- Blank weight ≈ 94 kg
- Scrap ≈ 16 kg (17%)

---

### 3.4 Heat Exchanger Components (TEMA Standards)

#### 3.4.1 Heat Exchanger Shell

**Category**: HX_SHELL
**Parameters**:

- Inside Diameter (Di): mm
- Thickness (t): mm
- Length (L): mm

**Formulas**: Same as Cylindrical Shell

**Material Compatibility**: PLATES_CARBON_STEEL, PLATES_STAINLESS_STEEL, PLATES_TITANIUM, PLATES_NICKEL_ALLOYS

**Standard Reference**: TEMA (Tubular Exchanger Manufacturers Association)

---

#### 3.4.2 Tube Bundle

**Category**: HX_TUBE_BUNDLE
**Parameters**:

- Tube Outside Diameter (OD): mm
- Tube Wall Thickness (wt): mm
- Tube Length (L): mm
- Number of Tubes (N): integer
- Tube Pitch (P): mm

**Formulas**:

- Volume per Tube = π × ((OD/2)² - ((OD - 2×wt)/2)²) × L × 10⁻⁹ (m³)
- Total Volume = Volume per Tube × N
- Weight = Total Volume × Density (kg)
- Heat Transfer Area = π × OD × L × N × 10⁻⁶ (m²)

**Material Compatibility**: PIPES_STAINLESS, PIPES_COPPER, PLATES_TITANIUM

---

#### 3.4.3 Tube Sheet

**Category**: HX_TUBE_SHEET
**Parameters**:

- Diameter (D): mm (typically = shell Di)
- Thickness (t): mm
- Number of Tube Holes (N): integer
- Tube Hole Diameter (dh): mm

**Formulas**:

- Solid Plate Volume = π × (D/2)² × t × 10⁻⁹ (m³)
- Hole Volume = N × π × (dh/2)² × t × 10⁻⁹ (m³)
- Net Volume = Solid Plate Volume - Hole Volume
- Weight = Net Volume × Density (kg)

**Material Compatibility**: PLATES_CARBON_STEEL, PLATES_STAINLESS_STEEL

---

#### 3.4.4 Baffle Plate

**Category**: HX_BAFFLE
**Parameters**:

- Diameter (D): mm
- Thickness (t): mm
- Baffle Cut (%): number (typically 20-25%)
- Number of Baffles (N): integer

**Formulas**:

- Full Circle Area = π × (D/2)² × 10⁻⁶ (m²)
- Cut Area = Full Circle Area × (Baffle Cut / 100)
- Net Area = Full Circle Area - Cut Area
- Volume per Baffle = Net Area × t × 10⁻³ (m³)
- Total Volume = Volume per Baffle × N
- Weight = Total Volume × Density (kg)

**Material Compatibility**: PLATES_CARBON_STEEL, PLATES_STAINLESS_STEEL

---

### 3.5 Fittings (ASME B16.9)

#### 3.5.1 90° Elbow (Long Radius)

**Category**: ELBOW_90_DEG
**Parameters**:

- Nominal Diameter (DN): Select
- Schedule: Select
- Outside Diameter (OD): mm (auto-filled)
- Wall Thickness (wt): mm (auto-filled)
- Radius (R): mm (default = 1.5 × DN for LR)

**Formulas**:

- Center Line Length = π × R / 2
- Volume = π × ((OD/2)² - ((OD - 2×wt)/2)²) × Center Line Length × 10⁻⁹ (m³)
- Weight = Volume × Density (kg)

**Material Compatibility**: FITTINGS_BUTT_WELD (CS: ASTM A234, SS: ASTM A403)

**Standard Reference**: ASME B16.9

---

#### 3.5.2 Tee (Straight)

**Category**: TEE_STRAIGHT
**Parameters**:

- Nominal Diameter (DN): Select (same for run and branch)
- Schedule: Select
- Outside Diameter (OD): mm
- Wall Thickness (wt): mm

**Formulas**:

- Volume = Approximated based on standard tee dimensions
- Weight = Volume × Density (kg)

**Material Compatibility**: FITTINGS_BUTT_WELD

**Standard Reference**: ASME B16.9

---

#### 3.5.3 Concentric Reducer

**Category**: REDUCER_CONCENTRIC
**Parameters**:

- Large End Diameter (D1): mm
- Small End Diameter (D2): mm
- Length (L): mm
- Wall Thickness (wt): mm

**Formulas**:

- Volume = (π/3) × L × (wt × (D1 + D2 + sqrt(D1² + D2²))) × 10⁻⁹ (m³)
- Weight = Volume × Density (kg)

**Material Compatibility**: FITTINGS_BUTT_WELD

**Standard Reference**: ASME B16.9

---

### 3.6 Flanges (ASME B16.5)

#### 3.6.1 Weld Neck Flange

**Category**: FLANGE_WELD_NECK
**Parameters**:

- Nominal Diameter (DN): Select
- Pressure Rating (Class): Select (150, 300, 600, 900, 1500, 2500)
- Outside Diameter (OD): mm (per ASME B16.5 table)
- Thickness (t): mm (per ASME B16.5 table)
- Hub Height (h): mm

**Formulas**:

- Volume = Calculated from standard flange dimensions (tabulated)
- Weight = Volume × Density (kg)

**Material Compatibility**: PLATES_CARBON_STEEL, PLATES_STAINLESS_STEEL, PLATES_ALLOY_STEEL

**Standard Reference**: ASME B16.5

**Note**: Flange dimensions are standardized. Users select DN and Class, system looks up dimensions from table.

---

### 3.7 Structural Shapes (AISC)

#### 3.7.1 I-Beam (W-Shape)

**Category**: BEAM_I
**Parameters**:

- Designation: Select (e.g., W8×31, W12×26, W14×90)
  - Depth (d): mm (auto-filled)
  - Flange Width (bf): mm (auto-filled)
  - Web Thickness (tw): mm (auto-filled)
  - Flange Thickness (tf): mm (auto-filled)
- Length (L): mm

**Formulas**:

- Cross-sectional Area (A): mm² (from AISC table)
- Volume = A × L × 10⁻⁹ (m³)
- Weight per meter = A × Density × 10⁻⁶ (kg/m)
- Total Weight = Weight per meter × (L / 1000) (kg)

**Material Compatibility**: STRUCTURAL_SHAPES (ASTM A992, A36)

**Standard Reference**: AISC Steel Construction Manual

---

### 3.8 Gaskets (ASME B16.20, B16.21)

#### 3.8.1 Full Face Gasket

**Category**: GASKET_FULL_FACE
**Parameters**:

- Outside Diameter (OD): mm
- Inside Diameter (ID): mm
- Thickness (t): mm

**Formulas**:

- Volume = π × ((OD/2)² - (ID/2)²) × t × 10⁻⁹ (m³)
- Weight = Volume × Density (kg)

**Material Compatibility**: GASKETS (Rubber, Graphite, PTFE)

**Standard Reference**: ASME B16.21

---

#### 3.8.2 Ring Gasket (Ring Joint)

**Category**: GASKET_RING
**Parameters**:

- Ring Number: Select (per ASME B16.20)
- Material Grade: Select (Soft Iron, SS 304, SS 316, Monel)

**Formulas**:

- Weight = Standard weight from ASME B16.20 table (kg)

**Material Compatibility**: Metal gaskets only

**Standard Reference**: ASME B16.20

---

### 3.9 Blank Material & Scrap Management

#### 3.9.1 Overview

For many fabricated components, the finished part is cut from a larger **blank** (stock material). The difference between blank size and finished part size results in **scrap** (material waste). Accurate calculation of blank requirements and scrap percentage is critical for:

1. **Material Procurement**: Order correct blank sizes
2. **Cost Estimation**: Account for scrap in material cost
3. **Inventory Management**: Track blank inventory vs. finished parts
4. **Yield Optimization**: Identify opportunities to reduce waste

#### 3.9.2 Common Blank Scenarios

**Scenario 1: Circular Parts from Rectangular Blanks**

- **Example**: Circular plate, tube sheet, gasket
- **Blank Type**: RECTANGULAR (square or rectangular plate)
- **Typical Scrap**: 21-30% (depending on cutting allowance)
- **Calculation**:
  ```
  Blank Length = Part Diameter + Cutting Allowance
  Blank Width = Part Diameter + Cutting Allowance
  Blank Area = Length × Width
  Finished Area = π × (Diameter/2)²
  Scrap % = ((Blank Area - Finished Area) / Blank Area) × 100
  ```

**Scenario 2: Dished Heads from Circular Blanks**

- **Example**: Hemispherical, ellipsoidal, torispherical heads
- **Blank Type**: CIRCULAR (circular plate)
- **Typical Scrap**: 15-28% (varies by head type)
- **Calculation**:
  ```
  Blank Diameter = Head OD × Multiplier (1.08 to 1.15)
  Blank Area = π × (Blank Diameter/2)²
  Finished Projected Area = π × (Head OD/2)²
  Scrap % = ((Blank Area - Finished Projected Area) / Blank Area) × 100
  ```

**Scenario 3: Nozzle Reinforcement Pads**

- **Example**: Square pad cut from plate
- **Blank Type**: RECTANGULAR (from larger plate stock)
- **Typical Scrap**: Depends on nesting efficiency (10-40%)

#### 3.9.3 Scrap Percentage by Shape Type

| Shape Type               | Blank Type  | Typical Scrap % | Notes                               |
| ------------------------ | ----------- | --------------- | ----------------------------------- |
| Circular Plate           | RECTANGULAR | 21-30%          | Highest scrap, but simplest cutting |
| Hemispherical Head       | CIRCULAR    | 24-28%          | Deep drawing requires large blank   |
| Ellipsoidal Head (2:1)   | CIRCULAR    | 18-22%          | Most efficient dished head          |
| Torispherical Head (F&D) | CIRCULAR    | 15-18%          | Least scrap, most economical        |
| Tube Sheet (drilled)     | CIRCULAR    | 20-25%          | Includes hole drilling scrap        |
| Reinforcement Pad        | RECTANGULAR | 10-40%          | Depends on nesting                  |
| Gasket (ring)            | RECTANGULAR | 30-50%          | High scrap for annular shapes       |

#### 3.9.4 Scrap Cost Impact

**Example Calculation**:

- Part: Hemispherical head, Di = 1000 mm, t = 10 mm
- Material: SS 316L plate @ ₹350/kg
- Finished weight: 125 kg → Material cost = ₹43,750
- Blank weight: 170 kg → Actual material cost = ₹59,500
- Scrap: 45 kg (₹15,750 wasted)
- **Scrap impact on cost: +36%**

**Scrap Recovery Options**:

1. **Sell as scrap metal**: Typically 30-50% of purchase price
2. **Reuse for smaller parts**: If scrap pieces large enough
3. **Account as loss**: For small scrap pieces

**Effective Material Cost Calculation**:

```
Effective Price per kg = (Blank Weight × Price per kg - Scrap Recovery) / Finished Weight

Example:
Effective Price = (170 kg × ₹350/kg - 45 kg × ₹150/kg) / 125 kg
Effective Price = (₹59,500 - ₹6,750) / 125 kg
Effective Price = ₹422/kg (20% higher than base price)
```

#### 3.9.5 Blank Optimization Strategies

**Strategy 1: Nesting Multiple Parts**

- Cut multiple smaller parts from single large blank
- Reduces overall scrap percentage
- Requires careful layout planning

**Strategy 2: Standard Blank Sizes**

- Use vendor standard plate sizes (e.g., 2000×1000 mm, 2400×1200 mm)
- Optimize part sizes to fit standard blanks
- Reduces procurement lead time

**Strategy 3: Scrap Minimization Allowances**

- Reduce cutting allowances (from 50mm to 25mm)
- Requires more precise cutting equipment
- Can reduce scrap by 5-10%

**Strategy 4: Material Grade Selection**

- Use lower-grade material for non-critical scrap-prone parts
- Reserve expensive alloys for low-scrap parts

#### 3.9.6 Implementation in Shape Database

Each shape definition should include:

1. **Blank Definition** (if applicable):
   - Blank type (RECTANGULAR, CIRCULAR, CUSTOM)
   - Blank dimension formulas
   - Cutting allowances
   - Scrap percentage formula

2. **Material Procurement Quantity**:
   - Finished part weight
   - Blank weight (including scrap)
   - Scrap weight
   - Scrap recovery value

3. **Cost Impact**:
   - Material cost based on finished weight
   - Actual material cost based on blank weight
   - Scrap recovery credit
   - Effective material cost per kg

4. **BOM Integration**:
   - When adding shape to BOM, show both finished and blank quantities
   - Alert if scrap percentage > 25%
   - Suggest optimization opportunities

---

## 4. Functional Requirements

### 4.1 Shape Master Data Management

#### 4.1.1 Create Shape

**Actor**: User with CREATE_SHAPE permission
**Trigger**: New standard shape needs to be added
**Flow**:

1. Navigate to Shapes → New Shape
2. Select shape category (dropdown with standard shapes)
3. Fill in basic information:
   - Name, description
   - Standard reference (ASME, AISC, etc.)
   - Shape type (standard, parametric, custom)
4. Define dimensional parameters:
   - Parameter name (D, L, t, etc.)
   - Label, unit, data type
   - Min/max values, default
   - Display order
5. Enter calculation formulas:
   - Volume formula (required)
   - Weight formula (auto-filled: Volume × Density)
   - Surface area formulas
   - Custom formulas (optional)
6. Set material compatibility:
   - Select allowed material categories
   - Set default material category
7. Add fabrication cost formula (optional)
8. Upload shape diagram/sketch
9. Add validation rules
10. Save

**Validations**:

- Shape code unique (if custom code provided)
- Name required
- Category required
- At least one parameter defined
- Volume formula required
- Formula syntax validation (check variables match parameters)

**Outputs**:

- Shape created with auto-generated SHP-YYYY-NNNN code
- Shape added to searchable database
- Audit log entry created

#### 4.1.2 Shape List & Search

**Actor**: Users with VIEW_ALL_SHAPES permission
**Features**:

**List View**:

- Columns: Shape Code, Name, Category, Parameters, Usage Count, Last Updated
- Default sort: Standard shapes first, then by usage count
- Pagination: 50/100/200 per page

**Search & Filter**:

- Text search (name, description, tags)
- Filter by:
  - Category (dropdown tree)
  - Shape type (standard/parametric/custom)
  - Material compatibility (shows shapes compatible with selected material)
  - Standard (ASME, AISC, TEMA)
  - Is standard (frequently used)
  - Is active

**Quick Filters**:

- My recent shapes (last 10 used)
- Standard shapes (most used)
- Pressure vessel components
- Heat exchanger components
- Piping components

**Export**:

- Export list to Excel
- Include: Code, Name, Category, Parameters, Formulas

#### 4.1.3 Shape Detail View

**Actor**: Users with VIEW_ALL_SHAPES permission
**Layout**:

**Tabs**:

1. **Overview Tab**:
   - Shape code, name, description
   - Category, type, standard reference
   - Visual diagram/sketch
   - Quick stats: Usage count, Created date
   - Material compatibility list

2. **Parameters Tab**:
   - Table of all parameters with:
     - Name, Label, Unit, Type
     - Min/Max values, Default
     - Required flag
     - Help text
   - Add/Edit/Delete parameter buttons

3. **Formulas Tab**:
   - Volume formula with explanation
   - Weight formula (usually auto-generated)
   - Surface area formulas
   - Custom formulas
   - Formula tester (input values, see calculated results)

4. **Material Compatibility Tab**:
   - List of compatible material categories
   - Suggested materials (from Material Database)
   - Add/remove material category buttons

5. **Fabrication Cost Tab**:
   - Cost formula display
   - Cost components breakdown
   - Test cost calculator

6. **Usage Tab**:
   - BOMs using this shape (list)
   - Projects using this shape (via BOMs)
   - Usage statistics (total weight, total cost)

7. **Validation Tab**:
   - List of validation rules
   - Add/edit/delete rules

**Actions** (right sidebar):

- Edit shape
- Duplicate shape (create similar)
- Mark as standard
- Upload diagram
- Test formula
- Deactivate/activate
- Delete (with cascade check)

#### 4.1.4 Formula Builder & Tester

**Actor**: User with CREATE_SHAPE or EDIT_SHAPE permission
**Purpose**: Interactive formula creation and validation

**Features**:

- **Formula Input**: Text editor with syntax highlighting
- **Variable Autocomplete**: Dropdown showing available parameters
- **Function Library**:
  - Math: sqrt, pow, abs, sin, cos, tan
  - Constants: PI, E
  - Conditional: if, max, min
- **Syntax Validation**: Real-time error checking
- **Unit Validation**: Ensure formula units are consistent
- **Formula Tester**:
  - Input sample parameter values
  - See calculated result immediately
  - Show step-by-step calculation
  - Validate result is in expected range

**Example**:

```
Formula: PI * D * D / 4 * L / 1e9
Variables: D (mm), L (mm)
Expected Unit: m³
Test Input: D=100, L=1000
Result: 0.00785 m³ ✓
```

---

### 4.2 Shape Instance Creation (Used in BOM Generator)

#### 4.2.1 Select Shape for BOM

**Actor**: User creating a BOM
**Flow**:

1. In BOM Generator, click "Add Component"
2. Select "From Shape Database"
3. Search/browse shapes by category
4. Select desired shape
5. System shows shape diagram and parameter form
6. User fills in dimensional values:
   - Diameter: 1000 mm
   - Thickness: 10 mm
   - Length: 2000 mm
7. Select material from compatible materials dropdown
8. System auto-calculates:
   - Volume (using formula)
   - Weight (Volume × Material Density)
   - Surface area
   - Material cost (Weight × Material Price)
   - Fabrication cost (using formula)
   - Total cost
9. Enter quantity (number of this component)
10. Add to BOM

**Outputs**:

- ShapeInstance created with all calculated values
- Added to BOM as line item
- Total weight and cost updated

#### 4.2.2 Shape Instance Calculator (Standalone)

**Actor**: Any user with VIEW_ALL_SHAPES permission
**Purpose**: Quick calculations without creating BOM
**Flow**:

1. Navigate to Shapes → Calculator
2. Select shape
3. Enter parameter values
4. Select material
5. See instant calculations:
   - Weight, volume, surface area
   - Estimated cost
6. Export results to PDF
7. Save calculation (optional, for reference)

**Use Case**: Engineer needs quick weight estimate for quotation

---

### 4.3 Standard Shape Library Management

#### 4.3.1 Pre-populate Standard Shapes

**Actor**: System Administrator
**Trigger**: Initial database setup or periodic updates
**Flow**:

1. Navigate to Shapes → Import Standards
2. Select standard:
   - ASME Section VIII (Pressure Vessel Components)
   - ASME B16.5 (Flanges)
   - ASME B16.9 (Fittings)
   - AISC (Structural Shapes)
   - TEMA (Heat Exchanger Components)
3. System imports pre-defined shapes with:
   - Standard dimensions
   - Calculation formulas
   - Material compatibility
   - Validation rules
4. Confirm import

**Outputs**:

- 50-100 standard shapes added to database
- Ready for use in BOM Generator

**Note**: This is a one-time setup task. Custom shapes can be added later.

---

### 4.4 Shape Validation & Quality Control

#### 4.4.1 Parameter Validation

**Validations Applied**:

1. **Required Parameters**: Must be filled
2. **Range Validation**: Value between min and max
3. **Consistency Checks**:
   - Thickness < Diameter/2 (for shells)
   - Length > 0
   - Knuckle radius > 3 × thickness (for torispherical heads)
4. **Standard Compliance**:
   - Pipe schedule exists for given DN
   - Flange class valid for DN (per ASME B16.5)
   - Structural shape designation valid (per AISC)

**User Experience**:

- Real-time validation as user types
- Clear error messages with guidance
- Warning for unusual values (e.g., very thin plate)

#### 4.4.2 Calculation Validation

**Validations Applied**:

1. **Result Range Check**: Weight not negative, volume positive
2. **Reasonability Check**:
   - Weight < 100,000 kg (warning if exceeded)
   - Thickness/Diameter ratio reasonable
3. **Material Compatibility**: Selected material allowed for shape
4. **Density Check**: Material has density defined (required for weight calc)

---

## 5. Non-Functional Requirements

### 5.1 Performance

- Shape list loading: < 2 seconds for 500 shapes
- Search results: < 1 second
- Calculation (weight, volume): < 100 milliseconds
- Formula validation: < 500 milliseconds

### 5.2 Security

- Role-based access control (CREATE, EDIT, DELETE, VIEW permissions)
- Audit trail for all formula changes (critical for engineering accuracy)
- Soft delete (shapes never hard-deleted if used in BOMs)
- Version control for shape definitions (track changes)

### 5.3 Usability

- Visual shape diagrams for all standard shapes
- Interactive parameter forms with help text
- Formula tester for instant feedback
- Material compatibility warnings
- Auto-complete for material selection

### 5.4 Integration

- **Material Database** (required): Material density, pricing
- **BOM Generator** (primary use): Shape instances become BOM items
- **Thermal Desalination Module**: Heat exchanger component selection
- **Proposal Module**: Cost estimation from shapes

### 5.5 Data Quality

- Standard shapes validated against ASME/AISC specifications
- Formulas peer-reviewed for engineering accuracy
- Unit consistency enforced (all internal calculations in SI units)
- Material compatibility pre-defined for standard shapes

---

## 6. UI/UX Requirements

### 6.1 Navigation Structure

```
/shapes
  /list                     # Shape list with search/filter
  /new                      # Create new shape
  /calculator               # Standalone calculator
  /import-standards         # Import ASME/AISC shapes
  /[shapeId]
    /overview              # Shape detail (default tab)
    /parameters            # Parameter definitions
    /formulas              # Calculation formulas
    /materials             # Compatible materials
    /fabrication           # Fabrication cost formula
    /usage                 # BOMs using this shape
    /validation            # Validation rules
    /edit                  # Edit shape
```

### 6.2 Key Screens

#### 6.2.1 Shape List Page

- Header: "Shapes" + New Shape + Import Standards + Calculator buttons
- Search bar (full-text search)
- Filters (collapsible left sidebar):
  - Category (tree view with ASME/AISC groupings)
  - Type (standard/parametric/custom)
  - Material compatibility (dropdown)
  - Standard (ASME, AISC, TEMA, Other)
  - Is standard (checkbox)
- Table:
  - Columns: Image (thumbnail), Code, Name, Category, Parameters, Usage Count, Actions
  - Sort by usage count (most used first)
  - Pagination
- Quick stats (top): Total shapes, Standard shapes, Most used

#### 6.2.2 Shape Detail Page

- Header: Shape Code + Name + Category badge
- Shape diagram (left sidebar, large)
- Tabs (main content area):
  - Overview, Parameters, Formulas, Materials, Fabrication, Usage, Validation
- Actions (right sidebar):
  - Edit, Duplicate, Test Formula, Upload Diagram, Delete

#### 6.2.3 Shape Calculator Page

- Two-column layout:
  - **Left**: Shape selection + parameter input form
  - **Right**: Live calculation results
- Shape category selector (dropdown with icons)
- Shape selector (filterable list with thumbnails)
- Parameter input form (dynamic based on selected shape):
  - Input fields with units
  - Help text below each field
  - Real-time validation
- Material selector (dropdown with search)
- Quantity input
- **Results Panel** (auto-updates as parameters change):
  - Volume (m³)
  - Weight (kg)
  - Surface Area (m²)
  - Material Cost (INR)
  - Fabrication Cost (INR)
  - Total Cost (INR)
  - Cost breakdown table
- Actions: Export PDF, Save Calculation, Add to BOM

#### 6.2.4 Formula Builder (Component)

- Code editor with syntax highlighting
- Variable palette (drag-and-drop)
- Function library (expandable list)
- Validation messages (real-time)
- Test panel (below editor):
  - Parameter value inputs
  - Calculate button
  - Result display with unit
  - Step-by-step breakdown

---

## 7. Technical Architecture

### 7.1 Firestore Collections

```
/shapes/{shapeId}
  - Shape document

/shapes/{shapeId}/parameters/{parameterId}
  - ShapeParameter sub-collection

/shapes/{shapeId}/usageHistory/{instanceId}
  - Track where shape is used (for analytics)

/shapeInstances/{instanceId}
  - ShapeInstance document (when used in BOM)
```

### 7.2 Firestore Indexes

```json
[
  {
    "collectionGroup": "shapes",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "category", "order": "ASCENDING" },
      { "fieldPath": "isStandard", "order": "DESCENDING" },
      { "fieldPath": "usageCount", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "shapes",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "isActive", "order": "ASCENDING" },
      { "fieldPath": "usageCount", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "shapes",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "allowedMaterialCategories", "arrayConfig": "CONTAINS" },
      { "fieldPath": "usageCount", "order": "DESCENDING" }
    ]
  }
]
```

### 7.3 Services

```typescript
// packages/firebase/src/shapeService.ts
- createShape()
- updateShape()
- deleteShape() // Soft delete
- getShapeById()
- listShapes(filters)
- searchShapes(query)
- getShapesByCategory(category)
- getShapesForMaterial(materialCategory)
- duplicateShape()

// packages/firebase/src/shapeCalculationService.ts
- calculateShapeInstance(shapeId, parameterValues, materialId, quantity)
  → Returns: volume, weight, surfaceArea, cost
- validateFormula(formula, parameters)
- evaluateFormula(formula, parameterValues)
- getStandardDimensions(standard, designation)
  → For pipes, flanges, beams - lookup tables

// packages/firebase/src/shapeImportService.ts
- importASMEB165Flanges() // Import standard flanges
- importASMEB169Fittings() // Import standard fittings
- importAISCShapes() // Import structural shapes
- importPressureVesselComponents() // ASME Section VIII

// packages/firebase/src/formulaEngineService.ts
- parseFormula(expression)
- validateSyntax(expression)
- evaluateExpression(expression, variables, constants)
- getFormulaVariables(expression)
```

### 7.4 Types

```typescript
// packages/types/src/shape.ts
-Shape -
  ShapeCategory -
  ShapeParameter -
  FormulaDefinition -
  ShapeInstance -
  ShapeFilter -
  CalculationResult;
```

### 7.5 Validation

```typescript
// packages/validation/src/schemas.ts
export const shapeSchema = z.object({
  shapeCode: z.string().optional(),
  customCode: z.string().optional(),
  name: z.string().min(3).max(200),
  description: z.string().min(10),
  category: z.nativeEnum(ShapeCategory),
  shapeType: z.enum(['STANDARD', 'PARAMETRIC', 'CUSTOM']),
  parameters: z.array(shapeParameterSchema).min(1),
  formulas: z.object({
    volume: formulaDefinitionSchema,
    weight: formulaDefinitionSchema.optional(),
    surfaceArea: formulaDefinitionSchema.optional(),
  }),
  allowedMaterialCategories: z.array(z.nativeEnum(MaterialCategory)),
  isActive: z.boolean().default(true),
});

export const shapeParameterSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), // Valid variable name
  label: z.string(),
  unit: z.string(),
  dataType: z.enum(['NUMBER', 'SELECT', 'BOOLEAN']),
  required: z.boolean(),
  order: z.number().min(1),
});

export const formulaDefinitionSchema = z.object({
  expression: z.string().min(1),
  variables: z.array(z.string()),
  unit: z.string(),
});
```

### 7.6 UI Components

```typescript
// apps/web/src/app/shapes/page.tsx
- ShapeListPage

// apps/web/src/app/shapes/[id]/page.tsx
- ShapeDetailPage

// apps/web/src/app/shapes/calculator/page.tsx
- ShapeCalculatorPage

// apps/web/src/components/shapes/
- ShapeCard.tsx
- ShapeTable.tsx
- ShapeSearchFilters.tsx
- ShapeDiagram.tsx (SVG rendering)
- ParameterInputForm.tsx (dynamic form based on parameters)
- FormulaBuilder.tsx (code editor)
- FormulaTester.tsx (parameter inputs + calculation display)
- CalculationResultsPanel.tsx (volume, weight, cost display)
- MaterialCompatibilityList.tsx
- ShapeInstanceCreator.tsx (used in BOM Generator)
```

---

## 8. Implementation Phases

### Phase 1: Core Shape CRUD (Week 1 - 20-25 hours)

- [ ] Data model (Shape, ShapeParameter types)
- [ ] Firestore collection and indexes
- [ ] Service functions (CRUD)
- [ ] Validation schemas
- [ ] Shape list page with search
- [ ] Shape detail page (overview tab only)
- [ ] Create/edit shape form (basic fields)
- [ ] Parameter definition UI

**Deliverable**: Can create and view shapes with parameters

### Phase 2: Formula Engine (Week 1-2 - 20-25 hours)

- [ ] Formula definition data model
- [ ] Formula parser and validator
- [ ] Formula evaluation engine (math.js or similar)
- [ ] Formula builder UI component
- [ ] Formula tester UI
- [ ] Unit conversion handling
- [ ] Formulas tab in shape detail

**Deliverable**: Can define and test calculation formulas

### Phase 3: Standard Shape Library (Week 2 - 15-20 hours)

- [ ] ASME B36.10M pipe dimensions (lookup table)
- [ ] ASME B16.5 flange dimensions (lookup table)
- [ ] ASME Section VIII vessel components (formulas)
- [ ] AISC structural shape properties (lookup table)
- [ ] Shape import service
- [ ] Pre-populate 50+ standard shapes
- [ ] Shape diagrams (SVG or images)

**Deliverable**: Standard shape library ready for use

### Phase 4: Shape Calculator & Integration (Week 2-3 - 25-30 hours)

- [ ] ShapeInstance data model
- [ ] Calculation service (volume, weight, cost)
- [ ] Material compatibility filtering
- [ ] Shape calculator page (standalone)
- [ ] Shape instance creator component (for BOM Generator)
- [ ] Calculation results display
- [ ] Export calculation to PDF
- [ ] Integration tests with Material Database

**Deliverable**: Complete shape calculator + BOM integration ready

---

## 9. Total Effort Estimate

| Phase                             | Hours            | Deliverable            |
| --------------------------------- | ---------------- | ---------------------- |
| Phase 1: Core CRUD                | 20-25            | Basic shape management |
| Phase 2: Formula Engine           | 20-25            | Calculation formulas   |
| Phase 3: Standard Library         | 15-20            | 50+ standard shapes    |
| Phase 4: Calculator & Integration | 25-30            | Production-ready       |
| **TOTAL**                         | **80-100 hours** | -                      |

**Recommended Team**: 1-2 developers
**Timeline**: 2-3 weeks (at 30-35 hours/week)

---

## 10. Success Criteria

- [ ] 50+ standard shapes in database (ASME, AISC, TEMA)
- [ ] Formula calculations accurate to 0.1% (validated against manual calcs)
- [ ] Calculator response time < 100 milliseconds
- [ ] Material compatibility filtering works correctly
- [ ] Can create shape instance and add to BOM
- [ ] Pipe/flange/beam dimensions match ASME/AISC tables
- [ ] Shape used by BOM Generator (integration test)
- [ ] User adoption: Engineers use calculator for quick estimates

---

## 11. Future Enhancements (Post Phase 1)

- 3D shape visualization (Three.js integration)
- CAD model import (STEP, IGES files)
- Shape optimization (suggest most economical dimensions)
- Nesting optimization (for plate cutting)
- Weld length calculation (for fabrication cost)
- Stress analysis integration (basic FEA)
- Multi-language support (formulas with localized parameters)
- Shape comparison tool (compare weights, costs)

---

**End of Document**
