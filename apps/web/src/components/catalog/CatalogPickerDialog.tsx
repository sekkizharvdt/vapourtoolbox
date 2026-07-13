'use client';

/**
 * CatalogPickerDialog — one picker for every procurable kind.
 *
 * Phase 2 of the catalog unification (design of record:
 * docs/reviews/2026-06-15-procurement-catalog-unification.md §3.3): a single
 * dialog with the catalog kind as tabs (Materials / Bought-Out / Services).
 *
 * Per the design, it initially HOSTS the existing per-kind pickers as tab
 * content — MaterialPickerDialog keeps its category drill-down / variant
 * handling, and all three keep their search, category filters, and inline
 * "Create New" forms (including duplicate detection). This component owns
 * the kind tabs (injected via each picker's `headerSlot`) and normalizes
 * every selection into a `CatalogRef` + `CatalogItem` via the catalogService
 * mappers, so consumers never branch on "which collection" again.
 *
 * Stage 2 absorbs the per-kind list UIs into one list backed by
 * `searchCatalog`, then retires the standalone picker call sites.
 */

import { useEffect, useState } from 'react';
import { Tab, Tabs } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import MaterialPickerDialog from '@/components/materials/MaterialPickerDialog';
import BoughtOutPickerDialog from '@/components/boughtOut/BoughtOutPickerDialog';
import ServicePickerDialog from '@/components/services/ServicePickerDialog';
import {
  materialToCatalogItem,
  boughtOutToCatalogItem,
  serviceToCatalogItem,
  toCatalogRef,
  type CatalogItem,
} from '@/lib/catalog/catalogService';
import type {
  CatalogKind,
  CatalogRef,
  Material,
  MaterialVariant,
  BoughtOutItem,
  Service,
} from '@vapour/types';

/** Kind-specific backing document for consumers that need fields beyond CatalogItem. */
export type CatalogSelectionSource =
  | { kind: 'RAW_MATERIAL'; material: Material; variant?: MaterialVariant; fullCode?: string }
  | { kind: 'BOUGHT_OUT'; boughtOutItem: BoughtOutItem }
  | { kind: 'SERVICE'; service: Service };

export interface CatalogSelection {
  /** Denormalized reference to store on the consumer line (rule 26). */
  ref: CatalogRef;
  /** Uniform read view of the selected item. */
  item: CatalogItem;
  /** The full backing document, discriminated by kind. */
  source: CatalogSelectionSource;
}

interface CatalogPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fires on selection (including after an inline create). Parent closes the dialog. */
  onSelect: (selection: CatalogSelection) => void;
  /** Tab shown when the dialog opens. Defaults to RAW_MATERIAL. */
  defaultKind?: CatalogKind;
  /**
   * Restrict the offered kinds (tab set). Omit for all three. E.g. the BOM
   * bought-out flow passes ['BOUGHT_OUT', 'RAW_MATERIAL'] — a service can't
   * be a physical BOM component.
   */
  kinds?: CatalogKind[];
  /**
   * Pre-fill for the Services tab's inline "Create new service" form —
   * passed through to ServicePickerDialog (the quote intake page seeds it
   * from the AI-parsed row's description/unit/price).
   */
  serviceCreateDefaults?: {
    name?: string;
    unit?: string;
    defaultRateValue?: number;
  };
}

const KIND_TABS: Array<{ kind: CatalogKind; label: string }> = [
  { kind: 'RAW_MATERIAL', label: 'Materials' },
  { kind: 'BOUGHT_OUT', label: 'Bought-Out' },
  { kind: 'SERVICE', label: 'Services' },
];

export default function CatalogPickerDialog({
  open,
  onClose,
  onSelect,
  defaultKind = 'RAW_MATERIAL',
  kinds,
  serviceCreateDefaults,
}: CatalogPickerDialogProps) {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId || 'default-entity';

  const visibleTabs =
    kinds && kinds.length > 0 ? KIND_TABS.filter((tab) => kinds.includes(tab.kind)) : KIND_TABS;
  // If the requested default kind isn't offered, fall back to the first tab.
  const initialKind = visibleTabs.some((tab) => tab.kind === defaultKind)
    ? defaultKind
    : (visibleTabs[0]?.kind ?? 'RAW_MATERIAL');

  const [kind, setKind] = useState<CatalogKind>(initialKind);

  // Re-sync the active tab each time the dialog opens — it may be opened for
  // a different row with a different default kind (rule 14b).
  useEffect(() => {
    if (open) {
      setKind(initialKind);
    }
  }, [open, initialKind]);

  const tabs = (
    <Tabs
      value={kind}
      onChange={(_event, value) => setKind(value as CatalogKind)}
      sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
    >
      {visibleTabs.map((tab) => (
        <Tab key={tab.kind} value={tab.kind} label={tab.label} />
      ))}
    </Tabs>
  );

  const handleMaterialSelect = (
    material: Material,
    variant?: MaterialVariant,
    fullCode?: string
  ) => {
    const item = materialToCatalogItem(material);
    onSelect({
      ref: toCatalogRef(item),
      item,
      source: {
        kind: 'RAW_MATERIAL',
        material,
        ...(variant && { variant }),
        ...(fullCode && { fullCode }),
      },
    });
  };

  const handleBoughtOutSelect = (boughtOutItem: BoughtOutItem) => {
    const item = boughtOutToCatalogItem(boughtOutItem);
    onSelect({ ref: toCatalogRef(item), item, source: { kind: 'BOUGHT_OUT', boughtOutItem } });
  };

  const handleServiceSelect = (service: Service) => {
    const item = serviceToCatalogItem(service);
    onSelect({ ref: toCatalogRef(item), item, source: { kind: 'SERVICE', service } });
  };

  return (
    <>
      <MaterialPickerDialog
        open={open && kind === 'RAW_MATERIAL'}
        onClose={onClose}
        onSelect={handleMaterialSelect}
        title="Select Material"
        // Line-item consumers link at material level; variant-aware consumers
        // (stage 2: Quotes/BOM) can lift this into a prop when they migrate.
        requireVariantSelection={false}
        headerSlot={tabs}
      />
      <BoughtOutPickerDialog
        open={open && kind === 'BOUGHT_OUT'}
        onClose={onClose}
        onSelect={handleBoughtOutSelect}
        tenantId={tenantId}
        title="Select Bought-Out Item"
        headerSlot={tabs}
      />
      <ServicePickerDialog
        open={open && kind === 'SERVICE'}
        onClose={onClose}
        onSelect={handleServiceSelect}
        createDefaults={serviceCreateDefaults}
        headerSlot={tabs}
      />
    </>
  );
}
