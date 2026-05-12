import ThermalExpansionClient from './ThermalExpansionClient';

export const metadata = {
  title: 'Thermal Expansion Calculator | Thermal Calculators',
  description:
    'Calculate free thermal expansion (ΔL) and restrained thermal stress for carbon steel, stainless steel, aluminium 5052 and titanium SB 338 Gr 2.',
};

export default function ThermalExpansionPage() {
  return <ThermalExpansionClient />;
}
