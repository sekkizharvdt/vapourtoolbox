/**
 * Thermal Calculators Layout
 *
 * Pass-through layout - parent /thermal/layout.tsx provides ModuleLayout.
 * No nested ModuleLayout needed to avoid double sidebar/margin.
 */
export default function ThermalCalculatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
