import type { Metadata } from 'next';
import MEDPlantClient from './MEDPlantClient';

export const metadata: Metadata = {
  title: 'MED Process Calculator | Thermal Calculators',
  description:
    'MED process heat and mass balance — steam flow in, GOR and distillate out. Per-effect tube/shell side balance with preheater integration.',
};

export default function MEDPlantPage() {
  return <MEDPlantClient />;
}
