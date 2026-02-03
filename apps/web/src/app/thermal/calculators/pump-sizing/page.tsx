import PumpSizingClient from './PumpSizingClient';

export const metadata = {
  title: 'Pump Sizing Calculator | Thermal Calculators',
  description:
    'Calculate total differential head, hydraulic power, and brake power for centrifugal pump sizing',
};

export default function PumpSizingPage() {
  return <PumpSizingClient />;
}
