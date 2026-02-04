import TVCClient from './TVCClient';

export const metadata = {
  title: 'Thermo Vapour Compressor | Thermal Calculators',
  description:
    'Calculate entrainment ratio, flows, and energy balance for steam ejectors in MED desalination',
};

export default function TVCPage() {
  return <TVCClient />;
}
