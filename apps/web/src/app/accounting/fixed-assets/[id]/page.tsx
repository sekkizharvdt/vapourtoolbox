import AssetDetailClient from './AssetDetailClient';
import { use } from 'react';

// For static export, we need to provide at least one path
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AssetDetailClient key={id} />;
}
