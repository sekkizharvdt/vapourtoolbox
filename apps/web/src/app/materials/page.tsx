'use client';

import { useState, useEffect } from 'react';
import {
  Layers as PlatesIcon,
  Circle as PipesIcon,
  RequestQuote as VendorOffersIcon,
  RateReview as ReviewIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { MATERIAL_MODULE_TILE_GROUPS } from '@vapour/types';
import { countMaterialsByTileGroup } from '@/lib/materials/queries';
import { createLogger } from '@vapour/logger';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';
import type { ReactNode } from 'react';

const logger = createLogger({ context: 'MaterialsPage' });

// Per-tile presentation (icon + blurb), keyed by the canonical group key from
// MATERIAL_MODULE_TILE_GROUPS. Only raw material has a tile since the Aug-2026
// taxonomy split — fittings, flanges, valves, pumps, instruments, fasteners,
// structural steel and consumables are bought-out items now, and their tiles
// opened onto empty lists (feedback huqiaePA). The taxonomy itself (label, route, member
// categories) is canonical in @vapour/types — only the visuals live here, so
// the picker and this module can never drift on which categories exist
// (feedback Jit9v).
const TILE_PRESENTATION: Record<string, { icon: ReactNode; description: string }> = {
  plates: {
    icon: <PlatesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'Carbon Steel, Stainless Steel, Duplex, and Alloy plates with thickness variants',
  },
  pipes: {
    icon: <PipesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description:
      'Carbon Steel, SS 304L, SS 316L seamless pipes with ASTM schedules (Sch 10, 40, 80)',
  },
};

export default function MaterialsPage() {
  const { db } = getFirebase();
  // Keyed by canonical group key (e.g. 'plates', 'structural-steel') + the two
  // special tiles 'vendorOffers' / 'needsReview'.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCounts() {
      if (!db) return;

      try {
        const col = collection(db, COLLECTIONS.MATERIALS);

        // Shared with the PR/Quote picker so the two can't show different
        // numbers for the same tile (feedback huqiaePA959XRjGnHwwq).
        const groupCounts = await countMaterialsByTileGroup(db, MATERIAL_MODULE_TILE_GROUPS);

        // Vendor quotes — materials-side tile shows STANDING_QUOTE only.
        const voQuery = query(
          collection(db, COLLECTIONS.VENDOR_QUOTES),
          where('sourceType', '==', 'STANDING_QUOTE'),
          where('isActive', '==', true)
        );
        const voCount = await getCountFromServer(voQuery);

        // AI-auto-created records waiting for human review of the spec.
        const reviewQuery = query(col, where('needsReview', '==', true));
        const reviewCount = await getCountFromServer(reviewQuery);

        const newCounts: Record<string, number> = {
          vendorOffers: voCount.data().count ?? 0,
          needsReview: reviewCount.data().count ?? 0,
        };
        Object.assign(newCounts, groupCounts);

        setCounts(newCounts);
      } catch (error) {
        logger.error('Error loading material counts', { error });
      } finally {
        setLoading(false);
      }
    }

    loadCounts();
  }, [db]);

  // Category tiles are derived from the canonical group registry so they always
  // match the picker. Presentation (icon/blurb) comes from TILE_PRESENTATION.
  const categoryTiles: ModuleItem[] = MATERIAL_MODULE_TILE_GROUPS.map((g) => {
    const presentation = TILE_PRESENTATION[g.key];
    return {
      id: g.key,
      title: g.label,
      description: presentation?.description ?? '',
      icon: presentation?.icon,
      path: g.moduleRoute,
      count: counts[g.key] ?? 0,
      countLoading: loading,
    };
  });

  const modules: ModuleItem[] = [
    ...categoryTiles,
    {
      id: 'quotes',
      title: 'Quotes',
      description:
        'Vendor quotes — RFQ replies, offline quotes, unsolicited offers, and standing rate cards',
      icon: <VendorOffersIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/quotes',
      count: counts.vendorOffers,
      countLabel: 'quotes',
      countLoading: loading,
    },
    {
      id: 'needs-review',
      title: 'Needs Review',
      description:
        'AI-auto-created materials from PR / quote imports. Open each to normalize the spec and clear the review flag.',
      icon: <ReviewIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
      path: '/materials/needs-review',
      count: counts.needsReview,
      countLabel: 'pending',
      countLoading: loading,
    },
  ];

  return (
    <ModuleLandingPage
      title="Materials"
      description="Engineering materials database with technical specifications and variants"
      items={modules}
      newAction={{
        label: 'Add New Material',
        path: '/materials/new',
      }}
    />
  );
}
