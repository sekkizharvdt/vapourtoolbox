# Materials Module - Requirements & Status

**Module Name:** Materials Database
**Status:** Partially Implemented
**Priority:** High
**Last Updated:** 2025-11-15

---

## Executive Summary

The Materials Module provides a centralized database for managing all materials used in projects, including **raw materials**, **bought-out components**, and **consumables**. This module serves as the master data source for both Procurement and Engineering modules.

### Current Implementation Status

- ✅ **Type Definitions**: Complete (45+ types defined)
- ✅ **Database Schema**: Complete (Firestore indexes defined)
- ✅ **Service Layer**: Implemented (materialService.ts with CRUD operations)
- ✅ **UI - List View**: Implemented with tabbed interface, search, and filters
- ❌ **UI - Detail View**: Not implemented
- ❌ **UI - Add/Edit Forms**: Not implemented
- ❌ **Seed Function**: Not deployed (exists but needs Firebase auth)
- ❌ **Price Management UI**: Not implemented
- ❌ **Stock Management UI**: Not implemented
- ❌ **Vendor Integration**: Not implemented

---

## Module Overview

### Purpose

1. **Master Data Repository**: Single source of truth for all materials
2. **Procurement Support**: Material specifications for purchase requests and RFQs
3. **Engineering Reference**: ASME/ASTM compliant material specifications
4. **Cost Management**: Material pricing history and vendor comparisons
5. **Inventory Tracking**: Optional stock management for frequently used materials

### Material Classification

The module supports three primary material types:

#### 1. RAW_MATERIAL
Materials that are processed or fabricated into final products:
- **Plates**: Carbon Steel, Stainless Steel, Alloy Steel, Aluminum, Copper, Titanium, Nickel Alloys
- **Pipes**: Seamless, Welded, Stainless, Copper, Alloy Steel
- **Bars & Rods**: Various metals per ASTM standards
- **Sheets**: Metal sheets for fabrication
- **Structural Shapes**: I-beams, Channels, Angles

#### 2. BOUGHT_OUT_COMPONENT (BOI)
Pre-manufactured components purchased from vendors:
- **Fittings**: Butt Weld, Socket Weld, Threaded, Flanged (ASME B16.9, B16.11)
- **Fasteners**: Bolts, Nuts, Washers, Sets, Studs, Screws (ASTM A193, A194)
- **Valves**: Gate, Globe, Check, Ball (ASME B16.34)
- **Flanges**: Slip-on, Weld neck, Blind (ASME B16.5, B16.47)
- **Gaskets**: Various types (ASME B16.20, B16.21)
- **Pumps**: Water pumps, chemical pumps
- **Motors**: Electric motors
- **Instrumentation**: Sensors, gauges, controllers
- **Electrical**: Electrical components

#### 3. CONSUMABLE
Items consumed during fabrication/operations:
- **Welding Consumables**: Electrodes, filler wire (AWS D1.1)
- **Paints & Coatings**: Protective coatings
- **Lubricants**: Oils, greases
- **Chemicals**: Process chemicals

---

## Data Model

### Core Entity: Material

```typescript
interface Material {
  // Identity
  id: string;
  materialCode: string;        // Auto: MAT-YYYY-NNNN
  customCode?: string;          // User-defined code
  name: string;
  description: string;

  // Classification
  category: MaterialCategory;   // 40+ categories
  subCategory?: string;
  materialType: MaterialType;   // RAW_MATERIAL | BOUGHT_OUT_COMPONENT | CONSUMABLE

  // Specifications (ASME/ASTM)
  specification: MaterialSpecification;
  properties: MaterialProperties;

  // Units
  baseUnit: string;
  alternateUnits?: UnitConversion[];

  // Procurement
  preferredVendors: string[];   // Vendor entity IDs
  leadTimeDays?: number;
  minimumOrderQuantity?: number;

  // Pricing
  currentPrice?: MaterialPrice;
  priceHistory: string[];       // MaterialPrice IDs

  // Stock Management (Optional)
  trackInventory: boolean;
  currentStock?: number;
  reorderLevel?: number;

  // Documentation
  datasheetUrl?: string;
  imageUrl?: string;
  certifications?: string[];

  // Organization
  tags: string[];
  isActive: boolean;
  isStandard: boolean;          // Frequently used
  substituteMaterials?: string[];
}
```

