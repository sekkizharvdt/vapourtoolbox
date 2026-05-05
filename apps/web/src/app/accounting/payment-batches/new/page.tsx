'use client';

// rule28-exempt: thin redirect page — auto-creates a DRAFT batch and routes
// to the detail page where receipts/payments are added via dialogs. No form
// fields here; the bank account placeholder mirrors the existing flow.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { createPaymentBatch } from '@/lib/accounting/paymentBatchService';

export default function NewPaymentBatchPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const hasManageAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  useEffect(() => {
    if (!user || startedRef.current) return;
    if (!hasManageAccess) {
      setError('You do not have permission to create payment batches.');
      return;
    }
    startedRef.current = true;

    (async () => {
      try {
        const { db } = getFirebase();
        const batch = await createPaymentBatch(
          db,
          {
            bankAccountId: 'primary-bank',
            bankAccountName: 'Primary Bank Account',
            ...(claims?.tenantId ? { tenantId: claims.tenantId } : {}),
          },
          user.uid
        );
        router.replace(`/accounting/payment-batches/${batch.id}`);
      } catch (err) {
        startedRef.current = false;
        setError(err instanceof Error ? err.message : 'Failed to create payment batch.');
      }
    })();
  }, [user, hasManageAccess, claims?.tenantId, router]);

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">Creating new payment batch…</Typography>
    </Box>
  );
}
