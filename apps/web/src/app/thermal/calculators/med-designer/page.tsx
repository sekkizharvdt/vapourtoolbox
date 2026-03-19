import MEDDesignerClient from './MEDDesignerClient';

export const metadata = {
  title: 'MED Plant Designer | Thermal Calculators',
  description:
    'Design a complete MED desalination plant from minimal inputs. Auto-sizes effects, tube bundles, condenser, preheaters, and brine recirculation.',
};

export default function MEDDesignerPage() {
  return <MEDDesignerClient />;
}
