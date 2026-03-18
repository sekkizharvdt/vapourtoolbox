import CustomBundleClient from './CustomBundleClient';

export const metadata = {
  title: 'Custom Tube Bundle | Thermal Calculators',
  description:
    'Design a custom tube bundle — choose shell diameter, shape, pitch, and tube specs to calculate tube count and surface area.',
};

export default function CustomBundlePage() {
  return <CustomBundleClient />;
}
