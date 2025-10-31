'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewAccounting } from '@vapour/constants';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewAccounting} moduleName="Accounting">
      {children}
    </ModuleLayout>
  );
}
