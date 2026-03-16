'use client';

import { useState, useEffect } from 'react';
import {
  Engineering as EngineeringIcon,
  PrecisionManufacturing as FabricationIcon,
  Science as TestingIcon,
  FactCheck as InspectionIcon,
  LocalShipping as TransportIcon,
  Construction as ErectionIcon,
  PlaylistAddCheck as CommissioningIcon,
  SupportAgent as ConsultingIcon,
  Straighten as CalibrationIcon,
  Build as MaintenanceIcon,
  School as TrainingIcon,
  MoreHoriz as OtherIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { ServiceCategory } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';

const logger = createLogger({ context: 'ServicesPage' });

type CategoryCounts = Record<ServiceCategory, number>;

const ICON_SX = { fontSize: 48, color: 'primary.main' };

const CATEGORY_CONFIG: {
  key: ServiceCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: ServiceCategory.ENGINEERING,
    title: 'Engineering',
    description: 'Engineering design, drawing generation, and technical consultancy',
    icon: <EngineeringIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.FABRICATION,
    title: 'Fabrication',
    description: 'Fabrication, machining, welding, and manufacturing services',
    icon: <FabricationIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.TESTING,
    title: 'Testing & Certification',
    description: 'Lab tests, proximate/ultimate analysis, NDT, and certification services',
    icon: <TestingIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.INSPECTION,
    title: 'Inspection & QC',
    description: 'Quality inspection, third-party inspection, and audit services',
    icon: <InspectionIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.CONSULTING,
    title: 'Consulting & Advisory',
    description: 'Technical advisory, design review, and specialist consulting',
    icon: <ConsultingIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.CALIBRATION,
    title: 'Calibration',
    description: 'Instrument calibration, gauge verification, and metrology services',
    icon: <CalibrationIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.TRANSPORTATION,
    title: 'Transportation',
    description: 'Freight, logistics, and heavy equipment transportation',
    icon: <TransportIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.ERECTION,
    title: 'Erection & Installation',
    description: 'On-site erection, piping installation, and structural assembly',
    icon: <ErectionIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.COMMISSIONING,
    title: 'Commissioning',
    description: 'Pre-commissioning, commissioning, and performance guarantee testing',
    icon: <CommissioningIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.MAINTENANCE,
    title: 'Maintenance & AMC',
    description: 'Preventive maintenance, corrective maintenance, and annual contracts',
    icon: <MaintenanceIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.TRAINING,
    title: 'Training',
    description: 'Operator training, safety training, and skill development',
    icon: <TrainingIcon sx={ICON_SX} />,
  },
  {
    key: ServiceCategory.OTHER,
    title: 'Other Services',
    description: 'Miscellaneous services not covered by other categories',
    icon: <OtherIcon sx={ICON_SX} />,
  },
];

export default function ServicesPage() {
  const { db } = getFirebase();
  const [counts, setCounts] = useState<Partial<CategoryCounts>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCounts() {
      if (!db) return;

      try {
        const col = collection(db, COLLECTIONS.SERVICES);

        const results = await Promise.all(
          CATEGORY_CONFIG.map(({ key }) =>
            getCountFromServer(
              query(col, where('category', '==', key), where('isActive', '==', true))
            )
          )
        );

        const newCounts: Partial<CategoryCounts> = {};
        CATEGORY_CONFIG.forEach(({ key }, i) => {
          newCounts[key] = results[i]?.data().count ?? 0;
        });

        setCounts(newCounts);
      } catch (error) {
        logger.error('Error loading service counts', { error });
      } finally {
        setLoading(false);
      }
    }

    loadCounts();
  }, [db]);

  const modules: ModuleItem[] = CATEGORY_CONFIG.map(({ key, title, description, icon }) => ({
    id: key,
    title,
    description,
    icon,
    path: `/services/catalog?category=${key}`,
    count: counts[key] ?? 0,
    countLoading: loading,
  }));

  return (
    <ModuleLandingPage
      title="Services"
      description="Service catalog for engineering, fabrication, lab testing, inspection, and consulting"
      items={modules}
      newAction={{
        label: 'Add New Service',
        path: '/services/new',
      }}
    />
  );
}
