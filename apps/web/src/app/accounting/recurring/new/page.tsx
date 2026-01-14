'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Typography, Box, Breadcrumbs, Link, Alert } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { createRecurringTransaction } from '@/lib/accounting/recurringTransactionService';
import RecurringTransactionForm from '../components/RecurringTransactionForm';
import type { RecurringTransactionInput } from '@vapour/types';

export default function NewRecurringTransactionPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const hasAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  const handleSubmit = async (data: RecurringTransactionInput) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { db } = getFirebase();
      const id = await createRecurringTransaction(db, data, user.uid, user.displayName || undefined);
      router.push(`/accounting/recurring/${id}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/accounting/recurring');
  };

  if (!hasAccess) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Create Recurring Transaction
          </Typography>
          <Alert severity="error">
            You do not have permission to create recurring transactions.
          </Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/accounting"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/accounting');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Accounting
          </Link>
          <Link
            color="inherit"
            href="/accounting/recurring"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/accounting/recurring');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Recurring Transactions
          </Link>
          <Typography color="text.primary">New</Typography>
        </Breadcrumbs>

        <Typography variant="h4" component="h1" gutterBottom>
          Create Recurring Transaction
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Set up a new recurring invoice, bill, salary, or journal entry
        </Typography>

        <RecurringTransactionForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      </Box>
    </>
  );
}
