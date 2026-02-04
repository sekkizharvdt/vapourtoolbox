import MVCClient from './MVCClient';

export const metadata = {
  title: 'Mechanical Vapour Compressor | Thermal Calculators',
  description:
    'Calculate shaft power, discharge conditions, and specific energy for isentropic vapor compression',
};

export default function MVCPage() {
  return <MVCClient />;
}
