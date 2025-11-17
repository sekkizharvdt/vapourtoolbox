# Material Variant UI Components

**Version:** 1.0
**Created:** 2025-11-17
**Status:** ✅ Implemented

---

## Overview

The Material Variant UI system provides a complete set of components for managing and selecting material variants within the Vapour Toolbox. The system supports the new material code format (`PL-SS-304`) with variant-specific extensions (e.g., `PL-SS-304-4thk-2B`).

### Key Features

- **Base Material Codes**: Clean, simple codes (e.g., `PL-SS-304`)
- **Variant Extensions**: Full specification codes when variant selected (e.g., `PL-SS-304-4thk-2B`)
- **Interactive Selection**: User-friendly variant selection with pricing, lead time, and availability
- **Management Tools**: Admin interfaces for adding/editing/deleting variants
- **Reusable Components**: Modular components for use throughout the application

---

## Architecture

### File Structure

```
apps/web/src/
├── lib/materials/
│   └── variantUtils.ts          # Utility functions for variants
├── components/materials/
│   ├── MaterialVariantSelector.tsx    # Interactive variant selector
│   ├── MaterialVariantList.tsx        # Table view of variants
│   ├── MaterialPickerDialog.tsx       # Material selection dialog
│   ├── MaterialVariantManager.tsx     # Variant management (add/edit/delete)
│   └── index.ts                       # Exports
└── app/materials/
    └── variant-demo/page.tsx          # Demo/test page
```

---

## Components

### 1. MaterialVariantSelector

**Purpose**: Interactive component for selecting a specific variant from a material's options.

**Usage**:
```tsx
import { MaterialVariantSelector } from '@/components/materials';

<MaterialVariantSelector
  material={material}
  selectedVariantId={selectedVariant?.id}
  onVariantSelect={(variant, fullCode) => {
    console.log('Selected:', fullCode);
    // fullCode example: "PL-SS-304-4thk-2B"
  }}
  showPricing={true}
  showLeadTime={true}
  showStock={true}
  compact={false}
/>
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `material` | `Material` | ✅ | Material with variants |
| `selectedVariantId` | `string` | ❌ | Currently selected variant ID |
| `onVariantSelect` | `(variant, fullCode) => void` | ✅ | Selection callback |
| `showPricing` | `boolean` | ❌ | Show pricing (default: true) |
| `showLeadTime` | `boolean` | ❌ | Show lead time (default: true) |
| `showStock` | `boolean` | ❌ | Show stock levels (default: false) |
| `showUnavailable` | `boolean` | ❌ | Show unavailable variants (default: false) |
| `compact` | `boolean` | ❌ | Compact view (default: false) |

**Features**:
- Radio button selection
- Variant cards with full details
- Real-time code generation preview
- Availability status chips
- Pricing display
- Lead time information
- Stock levels (optional)
- Expandable/collapsible

---

### 2. MaterialVariantList

**Purpose**: Table view displaying all variants with specifications and pricing.

**Usage**:
```tsx
import { MaterialVariantList } from '@/components/materials';

<MaterialVariantList
  material={material}
  showPricing={true}
  showStock={true}
  compact={false}
/>
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `material` | `Material` | ✅ | Material with variants |
| `showPricing` | `boolean` | ❌ | Show pricing column (default: true) |
| `showStock` | `boolean` | ❌ | Show stock column (default: true) |
| `compact` | `boolean` | ❌ | Compact table (default: false) |

**Features**:
- Sortable table
- Full specification codes displayed
- Dimensions breakdown
- Weight per unit
- Availability status
- Lead time with icons
- Pricing per unit
- Stock levels
- Summary statistics chips

**Use Cases**:
- Material detail pages
- Documentation/catalogs
- Inventory reports

---

### 3. MaterialPickerDialog

**Purpose**: Complete material selection flow with search, filtering, and variant selection.

