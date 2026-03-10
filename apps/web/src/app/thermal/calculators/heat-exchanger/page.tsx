import UnifiedHeatExchangerClient from './UnifiedHeatExchangerClient';

export const metadata = {
  title: 'Heat Exchanger Calculator | Thermal Calculators',
  description:
    'Unified heat exchanger calculator — quick heat duty, HTC analysis, and iterative sizing',
};

export default function HeatExchangerPage() {
  return <UnifiedHeatExchangerClient />;
}
