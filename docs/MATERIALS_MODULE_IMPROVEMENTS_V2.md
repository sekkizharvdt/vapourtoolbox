# Materials Module - Improvements Implementation Plan

**Date**: 2025-11-15
**Status**: Ready for Implementation
**Priority**: High
**Approved By**: User

---

## Executive Summary

Two improvements confirmed for Materials Module:

1. **Material Code Format**: `PL-SS-XX` (Form-Material-2DigitSequence)
2. **Variants System**: One material with multiple thickness variants

**Scope**: Plates only (Phase 1). Pipes and fittings deferred to Phase 2.

**Timeline**: 2-3 weeks

---

## Improvement #1: Material Code Format

### Current ❌
```
Format: MAT-2025-0001, MAT-2025-0002, ...
Problems:
- Not descriptive
- Year is meaningless
- Can't identify material type
```

### New Format ✅
```
Format: {FORM}-{MATERIAL}-{XX}

Examples:
PL-SS-01  → Plate - Stainless Steel #01 (e.g., 316L)
PL-SS-02  → Plate - Stainless Steel #02 (e.g., 304)
PL-CS-01  → Plate - Carbon Steel #01 (e.g., A36)
PL-DS-01  → Plate - Duplex Steel #01 (e.g., 2205)
PL-AS-01  → Plate - Alloy Steel #01
PL-AL-01  → Plate - Aluminum #01
```

**Key Points**:
- **XX**: 2 digits only (01-99)
- **Grade**: Stored in `specification.grade`, NOT in code
- **Max**: 99 materials per type (plenty for Phase 1)

### Material Type Codes

**Plates** (Phase 1):
```
PL-SS  → Stainless Steel Plate
PL-CS  → Carbon Steel Plate
PL-DS  → Duplex Steel Plate
PL-AS  → Alloy Steel Plate
PL-AL  → Aluminum Plate
PL-CU  → Copper Plate
PL-TI  → Titanium Plate
PL-NI  → Nickel Alloy Plate
```

**Future** (Pipes, Fittings):
```
PP-SS  → Stainless Steel Pipe
FT-BW  → Butt Weld Fitting
... (to be designed in Phase 2)
```

### Code Generation Logic

```typescript
function generateMaterialCode(category: MaterialCategory): string {
  const [form, material] = getFormAndMaterial(category);
  const baseCode = `${form}-${material}`;

  // Get next sequence for this material type
  const sequence = await getNextSequenceNumber(baseCode);

  // Validate limit
  if (sequence > 99) {
    throw new Error(`Maximum 99 materials reached for ${baseCode}`);
  }

  // Format: PL-SS-01
  return `${baseCode}-${sequence.toString().padStart(2, '0')}`;
}

function getFormAndMaterial(category: MaterialCategory): [string, string] {
  switch (category) {
    case MaterialCategory.PLATES_STAINLESS_STEEL:
      return ['PL', 'SS'];
    case MaterialCategory.PLATES_CARBON_STEEL:
      return ['PL', 'CS'];
    case MaterialCategory.PLATES_DUPLEX_STEEL:
      return ['PL', 'DS'];
    case MaterialCategory.PLATES_ALLOY_STEEL:
      return ['PL', 'AS'];
    case MaterialCategory.PLATES_ALUMINUM:
      return ['PL', 'AL'];
    case MaterialCategory.PLATES_COPPER:
      return ['PL', 'CU'];
    case MaterialCategory.PLATES_TITANIUM:
      return ['PL', 'TI'];
    case MaterialCategory.PLATES_NICKEL_ALLOYS:
      return ['PL', 'NI'];
    default:
      throw new Error(`Unsupported category: ${category}`);
  }
}

async function getNextSequenceNumber(baseCode: string): Promise<number> {
  const q = query(
    collection(db, COLLECTIONS.MATERIALS),
    where('materialCode', '>=', baseCode),
    where('materialCode', '<', `${baseCode}-ZZ`),
    orderBy('materialCode', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return 1;
  }

  const lastCode = snapshot.docs[0].data().materialCode as string;
  const lastSeq = parseInt(lastCode.split('-')[2], 10);

  return lastSeq + 1;
}
```

### Examples

