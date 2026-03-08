import VacuumSystemClient from './VacuumSystemClient';

export const metadata = {
  title: 'Vacuum System Design | Thermal Calculators',
  description:
    'Size steam ejector trains and liquid ring vacuum pumps to maintain vacuum against NCG load and air leakage.',
};

export default function VacuumSystemPage() {
  return <VacuumSystemClient />;
}
