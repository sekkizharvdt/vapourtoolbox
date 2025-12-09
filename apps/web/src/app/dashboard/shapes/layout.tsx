'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

export default function ShapesLayout({ children }: { children: React.ReactNode }) {
  // Shape Database is open to all users - no permission check required
  return (
    <ModuleLayout moduleName="Shape Database" moduleId="shape-database">
      {children}
    </ModuleLayout>
  );
}
