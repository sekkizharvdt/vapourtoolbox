import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thermal Desalination Design | Vapour Toolbox',
  description:
    'Design calculations for thermal desalination equipment including flash chambers, evaporators, and condensers.',
};

export default function ThermalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
