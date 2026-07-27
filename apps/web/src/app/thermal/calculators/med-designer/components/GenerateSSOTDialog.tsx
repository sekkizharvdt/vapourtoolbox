'use client';

/**
 * Generate a project's SSOT process registers from the current MED design.
 *
 * SSOT holds ~30 equipment items and ~200 lines per project, and entering that
 * by hand is what kept every project's registers empty. This dialog turns a
 * completed design into streams, equipment and lines in one step.
 *
 * Flow: pick the target project → choose line-numbering options → the dialog
 * reads the project's existing registers and shows exactly what will be created,
 * updated, left alone and orphaned → confirm to write.
 *
 * Nothing is written until the user confirms the plan. Records the user has
 * edited by hand are never overwritten (see medDesignSync's merge contract), and
 * the preview says so up front — that promise is the reason the feature will
 * still be used after the first design revision.
 *
 * The dialog is stateless per-open (rule 14b): the plan is discarded and
 * re-derived every time it opens, because the design may have changed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import { getProjectsForUser } from '@/lib/projects/projectService';
import {
  generateSSOTFromMEDDesign,
  LINE_MATERIAL_OPTIONS,
  type MEDSSOTGeneration,
} from '@/lib/ssot/medDesignGenerator';
import {
  planMEDSSOTSync,
  applyMEDSSOTSync,
  summarisePlan,
  type MEDSSOTSyncPlan,
  type MEDSSOTSyncResult,
} from '@/lib/ssot/medDesignSync';
import type { SSOTAccessCheck } from '@/lib/ssot/ssotAuth';
import { MaterialCategory, PIPE_MATERIAL_CODES, FLUID_TYPES } from '@vapour/types';
import type { FluidType, Project } from '@vapour/types';
import type { MEDDesignerResult } from '@/lib/thermal';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'GenerateSSOTDialog' });

interface GenerateSSOTDialogProps {
  open: boolean;
  onClose: () => void;
  designResult: MEDDesignerResult | null;
}

/** Human label for a pipe material category, e.g. "SS316L" */
function materialLabel(category: MaterialCategory): string {
  return PIPE_MATERIAL_CODES[category]?.[1] ?? String(category);
}

