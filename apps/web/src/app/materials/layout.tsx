'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewMaterialDB } from '@vapour/constants';

export default function MaterialsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout
      permissionCheck2={canViewMaterialDB}
      moduleName="Material Database"
      moduleId="material-database"
    >
      {children}
    </ModuleLayout>
  );
}
