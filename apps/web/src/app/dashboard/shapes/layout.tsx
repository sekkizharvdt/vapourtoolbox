'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewShapeDB } from '@vapour/constants';

export default function ShapesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout
      permissionCheck2={canViewShapeDB}
      moduleName="Shape Database"
      moduleId="shape-database"
    >
      {children}
    </ModuleLayout>
  );
}
