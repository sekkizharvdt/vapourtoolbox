import EmployeeDetailClient from './EmployeeDetailClient';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <EmployeeDetailClient />;
}
