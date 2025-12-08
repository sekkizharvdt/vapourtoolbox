'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

export default function ThermalCalculatorsLayout({ children }: { children: React.ReactNode }) {
  // Thermal Calculators is open to all users - no permission check required
  return (
    <ModuleLayout moduleName="Thermal Calculators" moduleId="thermal-calcs">
      {children}
    </ModuleLayout>
  );
}