```typescript
// Material 1: SS 316L Plate
{
  id: "mat_001",
  materialCode: "PL-SS-01",
  name: "Stainless Steel 316L Plate",
  category: MaterialCategory.PLATES_STAINLESS_STEEL,
  specification: {
    standard: "ASTM A240",
    grade: "316L",  // ← Grade here, not in code
    finish: "2B",
    form: "Plate"
  }
}

// Material 2: SS 304 Plate
{
  id: "mat_002",
  materialCode: "PL-SS-02",
  name: "Stainless Steel 304 Plate",
  category: MaterialCategory.PLATES_STAINLESS_STEEL,
  specification: {
    standard: "ASTM A240",
    grade: "304",  // ← Different grade, same material type
    finish: "2B",
    form: "Plate"
  }
}

// Material 3: CS A36 Plate
{
  id: "mat_003",
  materialCode: "PL-CS-01",
  name: "Carbon Steel A36 Plate",
  category: MaterialCategory.PLATES_CARBON_STEEL,
  specification: {
    standard: "ASTM A36",
    grade: "A36",
    form: "Plate"
  }
}
```

---

## Improvement #2: Variants System

### Current Problem ❌

Each thickness = separate material entry:
```
Materials List:
1. SS 316L Plate 3mm  (PL-SS-01)
2. SS 316L Plate 5mm  (PL-SS-02)
3. SS 316L Plate 6mm  (PL-SS-03)
4. SS 316L Plate 8mm  (PL-SS-04)
5. SS 316L Plate 10mm (PL-SS-05)
... (uses up sequence numbers quickly)
```

Issues:
- Cluttered list
- Duplicate specifications
- Hard to compare thicknesses
- Wastes sequence numbers

### New Approach ✅

**One material with multiple variants**:
```
Material: PL-SS-01 "Stainless Steel 316L Plate"
├─ Variant: 3mm
├─ Variant: 5mm
├─ Variant: 6mm
├─ Variant: 8mm
└─ Variant: 10mm
```

### Data Model

