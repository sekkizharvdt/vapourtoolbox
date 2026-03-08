import SprayNozzleClient from './SprayNozzleClient';

export const metadata = {
  title: 'Spray Nozzle Selection | Thermal Calculators',
  description:
    'Select spray nozzles from the Spraying Systems Co. catalogue by required flow and operating pressure.',
};

export default function SprayNozzlePage() {
  return <SprayNozzleClient />;
}
