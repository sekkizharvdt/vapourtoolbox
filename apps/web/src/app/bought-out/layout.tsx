'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

export default function BoughtOutLayout({ children }: { children: React.ReactNode }) {
  // Bought Out Items is open to all users - no permission check required
  return (
    <ModuleLayout moduleName="Bought Out Items" moduleId="bought-out-database">
      {children}
    </ModuleLayout>
  );
}