### Supporting Entities

#### MaterialPrice
Tracks price history and vendor quotes:
```typescript
interface MaterialPrice {
  id: string;
  materialId: string;
  pricePerUnit: Money;
  unit: string;
  currency: CurrencyCode;
  vendorId?: string;
  sourceType: PriceSourceType; // VENDOR_QUOTE | MARKET_RATE | etc.
  effectiveDate: Timestamp;
  expiryDate?: Timestamp;
  quantityBreaks?: QuantityBreak[];
  isActive: boolean;
}
```

#### StockMovement
Tracks inventory movements:
```typescript
interface StockMovement {
  id: string;
  materialId: string;
  movementType: StockMovementType;
  quantity: number;
  unit: string;
  reason: string;
  documentReference?: string;  // PO, GRN, etc.
}
```

---

## Current Implementation

### 1. Type System ✅ COMPLETE

**Location**: `packages/types/src/material.ts`

**Includes**:
- Core Material interface
- 40+ MaterialCategory enum values
- MaterialSpecification with ASME/ASTM standards
- MaterialProperties (physical, mechanical, thermal, chemical)
- MaterialPrice and PriceSourceType
- StockMovement and StockMovementType
- Search and filter types
- Helper functions and type guards

**Status**: Production-ready, no changes needed

### 2. Database Schema ✅ COMPLETE

**Location**: `firestore.indexes.json` (lines 644-727)

**Composite Indexes**:
1. `(isActive, updatedAt)` - Active materials sorted by update date
2. `(category, updatedAt)` - Category filtering with sorting
3. `(materialType, updatedAt)` - Type filtering with sorting
4. `(isStandard, updatedAt)` - Standard materials filtering
5. `(isActive, materialCode)` - Code-based sorting for active materials
6. `(isActive, name)` - Name-based sorting for active materials
7. `(category, isActive, name)` - Category + active + name sort
8. `(category, isActive, materialCode)` - Category + active + code sort
9. `(category, isActive, isStandard, name)` - All filters with name sort
10. `(category, isActive, isStandard, updatedAt)` - All filters with date sort

**Collections**:
- `materials` - Main materials collection
- `materialPrices` - Price history (planned)
- `stockMovements` - Inventory movements (planned)

**Status**: Indexes defined, **needs deployment to Firebase**

### 3. Service Layer ✅ IMPLEMENTED

**Location**: `apps/web/src/lib/materials/materialService.ts`

**Functions Implemented**:
- ✅ `createMaterial()` - Create new material with auto-generated code
- ✅ `updateMaterial()` - Update existing material
- ✅ `getMaterialById()` - Fetch single material
- ✅ `deleteMaterial()` - Soft delete (set isActive = false)
- ✅ `queryMaterials()` - Advanced filtering and sorting
- ✅ `searchMaterials()` - Client-side text search
- ✅ `getMaterialsByVendor()` - Vendor-specific materials
- ✅ `addMaterialPrice()` - Add price entry
- ✅ `getMaterialPriceHistory()` - Get price history
- ✅ `getCurrentPrice()` - Get current active price
- ✅ `addPreferredVendor()` - Add vendor to material
- ✅ `removePreferredVendor()` - Remove vendor from material
- ✅ `updateMaterialStock()` - Update stock levels
- ✅ `getStockMovementHistory()` - Get stock movement history

**Code Quality**:
- Full TypeScript type safety
- Comprehensive error handling
- Firestore query optimization
- Audit logging integration
- Auto-generated material codes (MAT-2025-0001 format)

**Status**: Production-ready service layer

### 4. UI Pages - Partially Implemented

#### ✅ Materials List Page
**Location**: `apps/web/src/app/materials/page.tsx`

