'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewBoughtOutDB } from '@vapour/constants';

export default function BoughtOutLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout
      permissionCheck2={canViewBoughtOutDB}
      moduleName="Bought Out Items"
      moduleId="bought-out-database"
    >
      {children}
    </ModuleLayout>
  );
}
