'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

/**
 * Thermal Calculators Layout
 *
 * No permission check — open to all authenticated users.
 */
export default function ThermalCalculatorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout moduleName="Thermal Calculators" moduleId="thermal-calcs">
      {children}
    </ModuleLayout>
  );
}
