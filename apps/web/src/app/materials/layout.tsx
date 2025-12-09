'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

export default function MaterialsLayout({ children }: { children: React.ReactNode }) {
  // Material Database is open to all users - no permission check required
  return (
    <ModuleLayout moduleName="Material Database" moduleId="material-database">
      {children}
    </ModuleLayout>
  );
}
