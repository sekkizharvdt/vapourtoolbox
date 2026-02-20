import SiphonSizingClient from './SiphonSizingClient';

export const metadata = {
  title: 'Siphon Sizing | Thermal Calculators',
  description:
    'Size inter-effect siphon pipes, calculate minimum U-bend height, pressure drop, and flash vapor for MED thermal desalination plants.',
};

export default function SiphonSizingPage() {
  return <SiphonSizingClient />;
}
