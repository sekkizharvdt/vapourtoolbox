import GORClient from './GORClient';

export const metadata = {
  title: 'Performance Ratio / GOR | Thermal Calculators',
  description:
    'Estimate Gain Output Ratio (GOR) and thermal performance for MED desalination plants.',
};

export default function GORPage() {
  return <GORClient />;
}
