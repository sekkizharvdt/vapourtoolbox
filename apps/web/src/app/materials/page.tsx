'use client';

import { useState, useEffect } from 'react';
import {
  Layers as PlatesIcon,
  Circle as PipesIcon,
  ViewInAr as StructuralIcon,
  Architecture as FittingsIcon,
  Build as FastenersIcon,
  Cake as FlangesIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { MaterialCategory as MC } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';

const logger = createLogger({ context: 'MaterialsPage' });

// Define counts type with module IDs as keys
interface MaterialCounts {
  plates: number;
  pipes: number;
  fittings: number;
  flanges: number;
}

export default function MaterialsPage() {
  const { db } = getFirebase();
  const [counts, setCounts] = useState<MaterialCounts>({
    plates: 0,
    pipes: 0,
    fittings: 0,
    flanges: 0,
  });
  const [loading, setLoading] = useState(true);

  // Load material counts
  useEffect(() => {
    async function loadCounts() {
      if (!db) return;

      try {
        const plateCategories = [
          MC.PLATES_CARBON_STEEL,
          MC.PLATES_STAINLESS_STEEL,
          MC.PLATES_DUPLEX_STEEL,
          MC.PLATES_ALLOY_STEEL,
        ];

        const pipeCategories = [
          MC.PIPES_CARBON_STEEL,
          MC.PIPES_STAINLESS_304L,
          MC.PIPES_STAINLESS_316L,
        ];

        const platesQuery = query(
          collection(db, COLLECTIONS.MATERIALS),
          where('category', 'in', plateCategories),
          where('isActive', '==', true)
        );

        const pipesQuery = query(
          collection(db, COLLECTIONS.MATERIALS),
          where('category', 'in', pipeCategories),
          where('isActive', '==', true)
        );

        const fittingsQuery = query(
          collection(db, COLLECTIONS.MATERIALS),
          where('category', '==', MC.FITTINGS_BUTT_WELD)
        );

        const flangesQuery = query(
          collection(db, COLLECTIONS.MATERIALS),
          where('category', 'in', [MC.FLANGES_WELD_NECK, MC.FLANGES_SLIP_ON, MC.FLANGES_BLIND])
        );

        // Execute all queries in parallel
        const [platesSnapshot, pipesSnapshot, fittingsSnapshot, flangesSnapshot] =
          await Promise.all([
            getCountFromServer(platesQuery),
            getCountFromServer(pipesQuery),
            getCountFromServer(fittingsQuery),
            getCountFromServer(flangesQuery),
          ]);

        setCounts({
          plates: platesSnapshot.data().count,
          pipes: pipesSnapshot.data().count,
          fittings: fittingsSnapshot.data().count,
          flanges: flangesSnapshot.data().count,
        });
      } catch (error) {
        logger.error('Error loading material counts', { error });
      } finally {
        setLoading(false);
      }
    }

    loadCounts();
  }, [db]);

  const modules: ModuleItem[] = [
    {
      id: 'plates',
      title: 'Plates',
      description:
        'Carbon Steel, Stainless Steel, Duplex, and Alloy plates with thickness variants',
      icon: <PlatesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/plates',
      count: counts.plates,
      countLoading: loading,
    },
    {
      id: 'pipes',
      title: 'Pipes',
      description:
        'Carbon Steel, SS 304L, SS 316L seamless pipes with ASTM schedules (Sch 10, 40, 80)',
      icon: <PipesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/pipes',
      count: counts.pipes,
      countLoading: loading,
    },
    {
      id: 'structural-steel',
      title: 'Structural Steel',
      description: 'ISMB, ISMC, ISUA, ISLB sections and structural shapes',
      icon: <StructuralIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/structural-steel',
      comingSoon: true,
    },
    {
      id: 'fittings',
      title: 'Fittings',
      description: 'Butt weld elbows, tees, reducers, and other pipe fittings per ASME B16.9',
      icon: <FittingsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/fittings',
      count: counts.fittings,
      countLoading: loading,
    },
    {
      id: 'fasteners',
      title: 'Fasteners',
      description: 'Bolts, nuts, washers, and other fasteners with grade specifications',
      icon: <FastenersIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/fasteners',
      comingSoon: true,
    },
    {
      id: 'flanges',
      title: 'Flanges',
      description: 'Weld neck, slip-on, blind, and other flanges per ASME B16.5',
      icon: <FlangesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/flanges',
      count: counts.flanges,
      countLoading: loading,
    },
  ];

  return (
    <ModuleLandingPage
      title="Materials"
      description="Engineering materials database with technical specifications and variants"
      items={modules}
    />
  );
}
