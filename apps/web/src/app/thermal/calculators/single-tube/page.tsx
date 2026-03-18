import SingleTubeClient from './SingleTubeClient';

export const metadata = {
  title: 'Single Tube Analysis | Thermal Calculators',
  description:
    'Analyse a single horizontal tube with vapour condensing inside and spray water evaporating outside — film thickness, HTCs, and heat & mass balance.',
};

export default function SingleTubePage() {
  return <SingleTubeClient />;
}
