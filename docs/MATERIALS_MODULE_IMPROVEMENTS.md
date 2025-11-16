# Materials Module - Proposed Improvements

**Date**: 2025-11-15
**Status**: Design Proposal
**Priority**: High

---

## Executive Summary

Based on user feedback, two critical improvements are needed for the Materials Module:

1. **Material Code Format**: Replace generic `MAT-YYYY-NNNN` with category-specific prefixes (CS, SS, DS, etc.)
2. **Thickness/Dimension Handling**: Implement variant system instead of separate materials per thickness

These changes will significantly improve usability and align with industry best practices.

---

## Issue #1: Material Code Format

### Current Implementation ❌

```typescript
// Auto-generated format: MAT-YYYY-NNNN
// Example: MAT-2025-0001, MAT-2025-0002, etc.

materialCode = `MAT-${year}-${sequenceNumber.padStart(4, '0')}`;
```

**Problems**:
- Not descriptive - can't identify material type from code
- Year is not useful for material identification
- Sequential numbering has no business meaning
- Hard to search/filter by material type

### Proposed Implementation ✅

#### Format: `{PREFIX}-{GRADE}-{SEQUENCE}`

**Material Category Prefixes**:

```typescript
// Plates
CS-PL   // Carbon Steel Plate
SS-PL   // Stainless Steel Plate
AS-PL   // Alloy Steel Plate
AL-PL   // Aluminum Plate
CU-PL   // Copper Plate
TI-PL   // Titanium Plate
NI-PL   // Nickel Alloy Plate
DS-PL   // Duplex Steel Plate

// Pipes
CS-PP   // Carbon Steel Pipe (Seamless/Welded)
SS-PP   // Stainless Steel Pipe
AS-PP   // Alloy Steel Pipe
CU-PP   // Copper Pipe

// Fittings
BW-FT   // Butt Weld Fittings
SW-FT   // Socket Weld Fittings
TH-FT   // Threaded Fittings
FL-FT   // Flanged Fittings

// Fasteners
BL-FS   // Bolts
NT-FS   // Nuts
WS-FS   // Washers
ST-FS   // Studs
SC-FS   // Screws

// Components
VL-CP   // Valves
FG-CP   // Flanges
GS-CP   // Gaskets
PM-CP   // Pumps
MT-CP   // Motors
IN-CP   // Instrumentation
EL-CP   // Electrical

// Other
BR-MT   // Bars and Rods
SH-MT   // Sheets
ST-MT   // Structural Shapes
WC-CS   // Welding Consumables
PC-CS   // Paints & Coatings
```

#### Examples:

```typescript
// Stainless Steel 316L Plate
materialCode: "SS-PL-316L-0001"

// Carbon Steel A36 Plate
materialCode: "CS-PL-A36-0001"

// Duplex Steel 2205 Plate
materialCode: "DS-PL-2205-0001"

// Stainless Steel 304 Seamless Pipe
materialCode: "SS-PP-304-0001"

// Carbon Steel A193 B7 Bolt
materialCode: "BL-FS-B7-0001"
```

#### Code Generation Logic:

```typescript
interface MaterialCodeConfig {
  categoryPrefix: string;  // "SS-PL"
  grade?: string;         // "316L"
  sequence: number;       // 1, 2, 3...
}

function generateMaterialCode(
  category: MaterialCategory,
  grade?: string
): string {
  const prefix = getCategoryPrefix(category);
  const gradeCode = grade ? `-${grade}` : '';
  const sequence = await getNextSequence(category, grade);

  return `${prefix}${gradeCode}-${sequence.toString().padStart(4, '0')}`;
}

// Examples:
// SS-PL-316L-0001 (1st SS 316L plate)
// SS-PL-316L-0002 (2nd SS 316L plate)
// SS-PL-304-0001  (1st SS 304 plate)
// CS-PL-A36-0001  (1st CS A36 plate)
```

**Benefits**:
- ✅ Instantly recognizable material type
- ✅ Grade visible in code
- ✅ Easy to search/filter (all SS plates start with "SS-PL")
- ✅ Industry-standard approach
- ✅ Sequence per grade (easier to track variants)

---

## Issue #2: Thickness/Dimension Handling

### Current Implementation ❌

**Problem**: Each thickness is a separate material entry

```
Material List:
1. SS-PL-316L-0001 - Stainless Steel 316L Plate - 3mm
2. SS-PL-316L-0002 - Stainless Steel 316L Plate - 5mm
3. SS-PL-316L-0003 - Stainless Steel 316L Plate - 6mm
4. SS-PL-316L-0004 - Stainless Steel 316L Plate - 8mm
5. SS-PL-316L-0005 - Stainless Steel 316L Plate - 10mm
... (20+ entries for same material, different thickness)
```

