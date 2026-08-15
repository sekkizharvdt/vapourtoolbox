'use client';

/**
 * Import a project's SSOT registers from a spreadsheet.
 *
 * For the case the team raised: a basic design done by another engineering
 * house arrives as a stream table, an equipment list and a line list, and until
 * now there was no way in but typing.
 *
 * ── Why this is a separate dialog from GenerateSSOTDialog ───────────────
 * The two share everything that matters — `planSSOTSync`, `applySSOTSync` and
 * `summarisePlan` are called here unchanged, so the merge contract has one
 * implementation (rule 32). What differs is the input: a generator needs an
 * area code, a material per fluid service and an equipment tag, because it is
 * *inventing* those. An import needs none of them, because the file already
 * carries its own tags and numbering — offering those controls here would
 * imply the import applies a naming convention it deliberately does not.
 *
 * Nothing is written until the plan is approved, and the plan is shown in the
 * same terms: created, updated, left alone, orphaned.
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { LoadingState } from '@vapour/ui';
import { UploadFile as UploadFileIcon } from '@mui/icons-material';
import { useToast } from '@/components/common/Toast';
import { parseSSOTWorkbook, type SSOTImportResult } from '@/lib/ssot/ssotImport';
import {
  planSSOTSync,
  applySSOTSync,
  summarisePlan,
  type SSOTSyncPlan,
  type SSOTSyncResult,
} from '@/lib/ssot/ssotSync';
import type { SSOTAccessCheck } from '@/lib/ssot/ssotAuth';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'ImportSSOTDialog' });

export interface ImportSSOTDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectLabel: string;
  userId: string;
  accessCheck: SSOTAccessCheck;
  /** Called after a successful apply so the tabs can refresh */
  onImported?: () => void;
}