```typescript
interface Material {
  id: string;
  materialCode: string;  // PL-SS-01
  name: string;          // "Stainless Steel 316L Plate"
  category: MaterialCategory;
  specification: MaterialSpecification;

  // NEW: Variants support
  hasVariants: boolean;
  variants?: MaterialVariant[];

  // ... other fields
}

interface MaterialVariant {
  id: string;
  variantCode: string;        // "3MM", "5MM", "10MM"
  displayName: string;        // "3mm thickness"

  // Dimensions
  dimensions: {
    thickness?: number;       // 3, 5, 6, 8, 10 (mm)
    length?: number;          // Optional
    width?: number;           // Optional
  };

  // Weight varies by thickness
  weightPerUnit?: number;     // kg/m²

  // VARIANT-SPECIFIC (confirmed by user):
  currentPrice?: MaterialPrice;
  priceHistory: string[];
  leadTimeDays?: number;
  preferredVendors?: string[];

  // Stock (if tracked)
  currentStock?: number;
  reorderLevel?: number;

  // Status
  isAvailable: boolean;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Example with Variants

```typescript
{
  id: "mat_001",
  materialCode: "PL-SS-01",
  name: "Stainless Steel 316L Plate",
  category: MaterialCategory.PLATES_STAINLESS_STEEL,
  specification: {
    standard: "ASTM A240",
    grade: "316L",
    finish: "2B",
    form: "Plate"
  },
  hasVariants: true,
  variants: [
    {
      id: "var_001",
      variantCode: "3MM",
      displayName: "3mm thickness",
      dimensions: { thickness: 3 },
      weightPerUnit: 23.55,  // kg/m²

      // Price varies
      currentPrice: {
        amount: 280,
        currency: "INR",
        unit: "kg"
      },

      // Lead time varies
      leadTimeDays: 7,

      // Vendors may vary
      preferredVendors: ["vendor_001", "vendor_002"],

      // Stock
      currentStock: 500,
      isAvailable: true
    },
    {
      id: "var_002",
      variantCode: "5MM",
      displayName: "5mm thickness",
      dimensions: { thickness: 5 },
      weightPerUnit: 39.25,

      currentPrice: {
        amount: 280,  // Same price per kg
        currency: "INR",
        unit: "kg"
      },

      leadTimeDays: 7,
      preferredVendors: ["vendor_001", "vendor_002"],

      currentStock: 750,
      isAvailable: true
    },
    {
      id: "var_003",
      variantCode: "10MM",
      displayName: "10mm thickness",
      dimensions: { thickness: 10 },
      weightPerUnit: 78.5,

      currentPrice: {
        amount: 285,  // Different price for thicker
        currency: "INR",
        unit: "kg"
      },

      leadTimeDays: 15,  // Longer lead time
      preferredVendors: ["vendor_003"],  // Different vendor

      currentStock: 0,
      reorderLevel: 200,
      isAvailable: false  // Out of stock
    }
  ]
}
```

### UI Changes

#### Materials List Page

**Before**:
```
┌──────────────┬────────────────────────────┬─────────┐
│ Code         │ Name                       │ Actions │
├──────────────┼────────────────────────────┼─────────┤
│ PL-SS-01     │ SS 316L Plate 3mm         │ View    │
│ PL-SS-02     │ SS 316L Plate 5mm         │ View    │
│ PL-SS-03     │ SS 316L Plate 6mm         │ View    │
│ PL-SS-04     │ SS 316L Plate 10mm        │ View    │
│ PL-SS-05     │ SS 304 Plate 3mm          │ View    │
└──────────────┴────────────────────────────┴─────────┘
(Cluttered - 20+ entries)
```

**After**:
```
┌──────────────┬────────────────────────────┬──────────┬─────────┐
│ Code         │ Name                       │ Variants │ Actions │
├──────────────┼────────────────────────────┼──────────┼─────────┤
│ PL-SS-01     │ SS 316L Plate             │ 5 sizes  │ View    │
│ PL-SS-02     │ SS 304 Plate              │ 6 sizes  │ View    │
│ PL-CS-01     │ CS A36 Plate              │ 8 sizes  │ View    │
└──────────────┴────────────────────────────┴──────────┴─────────┘
(Clean - one entry per grade)
```

#### Material Detail Page

```
┌─────────────────────────────────────────────────────────────────┐
│ Stainless Steel 316L Plate (PL-SS-01)                         │
│                                                                 │
│ Specifications: ASTM A240, Grade 316L, Finish 2B              │
├─────────────────────────────────────────────────────────────────┤
│ Available Sizes:                                                │
│                                                                 │
│ ┌──────┬──────────┬────────┬──────────┬──────────┬──────────┐ │
│ │Thick │Weight/m² │ Stock  │  Price   │Lead Time │ Vendors  │ │
│ ├──────┼──────────┼────────┼──────────┼──────────┼──────────┤ │
│ │ 3mm  │ 23.55 kg │ 500 kg │ ₹280/kg  │  7 days  │ V1, V2   │ │
│ │ 5mm  │ 39.25 kg │ 750 kg │ ₹280/kg  │  7 days  │ V1, V2   │ │
│ │ 6mm  │ 47.10 kg │ 300 kg │ ₹280/kg  │  7 days  │ V1, V2   │ │
│ │ 8mm  │ 62.80 kg │ 150 kg │ ₹282/kg  │ 10 days  │ V1, V3   │ │
│ │ 10mm │ 78.50 kg │   0 kg │ ₹285/kg  │ 15 days⚠ │ V3 only  │ │
│ └──────┴──────────┴────────┴──────────┴──────────┴──────────┘ │
│                                                                 │
│ [Add Size] [Edit Sizes] [Manage Prices] [Manage Stock]        │
└─────────────────────────────────────────────────────────────────┘
```

#### Purchase Request Integration

When creating a purchase request:

```
1. Select Material: SS 316L Plate (PL-SS-01)

2. Select Thickness:
   ┌─────────────────────────────────────┐
   │ ○ 3mm  (₹280/kg) - In Stock ✓      │
   │ ○ 5mm  (₹280/kg) - In Stock ✓      │
   │ ○ 6mm  (₹280/kg) - In Stock ✓      │
   │ ○ 8mm  (₹282/kg) - In Stock ✓      │
   │ ○ 10mm (₹285/kg) - 15 days ⚠       │
   └─────────────────────────────────────┘

