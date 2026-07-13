/**
 * Catalog Service — the facade over the per-kind master-data services.
 *
 * Phase 2 of the catalog unification (design of record:
 * docs/reviews/2026-06-15-procurement-catalog-unification.md §3.2).
 *
 * `materials`, `bought_out_items`, and `services` stay separate collections
 * with legitimately different schemas. This module is a THIN ADAPTER
 * (rule 32): every query/write delegates to the existing materialService /
 * boughtOutService / services backends; here we only dispatch on kind and
 * map each backend's fields into the uniform `CatalogItem` view.
 *
 * Soft-delete filtering lives in the backends (all three use `isActive`):
 * - materials: searchMaterials filters isActive==true; queryMaterials is
 *   passed `isActive: true` below.
 * - bought_out_items: listBoughtOutItems is passed `isActive: true` below.
 * - services: listServices returns only isActive==true by default.
 * getCatalogItem is a direct by-ref lookup and intentionally returns the
 * item even if inactive (an existing line must still resolve its link).
 */

import type { Firestore } from 'firebase/firestore';
import type {
  Material,
  MaterialCategory,
  BoughtOutItem,
  BoughtOutCategory,
  CreateBoughtOutItemInput,
  Service,
  ServiceCategory,
  CatalogKind,
  CatalogRef,
} from '@vapour/types';
import { queryMaterials, searchMaterials } from '@/lib/materials/queries';
import { getMaterialById, createMaterial } from '@/lib/materials/crud';
import { formatMaterialSpec } from '@/lib/materials/specFormat';
import {
  listBoughtOutItems,
  getBoughtOutItemById,
  createBoughtOutItem,
} from '@/lib/boughtOut/boughtOutService';
import { listServices, getServiceById, createService } from '@/lib/services/crud';

// ============================================================================
// Uniform read view
// ============================================================================

/** Uniform read view across all catalog kinds (design §3.2). */
export interface CatalogItem {
  kind: CatalogKind;
  id: string;
  code: string;
  name: string;
  /** Kind-specific category value as a string (MaterialCategory | BoughtOutCategory | ServiceCategory). */
  category: string;
  baseUnit?: string;
  specification?: string;
}

// ============================================================================
// Per-kind → CatalogItem mappers (exported for reuse by the picker + tests)
// ============================================================================

export function materialToCatalogItem(material: Material): CatalogItem {
  const spec = formatMaterialSpec(material.specification);
  return {
    kind: 'RAW_MATERIAL',
    id: material.id,
    code: material.materialCode,
    name: material.name,
    category: material.category,
    ...(material.baseUnit && { baseUnit: material.baseUnit }),
    ...(spec && { specification: spec }),
  };
}

export function boughtOutToCatalogItem(item: BoughtOutItem): CatalogItem {
  // Bought-out specs are structured per category; the deterministic specCode
  // is the best one-line summary when present, else the free-text description.
  const spec = item.specCode || item.description;
  return {
    kind: 'BOUGHT_OUT',
    id: item.id,
    code: item.itemCode,
    name: item.name,
    category: item.category,
    ...(spec && { specification: spec }),
  };
}

export function serviceToCatalogItem(service: Service): CatalogItem {
  return {
    kind: 'SERVICE',
    id: service.id,
    code: service.serviceCode,
    name: service.name,
    category: service.category,
    ...(service.unit && { baseUnit: service.unit }),
    ...(service.description && { specification: service.description }),
  };
}

/** Denormalized reference for storing on consumer lines (rule 26). */
export function toCatalogRef(item: CatalogItem): CatalogRef {
  return { kind: item.kind, id: item.id, code: item.code, name: item.name };
}

// ============================================================================
// searchCatalog
// ============================================================================

export interface SearchCatalogOptions {
  /** Restrict to one kind; omit to search all three backends. */
  kind?: CatalogKind;
  /** Free-text query matched against code / name / description (client-side, mirroring the per-kind pickers). */
  query?: string;
  /**
   * Kind-specific category value. Category enums are per-kind, so this is
   * only meaningful together with `kind` (a foreign category simply matches
   * nothing in the other backends).
   */
  category?: string;
  /** Tenant for the bought_out_items backend. Defaults to 'default-entity'. */
  tenantId?: string;
  /** Per-kind result cap. Default 50. */
  limit?: number;
}

const ALL_KINDS: CatalogKind[] = ['RAW_MATERIAL', 'BOUGHT_OUT', 'SERVICE'];

