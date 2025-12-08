'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewThermalDesal } from '@vapour/constants';

export default function SSOTLayout({ children }: { children: React.ReactNode }) {
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