**Usage**:
```tsx
import { MaterialPickerDialog } from '@/components/materials';

const [open, setOpen] = useState(false);

<MaterialPickerDialog
  open={open}
  onClose={() => setOpen(false)}
  onSelect={(material, variant, fullCode) => {
    console.log('Picked:', fullCode);
    // Use material and variant in your form
  }}
  title="Select Material for Order"
  categories={[MaterialCategory.PLATES_STAINLESS_STEEL]}
  requireVariantSelection={true}
/>
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | ✅ | Dialog open state |
| `onClose` | `() => void` | ✅ | Close callback |
| `onSelect` | `(material, variant?, fullCode?) => void` | ✅ | Selection callback |
| `title` | `string` | ❌ | Dialog title (default: "Select Material") |
| `categories` | `MaterialCategory[]` | ❌ | Filter by categories |
| `requireVariantSelection` | `boolean` | ❌ | Require variant selection (default: true) |

**Features**:
- Two-column layout (materials list + variant selector)
- Search materials by code, name, specification
- Category tabs for filtering
- Material details preview
- Integrated variant selector
- Full specification code confirmation
- Validation (ensures variant selected if required)

**Use Cases**:
- Project BOMs
- Purchase orders
- Quotation line items
- Inventory management

---

### 4. MaterialVariantManager

**Purpose**: Admin interface for managing variants (add/edit/delete).

**Usage**:
```tsx
import { MaterialVariantManager } from '@/components/materials';

<MaterialVariantManager
  material={material}
  onVariantsChange={(updatedVariants) => {
    // Save updated variants
    setMaterial({ ...material, variants: updatedVariants });
  }}
  readOnly={false}
/>
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `material` | `Material` | ✅ | Material to manage |
| `onVariantsChange` | `(variants) => void` | ✅ | Callback when variants change |
| `readOnly` | `boolean` | ❌ | Read-only mode (default: false) |

**Features**:
- Add new variants
- Edit existing variants
- Delete variants
- Duplicate variants
- Form validation
- Preview full specification code
- Comprehensive variant form:
  - Variant code (finish, size identifier)
  - Display name
  - Dimensions (thickness, length, width)
  - Schedule (for pipes)
  - Nominal size (DN/NPS)
  - Weight per unit
  - Lead time
  - Minimum order quantity
  - Availability toggle

**Use Cases**:
- Material creation page
- Material edit page
- Admin catalog management

---

## Utility Functions

### variantUtils.ts

Comprehensive utilities for working with material variants.

#### Code Generation

```tsx
import { generateVariantCode } from '@/lib/materials/variantUtils';

const fullCode = generateVariantCode(material.materialCode, variant);
// Example: "PL-SS-304-4thk-2B"
```

#### Formatting Functions

```tsx
import {
  formatThickness,
  formatWeight,
  formatPrice,
  formatLeadTime,
} from '@/lib/materials/variantUtils';

formatThickness(4);           // "4mm"
formatWeight(32, 'kg/m²');    // "32.00 kg/m²"
formatPrice(450, 'INR');      // "₹450.00"
formatLeadTime(7);            // "7 days"
formatLeadTime(21);           // "3 weeks"
```

#### Availability Status

```tsx
import { getVariantAvailability } from '@/lib/materials/variantUtils';

const status = getVariantAvailability(variant);
// Returns: { label: string, color: 'success' | 'warning' | 'error' | 'default' }
```

#### Sorting & Filtering

```tsx
import {
  sortVariantsByThickness,
  filterAvailableVariants,
  hasVariants,
} from '@/lib/materials/variantUtils';

const sorted = sortVariantsByThickness(material.variants);
const available = filterAvailableVariants(material.variants);
const canSelectVariant = hasVariants(material);
```

#### Helper Functions

```tsx
import {
  getCheapestVariant,
  getFastestDeliveryVariant,
  getVariantDisplayName,
} from '@/lib/materials/variantUtils';

const cheapest = getCheapestVariant(material.variants);
const fastest = getFastestDeliveryVariant(material.variants);
const displayName = getVariantDisplayName(variant); // "3mm - 2B Finish"
```

---

## Material Code Format

### Base Material Code

Format: `{FORM}-{MATERIAL}-{GRADE}`

Examples:
- `PL-SS-304` - Plate, Stainless Steel, 304
- `PL-SS-316L` - Plate, Stainless Steel, 316L
- `PL-CS-A36` - Plate, Carbon Steel, A36
- `PL-DS-2205` - Plate, Duplex Steel, 2205

