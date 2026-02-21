import NPSHaClient from './NPSHaClient';

export const metadata = {
  title: 'Suction System Designer | Thermal Calculators',
  description:
    'Design pump suction systems for vacuum vessels — pipe sizing, fitting selection, friction losses, holdup volume, and NPSHa verification.',
};

export default function NPSHaPage() {
  return <NPSHaClient />;
}
