# Proposal Module - Foundation Work Specification

**Document Version**: 1.0
**Created**: 2025-11-18
**Target Completion**: 4-5 weeks (148-180 hours)
**Status**: NOT STARTED

## Executive Summary

This specification outlines the foundational work required to support the Proposal Module workflow:

1. Receipt of enquiry
2. Preparation of scope matrix
3. Pricing sheets (BOMs + bought-outs + services + overheads + profit)
4. Techno-commercial offer generation with T&C (PDF)
5. Revision capability
6. Data flow to Projects module upon acceptance

**Current State**: 60% ready (Materials and Shapes excellent, BOM MVP only, Bought-Outs placeholder)
**Target State**: 100% ready with complete costing, versioning, and PDF generation

---

## Phase 1: Complete BOM Costing (20-25 hours)

### 1.1 Implement Fabrication Cost Calculation

**Objective**: Add cutting, welding, forming, and assembly costs to BOM items

**Current State**:

- ✅ Material costs implemented in `bomCalculations.ts:258`
- ❌ Fabrication costs stubbed with "Week 2+" comment
- ✅ Shape calculator has `fabricationCost` in return type but returns 0

**Files to Modify**:

- `/apps/web/src/lib/bom/bomCalculations.ts` (lines 90-94)
- `/apps/web/src/lib/shapes/shapeCalculator.ts` (add fabrication logic)
- `/packages/types/src/bom.ts` (verify `fabricationCostPerUnit` exists in `BOMItemCostCalculation`)

**Implementation Details**:

```typescript
// bomCalculations.ts - Current placeholder:
// Week 2+: Calculate fabrication costs based on shape complexity and operations
const fabricationCostPerUnit = 0;
const totalFabricationCost = 0;

// TARGET IMPLEMENTATION:
export async function calculateFabricationCost(
  shape: Shape,
  material: Material,
  shapeResult: ShapeCalculationResult,
  quantity: number
): Promise<{ fabricationCostPerUnit: number; totalFabricationCost: number }> {
  const operations = shape.fabrication?.operations || [];
  let fabricationCostPerUnit = 0;

  for (const op of operations) {
    switch (op.type) {
      case 'CUTTING':
        // Cost = cutting length × rate per meter
        const cuttingLength = shapeResult.calculatedValues.perimeter || 0;
        fabricationCostPerUnit += cuttingLength * (op.ratePerUnit || 0);
        break;

      case 'WELDING':
        // Cost = weld length × rate per meter × difficulty multiplier
        const weldLength = shapeResult.calculatedValues.weldLength || 0;
        const difficultyMultiplier =
          material.weldability === 'EXCELLENT' ? 1.0 : material.weldability === 'GOOD' ? 1.2 : 1.5;
        fabricationCostPerUnit += weldLength * (op.ratePerUnit || 0) * difficultyMultiplier;
        break;

      case 'FORMING':
        // Cost = surface area × rate per sq meter
        const surfaceArea = shapeResult.calculatedValues.surfaceArea || 0;
        fabricationCostPerUnit += surfaceArea * (op.ratePerUnit || 0);
        break;

      case 'ASSEMBLY':
        // Fixed cost per assembly
        fabricationCostPerUnit += op.ratePerUnit || 0;
        break;

      case 'MACHINING':
        // Cost = machining time × rate per hour
        fabricationCostPerUnit += (op.timePerUnit || 0) * (op.ratePerUnit || 0);
        break;
    }
  }

  return {
    fabricationCostPerUnit,
    totalFabricationCost: fabricationCostPerUnit * quantity,
  };
}
```

**Testing Requirements**:

1. Create test BOM with simple plate (cutting only) → verify cutting cost
2. Create test BOM with welded pipe → verify welding cost with material difficulty
3. Create test BOM with complex assembly → verify all operation costs summed
4. Verify costs scale correctly with quantity

**Acceptance Criteria**:

- [ ] Fabrication costs calculated for all operation types (CUTTING, WELDING, FORMING, ASSEMBLY, MACHINING)
- [ ] Material weldability affects welding cost multiplier
- [ ] Costs scale correctly with quantity
- [ ] BOM summary includes `totalFabricationCost` separate from `totalMaterialCost`
- [ ] UI displays fabrication costs in BOM item cards

---

## Phase 2: Bought-Out Items Structure (25-30 hours)

### 2.1 Create Bought-Out Item Types

**Objective**: Implement dedicated structure for valves, pumps, instruments, strainers, separators

**Current State**:

- ❌ Placeholder page at `/apps/web/src/app/bought-out/page.tsx` (32 lines)
- ❌ No types defined in `@vapour/types`
- ❌ No service layer
- ⚠️ BOM items have `component.boughtOutItemId` field (optional) but nothing to reference

**Files to Create**:

- `/packages/types/src/boughtOut.ts` (new file)
- `/apps/web/src/lib/boughtOut/boughtOutService.ts` (new file)
- `/apps/web/src/app/bought-out/page.tsx` (replace placeholder)
- `/apps/web/src/app/bought-out/new/page.tsx` (new file)
- `/apps/web/src/app/bought-out/[id]/page.tsx` (new file)

**Type Structure**:

```typescript
// /packages/types/src/boughtOut.ts

export type BoughtOutCategory =
  | 'VALVE' // Gate, globe, ball, butterfly, check valves
  | 'PUMP' // Centrifugal, positive displacement
  | 'INSTRUMENT' // Pressure gauge, temperature sensor, flow meter
  | 'STRAINER' // Y-strainer, basket strainer
  | 'SEPARATOR' // Oil-water, gas-liquid separator
  | 'FITTING' // Flanges, elbows, tees
  | 'FASTENER' // Bolts, nuts, washers
  | 'GASKET' // Spiral wound, ring joint
  | 'INSULATION' // Thermal insulation materials
  | 'ELECTRICAL' // Motors, cables, switches
  | 'OTHER';

export interface BoughtOutItem {
  id: string;
  entityId: string;

  // Basic Info
  itemCode: string; // Auto-generated: BO-2024-0001
  name: string; // e.g., "Gate Valve 2\" Class 150"
  description?: string;
  category: BoughtOutCategory;

  // Specifications
  specifications: {
    manufacturer?: string;
    model?: string;
    size?: string; // e.g., "2 inch", "DN50"
    rating?: string; // e.g., "Class 150", "PN16"
    material?: string; // e.g., "CF8M (SS316)"
    standard?: string; // e.g., "ASME B16.34", "API 600"
    endConnection?: string; // e.g., "Flanged RF", "Butt Weld"
    customSpecs?: Record<string, string>; // Additional specs by category
  };

  // Pricing
  pricing: {
    listPrice: Money;
    currency: CurrencyCode;
    leadTime?: number; // Days
    moq?: number; // Minimum order quantity
    vendorId?: string; // Link to entity
    lastUpdated: Date | Timestamp;
  };

  // Documentation
  attachments?: {
    datasheetUrl?: string;
    catalogUrl?: string;
    drawingUrl?: string;
    certificationUrl?: string;
  };

  // Metadata
  tags?: string[];
  isActive: boolean;

  createdAt: Date | Timestamp;
  createdBy: string;
  updatedAt: Date | Timestamp;
  updatedBy: string;
}

export interface CreateBoughtOutItemInput {
  entityId: string;
  name: string;
  description?: string;
  category: BoughtOutCategory;
  specifications: BoughtOutItem['specifications'];
  pricing: Omit<BoughtOutItem['pricing'], 'lastUpdated'>;
  attachments?: BoughtOutItem['attachments'];
  tags?: string[];
}

export interface UpdateBoughtOutItemInput {
  name?: string;
  description?: string;
  category?: BoughtOutCategory;
  specifications?: Partial<BoughtOutItem['specifications']>;
  pricing?: Partial<Omit<BoughtOutItem['pricing'], 'lastUpdated'>>;
  attachments?: Partial<BoughtOutItem['attachments']>;
  tags?: string[];
  isActive?: boolean;
}

export interface ListBoughtOutItemsOptions {
  entityId: string;
  category?: BoughtOutCategory;
  isActive?: boolean;
  limit?: number;
  startAfter?: string;
}
```

**Service Layer**:

