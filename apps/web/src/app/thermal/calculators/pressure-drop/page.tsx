import PressureDropClient from './PressureDropClient';

export const metadata = {
  title: 'Pressure Drop | Thermal Calculators',
  description: 'Calculate pressure drop in piping systems using Darcy-Weisbach equation',
};

export default function PressureDropPage() {
  return <PressureDropClient />;
}
