'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { AccountingFiscalYearBar } from '@/components/accounting/AccountingFiscalYearBar';
import { canViewAccounting } from '@vapour/constants';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewAccounting} moduleName="Accounting">
      <AccountingFiscalYearBar />
      {children}
    </ModuleLayout>
  );
}