```typescript
// /apps/web/src/lib/boughtOut/boughtOutService.ts

const COLLECTIONS = {
  BOUGHT_OUT_ITEMS: 'bought_out_items',
};

export async function createBoughtOutItem(
  db: Firestore,
  input: CreateBoughtOutItemInput,
  userId: string
): Promise<BoughtOutItem> {
  // Generate itemCode: BO-YYYY-NNNN
  const itemCode = await generateBoughtOutItemCode(db);

  const now = Timestamp.now();
  const item: Omit<BoughtOutItem, 'id'> = {
    ...input,
    itemCode,
    pricing: {
      ...input.pricing,
      lastUpdated: now,
    },
    isActive: true,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS), item);
  return { id: docRef.id, ...item };
}

export async function getBoughtOutItemById(
  db: Firestore,
  itemId: string
): Promise<BoughtOutItem | null> {
  const docRef = doc(db, COLLECTIONS.BOUGHT_OUT_ITEMS, itemId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return { id: docSnap.id, ...docSnap.data() } as BoughtOutItem;
}

export async function listBoughtOutItems(
  db: Firestore,
  options: ListBoughtOutItemsOptions
): Promise<BoughtOutItem[]> {
  let q = query(
    collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS),
    where('entityId', '==', options.entityId)
  );

  if (options.category) {
    q = query(q, where('category', '==', options.category));
  }

  if (options.isActive !== undefined) {
    q = query(q, where('isActive', '==', options.isActive));
  }

  q = query(q, orderBy('createdAt', 'desc'));

  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BoughtOutItem);
}

export async function updateBoughtOutItem(
  db: Firestore,
  itemId: string,
  input: UpdateBoughtOutItemInput,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.BOUGHT_OUT_ITEMS, itemId);

  const updates: Partial<BoughtOutItem> = {
    ...input,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  if (input.pricing) {
    updates.pricing = {
      ...input.pricing,
      lastUpdated: Timestamp.now(),
    } as BoughtOutItem['pricing'];
  }

  await updateDoc(docRef, updates);
}

export async function deleteBoughtOutItem(db: Firestore, itemId: string): Promise<void> {
  // Soft delete by setting isActive = false
  await updateDoc(doc(db, COLLECTIONS.BOUGHT_OUT_ITEMS, itemId), {
    isActive: false,
    updatedAt: Timestamp.now(),
  });
}

async function generateBoughtOutItemCode(db: Firestore): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BO-${year}-`;

  // Query for highest number in current year
  const q = query(
    collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS),
    where('itemCode', '>=', prefix),
    where('itemCode', '<', `BO-${year + 1}-`),
    orderBy('itemCode', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let nextNumber = 1;
  if (!snapshot.empty) {
    const lastCode = snapshot.docs[0].data().itemCode as string;
    const lastNumber = parseInt(lastCode.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}
```

**UI Requirements**:

1. **List Page**: Table showing itemCode, name, category, manufacturer, model, price
2. **Detail Page**: Full specifications, pricing history, attachments, usage in BOMs
3. **Create/Edit Form**: Category-specific specs (e.g., valve has endConnection, pump has flowRate)
4. **Search/Filter**: By category, manufacturer, size, rating

**Firestore Indexes Required**:

```json
{
  "collectionGroup": "bought_out_items",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "entityId", "order": "ASCENDING" },
    { "fieldPath": "category", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "bought_out_items",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "entityId", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "bought_out_items",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "itemCode", "order": "ASCENDING" }
  ]
}
```

**Testing Requirements**:

1. Create valve with all specs → verify itemCode generated (BO-2025-0001)
2. Create pump with different specs → verify itemCode increments (BO-2025-0002)
3. List items filtered by category → verify correct results
4. Update pricing → verify lastUpdated timestamp changes
5. Soft delete → verify isActive = false

**Acceptance Criteria**:

- [ ] All 11 categories supported with appropriate specs
- [ ] Item codes auto-generated (BO-YYYY-NNNN)
- [ ] CRUD operations working (create, read, update, soft delete)
- [ ] List page with table, search, filter by category
- [ ] Detail page shows full specs and pricing
- [ ] Create/edit forms have category-specific fields
- [ ] Firestore indexes deployed

---

## Phase 3: Service Cost Items (15-20 hours)

### 3.1 Implement Non-Material/Non-Fabrication Costs

**Objective**: Add service line items to BOMs for drawing, installation, outsourced services

**Current State**:

- ❌ BOM only supports shape-based items (material + fabrication)
- ❌ No type for service items
- ❌ BOM summary doesn't include service costs

**Files to Modify**:

- `/packages/types/src/bom.ts` (add `BOMServiceItem` type)
- `/apps/web/src/lib/bom/bomService.ts` (add service item CRUD)
- `/apps/web/src/lib/bom/bomCalculations.ts` (include service costs in summary)
- `/apps/web/src/app/estimation/[id]/BOMEditorClient.tsx` (add "Add Service" button)

**Type Extensions**:

```typescript
// /packages/types/src/bom.ts - ADD THESE TYPES

export type ServiceCategory =
  | 'DRAWING' // Engineering drawings, CAD work
  | 'DESIGN' // Design calculations, simulations
  | 'INSTALLATION' // On-site installation labor
  | 'COMMISSIONING' // Testing, startup, handover
  | 'OUTSOURCED' // Subcontracted work (e.g., heat treatment)
  | 'INSPECTION' // NDT, pressure testing, certifications
  | 'TRANSPORTATION' // Freight, logistics
  | 'PACKAGING' // Export packing, crating
  | 'TRAINING' // Operator training
  | 'WARRANTY' // Extended warranty services
  | 'OTHER';

export interface BOMServiceItem {
  id: string;
  bomId: string;

  // Item numbering (fits into hierarchical structure)
  itemNumber: string; // e.g., "S1", "S2" (services numbered separately)
  name: string; // e.g., "GA Drawing Preparation"
  description?: string;
  category: ServiceCategory;

  // Costing
  cost: {
    rateType: 'FIXED' | 'HOURLY' | 'PER_UNIT';
    rate: Money; // Fixed price, or rate per hour/unit
    quantity: number; // Hours or units
    totalCost: Money; // rate × quantity (or fixed)
    currency: CurrencyCode;
  };

  // Assignment
  assignedTo?: 'INTERNAL' | 'OUTSOURCED';
  vendorId?: string; // If outsourced

  // Metadata
  notes?: string;
  tags?: string[];

  createdAt: Date | Timestamp;
  createdBy: string;
  updatedAt: Date | Timestamp;
  updatedBy: string;
}

export interface CreateBOMServiceItemInput {
  bomId: string;
  name: string;
  description?: string;
  category: ServiceCategory;
  cost: BOMServiceItem['cost'];
  assignedTo?: 'INTERNAL' | 'OUTSOURCED';
  vendorId?: string;
  notes?: string;
  tags?: string[];
}

// Update BOMSummary to include service costs:
export interface BOMSummary {
  itemCount: number;
  totalWeight: number;
  totalMaterialCost: Money;
  totalFabricationCost: Money; // ADD THIS
  totalServiceCost: Money; // ADD THIS
  totalBoughtOutCost: Money; // ADD THIS (for Phase 2)
  totalDirectCost: Money; // Sum of above
  overhead: Money; // ADD THIS (for Phase 4)
  contingency: Money; // ADD THIS (for Phase 4)
  profit: Money; // ADD THIS (for Phase 4)
  totalCost: Money; // Grand total including overheads & profit
  currency: CurrencyCode;
  lastCalculated?: Date | Timestamp;
}
```

**Service Layer Functions**:

```typescript
// /apps/web/src/lib/bom/bomService.ts - ADD THESE FUNCTIONS

