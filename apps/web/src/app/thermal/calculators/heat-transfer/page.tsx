import HeatTransferClient from './HeatTransferClient';

export const metadata = {
  title: 'Heat Transfer Coefficients | Thermal Calculators',
  description:
    'Calculate tube-side, condensation, and overall heat transfer coefficients for heat exchanger design',
};

export default function HeatTransferPage() {
  return <HeatTransferClient />;
}
