'use client';

import { Suspense } from 'react';
import { Container, CircularProgress, Box } from '@mui/material';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { FeedbackForm } from '@/components/common/FeedbackForm';

function FeedbackContent() {
  return <FeedbackForm />;
}

export default function FeedbackPage() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          }
        >
          <FeedbackContent />
        </Suspense>
      </Container>
    </AuthenticatedLayout>
  );
}
