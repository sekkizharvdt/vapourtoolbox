import SteamTablesClient from './SteamTablesClient';

export const metadata = {
  title: 'Steam Tables | Thermal Calculators',
  description: 'Lookup steam and water saturation properties using IAPWS-IF97 correlations',
};

export default function SteamTablesPage() {
  return <SteamTablesClient />;
}