**Issues**:
- Cluttered material list
- Duplicate data (same spec, properties, vendors)
- Hard to see all available thicknesses for a material
- Price management nightmare (separate prices for each thickness)
- Stock tracking complex

### Proposed Implementation ✅

**Solution**: Material Variants System

#### Data Model:

```typescript
interface Material {
  // ... existing fields ...

  // NEW: Variants support
  hasVariants: boolean;           // true if material has size/thickness variants
  variants?: MaterialVariant[];   // Array of variants

  // For non-variant materials, properties stay at material level
  // For variant materials, properties move to variant level
}

interface MaterialVariant {
  id: string;                     // Unique variant ID
  variantCode: string;            // e.g., "3MM", "5MM", "SCH40"
  displayName: string;            // e.g., "3mm thickness", "Schedule 40"

  // Dimensional properties (vary by variant)
  dimensions: {
    thickness?: number;           // mm
    length?: number;              // mm
    width?: number;               // mm
    diameter?: number;            // mm (for pipes)
    schedule?: string;            // For pipes
    nominalSize?: string;         // DN/NPS
  };

  // Weight per unit (varies with thickness)
  weightPerUnit?: number;         // kg/m² for plates, kg/m for pipes

  // Variant-specific pricing
  currentPrice?: MaterialPrice;
  priceHistory: string[];

  // Variant-specific stock
  currentStock?: number;
  reorderLevel?: number;

  // Availability
  isAvailable: boolean;
  leadTimeDays?: number;

  // Preferred vendors (can differ by size)
  preferredVendors?: string[];

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Example Usage:

```typescript
// Master Material
{
  id: "mat_001",
  materialCode: "SS-PL-316L-0001",
  name: "Stainless Steel 316L Plate",
  category: MaterialCategory.PLATES_STAINLESS_STEEL,
  specification: {
    standard: "ASTM A240",
    grade: "316L",
    form: "Plate",
    finish: "2B"
  },
  hasVariants: true,
  variants: [
    {
      id: "var_001",
      variantCode: "3MM",
      displayName: "3mm thickness",
      dimensions: { thickness: 3 },
      weightPerUnit: 23.55,  // kg/m²
      currentPrice: { amount: 280, currency: "INR", unit: "kg" },
      currentStock: 500,
      isAvailable: true
    },
    {
      id: "var_002",
      variantCode: "5MM",
      displayName: "5mm thickness",
      dimensions: { thickness: 5 },
      weightPerUnit: 39.25,
      currentPrice: { amount: 280, currency: "INR", unit: "kg" },
      currentStock: 750,
      isAvailable: true
    },
    {
      id: "var_003",
      variantCode: "6MM",
      displayName: "6mm thickness",
      dimensions: { thickness: 6 },
      weightPerUnit: 47.1,
      currentPrice: { amount: 280, currency: "INR", unit: "kg" },
      currentStock: 300,
      isAvailable: true
    },
    {
      id: "var_004",
      variantCode: "10MM",
      displayName: "10mm thickness",
      dimensions: { thickness: 10 },
      weightPerUnit: 78.5,
      currentPrice: { amount: 285, currency: "INR", unit: "kg" },
      currentStock: 0,
      reorderLevel: 200,
      isAvailable: false  // Out of stock
    }
  ]
}
```

#### Firestore Collections:

**Option A: Embedded Variants** (Recommended)
```typescript
// Collection: materials
{
  materialCode: "SS-PL-316L-0001",
  name: "Stainless Steel 316L Plate",
  hasVariants: true,
  variants: [ /* embedded array */ ]
}
```

**Option B: Separate Collection**
```typescript
// Collection: materials
{
  id: "mat_001",
  materialCode: "SS-PL-316L-0001",
  hasVariants: true
}

