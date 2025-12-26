import TravelExpenseDetailClient from './TravelExpenseDetailClient';
import { use } from 'react';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function TravelExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TravelExpenseDetailClient key={id} reportId={id} />;
}
