'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Container } from '@mui/material';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { UserGuide } from '@/components/common/UserGuide';

function GuideContent() {
  const searchParams = useSearchParams();
  const section = searchParams.get('section') || undefined;

  return <UserGuide defaultSection={section} />;
}

export default function GuidePage() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Suspense>
          <GuideContent />
        </Suspense>
      </Container>
    </AuthenticatedLayout>
  );
}