### Variant Specification Code

Format: `{BASE_CODE}-{THICKNESS}thk-{FINISH}`

Examples:
- `PL-SS-304-3thk-2B` - 3mm thickness, 2B finish
- `PL-SS-304-5thk-2B` - 5mm thickness, 2B finish
- `PL-SS-304-3thk-BA` - 3mm thickness, BA (Bright Annealed) finish
- `PL-SS-316L-10thk-NO1` - 10mm thickness, No.1 finish

### Display Pattern

**Materials List Table**: Shows base code only
```
Material Code: PL-SS-304
```

**When Variant Selected**: Shows full specification
```
Selected: PL-SS-304-4thk-2B
```

---

## Integration Examples

### Example 1: Purchase Order Line Item

```tsx
import { useState } from 'react';
import { MaterialPickerDialog } from '@/components/materials';

function PurchaseOrderForm() {
  const [lineItems, setLineItems] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleMaterialSelect = (material, variant, fullCode) => {
    setLineItems([
      ...lineItems,
      {
        materialId: material.id,
        variantId: variant?.id,
        materialCode: fullCode,
        materialName: material.name,
        quantity: 0,
        unitPrice: variant?.currentPrice?.pricePerUnit || 0,
        leadTimeDays: variant?.leadTimeDays || material.leadTimeDays,
      },
    ]);
    setPickerOpen(false);
  };

  return (
    <>
      <Button onClick={() => setPickerOpen(true)}>
        Add Material
      </Button>

      <MaterialPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleMaterialSelect}
        title="Select Material for Purchase Order"
        requireVariantSelection
      />

      {/* Render line items table */}
    </>
  );
}
```

### Example 2: Material Detail Page

```tsx
import { MaterialVariantList } from '@/components/materials';

function MaterialDetailPage({ material }) {
  return (
    <Box>
      {/* Material header info */}

      {material.hasVariants && (
        <Box sx={{ mt: 4 }}>
          <MaterialVariantList
            material={material}
            showPricing
            showStock
          />
        </Box>
      )}
    </Box>
  );
}
```

### Example 3: Material Edit Page

```tsx
import { MaterialVariantManager } from '@/components/materials';

function MaterialEditPage({ material, onSave }) {
  const [materialData, setMaterialData] = useState(material);

  const handleVariantsChange = (updatedVariants) => {
    setMaterialData({
      ...materialData,
      variants: updatedVariants,
      hasVariants: updatedVariants.length > 0,
    });
  };

  return (
    <Box>
      {/* Material basic info form */}

      <MaterialVariantManager
        material={materialData}
        onVariantsChange={handleVariantsChange}
      />

      <Button onClick={() => onSave(materialData)}>
        Save Material
      </Button>
    </Box>
  );
}
```

---

## Testing

### Demo Page

Visit `/materials/variant-demo` to see all components in action with example data.

The demo page includes:
1. Interactive variant selector
2. Variant list table
3. Material picker dialog
4. Usage code examples

### Test Scenarios

1. **Select Variant with Pricing**
   - Open variant selector
   - Choose variant
   - Verify full code generated
   - Check price displayed

2. **Material Picker Flow**
   - Search for material
   - Filter by category
   - Select material
   - Choose variant
   - Confirm selection

3. **Variant Management**
   - Add new variant
   - Edit existing variant
   - Duplicate variant
   - Delete variant
   - Verify code preview

---

## Best Practices

### 1. Variant Code Consistency

✅ **DO**: Use consistent variant codes across similar materials
```tsx
// Good: All 2B finish plates use "2B"
PL-SS-304-3thk-2B
PL-SS-316-3thk-2B
PL-CS-A36-3thk-2B
```

❌ **DON'T**: Mix variant code formats
```tsx
// Bad: Inconsistent finish codes
PL-SS-304-3thk-2B
PL-SS-316-3thk-TwoB
PL-CS-A36-3thk-2b
```

### 2. Display Names

✅ **DO**: Use descriptive, user-friendly names
```tsx
{
  variantCode: "2B",
  displayName: "3mm - 2B Finish (Mill Finish)"
}
```

