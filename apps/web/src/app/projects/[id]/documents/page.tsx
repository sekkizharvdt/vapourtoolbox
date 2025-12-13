import DocumentsPageClient from './DocumentsPageClient';
import { use } from 'react';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DocumentsPageClient key={id} />;
}
