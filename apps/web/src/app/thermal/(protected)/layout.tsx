'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

// No permission check — merged into Thermal Calculators, open to all authenticated users.
export default function ThermalDesalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout moduleName="Thermal Calculators" moduleId="thermal-calcs">
      {children}
    </ModuleLayout>
  );
}
