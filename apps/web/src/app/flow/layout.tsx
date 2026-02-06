'use client';

/**
 * Flow Layout
 *
 * Standard module layout — no workspace sidebar.
 * Flow is accessible to all users (no permission check).
 */

import { ModuleLayout } from '@/components/layouts/ModuleLayout';

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <ModuleLayout moduleName="Flow">{children}</ModuleLayout>;
}
