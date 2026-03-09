import HeatExchangerClient from './HeatExchangerClient';

export const metadata = {
  title: 'Heat Exchanger Sizing | Thermal Calculators',
  description:
    'Size shell-and-tube heat exchangers — heat duty, LMTD, HTC, tube count, shell diameter',
};

export default function HeatExchangerPage() {
  return <HeatExchangerClient />;
}
