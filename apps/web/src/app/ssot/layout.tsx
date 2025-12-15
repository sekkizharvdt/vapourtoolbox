'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewThermalDesal } from '@vapour/constants';

export default function SSOTLayout({ children }: { children: React.ReactNode }) {
  // SSOT shares permissions with Thermal Desal module (VIEW_THERMAL_DESAL = 64)
  // as configured in modules.ts requiredPermissions2
  return (
    <ModuleLayout
      permissionCheck2={canViewThermalDesal}
      moduleName="Process Data (SSOT)"
      moduleId="process-data"
    >
      {children}
    </ModuleLayout>
  );
}
