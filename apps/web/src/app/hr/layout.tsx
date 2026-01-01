'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

export default function HRLayout({ children }: { children: React.ReactNode }) {
  // HR module is open to all authenticated users for basic functions
  // (My Leaves, Travel Expenses, Team Calendar, Employee Directory)
  // Advanced functions check permissions at the page level
  return <ModuleLayout moduleName="HR">{children}</ModuleLayout>;
}
