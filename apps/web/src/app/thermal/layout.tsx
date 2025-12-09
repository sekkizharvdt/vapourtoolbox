'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewThermalDesal } from '@vapour/constants';

export default function ThermalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout
      permissionCheck2={canViewThermalDesal}
      moduleName="Thermal Desalination"
      moduleId="thermal-desal"
    >
      {children}
    </ModuleLayout>
  );
}
