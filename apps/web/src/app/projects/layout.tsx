'use client';

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewProjects } from '@vapour/constants';

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewProjects} moduleName="Project Management">
      {children}
    </ModuleLayout>
  );
}
