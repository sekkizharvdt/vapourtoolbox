import SeawaterPropertiesClient from './SeawaterPropertiesClient';

export const metadata = {
  title: 'Seawater Properties | Thermal Calculators',
  description: 'Calculate seawater thermophysical properties using MIT correlations',
};

export default function SeawaterPropertiesPage() {
  return <SeawaterPropertiesClient />;
}