export async function createBOMServiceItem(
  db: Firestore,
  input: CreateBOMServiceItemInput,
  userId: string
): Promise<BOMServiceItem> {
  // Generate next service item number (S1, S2, ...)
  const itemNumber = await getNextServiceItemNumber(db, input.bomId);

  const now = Timestamp.now();
  const serviceItem: Omit<BOMServiceItem, 'id'> = {
    ...input,
    itemNumber,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(
    collection(db, COLLECTIONS.BOMS, input.bomId, 'service_items'),
    serviceItem
  );

  // Recalculate BOM summary
  await recalculateBOMSummary(db, input.bomId, userId);

  return { id: docRef.id, ...serviceItem };
}

export async function listBOMServiceItems(db: Firestore, bomId: string): Promise<BOMServiceItem[]> {
  const q = query(
    collection(db, COLLECTIONS.BOMS, bomId, 'service_items'),
    orderBy('itemNumber', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BOMServiceItem);
}

export async function updateBOMServiceItem(
  db: Firestore,
  bomId: string,
  serviceItemId: string,
  input: Partial<CreateBOMServiceItemInput>,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.BOMS, bomId, 'service_items', serviceItemId);

  await updateDoc(docRef, {
    ...input,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  // Recalculate BOM summary
  await recalculateBOMSummary(db, bomId, userId);
}

export async function deleteBOMServiceItem(
  db: Firestore,
  bomId: string,
  serviceItemId: string,
  userId: string
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.BOMS, bomId, 'service_items', serviceItemId));

  // Recalculate BOM summary
  await recalculateBOMSummary(db, bomId, userId);
}

async function getNextServiceItemNumber(db: Firestore, bomId: string): Promise<string> {
  const q = query(
    collection(db, COLLECTIONS.BOMS, bomId, 'service_items'),
    orderBy('itemNumber', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return 'S1';

  const lastNumber = snapshot.docs[0].data().itemNumber as string;
  const num = parseInt(lastNumber.substring(1), 10);
  return `S${num + 1}`;
}
```

**BOM Summary Recalculation**:

```typescript
// /apps/web/src/lib/bom/bomCalculations.ts - UPDATE THIS FUNCTION

export async function recalculateBOMSummary(
  db: Firestore,
  bomId: string,
  userId: string
): Promise<void> {
  // 1. Get all BOM items (shapes)
  const items = await getBOMItems(db, bomId);

  // 2. Get all service items
  const serviceItems = await listBOMServiceItems(db, bomId);

  // 3. Calculate totals
  let totalMaterialCost = 0;
  let totalFabricationCost = 0;
  let totalWeight = 0;

  for (const item of items) {
    if (item.cost?.totalMaterialCost) {
      totalMaterialCost += item.cost.totalMaterialCost.amount;
    }
    if (item.cost?.totalFabricationCost) {
      totalFabricationCost += item.cost.totalFabricationCost.amount;
    }
    if (item.cost?.totalWeight) {
      totalWeight += item.cost.totalWeight;
    }
  }

  let totalServiceCost = 0;
  for (const service of serviceItems) {
    totalServiceCost += service.cost.totalCost.amount;
  }

  const totalDirectCost = totalMaterialCost + totalFabricationCost + totalServiceCost;

  // TODO: Add overhead, contingency, profit in Phase 4
  const totalCost = totalDirectCost;

  const summary: BOMSummary = {
    itemCount: items.length,
    totalWeight,
    totalMaterialCost: { amount: totalMaterialCost, currency: 'INR' },
    totalFabricationCost: { amount: totalFabricationCost, currency: 'INR' },
    totalServiceCost: { amount: totalServiceCost, currency: 'INR' },
    totalBoughtOutCost: { amount: 0, currency: 'INR' }, // Phase 2
    totalDirectCost: { amount: totalDirectCost, currency: 'INR' },
    overhead: { amount: 0, currency: 'INR' },
    contingency: { amount: 0, currency: 'INR' },
    profit: { amount: 0, currency: 'INR' },
    totalCost: { amount: totalCost, currency: 'INR' },
    currency: 'INR',
    lastCalculated: Timestamp.now(),
  };

  await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
    summary,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}
```

**UI Changes**:

1. Add "Add Service" button next to "Add Item" in BOMEditorClient
2. Create service item modal with category dropdown, rate type selector, cost calculator
3. Display service items in separate "Services" section below BOM items
4. Update summary card to show breakdown: Materials + Fabrication + Services = Direct Cost

**Testing Requirements**:

1. Add fixed-price drawing service (₹50,000) → verify totalServiceCost updated
2. Add hourly installation service (100 hrs × ₹500/hr) → verify calculation (₹50,000)
3. Add per-unit inspection service (10 units × ₹2,000/unit) → verify calculation (₹20,000)
4. Verify BOM summary includes all service costs
5. Delete service item → verify summary recalculates

**Acceptance Criteria**:

- [ ] All 11 service categories supported
- [ ] Three rate types: FIXED, HOURLY, PER_UNIT
- [ ] Service items stored in subcollection `boms/{bomId}/service_items`
- [ ] Service items numbered S1, S2, S3...
- [ ] BOM summary includes totalServiceCost
- [ ] UI has "Add Service" flow with modal/dialog
- [ ] Services displayed in separate section in BOM editor

---

## Phase 4: Costing Configuration (10-12 hours)

### 4.1 Implement Overhead, Contingency, and Profit Margins

**Objective**: Add configurable percentages for indirect costs and profit

**Current State**:

- ❌ BOM summary only has direct costs
- ❌ No configuration for overhead/contingency/profit rates
- ❌ No entity-level or project-level cost settings

**Files to Create**:

- `/packages/types/src/costConfig.ts` (new file)
- `/apps/web/src/lib/bom/costConfig.ts` (new file)
- `/apps/web/src/app/company/costing/page.tsx` (new UI page)

**Type Structure**:

```typescript
// /packages/types/src/costConfig.ts

export interface CostConfiguration {
  id: string;
  entityId: string;

  // Overhead rates (as percentages of direct costs)
  overhead: {
    enabled: boolean;
    ratePercent: number; // e.g., 15 (for 15%)
    description?: string; // e.g., "Covers admin, utilities, facility costs"
    applicableTo: 'MATERIAL' | 'FABRICATION' | 'SERVICE' | 'ALL'; // What to apply overhead to
  };

  // Contingency (buffer for unknowns)
  contingency: {
    enabled: boolean;
    ratePercent: number; // e.g., 10 (for 10%)
    description?: string; // e.g., "Risk buffer for material price fluctuations"
  };

  // Profit margin
  profit: {
    enabled: boolean;
    ratePercent: number; // e.g., 20 (for 20%)
    description?: string; // e.g., "Target profit margin"
  };

  // Labor rates (for service items)
  laborRates: {
    engineerHourlyRate: Money;
    draftsmanHourlyRate: Money;
    fitterHourlyRate: Money;
    welderHourlyRate: Money;
    supervisorHourlyRate: Money;
  };

  // Fabrication rates (for operation costing)
  fabricationRates: {
    cuttingRatePerMeter: Money;
    weldingRatePerMeter: Money;
    formingRatePerSqMeter: Money;
    machiningRatePerHour: Money;
    assemblyRatePerUnit: Money;
  };

  // Metadata
  isActive: boolean;
  effectiveFrom: Date | Timestamp;
  createdAt: Date | Timestamp;
  createdBy: string;
  updatedAt: Date | Timestamp;
  updatedBy: string;
}

export interface CreateCostConfigurationInput {
  entityId: string;
  overhead: CostConfiguration['overhead'];
  contingency: CostConfiguration['contingency'];
  profit: CostConfiguration['profit'];
  laborRates: CostConfiguration['laborRates'];
  fabricationRates: CostConfiguration['fabricationRates'];
  effectiveFrom?: Date;
}
```

**Service Layer**:

```typescript
// /apps/web/src/lib/bom/costConfig.ts

const COLLECTIONS = {
  COST_CONFIGURATIONS: 'cost_configurations',
};

export async function createCostConfiguration(
  db: Firestore,
  input: CreateCostConfigurationInput,
  userId: string
): Promise<CostConfiguration> {
  const now = Timestamp.now();
  const config: Omit<CostConfiguration, 'id'> = {
    ...input,
    effectiveFrom: input.effectiveFrom ? Timestamp.fromDate(input.effectiveFrom) : now,
    isActive: true,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.COST_CONFIGURATIONS), config);
  return { id: docRef.id, ...config };
}

export async function getActiveCostConfiguration(
  db: Firestore,
  entityId: string
): Promise<CostConfiguration | null> {
  const q = query(
    collection(db, COLLECTIONS.COST_CONFIGURATIONS),
    where('entityId', '==', entityId),
    where('isActive', '==', true),
    where('effectiveFrom', '<=', Timestamp.now()),
    orderBy('effectiveFrom', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CostConfiguration;
}

export async function updateCostConfiguration(
  db: Firestore,
  configId: string,
  input: Partial<CreateCostConfigurationInput>,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.COST_CONFIGURATIONS, configId), {
    ...input,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}
```

**Update BOM Summary Calculation**:

```typescript
// /apps/web/src/lib/bom/bomCalculations.ts - ENHANCE recalculateBOMSummary

export async function recalculateBOMSummary(
  db: Firestore,
  bomId: string,
  userId: string
): Promise<void> {
  // ... existing direct cost calculation ...

  const totalDirectCost = totalMaterialCost + totalFabricationCost + totalServiceCost;

  // Get active cost configuration
  const bom = await getBOMById(db, bomId);
  const costConfig = await getActiveCostConfiguration(db, bom.entityId);

  let overheadAmount = 0;
  let contingencyAmount = 0;
  let profitAmount = 0;

  if (costConfig) {
    // Calculate overhead
    if (costConfig.overhead.enabled) {
      const base =
        costConfig.overhead.applicableTo === 'ALL'
          ? totalDirectCost
          : costConfig.overhead.applicableTo === 'MATERIAL'
            ? totalMaterialCost
            : costConfig.overhead.applicableTo === 'FABRICATION'
              ? totalFabricationCost
              : totalServiceCost;
      overheadAmount = base * (costConfig.overhead.ratePercent / 100);
    }

    // Calculate contingency (on direct cost + overhead)
    if (costConfig.contingency.enabled) {
      const base = totalDirectCost + overheadAmount;
      contingencyAmount = base * (costConfig.contingency.ratePercent / 100);
    }

    // Calculate profit (on everything)
    if (costConfig.profit.enabled) {
      const base = totalDirectCost + overheadAmount + contingencyAmount;
      profitAmount = base * (costConfig.profit.ratePercent / 100);
    }
  }

  const totalCost = totalDirectCost + overheadAmount + contingencyAmount + profitAmount;

  const summary: BOMSummary = {
    itemCount: items.length,
    totalWeight,
    totalMaterialCost: { amount: totalMaterialCost, currency: 'INR' },
    totalFabricationCost: { amount: totalFabricationCost, currency: 'INR' },
    totalServiceCost: { amount: totalServiceCost, currency: 'INR' },
    totalBoughtOutCost: { amount: 0, currency: 'INR' },
    totalDirectCost: { amount: totalDirectCost, currency: 'INR' },
    overhead: { amount: overheadAmount, currency: 'INR' },
    contingency: { amount: contingencyAmount, currency: 'INR' },
    profit: { amount: profitAmount, currency: 'INR' },
    totalCost: { amount: totalCost, currency: 'INR' },
    currency: 'INR',
    lastCalculated: Timestamp.now(),
  };

  await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
    summary,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}
```

**UI Requirements**:

1. **Company Settings Page** (`/company/costing`):
   - Form to configure overhead %, contingency %, profit %
   - Toggle switches to enable/disable each
   - Labor rate inputs (engineer, draftsman, fitter, welder, supervisor)
   - Fabrication rate inputs (cutting, welding, forming, machining, assembly)
   - Permission check: MANAGE_COMPANY_SETTINGS (512)

2. **BOM Summary Card Updates**:
   - Show breakdown:

     ```
     Material Cost:      ₹100,000
     Fabrication Cost:   ₹50,000
     Service Cost:       ₹30,000
     ─────────────────────────────
     Direct Cost:        ₹180,000

     Overhead (15%):     ₹27,000
     Contingency (10%):  ₹20,700
     ─────────────────────────────
     Subtotal:           ₹227,700

     Profit (20%):       ₹45,540
     ═════════════════════════════
     Total Cost:         ₹273,240
     ```

**Firestore Indexes Required**:

```json
{
  "collectionGroup": "cost_configurations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "entityId", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "effectiveFrom", "order": "DESCENDING" }
  ]
}
```

**Testing Requirements**:

1. Create cost config with 15% overhead, 10% contingency, 20% profit
2. Calculate BOM → verify overhead = direct × 0.15, contingency = (direct + overhead) × 0.10, profit = (all) × 0.20
3. Disable overhead → verify overhead = 0, recalculates correctly
4. Update rates → verify new BOMs use new rates
5. Create config with effectiveFrom = future date → verify not used yet

**Acceptance Criteria**:

- [ ] Cost configuration stored per entity
- [ ] Overhead can be applied to MATERIAL, FABRICATION, SERVICE, or ALL
- [ ] Contingency applies to direct cost + overhead
- [ ] Profit applies to everything (direct + overhead + contingency)
- [ ] Toggle switches to enable/disable each cost component
- [ ] Labor rates and fabrication rates configurable
- [ ] BOM summary shows full breakdown
- [ ] Company settings page with permission check
- [ ] Firestore indexes deployed

---

## Phase 5: BOM Versioning (15-18 hours)

### 5.1 Implement Version Control and Revision History

**Objective**: Track BOM changes, create revisions, compare versions

**Current State**:

- ⚠️ BOM type has `version` field (number) but no logic
- ❌ No revision history
- ❌ No comparison between versions
- ❌ Status transitions not tracked

**Files to Modify**:

- `/packages/types/src/bom.ts` (add `BOMRevision` type)
- `/apps/web/src/lib/bom/bomService.ts` (add versioning functions)
- `/apps/web/src/app/estimation/[id]/versions/page.tsx` (new UI page)

**Type Extensions**:

```typescript
// /packages/types/src/bom.ts - ADD THESE TYPES

export interface BOMRevision {
  id: string;
  bomId: string;

  // Version info
  version: number; // 1, 2, 3...
  versionLabel?: string; // e.g., "Rev A", "Rev B"
  revisionReason: string; // Why this revision was created

  // Snapshot of BOM at this version
  snapshot: {
    name: string;
    description?: string;
    category: BOMCategory;
    status: BOMStatus;
    summary: BOMSummary;
    itemCount: number;
    metadata?: Record<string, unknown>;
  };

  // Changes from previous version
  changes?: {
    itemsAdded: number;
    itemsRemoved: number;
    itemsModified: number;
    costDelta: Money; // Change in total cost
    changeDescription?: string;
  };

  // Approval workflow
  approvedBy?: string;
  approvedAt?: Date | Timestamp;

  // Metadata
  createdAt: Date | Timestamp;
  createdBy: string;
}

export interface CreateBOMRevisionInput {
  bomId: string;
  versionLabel?: string;
  revisionReason: string;
  changeDescription?: string;
}

// Add to BOM type:
export interface BOM {
  // ... existing fields ...
  version: number; // Current version number
  latestRevisionId?: string; // Reference to latest BOMRevision
  revisionHistory?: string[]; // Array of BOMRevision IDs
}
```

**Service Layer Functions**:

```typescript
// /apps/web/src/lib/bom/bomService.ts - ADD THESE FUNCTIONS

export async function createBOMRevision(
  db: Firestore,
  input: CreateBOMRevisionInput,
  userId: string
): Promise<BOMRevision> {
  const bom = await getBOMById(db, input.bomId);
  if (!bom) throw new Error('BOM not found');

  // Get all items to count
  const items = await getBOMItems(db, input.bomId);
  const serviceItems = await listBOMServiceItems(db, input.bomId);

  // Calculate changes from previous revision
  let changes: BOMRevision['changes'] | undefined;
  if (bom.latestRevisionId) {
    const prevRevision = await getBOMRevisionById(db, input.bomId, bom.latestRevisionId);
    if (prevRevision) {
      const costDelta =
        bom.summary.totalCost.amount - prevRevision.snapshot.summary.totalCost.amount;
      changes = {
        itemsAdded: 0, // TODO: Track actual changes
        itemsRemoved: 0,
        itemsModified: 0,
        costDelta: { amount: costDelta, currency: 'INR' },
        changeDescription: input.changeDescription,
      };
    }
  }

  const version = bom.version + 1;
  const now = Timestamp.now();

  const revision: Omit<BOMRevision, 'id'> = {
    bomId: input.bomId,
    version,
    versionLabel: input.versionLabel || `Rev ${version}`,
    revisionReason: input.revisionReason,
    snapshot: {
      name: bom.name,
      description: bom.description,
      category: bom.category,
      status: bom.status,
      summary: bom.summary,
      itemCount: items.length + serviceItems.length,
      metadata: bom.metadata,
    },
    changes,
    createdAt: now,
    createdBy: userId,
  };

  // Save revision
  const docRef = await addDoc(collection(db, COLLECTIONS.BOMS, input.bomId, 'revisions'), revision);

  // Update BOM with new version
  await updateDoc(doc(db, COLLECTIONS.BOMS, input.bomId), {
    version,
    latestRevisionId: docRef.id,
    revisionHistory: arrayUnion(docRef.id),
    updatedAt: now,
    updatedBy: userId,
  });

  logger.info('BOM revision created', { bomId: input.bomId, version, revisionId: docRef.id });

  return { id: docRef.id, ...revision };
}

export async function listBOMRevisions(db: Firestore, bomId: string): Promise<BOMRevision[]> {
  const q = query(collection(db, COLLECTIONS.BOMS, bomId, 'revisions'), orderBy('version', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BOMRevision);
}

export async function getBOMRevisionById(
  db: Firestore,
  bomId: string,
  revisionId: string
): Promise<BOMRevision | null> {
  const docRef = doc(db, COLLECTIONS.BOMS, bomId, 'revisions', revisionId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return { id: docSnap.id, ...docSnap.data() } as BOMRevision;
}

export async function approveBOMRevision(
  db: Firestore,
  bomId: string,
  revisionId: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.BOMS, bomId, 'revisions', revisionId);

  await updateDoc(docRef, {
    approvedBy: userId,
    approvedAt: Timestamp.now(),
  });

  // Update BOM status to APPROVED
  await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
    status: 'APPROVED',
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('BOM revision approved', { bomId, revisionId, userId });
}

export async function compareBOMRevisions(
  db: Firestore,
  bomId: string,
  revisionId1: string,
  revisionId2: string
): Promise<{
  version1: BOMRevision;
  version2: BOMRevision;
  differences: {
    costDelta: Money;
    statusChanged: boolean;
    summaryChanges: Partial<BOMSummary>;
  };
}> {
  const [rev1, rev2] = await Promise.all([
    getBOMRevisionById(db, bomId, revisionId1),
    getBOMRevisionById(db, bomId, revisionId2),
  ]);

  if (!rev1 || !rev2) throw new Error('Revision not found');

  const costDelta = rev2.snapshot.summary.totalCost.amount - rev1.snapshot.summary.totalCost.amount;

  return {
    version1: rev1,
    version2: rev2,
    differences: {
      costDelta: { amount: costDelta, currency: 'INR' },
      statusChanged: rev1.snapshot.status !== rev2.snapshot.status,
      summaryChanges: {
        totalMaterialCost: {
          amount:
            rev2.snapshot.summary.totalMaterialCost.amount -
            rev1.snapshot.summary.totalMaterialCost.amount,
          currency: 'INR',
        },
        totalFabricationCost: {
          amount:
            rev2.snapshot.summary.totalFabricationCost.amount -
            rev1.snapshot.summary.totalFabricationCost.amount,
          currency: 'INR',
        },
        // ... other summary fields
      },
    },
  };
}
```

**Automatic Revision Triggers**:

```typescript
// Create revision automatically when:
// 1. BOM status changes (DRAFT → UNDER_REVIEW → APPROVED → RELEASED)
// 2. User clicks "Create Revision" button
// 3. BOM is about to be included in a Proposal

export async function updateBOMStatus(
  db: Firestore,
  bomId: string,
  newStatus: BOMStatus,
  userId: string
): Promise<void> {
  const bom = await getBOMById(db, bomId);
  if (!bom) throw new Error('BOM not found');

  // Create revision before status change
  await createBOMRevision(
    db,
    {
      bomId,
      revisionReason: `Status change: ${bom.status} → ${newStatus}`,
    },
    userId
  );

  // Update status
  await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
    status: newStatus,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('BOM status updated', { bomId, oldStatus: bom.status, newStatus });
}
```

**UI Requirements**:

1. **Version History Tab** in BOM Editor:
   - Timeline view showing all revisions
   - Each revision shows: version, date, author, reason, cost delta
   - "View" button to see snapshot
   - "Compare" button to diff two versions

2. **Revision Comparison Modal**:
   - Side-by-side view of two versions
   - Highlight differences in red/green
   - Show cost delta prominently

3. **Create Revision Button**:
   - Available when BOM has unsaved changes
   - Modal to enter revision reason

4. **Status Change Flow**:
   - Confirm dialog before status change
   - Automatically creates revision
   - Shows "Revision created: Rev 3" message

**Testing Requirements**:

1. Create BOM, make changes, create revision → verify version = 1, snapshot correct
2. Make more changes, create revision → verify version = 2, changes tracked
3. Change status DRAFT → UNDER_REVIEW → verify automatic revision created
4. Compare version 1 and 2 → verify cost delta calculated correctly
5. Approve revision → verify BOM status changed to APPROVED

**Acceptance Criteria**:

- [ ] Revisions stored in subcollection `boms/{bomId}/revisions`
- [ ] Version numbers auto-increment (1, 2, 3...)
- [ ] Snapshot includes full BOM summary and metadata
- [ ] Changes tracked (items added/removed/modified, cost delta)
- [ ] Automatic revision on status change
- [ ] UI shows revision history timeline
- [ ] Compare two revisions side-by-side
- [ ] Approve revision flow (optional, for review workflow)

---

## Phase 6: PDF Generation (30-35 hours)

### 6.1 Implement Techno-Commercial Offer PDF

**Objective**: Generate professional PDF documents with T&C for proposals

**Note**: This phase can be partially deferred until Proposal module implementation, but the infrastructure should be planned now.

**Technology Stack Options**:

1. **Option A - React-PDF**: Generate PDFs on server using React components
2. **Option B - Puppeteer**: Render HTML/CSS to PDF via headless Chrome
3. **Option C - Cloud Functions + Template**: Use Firebase Functions with Handlebars templates

**Recommended**: Option B (Puppeteer) for flexibility and professional output

**Files to Create**:

- `/functions/src/pdf/generateBOMQuote.ts` (Firebase Function)
- `/packages/types/src/pdf.ts` (PDF generation types)
- `/functions/src/pdf/templates/bom-quote.html` (HTML template)
- `/apps/web/src/app/estimation/[id]/generate-pdf/route.ts` (API route)

**Type Structure**:

```typescript
// /packages/types/src/pdf.ts

export interface PDFGenerationOptions {
  templateType: 'BOM_QUOTE' | 'PROPOSAL' | 'INVOICE' | 'PURCHASE_ORDER';
  data: Record<string, unknown>;
  outputFormat: 'A4' | 'LETTER';
  includePageNumbers: boolean;
  includeWatermark?: string;
  headerLogoUrl?: string;
  footerText?: string;
}

export interface BOMQuotePDFData {
  // Company info
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    gst?: string;
    logoUrl?: string;
  };

  // Customer info
  customer?: {
    name: string;
    address: string;
    contactPerson?: string;
    email?: string;
  };

  // Quote metadata
  quote: {
    quoteNumber: string;
    date: string;
    validUntil: string;
    referenceNumber?: string;
    subject: string;
  };

  // BOM details
  bom: {
    id: string;
    bomCode: string;
    name: string;
    description?: string;
    category: string;
    version: number;
  };

  // Cost breakdown
  costs: {
    items: Array<{
      itemNumber: string;
      name: string;
      description?: string;
      quantity: number;
      unit: string;
      unitCost: Money;
      totalCost: Money;
    }>;

    services: Array<{
      itemNumber: string;
      name: string;
      description?: string;
      rateType: string;
      quantity: number;
      rate: Money;
      totalCost: Money;
    }>;

    summary: {
      totalMaterialCost: Money;
      totalFabricationCost: Money;
      totalServiceCost: Money;
      totalDirectCost: Money;
      overhead: Money;
      contingency: Money;
      subtotal: Money;
      profit: Money;
      grandTotal: Money;
    };
  };

  // Terms & Conditions
  termsAndConditions: string[]; // Array of T&C paragraphs

  // Payment terms
  paymentTerms?: {
    advancePercent?: number;
    milestones?: Array<{ name: string; percent: number }>;
    finalPercent?: number;
  };

  // Delivery terms
  deliveryTerms?: {
    leadTime: string;
    shippingMethod?: string;
    incoterm?: string;
  };

  // Notes
  notes?: string;
}
```

**Firebase Function**:

```typescript
// /functions/src/pdf/generateBOMQuote.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

export const generateBOMQuotePDF = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { bomId } = data;

  // Fetch BOM data from Firestore
  const db = admin.firestore();
  const bomDoc = await db.collection('boms').doc(bomId).get();

  if (!bomDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'BOM not found');
  }

  const bom = bomDoc.data();

  // Fetch items
  const itemsSnapshot = await db.collection('boms').doc(bomId).collection('items').get();
  const items = itemsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Fetch service items
  const servicesSnapshot = await db.collection('boms').doc(bomId).collection('service_items').get();
  const services = servicesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Fetch company settings
  const companyDoc = await db.collection('company_settings').doc(bom.entityId).get();
  const company = companyDoc.data();

  // Prepare PDF data
  const pdfData: BOMQuotePDFData = {
    company: {
      name: company?.name || 'Your Company',
      address: company?.address || '',
      phone: company?.phone || '',
      email: company?.email || '',
      website: company?.website,
      gst: company?.gstNumber,
      logoUrl: company?.logoUrl,
    },
    quote: {
      quoteNumber: `Q-${bom.bomCode}`,
      date: new Date().toLocaleDateString('en-IN'),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN'),
      subject: `Quotation for ${bom.name}`,
    },
    bom: {
      id: bomId,
      bomCode: bom.bomCode,
      name: bom.name,
      description: bom.description,
      category: bom.category,
      version: bom.version,
    },
    costs: {
      items: items.map((item) => ({
        itemNumber: item.itemNumber,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.cost?.totalMaterialCost || { amount: 0, currency: 'INR' },
        totalCost: item.cost?.totalMaterialCost || { amount: 0, currency: 'INR' },
      })),
      services: services.map((service) => ({
        itemNumber: service.itemNumber,
        name: service.name,
        description: service.description,
        rateType: service.cost.rateType,
        quantity: service.cost.quantity,
        rate: service.cost.rate,
        totalCost: service.cost.totalCost,
      })),
      summary: bom.summary,
    },
    termsAndConditions: company?.defaultTermsAndConditions || [],
    paymentTerms: company?.defaultPaymentTerms,
    deliveryTerms: {
      leadTime: '8-10 weeks from order confirmation',
    },
  };

  // Load HTML template
  const templatePath = join(__dirname, 'templates', 'bom-quote.html');
  const templateContent = readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);

  // Register Handlebars helpers
  Handlebars.registerHelper('formatCurrency', (money: Money) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
    }).format(money.amount);
  });

  // Generate HTML
  const html = template(pdfData);

  // Generate PDF using Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
  });

  await browser.close();

  // Upload to Firebase Storage
  const bucket = admin.storage().bucket();
  const fileName = `quotes/${bomId}/Q-${bom.bomCode}-v${bom.version}.pdf`;
  const file = bucket.file(fileName);

  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: {
      metadata: {
        bomId,
        bomCode: bom.bomCode,
        version: bom.version,
        generatedAt: new Date().toISOString(),
        generatedBy: context.auth.uid,
      },
    },
  });

  // Get signed URL (valid for 7 days)
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return {
    success: true,
    fileName,
    downloadUrl: url,
  };
});
```

**HTML Template** (abbreviated):

```html
<!-- /functions/src/pdf/templates/bom-quote.html -->