3. Quantity: [____] kg
```

---

## Implementation Plan

### Phase 1: Material Code Format (Week 1)

**Day 1-2: Type System & Constants**
```typescript
// packages/types/src/material.ts

export const PLATE_MATERIAL_CODES: Record<MaterialCategory, [string, string]> = {
  [MaterialCategory.PLATES_STAINLESS_STEEL]: ['PL', 'SS'],
  [MaterialCategory.PLATES_CARBON_STEEL]: ['PL', 'CS'],
  [MaterialCategory.PLATES_DUPLEX_STEEL]: ['PL', 'DS'],
  [MaterialCategory.PLATES_ALLOY_STEEL]: ['PL', 'AS'],
  [MaterialCategory.PLATES_ALUMINUM]: ['PL', 'AL'],
  [MaterialCategory.PLATES_COPPER]: ['PL', 'CU'],
  [MaterialCategory.PLATES_TITANIUM]: ['PL', 'TI'],
  [MaterialCategory.PLATES_NICKEL_ALLOYS]: ['PL', 'NI'],
};

export interface MaterialCodeConfig {
  form: string;      // "PL"
  material: string;  // "SS"
  sequence: number;  // 1-99
}
```

**Day 3-4: Service Layer Update**
```typescript
// apps/web/src/lib/materials/materialService.ts

async function generateMaterialCode(
  db: Firestore,
  category: MaterialCategory
): Promise<string> {
  // Implementation as shown above
}
```

**Day 5: Testing**
- Unit tests for code generation
- Test sequence numbering
- Test limit validation (99 max)

### Phase 2: Variants System (Week 2-3)

**Week 2, Day 1-2: Data Model**
- Add `MaterialVariant` interface
- Update `Material` interface with `hasVariants` and `variants`
- Update Firestore indexes

**Week 2, Day 3-5: Service Layer**
```typescript
// Variant CRUD operations
async function addMaterialVariant(...)
async function updateMaterialVariant(...)
async function deleteVariant(...)
async function getVariantById(...)
```

**Week 3, Day 1-3: UI Components**
- Variants table component
- Add/edit variant modal
- Variant selector (dropdown for PR/RFQ)
- Price management per variant
- Stock management per variant

**Week 3, Day 4-5: Testing & Polish**
- E2E tests
- UI polish
- Documentation

---

## Database Changes

### Firestore Indexes

Add indexes for new material code format:

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
    { "fieldPath": "materialCode", "order": "ASCENDING" }
  ]
}
```

### Migration Strategy

For existing materials (if any):
1. Backup current data
2. Generate new codes based on category
3. Preserve old codes in `customCode` field
4. Update all references in procurement documents

---

## Benefits Summary

### Material Code Benefits
- ✅ **Instantly recognizable**: "PL-SS" = Plate, Stainless Steel
- ✅ **Searchable**: Filter all SS plates with "PL-SS"
- ✅ **Simple**: 2-digit sequence is enough for plates
- ✅ **Scalable**: Can add PP-SS, FT-SS later for pipes/fittings

### Variants Benefits
- ✅ **Clean UI**: 80% fewer entries in materials list
- ✅ **Better UX**: See all thicknesses at once
- ✅ **Flexible pricing**: Different prices per thickness
- ✅ **Flexible vendors**: Different vendors per size
- ✅ **Easy procurement**: Quick thickness selection

---

## Success Criteria

- [ ] Material codes follow PL-SS-XX format
- [ ] Sequence max is 99 per material type
- [ ] Variants working for plates
- [ ] Price varies per thickness
- [ ] Lead time varies per thickness
- [ ] Vendors vary per thickness
- [ ] UI shows clean material list (one entry per grade)
- [ ] UI shows all thicknesses in detail view
- [ ] Purchase request can select thickness easily

---

## Next Steps

1. ✅ User approval - **DONE**
2. ⏳ Create feature branch
3. ⏳ Implement material code format (Week 1)
4. ⏳ Implement variants system (Week 2-3)
5. ⏳ Testing and deployment
6. ⏳ User training

---

**Status**: Ready for implementation
**Approved**: 2025-11-15
**Start Date**: TBD
**Estimated Completion**: 2-3 weeks from start