function matchesQuery(item: CatalogItem, queryLower: string): boolean {
  return (
    item.name.toLowerCase().includes(queryLower) ||
    item.code.toLowerCase().includes(queryLower) ||
    (item.specification ?? '').toLowerCase().includes(queryLower)
  );
}

async function searchOneKind(
  db: Firestore,
  kind: CatalogKind,
  options: SearchCatalogOptions
): Promise<CatalogItem[]> {
  const { query, category, tenantId = 'default-entity', limit = 50 } = options;
  const queryLower = query?.trim().toLowerCase() ?? '';

  switch (kind) {
    case 'RAW_MATERIAL': {
      if (queryLower) {
        // searchMaterials already filters isActive==true.
        const materials = await searchMaterials(db, queryLower, limit);
        return materials
          .filter((m) => !category || m.category === category)
          .map(materialToCatalogItem);
      }
      const result = await queryMaterials(db, {
        isActive: true,
        ...(category && { categories: [category as MaterialCategory] }),
        limitResults: limit,
      });
      return result.materials.map(materialToCatalogItem);
    }

    case 'BOUGHT_OUT': {
      const items = await listBoughtOutItems(db, {
        tenantId,
        isActive: true,
        ...(category && { category: category as BoughtOutCategory }),
      });
      return items
        .map(boughtOutToCatalogItem)
        .filter((item) => !queryLower || matchesQuery(item, queryLower))
        .slice(0, limit);
    }

    case 'SERVICE': {
      const services = await listServices(db, {
        ...(category && { category: category as ServiceCategory }),
      });
      return services
        .map(serviceToCatalogItem)
        .filter((item) => !queryLower || matchesQuery(item, queryLower))
        .slice(0, limit);
    }
  }
}

/**
 * Search the catalog across one or all kinds. Fans out to the per-kind
 * backends in parallel and concatenates the mapped results (per-kind
 * ordering is preserved; each kind is capped at `limit`).
 */
export async function searchCatalog(
  db: Firestore,
  options: SearchCatalogOptions = {}
): Promise<CatalogItem[]> {
  const kinds = options.kind ? [options.kind] : ALL_KINDS;
  const perKind = await Promise.all(kinds.map((kind) => searchOneKind(db, kind, options)));
  return perKind.flat();
}

// ============================================================================
// getCatalogItem
// ============================================================================

/** Resolve a stored CatalogRef to its current backing document. */
export async function getCatalogItem(db: Firestore, ref: CatalogRef): Promise<CatalogItem | null> {
  switch (ref.kind) {
    case 'RAW_MATERIAL': {
      const material = await getMaterialById(db, ref.id);
      return material ? materialToCatalogItem(material) : null;
    }
    case 'BOUGHT_OUT': {
      const item = await getBoughtOutItemById(db, ref.id);
      return item ? boughtOutToCatalogItem(item) : null;
    }
    case 'SERVICE': {
      const service = await getServiceById(db, ref.id);
      return service ? serviceToCatalogItem(service) : null;
    }
  }
}

// ============================================================================
// createCatalogItem
// ============================================================================

/** Per-kind create payloads — exactly what the backing services accept. */
export interface CatalogCreateInputMap {
  RAW_MATERIAL: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;
  BOUGHT_OUT: CreateBoughtOutItemInput;
  /** Service payload; `tenantId` is required by the services backend. */
  SERVICE: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;
}

/**
 * Create a catalog item in the correct backing collection and return its
 * CatalogRef. Code generation (materialCode / itemCode / serviceCode) and
 * duplicate handling stay in the backend services.
 */
export async function createCatalogItem<K extends CatalogKind>(
  db: Firestore,
  kind: K,
  input: CatalogCreateInputMap[K],
  userId: string
): Promise<CatalogRef> {
  switch (kind) {
    case 'RAW_MATERIAL': {
      const created = await createMaterial(
        db,
        input as CatalogCreateInputMap['RAW_MATERIAL'],
        userId
      );
      return toCatalogRef(materialToCatalogItem(created));
    }
    case 'BOUGHT_OUT': {
      const created = await createBoughtOutItem(
        db,
        input as CatalogCreateInputMap['BOUGHT_OUT'],
        userId
      );
      return toCatalogRef(boughtOutToCatalogItem(created));
    }
    case 'SERVICE': {
      const data = input as CatalogCreateInputMap['SERVICE'];
      const created = await createService(db, data, userId, data.tenantId);
      return toCatalogRef(serviceToCatalogItem(created));
    }
    default: {
      // CatalogKind is exhaustive above; guard for unexpected runtime values.
      throw new Error(`Unknown catalog kind: ${String(kind)}`);
    }
  }
}
