import DemisterClient from './DemisterClient';

export const metadata = {
  title: 'Demister Sizing | Thermal Calculators',
  description: 'Size demister pads and mist eliminators using the Souders-Brown correlation.',
};

export default function DemisterPage() {
  return <DemisterClient />;
}
