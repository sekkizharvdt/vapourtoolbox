import PipeSizingClient from './PipeSizingClient';

export const metadata = {
  title: 'Pipe Sizing | Thermal Calculators',
  description: 'Size pipes based on flow rate and velocity constraints using ASME B36.10 data',
};

export default function PipeSizingPage() {
  return <PipeSizingClient />;
}
