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
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Switch,
  FormControlLabel,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { addDays } from 'date-fns';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { createMinimalProposal } from '@/lib/proposals/proposalService';
import type { Enquiry, EngagementType, CurrencyCode } from '@vapour/types';
import { ENGAGEMENT_TYPE_LABELS, ENGAGEMENT_TYPE_ORDER, CURRENCIES } from '@vapour/constants';

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
  const [engagementType, setEngagementType] = useState<EngagementType | ''>('');
  const [nativeCurrency, setNativeCurrency] = useState<CurrencyCode>('INR');
  const [showSecondaryCurrency, setShowSecondaryCurrency] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>('USD');
  const [displayFxRate, setDisplayFxRate] = useState<string>('');

  const [title, setTitle] = useState('');
  const [validityDate, setValidityDate] = useState<Date | null>(addDays(new Date(), 30));
  const [notes, setNotes] = useState('');

  // Pre-fill title when enquiry changes
  useEffect(() => {
    if (enquiry) {
      setTitle(enquiry.title);
    }
  }, [enquiry]);

  const resetForm = () => {
    setEngagementType('');
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
    if (!engagementType) {
      setError('Pick the kind of work this proposal is for.');
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
          engagementType,
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

          {/* Engagement type picker */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              What kind of work is this?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Pick the closest match — you can refine the scope and pricing later.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                gap: 1.5,
              }}
            >
              {ENGAGEMENT_TYPE_ORDER.map((key) => {
                const label = ENGAGEMENT_TYPE_LABELS[key];
                const selected = engagementType === key;
                return (
                  <Card
                    key={key}
                    variant="outlined"
                    sx={{
                      borderColor: selected ? 'primary.main' : 'divider',
                      borderWidth: selected ? 2 : 1,
                      bgcolor: selected ? 'action.selected' : 'background.paper',
                      transition: 'all 120ms ease',
                    }}
                  >
                    <CardActionArea onClick={() => setEngagementType(key)} sx={{ height: '100%' }}>
                      <CardContent sx={{ py: 1.75 }}>
                        <Typography variant="subtitle2">{label.title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {label.description}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>
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
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create proposal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
