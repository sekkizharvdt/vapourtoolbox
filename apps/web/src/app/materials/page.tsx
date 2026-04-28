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
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { MaterialCategory as MC } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';

const logger = createLogger({ context: 'MaterialsPage' });

interface MaterialCounts {
  plates: number;
  pipes: number;
  fittings: number;
  flanges: number;
  valves: number;
  pumps: number;
  instruments: number;
  fasteners: number;
  structural: number;
  consumables: number;
  vendorOffers: number;
}

const VALVE_CATEGORIES = [
  MC.VALVE_GATE,
  MC.VALVE_GLOBE,
  MC.VALVE_BALL,
  MC.VALVE_BUTTERFLY,
  MC.VALVE_CHECK,
  MC.VALVE_OTHER,
];
const PUMP_CATEGORIES = [MC.PUMP_CENTRIFUGAL, MC.PUMP_POSITIVE_DISPLACEMENT];
const INSTRUMENT_CATEGORIES = [
  MC.INSTRUMENT_PRESSURE_GAUGE,
  MC.INSTRUMENT_TEMPERATURE_SENSOR,
  MC.INSTRUMENT_FLOW_METER,
  MC.INSTRUMENT_LEVEL_TRANSMITTER,
  MC.INSTRUMENT_CONTROL_VALVE,
  MC.INSTRUMENT_OTHER,
];
const FASTENER_CATEGORIES = [
  MC.FASTENERS_BOLTS,
  MC.FASTENERS_NUTS,
  MC.FASTENERS_WASHERS,
  MC.FASTENERS_BOLT_NUT_WASHER_SETS,
  MC.FASTENERS_STUDS,
  MC.FASTENERS_SCREWS,
];
const CONSUMABLE_CATEGORIES = [
  MC.WELDING_CONSUMABLES,
  MC.PAINTS_COATINGS,
  MC.LUBRICANTS,
  MC.CHEMICALS,
];

export default function MaterialsPage() {
  const { db } = getFirebase();
  const [counts, setCounts] = useState<MaterialCounts>({
    plates: 0,
    pipes: 0,
    fittings: 0,
    flanges: 0,
    valves: 0,
    pumps: 0,
    instruments: 0,
    fasteners: 0,
    structural: 0,
    consumables: 0,
    vendorOffers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCounts() {
      if (!db) return;

      try {
        const col = collection(db, COLLECTIONS.MATERIALS);

        const queries = {
          plates: query(
            col,
            where('category', 'in', [
              MC.PLATES_CARBON_STEEL,
              MC.PLATES_STAINLESS_STEEL,
              MC.PLATES_DUPLEX_STEEL,
              MC.PLATES_ALLOY_STEEL,
            ])
          ),
          pipes: query(
            col,
            where('category', 'in', [
              MC.PIPES_CARBON_STEEL,
              MC.PIPES_STAINLESS_304L,
              MC.PIPES_STAINLESS_316L,
            ])
          ),
          fittings: query(
            col,
            where('category', 'in', [
              MC.FITTINGS_BUTT_WELD,
              MC.FITTINGS_SOCKET_WELD,
              MC.FITTINGS_THREADED,
              MC.FITTINGS_FLANGED,
            ])
          ),
          flanges: query(
            col,
            where('category', 'in', [MC.FLANGES_WELD_NECK, MC.FLANGES_SLIP_ON, MC.FLANGES_BLIND])
          ),
          valves: query(col, where('category', 'in', VALVE_CATEGORIES)),
          pumps: query(col, where('category', 'in', PUMP_CATEGORIES)),
          instruments: query(col, where('category', 'in', INSTRUMENT_CATEGORIES)),
          fasteners: query(col, where('category', 'in', FASTENER_CATEGORIES)),
          structural: query(col, where('category', '==', MC.STRUCTURAL_SHAPES)),
          consumables: query(col, where('category', 'in', CONSUMABLE_CATEGORIES)),
        };

        const results = await Promise.all(Object.values(queries).map((q) => getCountFromServer(q)));

        // Vendor quotes — materials-side tile shows STANDING_QUOTE only.
        const voQuery = query(
          collection(db, COLLECTIONS.VENDOR_QUOTES),
          where('sourceType', '==', 'STANDING_QUOTE'),
          where('isActive', '==', true)
        );
        const voCount = await getCountFromServer(voQuery);

        const keys = Object.keys(queries) as (keyof MaterialCounts)[];
        const newCounts: MaterialCounts = {
          plates: 0,
          pipes: 0,
          fittings: 0,
          flanges: 0,
          valves: 0,
          pumps: 0,
          instruments: 0,
          fasteners: 0,
          structural: 0,
          consumables: 0,
          vendorOffers: voCount.data().count ?? 0,
        };
        keys.forEach((key, i) => {
          newCounts[key] = results[i]?.data().count ?? 0;
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
      id: 'fittings',
      title: 'Fittings',
      description: 'Butt weld elbows, tees, reducers, and other pipe fittings per ASME B16.9',
      icon: <FittingsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/fittings',
      count: counts.fittings,
      countLoading: loading,
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
    {
      id: 'valves',
      title: 'Valves',
      description: 'Gate, Globe, Ball, Butterfly, Check, and other valves per API/ASME standards',
      icon: <ValvesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/valves',
      count: counts.valves,
      countLoading: loading,
    },
    {
      id: 'pumps',
      title: 'Pumps',
      description: 'Centrifugal and Positive Displacement pumps per API standards',
      icon: <PumpsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/pumps',
      count: counts.pumps,
      countLoading: loading,
    },
    {
      id: 'instruments',
      title: 'Instruments',
      description: 'Pressure, Temperature, Flow, Level instruments and Control Valves',
      icon: <InstrumentsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/instruments',
      count: counts.instruments,
      countLoading: loading,
    },
    {
      id: 'fasteners',
      title: 'Fasteners',
      description: 'Bolts, nuts, washers, studs, and screws with ASTM grade specifications',
      icon: <FastenersIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/fasteners',
      count: counts.fasteners,
      countLoading: loading,
    },
    {
      id: 'structural-steel',
      title: 'Structural Steel',
      description: 'ISMB, ISMC, ISUA, ISLB sections and structural shapes',
      icon: <StructuralIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/structural-steel',
      count: counts.structural,
      countLoading: loading,
    },
    {
      id: 'consumables',
      title: 'Consumables',
      description: 'Welding consumables, paints, coatings, lubricants, and chemicals',
      icon: <ConsumablesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/consumables',
      count: counts.consumables,
      countLoading: loading,
    },
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
