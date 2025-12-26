import TravelExpenseDetailClient from './TravelExpenseDetailClient';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function TravelExpenseDetailPage() {
  return <TravelExpenseDetailClient />;
}
