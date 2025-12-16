'use client';

import { Container } from '@mui/material';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { UserGuide } from '@/components/common/UserGuide';

export default function GuidePage() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <UserGuide />
      </Container>
    </AuthenticatedLayout>
  );
}
