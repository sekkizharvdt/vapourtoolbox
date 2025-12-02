import HeatDutyClient from './HeatDutyClient';

export const metadata = {
  title: 'Heat Duty Calculator | Thermal Calculators',
  description: 'Calculate sensible and latent heat duty with LMTD for heat exchangers',
};

export default function HeatDutyPage() {
  return <HeatDutyClient />;
}
