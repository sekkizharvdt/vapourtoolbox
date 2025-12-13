import ReportsPageClient from './ReportsPageClient';
import { use } from 'react';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReportsPageClient key={id} />;
}
