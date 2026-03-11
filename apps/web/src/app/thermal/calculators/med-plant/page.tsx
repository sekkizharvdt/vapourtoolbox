import type { Metadata } from 'next';
import MEDPlantClient from './MEDPlantClient';

export const metadata: Metadata = {
  title: 'MED Plant Design | Thermal Calculators',
  description:
    'Multi-Effect Distillation plant heat and mass balance calculator with effect-by-effect analysis, preheater integration, and final condenser sizing.',
};

export default function MEDPlantPage() {
  return <MEDPlantClient />;
}
