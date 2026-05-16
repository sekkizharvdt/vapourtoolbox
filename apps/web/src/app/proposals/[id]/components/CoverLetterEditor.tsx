'use client';

/**
 * Cover Letter Editor
 *
 * Edits the personalised "Dear Sir, ..." page that prints right after the
 * cover. Recipient block defaults to the enquiry's contact + the client
 * name; the body is editable per deal. The user can toggle the whole page
 * off if a particular proposal doesn't need a covering letter.
 */

import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import type { Proposal, ProposalCoverLetter } from '@vapour/types';

interface CoverLetterEditorProps {
  proposalId: string;
}

const DEFAULT_BODY =
  'We are pleased to submit our techno-commercial proposal as requested.\n\n' +
  'The commercial summary, delivery schedule, and applicable terms are detailed in the following sections.\n\n' +
  'In case of any clarifications, please feel free to contact us.';

function buildDefaultLetter(proposal: Proposal): ProposalCoverLetter {
  return {
    recipientName: proposal.clientContactPerson || '',
    recipientTitle: '',
    recipientCompany: proposal.clientName || '',
    salutation: 'Dear Sir/Madam,',
    subject: proposal.title || '',
    body: DEFAULT_BODY,
    signOffName: '',
    included: true,
  };
}

export default function CoverLetterEditor({ proposalId }: CoverLetterEditorProps) {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [letter, setLetter] = useState<ProposalCoverLetter>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  useUnsavedChangesWarning(hasChanges);

  useEffect(() => {
    if (!db || !proposalId || proposalId === 'placeholder') return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getProposalById(db, proposalId);
        if (cancelled) return;
        if (!data) {
          setError('Proposal not found');
          return;
        }
        setProposal(data);
        setLetter(data.coverLetter ?? buildDefaultLetter(data));
      } catch (err) {
        console.error('Error loading proposal cover letter', err);
        if (!cancelled) setError('Failed to load proposal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, proposalId]);

  const update = (patch: Partial<ProposalCoverLetter>) => {
    setLetter((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!db || !user || !proposal) return;
    try {
      setSaving(true);
      setError(null);
      await updateProposal(
        db,
        proposalId,
        { coverLetter: letter },
        user.uid,
        claims?.permissions ?? 0
      );
      setHasChanges(false);
      toast.success('Cover letter saved');
    } catch (err) {
      console.error('Error saving cover letter', err);
      setError('Failed to save cover letter');
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error && !proposal) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (!proposal) {
    return <Alert severity="error">Proposal not found</Alert>;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        The covering letter prints on the page right after the cover. Recipient details default to
        the enquiry contact and the client name — edit as needed for the specific person you&apos;re
        addressing. Keep the body concise; technical detail belongs in the Scope tab.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={letter.included !== false}
                onChange={(e) => update({ included: e.target.checked })}
              />
            }
            label="Include cover letter on the customer PDF"
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Recipient
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Name"
              value={letter.recipientName ?? ''}
              onChange={(e) => update({ recipientName: e.target.value })}
              disabled={letter.included === false}
            />
            <TextField
              fullWidth
              size="small"
              label="Title / Role"
              value={letter.recipientTitle ?? ''}
              onChange={(e) => update({ recipientTitle: e.target.value })}
              disabled={letter.included === false}
              placeholder="e.g. Vice President"
            />
          </Stack>
          <TextField
            fullWidth
            size="small"
            label="Company"
            value={letter.recipientCompany ?? ''}
            onChange={(e) => update({ recipientCompany: e.target.value })}
            disabled={letter.included === false}
            sx={{ mb: 3 }}
          />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Letter
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="Salutation"
              value={letter.salutation ?? ''}
              onChange={(e) => update({ salutation: e.target.value })}
              disabled={letter.included === false}
              placeholder="Dear Sir/Madam,"
            />
            <TextField
              fullWidth
              size="small"
              label="Subject"
              value={letter.subject ?? ''}
              onChange={(e) => update({ subject: e.target.value })}
              disabled={letter.included === false}
              placeholder={proposal.title}
            />
            <TextField
              fullWidth
              multiline
              minRows={5}
              maxRows={20}
              label="Body"
              value={letter.body ?? ''}
              onChange={(e) => update({ body: e.target.value })}
              disabled={letter.included === false}
              helperText="Separate paragraphs with a blank line."
            />
            <TextField
              fullWidth
              size="small"
              label="Sign-off (printed name)"
              value={letter.signOffName ?? ''}
              onChange={(e) => update({ signOffName: e.target.value })}
              disabled={letter.included === false}
              placeholder="e.g. K. Sekkizhar Prasanna"
            />
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges || proposal?.status !== 'DRAFT'}
        >
          Save Cover Letter
        </LoadingButton>
      </Box>
    </Box>
  );
}
