import StrainerSizingClient from './StrainerSizingClient';

export const metadata = {
  title: 'Strainer Sizing Calculator | Thermal Calculators',
  description:
    'Size Y-type and bucket-type strainers — mesh selection and pressure drop at clean and 50% clogged conditions.',
};

export default function StrainerSizingPage() {
  return <StrainerSizingClient />;
}
