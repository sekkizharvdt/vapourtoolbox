'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';

// Check permissions - require MANAGE_USERS or VIEW_USERS
function canAccessUsers(permissions: number): boolean {
  const canManageUsers = hasPermission(permissions, PERMISSION_FLAGS.MANAGE_USERS);
  const canViewUsers = hasPermission(permissions, PERMISSION_FLAGS.VIEW_USERS);
  return canManageUsers || canViewUsers;
}

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canAccessUsers} moduleName="User Management">
      {children}
    </ModuleLayout>
  );
}
