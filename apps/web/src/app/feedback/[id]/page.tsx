import FeedbackDetailClient from './FeedbackDetailClient';
import { use } from 'react';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <FeedbackDetailClient key={id} />;
}
