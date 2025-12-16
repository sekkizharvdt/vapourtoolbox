/**
 * Shape Database Layout
 *
 * Pass-through layout - parent /dashboard/layout.tsx provides AuthenticatedLayout.
 * No nested ModuleLayout needed to avoid double sidebar/margin.
 */
export default function ShapesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
