'use client';

/**
 * Edit a DRAFT PO Amendment.
 *
 * Reads the amendment id from the pathname (rule 30 — useParams returns the
 * static-export placeholder), loads the amendment + its PO, and reuses the
 * shared <AmendmentForm /> seeded with the saved change set (rule 22).
 */

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, Stack, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { ArrowBack as ArrowBackIcon, Home as HomeIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, PurchaseOrderAmendment, PurchaseOrderChange } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { getAmendmentById, updateAmendment } from '@/lib/procurement/amendment';
import { getPOById } from '@/lib/procurement/purchaseOrderService';
import { AmendmentForm } from '@/components/procurement/AmendmentForm';

export default function AmendmentEditClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, claims } = useAuth();

  const [amendmentId, setAmendmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [amendment, setAmendment] = useState<PurchaseOrderAmendment | null>(null);
  const [po, setPO] = useState<PurchaseOrder | null>(null);

  // Extract the amendment id from the pathname (rule 30)
  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/procurement\/amendments\/([^/]+)\/edit/);
    const extracted = match?.[1];
    if (extracted && extracted !== 'placeholder') {
      setAmendmentId(extracted);
    }
  }, [pathname]);

  useEffect(() => {
    if (!amendmentId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { db } = getFirebase();
        const amendmentData = await getAmendmentById(db, amendmentId);
        if (!amendmentData) {
          if (!cancelled) setLoadError('Amendment not found');
          return;
        }
        const poData = await getPOById(amendmentData.purchaseOrderId);
        if (cancelled) return;
        setAmendment(amendmentData);
        setPO(poData);
      } catch (err) {
        console.error('[AmendmentEditClient] Error loading amendment:', err);
        if (!cancelled) setLoadError('Failed to load amendment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [amendmentId]);

  const handleSave = async (reason: string, changes: PurchaseOrderChange[]) => {
    if (!user || !amendmentId) return;
    setSaving(true);
    setSaveError('');
    try {
      const { db } = getFirebase();
      await updateAmendment(db, amendmentId, changes, reason, user.uid, claims?.permissions || 0);
      router.push(`/procurement/amendments/${amendmentId}`);
    } catch (err) {
      console.error('[AmendmentEditClient] Error updating amendment:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save amendment');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !amendment || !po) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{loadError || 'Amendment not found'}</Alert>
        <Button onClick={() => router.push('/procurement/amendments')} sx={{ mt: 2 }}>
          Back to Amendments
        </Button>
      </Box>
    );
  }

  // Only drafts are editable — guard the UI to match the service (rule 10).
  if (amendment.status !== 'DRAFT') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Only draft amendments can be edited. This amendment is{' '}
          {amendment.status.replace('_', ' ').toLowerCase()}.
        </Alert>
        <Button
          onClick={() => router.push(`/procurement/amendments/${amendmentId}`)}
          sx={{ mt: 2 }}
        >
          Back to Amendment
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'PO Amendments', href: '/procurement/amendments' },
            {
              label: `${amendment.purchaseOrderNumber} - #${amendment.amendmentNumber}`,
              href: `/procurement/amendments/${amendmentId}`,
            },
            { label: 'Edit' },
          ]}
        />

        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/procurement/amendments/${amendmentId}`)}
            sx={{ mb: 1 }}
          >
            Back to Amendment
          </Button>
          <Typography variant="h4" gutterBottom>
            Edit Amendment #{amendment.amendmentNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {amendment.purchaseOrderNumber} • {po.vendorName}
          </Typography>
        </Box>

        <AmendmentForm
          po={po}
          initialReason={amendment.reason}
          initialChanges={amendment.changes}
          submitting={saving}
          submitLabel="Save Changes"
          externalError={saveError}
          onCancel={() => router.push(`/procurement/amendments/${amendmentId}`)}
          onSubmit={handleSave}
        />
      </Stack>
    </Box>
  );
}
