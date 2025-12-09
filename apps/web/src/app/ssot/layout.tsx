'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewSSOT } from '@vapour/constants';

export default function SSOTLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout
      permissionCheck2={canViewSSOT}
      moduleName="Process Data (SSOT)"
      moduleId="process-data"
    >
      {children}
    </ModuleLayout>
  );
}
