import FoulingScalingClient from './FoulingScalingClient';

export const metadata = {
  title: 'Fouling & Scaling Prediction | Thermal Calculators',
  description:
    'Predict CaSO4 and CaCO3 scaling tendency in thermal desalination at various operating temperatures.',
};

export default function FoulingScalingPage() {
  return <FoulingScalingClient />;
}
