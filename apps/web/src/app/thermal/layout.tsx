'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

export default function ThermalLayout({ children }: { children: React.ReactNode }) {
  // Thermal Desalination is open to all users - no permission check required
  return (
    <ModuleLayout moduleName="Thermal Desalination" moduleId="thermal-desal">
      {children}
    </ModuleLayout>
  );
}
