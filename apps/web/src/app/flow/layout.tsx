'use client';

/**
 * Flow Layout
 *
 * Standard module layout — no workspace sidebar.
 * Flow is accessible to all users (no permission check).
 *
 * Carries the module's sub-navigation, because the app sidebar lists Flow as a
 * single entry: without this, Team Board / Meetings / Portfolio would only be
 * reachable from the old hub page.
 */

import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { FlowNav } from './components/FlowNav';

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout moduleName="Flow">
      <FlowNav />
      {children}
    </ModuleLayout>
  );
}