**Features**:
- Tabbed interface (Plates, Pipes)
- Sub-category chips for filtering
- Search box (name, code, description, spec, grade)
- "Standard Only" filter toggle
- Table view with columns:
  - Material Code (with custom code)
  - Name (with standard badge)
  - Specification (standard, grade, form, schedule, size)
  - Category
  - Properties (density, tensile strength, max temp)
  - Status (Active/Inactive)
  - Actions (View, Edit)
- Sorting by material code or name
- Pagination (25/50/100 items per page)
- Stats cards (Total, Standard, Category, Sub-categories)
- Refresh button
- Seed Catalog button (Super Admin only)

**Issues**:
- ⚠️ Indexes not deployed (materials won't load until indexes are deployed)
- ⚠️ Only shows Plates and Pipes tabs (needs all categories)
- ⚠️ View and Edit actions not implemented (no detail/edit pages)

#### ❌ Material Detail Page
**Location**: Not created
**Route**: `/materials/[id]/page.tsx` (needed)

**Required Features**:
- View all material details
- Specification details with ASME/ASTM standards
- Physical/mechanical/thermal properties
- Current price and price history chart
- Preferred vendors list
- Stock information (if tracking enabled)
- Certifications and documents
- Substitute materials
- Edit button (for authorized users)

#### ❌ Material Add/Edit Page
**Location**: Not created
**Route**: `/materials/new/page.tsx` and `/materials/[id]/edit/page.tsx` (needed)

**Required Features**:
- Multi-step form or tabbed form:
  1. Basic Information (code, name, description, category, type)
  2. Specifications (standard, grade, finish, form, schedule, size)
  3. Properties (physical, mechanical, thermal, chemical)
  4. Units & Conversions
  5. Procurement (vendors, lead time, MOQ)
  6. Documentation (datasheet, images, certifications)
  7. Organization (tags, standard flag, substitutes)
- Validation using Zod schemas
- Material code auto-generation
- Category-specific property fields
- Vendor selection from entity list
- Document upload integration
- Stock tracking toggle

#### ❌ Price Management UI
**Location**: Not created

**Required Features**:
- Price history table with chart visualization
- Add new price entry form
- Vendor quote upload
- Price comparison across vendors
- Quantity break tiers
- Validity date management
- Set current active price

#### ❌ Stock Management UI
**Location**: Not created
**Required for**: Materials with `trackInventory: true`

**Required Features**:
- Current stock display
- Stock movement history table
- Add stock adjustment form
- Reorder level alerts
- Stock movement types (Purchase, Consumption, Adjustment)
- Document reference linking (PO, GRN)

---

## Integration with Other Modules

### 1. Procurement Module Integration

**Materials Used In**:
- **Purchase Requests**: Select materials for requisitions
  - Material category filter
  - Material specifications auto-populate
  - Preferred vendors suggested
- **RFQs**: Material specs attached to RFQ items
- **Offers**: Vendor prices recorded as MaterialPrice entries
- **Purchase Orders**: Material details in line items
- **Goods Receipt**: Stock movements created when inventory tracked

**Data Flow**:
```
Purchase Request → Material Selection → Specs Populated
Vendor Offer → MaterialPrice Created → Price History Updated
Goods Receipt → StockMovement Created → Current Stock Updated
```

### 2. Estimation Module Integration (Future)

**Materials Used In**:
- **BOQ (Bill of Quantities)**: Material selection for cost estimation
- **Cost Calculation**: Current prices from MaterialPrice
- **Material Substitution**: Alternative materials for cost optimization

### 3. Entity Module Integration

**Vendors Linked**:
- `Material.preferredVendors[]` references `Entity.id` where `EntityRole.VENDOR`
- `MaterialPrice.vendorId` references `Entity.id`
- Vendor performance metrics based on price and delivery

### 4. Project Module Integration (Future)

**Project-Specific Materials**:
- Filter materials by project requirements
- Project-specific pricing
- Material allocation to projects

---

## Bought-Out Items (BOI) Functionality

### What are Bought-Out Items?

Bought-out items are **pre-manufactured components** purchased from vendors rather than fabricated in-house. In the Materials Module, these are classified as `MaterialType.BOUGHT_OUT_COMPONENT`.

### BOI Categories in Materials Module

The following categories are bought-out items:

**Fittings** (ASME B16.9, B16.11):
- Butt Weld Fittings (Elbows, Tees, Reducers)
- Socket Weld Fittings
- Threaded Fittings
- Flanged Fittings

**Fasteners** (ASTM A193, A194):
- Bolts (Hex bolts, Stud bolts)
- Nuts (Hex nuts, Heavy hex nuts)
- Washers (Flat, Lock, Spring washers)
- Complete Bolt-Nut-Washer Sets
- Studs (Threaded rods)
- Screws (Cap screws, Set screws)

**Other Components**:
- Valves (Gate, Globe, Check, Ball valves)
- Flanges (Slip-on, Weld neck, Blind flanges)
- Gaskets (Spiral wound, Ring type, Sheet gaskets)
- Pumps (Centrifugal, positive displacement)
- Motors (Electric motors, Variable frequency drives)
- Instrumentation (Sensors, transmitters, gauges, controllers)
- Electrical (Cables, panels, switches, protection devices)

### BOI in Procurement Module

In the Procurement Module, bought-out items are handled through:

1. **Purchase Request Category**:
   ```typescript
   category: "BOUGHT_OUT"  // vs "RAW_MATERIAL" or "SERVICE"
   ```

2. **Material Linking**:
   - Purchase request items reference `Material.id` for bought-out components
   - Specifications auto-populated from Materials Module
   - Preferred vendors suggested from Materials Module

3. **Vendor Comparison**:
   - Offers for bought-out items compared against MaterialPrice history
   - Price variance alerts
   - Lead time tracking

### BOI vs Raw Materials - Key Differences

| Aspect | Raw Materials | Bought-Out Items |
|--------|---------------|------------------|
| **Processing** | Requires fabrication/machining | Used as-is or minor modification |
| **Specifications** | Material grade, form, dimensions | Model number, rating, capacity |
| **Vendors** | Metal suppliers, mills | Manufacturers, distributors |
| **Pricing** | Per kg, per meter, per sheet | Per piece, per set |
| **Quality Control** | Mill test certificates | Manufacturer certificates, test reports |
| **Lead Time** | Shorter (stock items) | Longer (manufacturing lead time) |
| **Stock Tracking** | Weight/length based | Piece count based |

---

## Remaining Work

### Priority 1: Complete Core UI (Estimated: 2-3 weeks)

#### Week 1: Detail & Edit Pages
1. **Material Detail Page** (3 days)
   - View-only page with all material information
   - Tabbed layout: Info, Specs, Properties, Pricing, Stock, Documents
   - Actions: Edit, Deactivate, Duplicate

2. **Material Add/Edit Form** (4 days)
   - Multi-step form or tabbed form
   - Dynamic field validation per category
   - Auto-generated material code
   - Vendor selection integration
   - Document upload

#### Week 2: Price & Stock Management
3. **Price Management UI** (3 days)
   - Price history table with chart
   - Add price entry modal
   - Vendor price comparison
   - Quantity break configuration
   - Set active price

4. **Stock Management UI** (2 days)
   - Current stock widget
   - Stock movement history
   - Add adjustment modal
   - Reorder alerts

#### Week 3: Testing & Polish
5. **Complete Tab Implementation** (2 days)
   - Add all missing category tabs (Fittings, Fasteners, Valves, etc.)
   - Update MATERIAL_TABS constant with all categories

6. **Search & Filters** (1 day)
   - Advanced search modal
   - Property-based filtering (density, strength, etc.)
   - Vendor filtering

7. **Testing** (2 days)
   - E2E tests for CRUD operations
   - Test all material categories
   - Test price and stock management

### Priority 2: Advanced Features (Estimated: 1-2 weeks)

8. **Material Import/Export**
   - CSV/Excel import for bulk materials
   - Export material catalog
   - Template download

9. **Material Substitution**
   - Suggest alternative materials
   - Substitution rules
   - Cost comparison

10. **Document Management**
    - Datasheet upload
    - Image gallery
    - Certification documents
    - Version control

11. **Vendor Integration**
    - Material-vendor mapping UI
    - Vendor performance dashboard
    - Automatic vendor suggestions

12. **Reports & Analytics**
    - Material usage reports
    - Price trend analysis
    - Stock level reports
    - Vendor performance metrics

### Priority 3: Optimization (Ongoing)

13. **Performance**
    - Implement React Query for caching
    - Optimize Firestore queries
    - Add pagination cursors
    - Image lazy loading

14. **Search Optimization**
    - Consider Algolia for full-text search
    - Implement search suggestions
    - Search history

15. **Mobile Optimization**
    - Responsive tables
    - Mobile-friendly forms
    - Touch-optimized interactions

---

## Deployment Checklist

### Before Go-Live

- [ ] Deploy Firestore indexes to Firebase (`firebase deploy --only firestore:indexes`)
- [ ] Verify all indexes are built (status: Enabled)
- [ ] Seed standard materials catalog (Super Admin function)
- [ ] Test CRUD operations with real data
- [ ] Test search and filtering
- [ ] Test price management
- [ ] Test stock management (if enabled)
- [ ] Integrate with Procurement Module
- [ ] User training documentation
- [ ] Admin guide for material management

### Post-Launch

- [ ] Monitor query performance
- [ ] Collect user feedback
- [ ] Add requested categories
- [ ] Implement advanced features based on usage
- [ ] Optimize based on real-world data volume

---

## Success Metrics

### Technical Metrics
- ✅ Zero TypeScript errors
- ✅ All queries use composite indexes
- ⏳ Page load < 2 seconds
- ⏳ Search results < 500ms
- ⏳ 80%+ test coverage

### Business Metrics
- ⏳ 500+ materials in catalog (post-seed)
- ⏳ 90%+ procurement items linked to materials
- ⏳ Price history tracked for 80%+ materials
- ⏳ 95%+ user satisfaction with material search

---

## API Reference

### Service Functions

See `apps/web/src/lib/materials/materialService.ts` for complete implementation.

**Material CRUD**:
```typescript
createMaterial(db, materialData, userId): Promise<Material>
updateMaterial(db, materialId, updates, userId): Promise<void>
getMaterialById(db, materialId): Promise<Material | null>
deleteMaterial(db, materialId, userId): Promise<void>
```

**Material Queries**:
```typescript
queryMaterials(db, options): Promise<MaterialListResult>
searchMaterials(db, searchText, limit): Promise<Material[]>
getMaterialsByVendor(db, vendorId): Promise<Material[]>
```

**Price Management**:
```typescript
addMaterialPrice(db, price, userId): Promise<MaterialPrice>
getMaterialPriceHistory(db, materialId, options): Promise<MaterialPrice[]>
getCurrentPrice(db, materialId): Promise<MaterialPrice | null>
```

**Vendor Management**:
```typescript
addPreferredVendor(db, materialId, vendorId, userId): Promise<void>
removePreferredVendor(db, materialId, vendorId, userId): Promise<void>
```

**Stock Management**:
```typescript
updateMaterialStock(db, materialId, movement, userId): Promise<void>
getStockMovementHistory(db, materialId, limit): Promise<StockMovement[]>
```

---

## Notes

- **ASME/ASTM Compliance**: All specifications follow industry standards
- **Desktop-First**: UI optimized for desktop (1920×1080+), responsive design for smaller screens
- **NO MOCK DATA**: All components require real data or show empty states
- **Type Safety**: Full TypeScript strict mode throughout
- **Audit Trail**: All create/update operations tracked with userId and timestamp

---

**Document Status**: Living Document
**Maintained By**: Development Team
**Review Frequency**: Monthly or after major updates
**Next Review**: After UI completion (Priority 1)

---

## Related Documents

- [Procurement Module Progress](../archive/planning/PROCUREMENT_MODULE_PROGRESS.md)
- [Module Structure](../02-architecture/MODULE_STRUCTURE.md)
- [Project Summary](../00-overview/PROJECT_SUMMARY.md)
- [Implementation Roadmap](../analysis-docs/02-design-documents/IMPLEMENTATION_ROADMAP.md)

---

**Last Updated**: 2025-11-15
**Version**: 1.0
**Status**: Materials Module Partially Implemented - UI Completion Needed