<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>{{quote.quoteNumber}} - {{bom.name}}</title>
    <style>
      body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        font-size: 10pt;
        line-height: 1.4;
        color: #333;
      }
      .header {
        display: flex;
        justify-content: space-between;
        border-bottom: 2px solid #0891b2;
        padding-bottom: 10px;
        margin-bottom: 20px;
      }
      .company-logo {
        max-height: 60px;
      }
      .quote-title {
        font-size: 18pt;
        font-weight: bold;
        color: #0891b2;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      th {
        background-color: #e0f2f1;
        text-align: left;
        padding: 8px;
        border: 1px solid #b2dfdb;
      }
      td {
        padding: 6px 8px;
        border: 1px solid #e0e0e0;
      }
      .summary-row {
        font-weight: bold;
        background-color: #f5f5f5;
      }
      .grand-total {
        font-size: 12pt;
        font-weight: bold;
        background-color: #0891b2;
        color: white;
      }
      .terms {
        margin-top: 30px;
        font-size: 9pt;
      }
      .footer {
        margin-top: 40px;
        text-align: center;
        font-size: 8pt;
        color: #666;
      }
    </style>
  </head>
  <body>
    <!-- Header -->
    <div class="header">
      <div>
        {{#if company.logoUrl}}
        <img src="{{company.logoUrl}}" class="company-logo" alt="{{company.name}}" />
        {{else}}
        <h2>{{company.name}}</h2>
        {{/if}}
        <p>
          {{company.address}}<br />
          Phone: {{company.phone}} | Email: {{company.email}}<br />
          {{#if company.website}}Website: {{company.website}}<br />{{/if}} {{#if company.gst}}GST:
          {{company.gst}}{{/if}}
        </p>
      </div>
      <div style="text-align: right;">
        <div class="quote-title">QUOTATION</div>
        <p>
          <strong>Quote No:</strong> {{quote.quoteNumber}}<br />
          <strong>Date:</strong> {{quote.date}}<br />
          <strong>Valid Until:</strong> {{quote.validUntil}}
        </p>
      </div>
    </div>

    <!-- Customer Info -->
    {{#if customer}}
    <div style="margin-bottom: 20px;">
      <strong>To:</strong><br />
      {{customer.name}}<br />
      {{customer.address}}<br />
      {{#if customer.contactPerson}}Attn: {{customer.contactPerson}}<br />{{/if}} {{#if
      customer.email}}Email: {{customer.email}}{{/if}}
    </div>
    {{/if}}

    <!-- Subject -->
    <p><strong>Subject:</strong> {{quote.subject}}</p>

    <!-- BOM Info -->
    <p>
      We are pleased to submit our quotation for <strong>{{bom.name}}</strong> ({{bom.bomCode}} Rev
      {{bom.version}}):
    </p>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 8%;">Item</th>
          <th style="width: 35%;">Description</th>
          <th style="width: 10%;">Qty</th>
          <th style="width: 10%;">Unit</th>
          <th style="width: 17%;">Unit Cost</th>
          <th style="width: 20%;">Total Cost</th>
        </tr>
      </thead>
      <tbody>
        {{#each costs.items}}
        <tr>
          <td>{{itemNumber}}</td>
          <td>{{name}}{{#if description}}<br /><small>{{description}}</small>{{/if}}</td>
          <td style="text-align: center;">{{quantity}}</td>
          <td>{{unit}}</td>
          <td style="text-align: right;">{{formatCurrency unitCost}}</td>
          <td style="text-align: right;">{{formatCurrency totalCost}}</td>
        </tr>
        {{/each}} {{#if costs.services}}
        <tr class="summary-row">
          <td colspan="6">Services</td>
        </tr>
        {{#each costs.services}}
        <tr>
          <td>{{itemNumber}}</td>
          <td>{{name}}{{#if description}}<br /><small>{{description}}</small>{{/if}}</td>
          <td style="text-align: center;">{{quantity}}</td>
          <td>{{rateType}}</td>
          <td style="text-align: right;">{{formatCurrency rate}}</td>
          <td style="text-align: right;">{{formatCurrency totalCost}}</td>
        </tr>
        {{/each}} {{/if}}
      </tbody>
    </table>

    <!-- Summary Table -->
    <table style="width: 50%; margin-left: auto; margin-top: 20px;">
      <tr>
        <td><strong>Material Cost:</strong></td>
        <td style="text-align: right;">{{formatCurrency costs.summary.totalMaterialCost}}</td>
      </tr>
      <tr>
        <td><strong>Fabrication Cost:</strong></td>
        <td style="text-align: right;">{{formatCurrency costs.summary.totalFabricationCost}}</td>
      </tr>
      <tr>
        <td><strong>Service Cost:</strong></td>
        <td style="text-align: right;">{{formatCurrency costs.summary.totalServiceCost}}</td>
      </tr>
      <tr class="summary-row">
        <td><strong>Direct Cost:</strong></td>
        <td style="text-align: right;">{{formatCurrency costs.summary.totalDirectCost}}</td>
      </tr>
      <tr>
        <td>Overhead:</td>
        <td style="text-align: right;">{{formatCurrency costs.summary.overhead}}</td>
      </tr>
      <tr>
        <td>Contingency:</td>
        <td style="text-align: right;">{{formatCurrency costs.summary.contingency}}</td>
      </tr>
      <tr class="summary-row">
        <td><strong>Subtotal:</strong></td>
        <td style="text-align: right;">{{formatCurrency costs.summary.subtotal}}</td>
      </tr>
      <tr>
        <td>Profit:</td>
        <td style="text-align: right;">{{formatCurrency costs.summary.profit}}</td>
      </tr>
      <tr class="grand-total">
        <td><strong>GRAND TOTAL:</strong></td>
        <td style="text-align: right;">{{formatCurrency costs.summary.grandTotal}}</td>
      </tr>
    </table>

    <!-- Payment Terms -->
    {{#if paymentTerms}}
    <div style="margin-top: 30px;">
      <h3>Payment Terms:</h3>
      <ul>
        {{#if paymentTerms.advancePercent}}
        <li>{{paymentTerms.advancePercent}}% advance with purchase order</li>
        {{/if}} {{#each paymentTerms.milestones}}
        <li>{{this.percent}}% {{this.name}}</li>
        {{/each}} {{#if paymentTerms.finalPercent}}
        <li>{{paymentTerms.finalPercent}}% on final delivery</li>
        {{/if}}
      </ul>
    </div>
    {{/if}}

    <!-- Delivery Terms -->
    {{#if deliveryTerms}}
    <div style="margin-top: 20px;">
      <h3>Delivery Terms:</h3>
      <p>Lead Time: {{deliveryTerms.leadTime}}</p>
      {{#if deliveryTerms.shippingMethod}}
      <p>Shipping: {{deliveryTerms.shippingMethod}}</p>
      {{/if}} {{#if deliveryTerms.incoterm}}
      <p>Incoterm: {{deliveryTerms.incoterm}}</p>
      {{/if}}
    </div>
    {{/if}}

    <!-- Terms & Conditions -->
    <div class="terms">
      <h3>Terms & Conditions:</h3>
      <ol>
        {{#each termsAndConditions}}
        <li>{{this}}</li>
        {{/each}}
      </ol>
    </div>

    {{#if notes}}
    <div style="margin-top: 20px;">
      <h3>Notes:</h3>
      <p>{{notes}}</p>
    </div>
    {{/if}}

    <!-- Footer -->
    <div class="footer">
      <p>This is a computer-generated quotation and does not require a signature.</p>
      <p>{{company.name}} | {{company.phone}} | {{company.email}}</p>
    </div>
  </body>
</html>
```

**UI Integration**:

```typescript
// /apps/web/src/app/estimation/[id]/BOMEditorClient.tsx - ADD THIS

const handleGeneratePDF = async () => {
  if (!bom) return;

  try {
    setGeneratingPDF(true);

    const functions = getFunctions();
    const generatePDF = httpsCallable(functions, 'generateBOMQuotePDF');

    const result = await generatePDF({ bomId: bom.id });

    // Open download link in new tab
    window.open((result.data as { downloadUrl: string }).downloadUrl, '_blank');

    alert('PDF generated successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  } finally {
    setGeneratingPDF(false);
  }
};

// Add button:
<Button
  variant="outlined"
  startIcon={generatingPDF ? <CircularProgress size={20} /> : <PictureAsPdfIcon />}
  onClick={handleGeneratePDF}
  disabled={generatingPDF}
>
  {generatingPDF ? 'Generating...' : 'Generate Quote PDF'}
</Button>
```

**Testing Requirements**:

1. Generate PDF for simple BOM (5 items, no services) → verify layout correct
2. Generate PDF with services → verify services section rendered
3. Generate PDF with all cost components → verify summary table correct
4. Verify company logo displays if configured
5. Verify PDF stored in Firebase Storage with correct path
6. Verify signed URL expires after 7 days

**Acceptance Criteria**:

- [ ] Firebase Function generates PDF using Puppeteer
- [ ] HTML template with professional layout (header, tables, T&C)
- [ ] Handlebars helpers for currency formatting
- [ ] PDF stored in Firebase Storage (`quotes/{bomId}/...`)
- [ ] Signed download URL returned (7-day expiry)
- [ ] "Generate Quote PDF" button in BOM editor
- [ ] PDF includes: company info, BOM items, services, cost breakdown, T&C, payment/delivery terms
- [ ] Page breaks handled correctly for long BOMs
- [ ] Watermark support (optional, for drafts)

**Deployment Notes**:

```bash
# Install dependencies in functions:
cd functions
npm install puppeteer handlebars

# Deploy function:
firebase deploy --only functions:generateBOMQuotePDF
```

---

## Phase 7: Integration with Bought-Out Items (8-10 hours)

### 7.1 Link Bought-Out Items to BOM

**Objective**: Allow BOM items to reference bought-out catalog items

**Current State**:

- ⚠️ BOM items have `component.boughtOutItemId` field but it's unused
- ❌ No UI to select bought-out items
- ❌ Bought-out item costs not included in BOM summary

**Files to Modify**:

- `/apps/web/src/app/estimation/[id]/BOMEditorClient.tsx` (add bought-out item selector)
- `/apps/web/src/lib/bom/bomCalculations.ts` (calculate bought-out costs)
- `/packages/types/src/bom.ts` (ensure type consistency)

**Implementation**:

```typescript
// /apps/web/src/lib/bom/bomCalculations.ts - ADD THIS FUNCTION

export async function calculateBoughtOutItemCost(db: Firestore, item: BOMItem): Promise<Money> {
  if (!item.component.boughtOutItemId) {
    return { amount: 0, currency: 'INR' };
  }

  // Fetch bought-out item
  const boughtOutItem = await getBoughtOutItemById(db, item.component.boughtOutItemId);

  if (!boughtOutItem) {
    logger.warn('Bought-out item not found', { boughtOutItemId: item.component.boughtOutItemId });
    return { amount: 0, currency: 'INR' };
  }

  // Calculate total cost: list price × quantity
  const totalCost = boughtOutItem.pricing.listPrice.amount * item.quantity;

  return {
    amount: totalCost,
    currency: boughtOutItem.pricing.currency,
  };
}

// Update recalculateBOMSummary to include bought-out costs:
export async function recalculateBOMSummary(
  db: Firestore,
  bomId: string,
  userId: string
): Promise<void> {
  // ... existing material, fabrication, service calculations ...

  // Calculate bought-out item costs
  let totalBoughtOutCost = 0;
  for (const item of items) {
    if (item.component.boughtOutItemId) {
      const boughtOutCost = await calculateBoughtOutItemCost(db, item);
      totalBoughtOutCost += boughtOutCost.amount;
    }
  }

  const totalDirectCost =
    totalMaterialCost + totalFabricationCost + totalServiceCost + totalBoughtOutCost;

  // ... rest of calculation ...

  const summary: BOMSummary = {
    // ...
    totalBoughtOutCost: { amount: totalBoughtOutCost, currency: 'INR' },
    totalDirectCost: { amount: totalDirectCost, currency: 'INR' },
    // ...
  };
}
```

**UI Changes**:

```typescript
// /apps/web/src/app/estimation/[id]/components/AddItemDialog.tsx - NEW COMPONENT

export function AddItemDialog({ bomId, onClose, onItemAdded }: Props) {
  const [itemType, setItemType] = useState<'SHAPE' | 'BOUGHT_OUT'>('SHAPE');

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Item to BOM</DialogTitle>
      <DialogContent>
        {/* Item Type Selector */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Item Type</InputLabel>
          <Select value={itemType} onChange={(e) => setItemType(e.target.value as 'SHAPE' | 'BOUGHT_OUT')}>
            <MenuItem value="SHAPE">Shape (Fabricated)</MenuItem>
            <MenuItem value="BOUGHT_OUT">Bought-Out Item</MenuItem>
          </Select>
        </FormControl>

        {itemType === 'SHAPE' ? (
          <ShapeItemForm bomId={bomId} onSave={onItemAdded} />
        ) : (
          <BoughtOutItemForm bomId={bomId} onSave={onItemAdded} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BoughtOutItemForm({ bomId, onSave }: { bomId: string; onSave: () => void }) {
  const [selectedBoughtOutItem, setSelectedBoughtOutItem] = useState<BoughtOutItem | null>(null);
  const [quantity, setQuantity] = useState(1);

  const handleSave = async () => {
    if (!selectedBoughtOutItem) return;

    const input: CreateBOMItemInput = {
      bomId,
      name: selectedBoughtOutItem.name,
      description: selectedBoughtOutItem.description,
      component: {
        type: 'BOUGHT_OUT',
        boughtOutItemId: selectedBoughtOutItem.id,
      },
      quantity,
      unit: 'EA', // Each
    };

    await createBOMItem(db, input, user.uid);
    onSave();
  };

  return (
    <Box>
      <BoughtOutItemSelector
        onSelect={setSelectedBoughtOutItem}
        selectedItem={selectedBoughtOutItem}
      />

      {selectedBoughtOutItem && (
        <>
          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            fullWidth
            sx={{ mt: 2 }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>List Price:</strong> {formatCurrency(selectedBoughtOutItem.pricing.listPrice)}
            </Typography>
            <Typography variant="body2">
              <strong>Total Cost:</strong> {formatCurrency({
                amount: selectedBoughtOutItem.pricing.listPrice.amount * quantity,
                currency: selectedBoughtOutItem.pricing.currency,
              })}
            </Typography>
            {selectedBoughtOutItem.pricing.leadTime && (
              <Typography variant="body2">
                <strong>Lead Time:</strong> {selectedBoughtOutItem.pricing.leadTime} days
              </Typography>
            )}
          </Alert>

          <Button variant="contained" onClick={handleSave} sx={{ mt: 2 }}>
            Add to BOM
          </Button>
        </>
      )}
    </Box>
  );
}
```

**Testing Requirements**:

1. Create bought-out item (valve, ₹10,000) → verify created
2. Add bought-out item to BOM (qty 5) → verify totalBoughtOutCost = ₹50,000
3. Add both shape items and bought-out items → verify summary includes both
4. Update bought-out item price → verify BOM recalculates on next save
5. Delete bought-out item → verify BOM item shows "Item not found" warning

**Acceptance Criteria**:

- [ ] BOM item can reference bought-out item via `component.boughtOutItemId`
- [ ] "Add Item" dialog has type selector: Shape or Bought-Out
- [ ] Bought-out item selector shows catalog with search/filter
- [ ] BOM summary includes `totalBoughtOutCost`
- [ ] Bought-out items displayed in BOM items list with "Bought-Out" badge
- [ ] Cost calculated as: list price × quantity
- [ ] Lead time displayed in item details

---

## Summary & Roadmap

### Work Breakdown by Phase

| Phase | Description                 | Effort | Priority | Dependencies                |
| ----- | --------------------------- | ------ | -------- | --------------------------- |
| 1     | Complete BOM Costing        | 20-25h | HIGH     | None                        |
| 2     | Bought-Out Items Structure  | 25-30h | HIGH     | None                        |
| 3     | Service Cost Items          | 15-20h | HIGH     | Phase 1                     |
| 4     | Costing Configuration       | 10-12h | MEDIUM   | Phase 1, 3                  |
| 5     | BOM Versioning              | 15-18h | MEDIUM   | Phase 1-4                   |
| 6     | PDF Generation              | 30-35h | LOW      | Phase 1-5 (can be deferred) |
| 7     | Integration with Bought-Out | 8-10h  | MEDIUM   | Phase 2                     |

**Total: 148-180 hours**

### Recommended Implementation Order

**Week 1-2**: Foundation (45-55 hours)

- Phase 1: Complete BOM Costing (20-25h)
- Phase 2: Bought-Out Items Structure (25-30h)

**Week 3**: Costing & Services (25-32 hours)

- Phase 3: Service Cost Items (15-20h)
- Phase 4: Costing Configuration (10-12h)

**Week 4**: Versioning & Integration (23-28 hours)

- Phase 5: BOM Versioning (15-18h)
- Phase 7: Integration with Bought-Out (8-10h)

**Week 5** (Optional, can defer to Proposal module):

- Phase 6: PDF Generation (30-35h)

### Critical Path Items

These MUST be completed before Proposal module:

1. ✅ Complete BOM Costing (Phase 1) - Proposals need accurate costs
2. ✅ Bought-Out Items (Phase 2) - Proposals need to include bought-outs
3. ✅ Service Cost Items (Phase 3) - Proposals need to price services
4. ✅ Costing Configuration (Phase 4) - Proposals need overhead/profit
5. ✅ BOM Versioning (Phase 5) - Proposals lock specific BOM versions

### Nice-to-Have (Can Defer)

These can be implemented during or after Proposal module:

- PDF Generation (Phase 6) - Proposal module will have its own PDF generation
- Advanced bought-out item features (price history, vendor comparison)
- Multi-currency support (currently hardcoded to INR)
- BOM templates/cloning

### Session Handoff Checklist

If work spills over to another session, the next developer should:

1. **Read This Spec First** - All requirements are documented here
2. **Check Current State**:
   ```bash
   git status
   git log --oneline -10
   ```
3. **Verify Foundation**:
   - BOM types exist: `/packages/types/src/bom.ts`
   - BOM service exists: `/apps/web/src/lib/bom/bomService.ts`
   - BOM calculations exist: `/apps/web/src/lib/bom/bomCalculations.ts`
   - BOM UI exists: `/apps/web/src/app/estimation/*`
4. **Start with Phase 1**:
   - Modify `bomCalculations.ts` line 90-94
   - Implement `calculateFabricationCost()` function
   - Test with simple BOM
5. **Deploy Firestore Indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```
6. **Run Tests**:
   ```bash
   pnpm type-check
   pnpm lint
   pnpm --filter @vapour/web build
   ```

### Files Created/Modified Summary

**New Files** (23 total):

- `/packages/types/src/boughtOut.ts` (Phase 2)
- `/packages/types/src/costConfig.ts` (Phase 4)
- `/packages/types/src/pdf.ts` (Phase 6)
- `/apps/web/src/lib/boughtOut/boughtOutService.ts` (Phase 2)
- `/apps/web/src/lib/bom/costConfig.ts` (Phase 4)
- `/apps/web/src/app/bought-out/page.tsx` (replace, Phase 2)
- `/apps/web/src/app/bought-out/new/page.tsx` (Phase 2)
- `/apps/web/src/app/bought-out/[id]/page.tsx` (Phase 2)
- `/apps/web/src/app/company/costing/page.tsx` (Phase 4)
- `/apps/web/src/app/estimation/[id]/versions/page.tsx` (Phase 5)
- `/apps/web/src/app/estimation/[id]/components/AddItemDialog.tsx` (Phase 7)
- `/functions/src/pdf/generateBOMQuote.ts` (Phase 6)
- `/functions/src/pdf/templates/bom-quote.html` (Phase 6)

**Modified Files** (4 total):

- `/packages/types/src/bom.ts` (Phases 3, 5)
- `/apps/web/src/lib/bom/bomCalculations.ts` (Phases 1, 3, 4, 7)
- `/apps/web/src/lib/bom/bomService.ts` (Phases 3, 5)
- `/apps/web/src/app/estimation/[id]/BOMEditorClient.tsx` (Phases 3, 6, 7)

---

## Appendix A: Firestore Collection Structure

```
boms/{bomId}
  ├── items/{itemId}                  # BOM items (shapes/components)
  ├── service_items/{serviceItemId}   # Service cost items (NEW - Phase 3)
  └── revisions/{revisionId}          # Version history (NEW - Phase 5)

bought_out_items/{itemId}            # Bought-out catalog (NEW - Phase 2)

cost_configurations/{configId}       # Costing config (NEW - Phase 4)

company_settings/{entityId}          # Company info for PDF (existing)
```

---

## Appendix B: Type Dependencies Graph

```
Money (base type)
  ↓
BOMSummary
  ↓
BOM ← BOMItem ← BOMItemCostCalculation
  ↓       ↓
  ↓       ├→ Shape (from shapes DB)
  ↓       └→ Material (from materials DB)
  ↓
  ├→ BOMServiceItem (Phase 3)
  ├→ BOMRevision (Phase 5)
  └→ BOMQuotePDFData (Phase 6)

BoughtOutItem (Phase 2)
  ↓
BOMItem.component.boughtOutItemId (Phase 7)

CostConfiguration (Phase 4)
  ↓
BOMSummary.overhead/contingency/profit
```

---

## Appendix C: Testing Checklist

**Phase 1: Complete BOM Costing**

- [ ] Calculate cutting cost for plate shape
- [ ] Calculate welding cost with material difficulty multiplier
- [ ] Calculate forming cost for bent plate
- [ ] Calculate assembly cost for multi-part item
- [ ] Verify fabrication costs scale with quantity
- [ ] Verify BOM summary includes `totalFabricationCost`

**Phase 2: Bought-Out Items Structure**

- [ ] Create valve with specifications
- [ ] Create pump with specifications
- [ ] Verify itemCode auto-generated (BO-2025-XXXX)
- [ ] List items filtered by category
- [ ] Update pricing, verify lastUpdated timestamp
- [ ] Soft delete item, verify isActive = false

**Phase 3: Service Cost Items**

- [ ] Add fixed-price drawing service
- [ ] Add hourly installation service
- [ ] Add per-unit inspection service
- [ ] Verify service items numbered S1, S2, S3...
- [ ] Verify BOM summary includes `totalServiceCost`
- [ ] Delete service item, verify summary recalculates

**Phase 4: Costing Configuration**

- [ ] Create cost config with overhead/contingency/profit
- [ ] Verify overhead calculation based on applicableTo setting
- [ ] Verify contingency = (direct + overhead) × rate
- [ ] Verify profit = (all) × rate
- [ ] Disable overhead, verify recalculation
- [ ] Create config with future effectiveFrom, verify not used yet

**Phase 5: BOM Versioning**

- [ ] Create BOM, make changes, create revision
- [ ] Verify version increments (1, 2, 3...)
- [ ] Verify snapshot includes full summary
- [ ] Change status DRAFT → UNDER_REVIEW, verify auto-revision
- [ ] Compare two versions, verify cost delta correct
- [ ] Approve revision, verify BOM status = APPROVED

**Phase 6: PDF Generation**

- [ ] Generate PDF for simple BOM (5 items, no services)
- [ ] Generate PDF with services section
- [ ] Generate PDF with full cost breakdown
- [ ] Verify company logo displays
- [ ] Verify PDF stored in Firebase Storage
- [ ] Verify signed URL expires after 7 days

**Phase 7: Integration with Bought-Out**

- [ ] Add bought-out item to BOM
- [ ] Verify totalBoughtOutCost calculated
- [ ] Add mix of shape items and bought-out items
- [ ] Update bought-out item price, verify BOM updates
- [ ] Delete bought-out item, verify warning shown

---

**End of Specification**

**Document Version**: 1.0
**Total Pages**: 45
**Last Updated**: 2025-11-18
**Next Review**: After Phase 3 completion
