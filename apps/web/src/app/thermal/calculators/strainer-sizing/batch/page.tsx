import BatchStrainerClient from './BatchStrainerClient';

export const metadata = {
  title: 'Batch Strainer Sizing | Thermal Calculators',
  description:
    'Size multiple strainers at once — mesh selection and pressure drop at clean and 50% clogged conditions.',
};

export default function BatchStrainerPage() {
  return <BatchStrainerClient />;
}