❌ **DON'T**: Use cryptic abbreviations
```tsx
{
  variantCode: "2B",
  displayName: "3MM-2B"
}
```

### 3. Variant Selection

✅ **DO**: Require variant selection for materials with variants
```tsx
<MaterialPickerDialog
  requireVariantSelection={true}
  // Forces user to select a specific variant
/>
```

❌ **DON'T**: Allow base material selection when variants exist
```tsx
// This could lead to ambiguous material specifications
```

### 4. Pricing & Lead Time

✅ **DO**: Set variant-specific pricing when prices differ
```tsx
// 3mm plate cheaper than 10mm
variants: [
  { thickness: 3, currentPrice: { pricePerUnit: 450 } },
  { thickness: 10, currentPrice: { pricePerUnit: 510 } },
]
```

❌ **DON'T**: Use same price for all variants if they actually differ

### 5. Availability Management

✅ **DO**: Mark unavailable variants explicitly
```tsx
{
  isAvailable: false,
  discontinuedDate: timestamp
}
```

✅ **DO**: Filter unavailable variants in selection UIs
```tsx
<MaterialVariantSelector showUnavailable={false} />
```

---

## Troubleshooting

### Variant Selector Not Showing

**Problem**: MaterialVariantSelector shows "This material has no variants"

**Solutions**:
1. Check `material.hasVariants` is `true`
2. Verify `material.variants` array exists and has items
3. Ensure variants are not filtered out (check `isAvailable` flag)

### Full Code Not Generating

**Problem**: `generateVariantCode()` returns only base code

**Solutions**:
1. Verify variant has `dimensions.thickness` or `variantCode`
2. Check variant object structure matches `MaterialVariant` interface
3. Ensure `materialCode` is valid

### Material Picker Not Loading

**Problem**: MaterialPickerDialog shows "No materials available"

**Solutions**:
1. Check Firestore indexes are deployed
2. Verify materials exist in database
3. Check category filter isn't excluding all materials
4. Review Firebase permissions

---

## Future Enhancements

### Planned Features

1. **Bulk Variant Import**
   - CSV import for variants
   - Template download
   - Validation & preview

2. **Variant Templates**
   - Predefined variant sets
   - Quick apply to similar materials
   - Standard thickness/finish combinations

3. **Price History Graph**
   - Visual price trends per variant
   - Comparison across variants
   - Export to Excel

4. **Stock Alerts**
   - Low stock notifications
   - Reorder point warnings
   - Integration with procurement

5. **Vendor Comparison**
   - Compare prices across vendors
   - Lead time comparison
   - Preferred vendor suggestions

---

## Migration Guide

### From Old Material Codes

If you have existing materials with old format codes (`MAT-2025-0001`):

1. **Preserve old codes**:
   ```tsx
   {
     materialCode: "PL-SS-304",
     customCode: "MAT-2025-0001" // Keep for reference
   }
   ```

2. **Migrate thickness variations**:
   ```tsx
   // OLD: Multiple materials
   MAT-2025-0001 (3mm SS 304)
   MAT-2025-0002 (5mm SS 304)
   MAT-2025-0003 (10mm SS 304)

   // NEW: One material with variants
   PL-SS-304 with variants:
   - PL-SS-304-3thk-2B
   - PL-SS-304-5thk-2B
   - PL-SS-304-10thk-2B
   ```

3. **Update references**:
   - Update BOMs to use new codes
   - Migrate purchase orders
   - Update price lists

---

## Support

### Documentation
- Material Types: `packages/types/src/material.ts`
- Requirements: `docs/MATERIALS_MODULE_REQUIREMENTS.md`
- Improvements Plan: `docs/MATERIALS_MODULE_IMPROVEMENTS_V2.md`

### Component Locations
- Components: `apps/web/src/components/materials/`
- Utils: `apps/web/src/lib/materials/variantUtils.ts`
- Demo: `apps/web/src/app/materials/variant-demo/page.tsx`

---

**Last Updated:** 2025-11-17
**Version:** 1.0
**Status:** ✅ Production Ready
