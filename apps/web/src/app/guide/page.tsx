'use client';

import { Container } from '@mui/material';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { UserGuide } from '@/components/common/UserGuide';

export default function GuidePage() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <UserGuide />
      </Container>
    </AuthenticatedLayout>
  );
}
