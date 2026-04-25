'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Alert,
  Typography,
  Stack,
  Switch,
  FormControlLabel,
  InputAdornment,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { addDays } from 'date-fns';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { createMinimalProposal } from '@/lib/proposals/proposalService';
import type { Enquiry, CurrencyCode } from '@vapour/types';
import { ENGAGEMENT_TYPE_LABELS, CURRENCIES } from '@vapour/constants';

interface CreateProposalDialogProps {
  open: boolean;
  onClose: () => void;
  enquiry: Enquiry;
  onSuccess: (proposalId: string) => void;
}

const CURRENCY_OPTIONS: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'];

export function CreateProposalDialog({
  open,
  onClose,
  enquiry,
  onSuccess,
}: CreateProposalDialogProps) {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Form state
  const [nativeCurrency, setNativeCurrency] = useState<CurrencyCode>('INR');
  const [showSecondaryCurrency, setShowSecondaryCurrency] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>('USD');
  const [displayFxRate, setDisplayFxRate] = useState<string>('');

  const [title, setTitle] = useState('');
  const [validityDate, setValidityDate] = useState<Date | null>(addDays(new Date(), 30));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (enquiry) {
      setTitle(enquiry.title);
    }
  }, [enquiry]);

  const inheritedTypeLabel = enquiry.engagementType
    ? ENGAGEMENT_TYPE_LABELS[enquiry.engagementType].title
    : null;

  const resetForm = () => {
    setNativeCurrency('INR');
    setShowSecondaryCurrency(false);
    setDisplayCurrency('USD');
    setDisplayFxRate('');
    setTitle(enquiry?.title || '');
    setValidityDate(addDays(new Date(), 30));
    setNotes('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!enquiry.engagementType) {
      setError('Set the type of work on the enquiry before creating a proposal.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a proposal title.');
      return;
    }
    if (!validityDate) {
      setError('Please pick a validity date.');
      return;
    }
    if (showSecondaryCurrency) {
      if (displayCurrency === nativeCurrency) {
        setError('Pick a different secondary currency from your quote currency.');
        return;
      }
      const rate = parseFloat(displayFxRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        setError('Enter a positive exchange rate for the secondary currency.');
        return;
      }
    }
    if (!db || !user?.uid) {
      setError('Authentication required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const proposal = await createMinimalProposal(
        db,
        {
          tenantId: enquiry.tenantId,
          enquiryId: enquiry.id,
          title: title.trim(),
          clientId: enquiry.clientId,
          validityDate,
          notes: notes.trim() || undefined,
          nativeCurrency,
          ...(showSecondaryCurrency && {
            displayCurrency,
            displayFxRate: parseFloat(displayFxRate),
          }),
        },
        user.uid
      );

      onSuccess(proposal.id);
      handleClose();
      router.push(`/proposals/${proposal.id}`);
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const nativeSymbol = CURRENCIES[nativeCurrency].symbol;
  const displaySymbol = CURRENCIES[displayCurrency].symbol;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Start a new proposal
        <Typography variant="body2" color="text.secondary">
          From enquiry {enquiry.enquiryNumber} — {enquiry.clientName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={4} sx={{ pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Inherited type of work */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Type of work
            </Typography>
            {inheritedTypeLabel ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={inheritedTypeLabel} color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Inherited from the enquiry. Edit it on the enquiry if it needs to change.
                </Typography>
              </Stack>
            ) : (
              <Alert severity="warning" sx={{ mt: 0.5 }}>
                This enquiry doesn&apos;t have a type of work yet. Open the enquiry, set it, then
                come back.
              </Alert>
            )}
          </Box>

          {/* Currency */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              Quote currency
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The currency you&apos;ll quote the customer in. Your internal costs stay in INR
              regardless.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <TextField
                select
                label="Quote currency"
                value={nativeCurrency}
                onChange={(e) => setNativeCurrency(e.target.value as CurrencyCode)}
                sx={{ minWidth: 200 }}
              >
                {CURRENCY_OPTIONS.map((code) => (
                  <MenuItem key={code} value={code}>
                    {CURRENCIES[code].symbol} {code} — {CURRENCIES[code].name}
                  </MenuItem>
                ))}
              </TextField>

              <FormControlLabel
                control={
                  <Switch
                    checked={showSecondaryCurrency}
                    onChange={(e) => setShowSecondaryCurrency(e.target.checked)}
                  />
                }
                label="Also show on the PDF in another currency"
                sx={{ pt: 1 }}
              />
            </Stack>

            {showSecondaryCurrency && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                <TextField
                  select
                  label="Secondary currency"
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value as CurrencyCode)}
                  sx={{ minWidth: 200 }}
                >
                  {CURRENCY_OPTIONS.filter((c) => c !== nativeCurrency).map((code) => (
                    <MenuItem key={code} value={code}>
                      {CURRENCIES[code].symbol} {code} — {CURRENCIES[code].name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Exchange rate"
                  value={displayFxRate}
                  onChange={(e) => setDisplayFxRate(e.target.value)}
                  type="number"
                  inputProps={{ step: 'any', min: 0 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">{`1 ${nativeSymbol} =`}</InputAdornment>
                    ),
                    endAdornment: <InputAdornment position="end">{displaySymbol}</InputAdornment>,
                  }}
                  helperText={
                    displayFxRate && parseFloat(displayFxRate) > 0
                      ? `i.e. 1 ${displayCurrency} ≈ ${(1 / parseFloat(displayFxRate)).toFixed(4)} ${nativeCurrency}`
                      : 'Snapshot used for the PDF — held steady after creation.'
                  }
                  sx={{ minWidth: 280 }}
                />
              </Stack>
            )}
          </Box>

          {/* Title + validity + notes */}
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              required
              label="Proposal title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              helperText="Pre-filled from the enquiry — edit if you'd like."
            />

            <DatePicker
              label="Valid until"
              value={validityDate}
              onChange={(date) => setValidityDate(date)}
              format="dd/MM/yyyy"
              minDate={new Date()}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  helperText: 'How long the offer stands for the customer.',
                },
              }}
            />

            <TextField
              fullWidth
              label="Initial notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              helperText="Anything you'd like to remember about this proposal."
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !inheritedTypeLabel}
        >
          {submitting ? 'Creating…' : 'Create proposal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
