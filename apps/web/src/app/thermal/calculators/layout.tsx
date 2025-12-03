'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewThermalCalcs } from '@vapour/constants';

export default function ThermalCalculatorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout
      permissionCheck2={canViewThermalCalcs}
      moduleName="Thermal Calculators"
      moduleId="thermal-calcs"
    >
      {children}
    </ModuleLayout>
  );
}