// Collection: materialVariants
{
  id: "var_001",
  materialId: "mat_001",
  variantCode: "3MM",
  ...
}
```

**Recommendation**: Use **Option A (Embedded)** because:
- Fewer database reads
- Atomic updates
- Variants always loaded with material
- Better performance
- Simpler queries

**Size Limit**: Firestore document limit is 1MB - a material with 100 variants will be ~200KB, well within limit.

---

## UI Changes

### Material List Page

**Before**:
```
┌─────────────────────────────────────────────────────────────┐
│ Material Code    | Name                           | Actions  │
├─────────────────────────────────────────────────────────────┤
│ SS-PL-316L-0001 | SS 316L Plate 3mm              | View Edit│
│ SS-PL-316L-0002 | SS 316L Plate 5mm              | View Edit│
│ SS-PL-316L-0003 | SS 316L Plate 6mm              | View Edit│
│ SS-PL-316L-0004 | SS 316L Plate 8mm              | View Edit│
│ SS-PL-316L-0005 | SS 316L Plate 10mm             | View Edit│
│ SS-PL-304-0001  | SS 304 Plate 3mm               | View Edit│
│ SS-PL-304-0002  | SS 304 Plate 5mm               | View Edit│
└─────────────────────────────────────────────────────────────┘
(Cluttered - 20+ entries for variations)
```

**After**:
```
┌─────────────────────────────────────────────────────────────┐
│ Material Code    | Name                  | Variants | Actions│
├─────────────────────────────────────────────────────────────┤
│ SS-PL-316L-0001 | SS 316L Plate        | 4 sizes  | View Edit│
│ SS-PL-304-0001  | SS 304 Plate         | 6 sizes  | View Edit│
│ CS-PL-A36-0001  | CS A36 Plate         | 8 sizes  | View Edit│
└─────────────────────────────────────────────────────────────┘
(Clean - one entry per material grade)
```

### Material Detail Page

**Variants Section**:
```
┌─────────────────────────────────────────────────────────────┐
│ Stainless Steel 316L Plate (SS-PL-316L-0001)              │
├─────────────────────────────────────────────────────────────┤
│ Specifications: ASTM A240, Grade 316L, Finish 2B          │
│                                                             │
│ Available Sizes:                                            │
│                                                             │
│ ┌─────────┬──────────┬────────┬───────────┬──────────────┐ │
│ │Thickness│Weight/m² │ Stock  │   Price   │ Lead Time    │ │
│ ├─────────┼──────────┼────────┼───────────┼──────────────┤ │
│ │  3mm    │ 23.55 kg │ 500 kg │ ₹280/kg   │ In Stock  ✓  │ │
│ │  5mm    │ 39.25 kg │ 750 kg │ ₹280/kg   │ In Stock  ✓  │ │
│ │  6mm    │ 47.10 kg │ 300 kg │ ₹280/kg   │ In Stock  ✓  │ │
│ │  8mm    │ 62.80 kg │ 150 kg │ ₹282/kg   │ In Stock  ✓  │ │
│ │  10mm   │ 78.50 kg │   0 kg │ ₹285/kg   │ 15 days   ⚠  │ │
│ │  12mm   │ 94.20 kg │ 400 kg │ ₹285/kg   │ In Stock  ✓  │ │
│ └─────────┴──────────┴────────┴───────────┴──────────────┘ │
│                                                             │
│ [Add New Size] [Manage Prices] [Manage Stock]              │
└─────────────────────────────────────────────────────────────┘
```

### Purchase Request Integration

**When creating PR**:
```
Select Material: SS 316L Plate (SS-PL-316L-0001)
  ↓
Select Thickness: [Dropdown]
  • 3mm (₹280/kg) - In Stock ✓
  • 5mm (₹280/kg) - In Stock ✓
  • 6mm (₹280/kg) - In Stock ✓
  • 10mm (₹285/kg) - 15 days ⚠
  ↓
Quantity: [___] kg
```

---

## Implementation Plan

### Phase 1: Material Code Format (Week 1)

#### 1.1 Update Type Definitions (1 day)

```typescript
// packages/types/src/material.ts

// Add category prefix mapping
export const MATERIAL_CATEGORY_PREFIXES: Record<MaterialCategory, string> = {
  [MaterialCategory.PLATES_CARBON_STEEL]: 'CS-PL',
  [MaterialCategory.PLATES_STAINLESS_STEEL]: 'SS-PL',
  [MaterialCategory.PLATES_ALLOY_STEEL]: 'AS-PL',
  [MaterialCategory.PLATES_DUPLEX_STEEL]: 'DS-PL',
  // ... all categories
};

export interface MaterialCodeConfig {
  categoryPrefix: string;
  grade?: string;
  sequence: number;
}
```

#### 1.2 Update Service Layer (2 days)

```typescript
// apps/web/src/lib/materials/materialService.ts

