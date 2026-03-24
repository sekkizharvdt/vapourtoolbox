import MEDWizardClient from './MEDWizardClient';

export const metadata = {
  title: 'MED Plant Designer | Thermal Calculators',
  description:
    'Design a complete MED desalination plant in 4 steps. Enter steam conditions and target GOR, select effects and geometry, review and export.',
};

export default function MEDDesignerPage() {
  return <MEDWizardClient />;
}
