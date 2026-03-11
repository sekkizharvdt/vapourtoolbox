import VacuumBreakerClient from './VacuumBreakerClient';

export const metadata = {
  title: 'Vacuum Breaker Sizing | Thermal Calculators',
  description:
    'Size vacuum breaker valves for MED thermal desalination plants using HEI surface condenser methodology',
};

export default function VacuumBreakerPage() {
  return <VacuumBreakerClient />;
}