export function ImportSSOTDialog({
  open,
  onClose,
  projectId,
  projectLabel,
  userId,
  accessCheck,
  onImported,
}: ImportSSOTDialogProps) {
  const { toast } = useToast();

  const [sourceReference, setSourceReference] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parsed, setParsed] = useState<SSOTImportResult | null>(null);
  const [plan, setPlan] = useState<SSOTSyncPlan | null>(null);
  const [result, setResult] = useState<SSOTSyncResult | null>(null);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setFileName('');
    setParsed(null);
    setPlan(null);
    setResult(null);
    setError('');
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!sourceReference.trim()) {
        setError('Name the source document first — every imported value is attributed to it.');
        return;
      }

      reset();
      setFileName(file.name);
      setParsing(true);
      try {
        const buffer = await file.arrayBuffer();
        const parsedResult = await parseSSOTWorkbook(buffer, {
          sourceReference: sourceReference.trim(),
        });
        setParsed(parsedResult);

        const total =
          parsedResult.counts.streams + parsedResult.counts.equipment + parsedResult.counts.lines;
        if (total === 0) {
          setError('Nothing to import — no readable rows in the file.');
          return;
        }

        // Read-only: works out what would change, writes nothing
        setPlan(await planSSOTSync(projectId, parsedResult, 'IMPORTED'));
      } catch (err) {
        logger.error('Import parse failed', { error: err });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setParsing(false);
      }
    },
    [projectId, reset, sourceReference]
  );

  const handleApply = useCallback(async () => {
    if (!plan) return;
    setApplying(true);
    setError('');
    try {
      const applyResult = await applySSOTSync(plan, userId, accessCheck);
      setResult(applyResult);
      const created = Object.values(applyResult.created).reduce((a, b) => a + b, 0);
      const updated = Object.values(applyResult.updated).reduce((a, b) => a + b, 0);
      toast.success(`Imported ${created} new and ${updated} updated records`);
      onImported?.();
    } catch (err) {
      logger.error('Import apply failed', { error: err });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }, [plan, userId, accessCheck, toast, onImported]);

  const handleClose = () => {
    reset();
    setSourceReference('');
    onClose();
  };

  const totals = plan ? summarisePlan(plan) : null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import process data — {projectLabel}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            Expects the layout the <strong>Export Excel</strong> button produces — Streams,
            Equipment and Lines sheets. Export the project first to get the template, even when it
            is empty. Columns are matched by name, so their order does not matter.
          </Alert>

          <TextField
            label="Source document"
            value={sourceReference}
            onChange={(e) => setSourceReference(e.target.value)}
            fullWidth
            required
            placeholder="e.g. Client basic design BD-1234 Rev B, 12 Aug 2026"
            helperText="Recorded against every value the file supplies, so a datasheet can say where its numbers came from"
          />

          <Button
            component="label"
            variant="outlined"
            startIcon={<UploadFileIcon />}
            disabled={parsing || applying}
          >
            {fileName || 'Choose spreadsheet'}
            <input
              type="file"
              hidden
              accept=".xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                // Clear so choosing the same file again re-triggers a parse
                e.target.value = '';
              }}
            />
          </Button>

          {error && <Alert severity="error">{error}</Alert>}

          {parsing && <LoadingState message="Reading the file…" />}

          {parsed && parsed.errors.length > 0 && (
            <Alert severity="warning">
              <AlertTitle>{parsed.errors.length} row(s) skipped</AlertTitle>
              {parsed.errors.slice(0, 8).map((e) => (
                <Typography key={e} variant="body2">
                  {e}
                </Typography>
              ))}
              {parsed.errors.length > 8 && (
                <Typography variant="body2">…and {parsed.errors.length - 8} more.</Typography>
              )}
            </Alert>
          )}

          {parsed && parsed.warnings.length > 0 && (
            <Alert severity="info">
              {parsed.warnings.slice(0, 6).map((w) => (
                <Typography key={w} variant="body2">
                  {w}
                </Typography>
              ))}
            </Alert>
          )}

          {plan && totals && !result && (
            <>
              <Divider />
              <Typography variant="subtitle1">What this will do</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Register</TableCell>
                      <TableCell align="right">Create</TableCell>
                      <TableCell align="right">Update</TableCell>
                      <TableCell align="right">Left alone</TableCell>
                      <TableCell align="right">No longer in file</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(['streams', 'equipment', 'lines'] as const).map((register) => (
                      <TableRow key={register}>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{register}</TableCell>
                        <TableCell align="right">{plan[register].creates.length}</TableCell>
                        <TableCell align="right">{plan[register].updates.length}</TableCell>
                        <TableCell align="right">{plan[register].skips.length}</TableCell>
                        <TableCell align="right">{plan[register].orphans.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <Alert severity="success" icon={false}>
                <Typography variant="body2">
                  Records you entered by hand are <strong>left alone</strong>, and fields you edited
                  on a previously imported record are preserved. Nothing is deleted — records no
                  longer in the file are reported, not removed.
                </Typography>
              </Alert>
            </>
          )}

          {result && (
            <Alert severity="success">
              <AlertTitle>Imported</AlertTitle>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  size="small"
                  label={`${Object.values(result.created).reduce((a, b) => a + b, 0)} created`}
                />
                <Chip
                  size="small"
                  label={`${Object.values(result.updated).reduce((a, b) => a + b, 0)} updated`}
                />
                <Chip
                  size="small"
                  label={`${Object.values(result.skipped).reduce((a, b) => a + b, 0)} left alone`}
                />
              </Stack>
              {result.failures.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="error">
                    {result.failures.length} record(s) failed:
                  </Typography>
                  {result.failures.slice(0, 5).map((f) => (
                    <Typography key={`${f.register}-${f.label}`} variant="body2" color="error">
                      {f.register} {f.label}: {f.error}
                    </Typography>
                  ))}
                </Box>
              )}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={applying}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {plan && !result && (
          <Button variant="contained" onClick={handleApply} disabled={applying}>
            {applying ? 'Importing…' : 'Import'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
