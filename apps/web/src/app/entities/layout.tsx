'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewEntities } from '@vapour/constants';

export default function EntitiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewEntities} moduleName="Entity Management">
      {children}
    </ModuleLayout>
  );
}
