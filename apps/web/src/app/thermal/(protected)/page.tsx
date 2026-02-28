'use client';

/**
 * Thermal Desalination Module Landing Page
 *
 * Overview of available thermal desalination design calculators.
 */

import {
  Thermostat as ThermostatIcon,
  Science as ScienceIcon,
  Opacity as OpacityIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';

export default function ThermalLandingPage() {
  const modules: ModuleItem[] = [
    {
      id: 'flash-chamber',
      title: 'Flash Chamber',
      description:
        'Design flash evaporation chambers with heat/mass balance, sizing calculations, nozzle sizing, and NPSHa calculation.',
      icon: <ThermostatIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/thermal/flash-chamber',
    },
    {
      id: 'condenser',
      title: 'Condenser',
      description:
        'Design surface condensers for vapor condensation with tube layout, heat transfer, and cooling water calculations.',
      icon: <OpacityIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/thermal/condenser',
      comingSoon: true,
    },
    {
      id: 'ejector',
      title: 'Ejector',
      description:
        'Design steam ejectors for vacuum generation with entrainment ratio and performance curve calculations.',
      icon: <ScienceIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/thermal/ejector',
      comingSoon: true,
    },
  ];

  return (
    <ModuleLandingPage
      title="Thermal Desalination Design"
      description="Engineering design calculators for thermal desalination processes including Multi-Effect Distillation (MED) and Multi-Stage Flash (MSF) systems."
      items={modules}
      highlightCard={{
        title: 'Thermal Calculators',
        description:
          'Quick property lookups and engineering calculations: steam tables, seawater properties, pipe sizing, pressure drop, NPSHa, and heat duty.',
        icon: <CalculateIcon sx={{ fontSize: 40 }} />,
        path: '/thermal/calculators',
        buttonLabel: 'Open Calculators',
      }}
    />
  );
}
