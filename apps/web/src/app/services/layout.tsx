'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  // Service Catalog is open to all users - no permission check required
  return (
    <ModuleLayout moduleName="Services" moduleId="service-catalog">
      {children}
    </ModuleLayout>
  );
}
