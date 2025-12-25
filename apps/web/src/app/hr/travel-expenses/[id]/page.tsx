import TravelExpenseDetailClient from './TravelExpenseDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TravelExpenseDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <TravelExpenseDetailClient reportId={id} />;
}