async function generateMaterialCode(
  db: Firestore,
  category: MaterialCategory,
  grade?: string
): Promise<string> {
  const prefix = MATERIAL_CATEGORY_PREFIXES[category];
  const gradeCode = grade ? `-${normalizeGrade(grade)}` : '';
  const baseCode = `${prefix}${gradeCode}`;

  // Find last sequence for this base code
  const q = query(
    collection(db, COLLECTIONS.MATERIALS),
    where('materialCode', '>=', baseCode),
    where('materialCode', '<', `${baseCode}-ZZZZ`),
    orderBy('materialCode', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  const lastSequence = extractSequence(snapshot.docs[0]?.data()?.materialCode);
  const nextSequence = (lastSequence + 1).toString().padStart(4, '0');

  return `${baseCode}-${nextSequence}`;
}

function normalizeGrade(grade: string): string {
  // Remove spaces, convert to uppercase
  return grade.replace(/\s+/g, '').toUpperCase();
}
```

#### 1.3 Migration Script (2 days)

Create migration for existing materials:
```typescript
// scripts/migrate-material-codes.ts

async function migrateMaterialCodes() {
  const materials = await getAllMaterials();

  for (const material of materials) {
    const newCode = generateNewCode(material);
    await updateMaterialCode(material.id, newCode);
  }
}
```

### Phase 2: Variants System (Week 2-3)

#### 2.1 Update Type Definitions (1 day)

Add `MaterialVariant` interface and update `Material` interface.

#### 2.2 Update Service Layer (3 days)

```typescript
// Create variant
async function addMaterialVariant(
  db: Firestore,
  materialId: string,
  variant: Omit<MaterialVariant, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<MaterialVariant>

// Update variant
async function updateMaterialVariant(
  db: Firestore,
  materialId: string,
  variantId: string,
  updates: Partial<MaterialVariant>,
  userId: string
): Promise<void>

// Get material with variants
async function getMaterialWithVariants(
  db: Firestore,
  materialId: string
): Promise<Material>
```

#### 2.3 UI Components (4 days)

- Variants table component
- Add variant modal
- Edit variant modal
- Variant selector (for PR, RFQ)
- Price management per variant
- Stock management per variant

#### 2.4 Migration Strategy (2 days)

**For existing materials with thickness in name**:
```typescript
// Identify materials that are variants
// Example: "SS 316L Plate 3mm", "SS 316L Plate 5mm"
// Consolidate into single material with variants

async function consolidateVariants() {
  const materials = await getAllMaterials();
  const grouped = groupByBaseSpec(materials);

  for (const [baseSpec, variants] of grouped) {
    const master = createMasterMaterial(baseSpec);
    const variantRecords = variants.map(createVariantFromMaterial);

    await saveMasterWithVariants(master, variantRecords);
    await archiveOldMaterials(variants);
  }
}
```

---

## Database Schema Changes

### Firestore Indexes

**New indexes needed**:
```json
{
  "collectionGroup": "materials",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "materialCode", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "materials",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "category", "order": "ASCENDING" },
    { "fieldPath": "specification.grade", "order": "ASCENDING" },
    { "fieldPath": "materialCode", "order": "ASCENDING" }
  ]
}
```

---

## Benefits Summary

### Material Code Benefits
1. **Searchability**: Find all stainless steel plates with "SS-PL"
2. **Recognition**: Instantly know what material type from code
3. **Organization**: Materials grouped by prefix in lists
4. **Industry Standard**: Aligns with common material coding practices
5. **Integration**: Easier to reference in documents (RFQ, PO, etc.)

### Variants System Benefits
1. **Clean UI**: Material list 80% smaller (one entry vs 10-20)
2. **Data Efficiency**: Single spec, properties for all variants
3. **Price Management**: Compare prices across sizes at a glance
4. **Stock Visibility**: See all available thicknesses instantly
5. **Procurement**: Easy thickness selection in PR/RFQ
6. **Reporting**: Better analytics (material usage by grade vs thickness)

---

## Risk Assessment

### Low Risks
- Material code format change (straightforward migration)
- UI updates (existing patterns)

### Medium Risks
- Variants system (new data model, requires thorough testing)
- Migration of existing materials (need careful data transformation)

### Mitigation
- Implement in staging first
- Keep old material codes as `customCode` for reference
- Parallel run both systems during transition
- Comprehensive testing before production

---

## Questions for User

1. **Material Code Format**:
   - Should we add Duplex Steel (DS-PL) to the prefix list?
   - Any other material types need specific prefixes?
   - Should we include finish in code? (e.g., SS-PL-316L-2B-0001)

2. **Variants**:
   - Which properties should vary by thickness?
     - Price? (Yes, likely)
     - Lead time? (Possibly)
     - Vendors? (Some vendors may specialize in certain sizes)
   - Should we support multiple variant dimensions?
     - Example: Plates vary by thickness
     - Example: Pipes vary by schedule AND diameter
   - Max number of variants per material? (for UI pagination)

3. **Migration**:
   - Do you have existing materials in the database?
   - Should we preserve old codes or completely replace?
   - Timeframe for migration?

4. **Scope**:
   - Should variants apply to:
     - Plates only?
     - Plates and Pipes?
     - All raw materials?
     - Bought-out items too? (e.g., bolts by size)

---

## Recommendation

**Implement both improvements in sequence**:

1. **Week 1**: Material Code Format
   - Lower risk
   - Immediate value
   - Foundation for variants

2. **Week 2-3**: Variants System
   - Higher complexity
   - Bigger impact on UX
   - Requires code format to be in place

**Total Effort**: 2-3 weeks
**Priority**: High (before extensive material data entry)

---

**Status**: Awaiting user feedback and approval
**Next Step**: Clarify questions and get approval to proceed
