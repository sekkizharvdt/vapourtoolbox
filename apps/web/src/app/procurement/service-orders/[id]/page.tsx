import ServiceOrderDetailClient from './ServiceOrderDetailClient';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <ServiceOrderDetailClient />;
}
