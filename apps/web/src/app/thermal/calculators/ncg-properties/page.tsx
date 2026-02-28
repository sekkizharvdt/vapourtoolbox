import NCGPropertiesClient from './NCGPropertiesClient';

export const metadata = {
  title: 'NCG Properties | Thermal Calculators',
  description:
    'Calculate thermophysical properties of non-condensable gas + water vapour mixtures in thermal desalination vacuum systems.',
};

export default function NCGPropertiesPage() {
  return <NCGPropertiesClient />;
}
