import EditServiceClient from './EditServiceClient';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <EditServiceClient />;
}
