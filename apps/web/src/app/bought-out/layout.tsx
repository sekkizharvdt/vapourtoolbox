'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewEstimation } from '@vapour/constants';

export default function BoughtOutLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewEstimation} moduleName="Bought-Out Items">
      {children}
    </ModuleLayout>
  );
}