export function GenerateSSOTDialog({ open, onClose, designResult }: GenerateSSOTDialogProps) {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { toast } = useToast();
  const tenantId = claims?.tenantId || 'default-entity';

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [areaCode, setAreaCode] = useState('00');
  const [materialByFluid, setMaterialByFluid] = useState<
    Partial<Record<FluidType, MaterialCategory>>
  >({});

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<MEDSSOTSyncPlan | null>(null);
  const [generation, setGeneration] = useState<MEDSSOTGeneration | null>(null);
  const [result, setResult] = useState<MEDSSOTSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rule 14b: every field re-syncs when the dialog opens — the design may have
  // changed since last time, so a stale plan must never survive a reopen.
  useEffect(() => {
    if (!open) return;
    setPlan(null);
    setGeneration(null);
    setResult(null);
    setError(null);
    setAreaCode('00');
    setMaterialByFluid({});
  }, [open, designResult]);

  // Load the projects this user may write SSOT data for
  useEffect(() => {
    if (!open || !user?.uid) return;

    let cancelled = false;
    setLoadingProjects(true);
    (async () => {
      try {
        const list = await retryOnStaleToken(() =>
          getProjectsForUser(tenantId, user.uid, claims?.permissions ?? 0)
        );
        if (cancelled) return;
        setProjects(list);
        setProjectId((current) => current || list[0]?.id || '');
      } catch (err) {
        if (cancelled) return;
        logger.error('Failed to load projects for SSOT generation', { error: err });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user?.uid, tenantId, claims?.permissions]);

  const accessCheck = useMemo<SSOTAccessCheck>(
    () => ({
      userPermissions2: claims?.permissions2 ?? 0,
      userAssignedProjects: projects.map((p) => p.id),
    }),
    [claims?.permissions2, projects]
  );

  const handlePreview = useCallback(async () => {
    if (!designResult || !projectId) return;

    setPlanning(true);
    setError(null);
    setResult(null);
    try {
      const project = projects.find((p) => p.id === projectId);
      const generated = generateSSOTFromMEDDesign(designResult, {
        areaCode,
        materialByFluid,
        sourceLabel: `${designResult.effects.length}-effect MED, GOR ${designResult.achievedGOR.toFixed(1)}`,
      });
      const nextPlan = await planMEDSSOTSync(projectId, generated);

      setGeneration(generated);
      setPlan(nextPlan);
      logger.info('SSOT generation previewed', {
        projectId,
        projectName: project?.name,
        ...summarisePlan(nextPlan),
      });
    } catch (err) {
      logger.error('SSOT generation preview failed', { projectId, error: err });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanning(false);
    }
  }, [designResult, projectId, projects, areaCode, materialByFluid]);

  const handleApply = useCallback(async () => {
    if (!plan || !user?.uid) return;

    setApplying(true);
    setError(null);
    try {
      const applied = await applyMEDSSOTSync(plan, user.uid, accessCheck);
      setResult(applied);

      const total =
        applied.created.streams +
        applied.created.equipment +
        applied.created.lines +
        applied.updated.streams +
        applied.updated.equipment +
        applied.updated.lines;

      if (applied.failures.length > 0) {
        toast.warning(`SSOT updated with ${applied.failures.length} failure(s) — see details`);
      } else {
        toast.success(`SSOT updated — ${total} record(s) written`);
      }
      logger.info('SSOT generation applied', { projectId: plan.projectId, ...applied });
    } catch (err) {
      logger.error('SSOT generation failed', { projectId: plan.projectId, error: err });
      setError(err instanceof Error ? err.message : String(err));
      toast.error('Failed to write SSOT records');
    } finally {
      setApplying(false);
    }
  }, [plan, user?.uid, accessCheck, toast]);

  const totals = plan ? summarisePlan(plan) : null;
  const canPreview = Boolean(designResult && projectId) && !planning && !applying;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Generate SSOT from this design</DialogTitle>

      <DialogContent dividers>
        {!designResult && (
          <Alert severity="info">Complete a MED design before generating SSOT registers.</Alert>
        )}

        {designResult && (
          <Stack spacing={3}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* ── Target and numbering ─────────────────────────────────── */}
            {loadingProjects ? (
              <LoadingState message="Loading projects..." />
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="ssot-project-label">Project</InputLabel>
                  <Select
                    labelId="ssot-project-label"
                    label="Project"
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setPlan(null);
                      setResult(null);
                    }}
                  >
                    {projects.map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.name} ({project.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  size="small"
                  label="Area code"
                  helperText="The “40” in 300-40-SS316L-SW-01"
                  value={areaCode}
                  onChange={(e) => {
                    setAreaCode(e.target.value);
                    setPlan(null);
                  }}
                  sx={{ minWidth: 160 }}
                />
              </Stack>
            )}

            {/* ── Pipe material per service ────────────────────────────── */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Pipe material
              </Typography>
              <Typography variant="caption" color="text.secondary">
                SS316L throughout is the default. Change a service only where the project&apos;s
                material compatibility review calls for it.
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mt: 1.5 }}>
                {FLUID_TYPES.map((fluid) => {
                  const options = LINE_MATERIAL_OPTIONS[fluid];
                  return (
                    <FormControl key={fluid} size="small" sx={{ minWidth: 190 }}>
                      <InputLabel id={`mat-${fluid}`}>{fluid}</InputLabel>
                      <Select
                        labelId={`mat-${fluid}`}
                        label={fluid}
                        value={materialByFluid[fluid] ?? options[0]}
                        onChange={(e) => {
                          setMaterialByFluid((prev) => ({
                            ...prev,
                            [fluid]: e.target.value as MaterialCategory,
                          }));
                          setPlan(null);
                        }}
                      >
                        {options.map((category) => (
                          <MenuItem key={category} value={category}>
                            {materialLabel(category)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                })}
              </Stack>
            </Box>

            <Divider />

            {/* ── Plan preview ─────────────────────────────────────────── */}
            {planning && <LoadingState message="Reading the project's existing registers..." />}

            {!planning && !plan && (
              <Alert severity="info">
                Preview shows exactly what will change before anything is written.
              </Alert>
            )}

            {!planning && plan && totals && !result && (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip color="success" label={`${totals.creates} to create`} />
                  <Chip color="primary" label={`${totals.updates} to update`} />
                  {totals.skips > 0 && (
                    <Chip color="default" label={`${totals.skips} hand-entered, untouched`} />
                  )}
                  {totals.orphans > 0 && (
                    <Chip color="warning" label={`${totals.orphans} no longer in the design`} />
                  )}
                </Stack>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Register</TableCell>
                      <TableCell align="right">Create</TableCell>
                      <TableCell align="right">Update</TableCell>
                      <TableCell align="right">Untouched</TableCell>
                      <TableCell align="right">Orphaned</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(
                      [
                        ['Streams', plan.streams],
                        ['Equipment', plan.equipment],
                        ['Lines', plan.lines],
                      ] as const
                    ).map(([label, register]) => (
                      <TableRow key={label}>
                        <TableCell>{label}</TableCell>
                        <TableCell align="right">{register.creates.length}</TableCell>
                        <TableCell align="right">{register.updates.length}</TableCell>
                        <TableCell align="right">{register.skips.length}</TableCell>
                        <TableCell align="right">{register.orphans.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totals.preservedFields > 0 && (
                  <Alert severity="success">
                    <AlertTitle>Your edits are safe</AlertTitle>
                    {totals.preservedFields} hand-edited field(s) will be kept as they are, even
                    though the design computes a different value.
                  </Alert>
                )}

                {totals.orphans > 0 && (
                  <Alert severity="warning">
                    <AlertTitle>Records no longer produced by this design</AlertTitle>
                    {totals.orphans} previously generated record(s) are not in the current design —
                    most likely because the effect count changed. They are left in place; remove
                    them from the SSOT tabs if they are genuinely obsolete.
                  </Alert>
                )}

                {generation && generation.warnings.length > 0 && (
                  <Alert severity="info">
                    <AlertTitle>Not generated — needs entering by hand</AlertTitle>
                    <Stack component="ul" sx={{ pl: 2, m: 0 }} spacing={0.5}>
                      {generation.warnings.map((warning) => (
                        <Typography component="li" variant="body2" key={warning}>
                          {warning}
                        </Typography>
                      ))}
                    </Stack>
                  </Alert>
                )}
              </Stack>
            )}

            {/* ── Result ───────────────────────────────────────────────── */}
            {result && (
              <Stack spacing={2}>
                <Alert severity={result.failures.length > 0 ? 'warning' : 'success'}>
                  <AlertTitle>
                    {result.failures.length > 0 ? 'Completed with failures' : 'SSOT updated'}
                  </AlertTitle>
                  Created {result.created.streams} stream(s), {result.created.equipment} equipment
                  item(s) and {result.created.lines} line(s). Updated{' '}
                  {result.updated.streams + result.updated.equipment + result.updated.lines}{' '}
                  record(s).
                </Alert>

                {result.failures.length > 0 && (
                  <Alert severity="error">
                    <AlertTitle>{result.failures.length} record(s) failed</AlertTitle>
                    <Stack component="ul" sx={{ pl: 2, m: 0 }} spacing={0.5}>
                      {result.failures.slice(0, 10).map((failure) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={`${failure.register}-${failure.label}`}
                        >
                          {failure.register} “{failure.label}”: {failure.error}
                        </Typography>
                      ))}
                    </Stack>
                  </Alert>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={applying}>
          {result ? 'Close' : 'Cancel'}
        </Button>

        {result ? (
          <Button
            variant="contained"
            endIcon={<OpenInNewIcon />}
            onClick={() => router.push('/ssot')}
          >
            Open SSOT
          </Button>
        ) : plan ? (
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={applying || (totals?.creates === 0 && totals?.updates === 0)}
          >
            {applying ? 'Writing…' : 'Apply to project'}
          </Button>
        ) : (
          <Button variant="contained" onClick={handlePreview} disabled={!canPreview}>
            {planning ? 'Checking…' : 'Preview changes'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default GenerateSSOTDialog;
