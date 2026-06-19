'use client';

import { useState, useEffect } from 'react';
import {
  Layers as PlatesIcon,
  Circle as PipesIcon,
  ViewInAr as StructuralIcon,
  Architecture as FittingsIcon,
  Build as FastenersIcon,
  Cake as FlangesIcon,
  Tune as ValvesIcon,
  SettingsInputComponent as PumpsIcon,
  Speed as InstrumentsIcon,
  Science as ConsumablesIcon,
  RequestQuote as VendorOffersIcon,
  RateReview as ReviewIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { MATERIAL_MODULE_TILE_GROUPS } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';
import type { ReactNode } from 'react';

const logger = createLogger({ context: 'MaterialsPage' });

// Per-tile presentation (icon + blurb), keyed by the canonical group key from
// MATERIAL_MODULE_TILE_GROUPS. The taxonomy itself (label, route, member
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
  fittings: {
    icon: <FittingsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'Butt weld elbows, tees, reducers, and other pipe fittings per ASME B16.9',
  },
  flanges: {
    icon: <FlangesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'Weld neck, slip-on, blind, and other flanges per ASME B16.5',
  },
  valves: {
    icon: <ValvesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'Gate, Globe, Ball, Butterfly, Check, and other valves per API/ASME standards',
  },
  pumps: {
    icon: <PumpsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'Centrifugal and Positive Displacement pumps per API standards',
  },
  instruments: {
    icon: <InstrumentsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'Pressure, Temperature, Flow, Level instruments and Control Valves',
  },
  fasteners: {
    icon: <FastenersIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'Bolts, nuts, washers, studs, and screws with ASTM grade specifications',
  },
  'structural-steel': {
    icon: <StructuralIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'ISMB, ISMC, ISUA, ISLB sections and structural shapes',
  },
  consumables: {
    icon: <ConsumablesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: 'Welding consumables, paints, coatings, lubricants, and chemicals',
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

        // One count query per module tile, using the canonical category sets.
        const results = await Promise.all(
          MATERIAL_MODULE_TILE_GROUPS.map((g) =>
            getCountFromServer(query(col, where('category', 'in', g.categories)))
          )
        );

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
        MATERIAL_MODULE_TILE_GROUPS.forEach((g, i) => {
          newCounts[g.key] = results[i]?.data().count ?? 0;
        });

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
