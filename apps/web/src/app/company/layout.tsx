'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';

// Company settings access: SUPER_ADMIN and DIRECTOR only
function canAccessCompanySettings(permissions: number): boolean {
  // This is an admin function, so we'll be more restrictive
  // Allow if user has MANAGE_COMPANY_SETTINGS permission
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_COMPANY_SETTINGS);
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout
      permissionCheck={canAccessCompanySettings}
      moduleName="Company Settings"
    >
      {children}
    </ModuleLayout>
  );
}
