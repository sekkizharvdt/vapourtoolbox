'use client';

/**
 * Generate a project's SSOT process registers from a calculator result.
 *
 * SSOT holds ~30 equipment items and ~200 lines per project, and entering that
 * by hand is what kept every project's registers empty. This dialog turns a
 * completed calculation into streams, equipment and lines in one step.
 *
 * Flow: pick the target project → choose numbering and material options → the
 * dialog reads the project's existing registers and shows exactly what will be
 * created, updated, left alone and orphaned → confirm to write.
 *
 * Nothing is written until the user confirms the plan. Records the user has
 * edited by hand are never overwritten (see ssotSync's merge contract), and
 * the preview says so up front — that promise is the reason the feature will
 * still be used after the first design revision.
 *
 * ── One dialog, several calculators ──────────────────────────────────────
 * This started MED-specific and was made source-agnostic when the flash chamber
 * gained a generator, rather than being copied (rule 32). Everything below the
 * `generate` callback — project selection, area code, material choice, the plan
 * preview, the merge promise, the result panel — is identical for every source;
 * only the mapping function and the provenance `source` differ.
 *
 * The caller supplies `generate` (pure, no I/O) and the `source` the records are
 * stamped with. `source` scopes the sync: a MED regeneration must never touch a
 * flash chamber's records, and vice versa.
 *
 * ⚠ `generate` MUST be memoised (`useCallback`) by the caller. The dialog resets
 * its state whenever it changes — that is how rule 14b is satisfied here, since
 * a new `generate` identity means the underlying calculation moved — so an
 * inline arrow function would reset the dialog on every render.
 *
 * The dialog is stateless per-open (rule 14b): the plan is discarded and
 * re-derived every time it opens, because the calculation may have changed.
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
import { LINE_MATERIAL_OPTIONS } from '@/lib/ssot/generatorHelpers';
import {
  planSSOTSync,
  applySSOTSync,
  summarisePlan,
  type SSOTGeneration,
  type SSOTSyncPlan,
  type SSOTSyncResult,
} from '@/lib/ssot/ssotSync';
import type { SSOTAccessCheck } from '@/lib/ssot/ssotAuth';
import { MaterialCategory, PIPE_MATERIAL_CODES, FLUID_TYPES } from '@vapour/types';
import type { FluidType, Project, SSOTRecordSource } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'GenerateSSOTDialog' });

/** The choices the dialog collects and hands to a generator */
export interface SSOTGenerationOptions {
  /** The "40" in `300-40-SS316L-SW-01` */
  areaCode: string;
  /** Pipe material per fluid service; a generator falls back to its own default */
  materialByFluid: Partial<Record<FluidType, MaterialCategory>>;
  /** Equipment tag — empty string when the source declares no `identity` */
  equipmentTag: string;
  /** Equipment display name — empty string when the source declares no `identity` */
  equipmentName: string;
}

/**
 * Equipment identity the user may set.
 *
 * Only for sources that generate ONE tagged item whose tag would otherwise be a
 * constant. That matters: sync matches records on `provenance.generatedKey`,
 * which is built from the tag, so two flash chambers generated into one project
 * under the same default tag would silently update each other rather than
 * co-exist. Omit for sources like MED that tag every item from the design.
 */
export interface SSOTIdentityConfig {
  tagLabel: string;
  defaultTag: string;
  nameLabel: string;
  defaultName: string;
}

export interface GenerateSSOTDialogProps {
  open: boolean;
  onClose: () => void;
  /** Provenance source stamped on the records; scopes the sync's merge */
  source: SSOTRecordSource;
  /** Dialog title, e.g. "Generate SSOT from this design" */
  title: string;
  /** Shown in place of the form when the calculator has no result yet */
  notReadyMessage: string;
  /**
   * Fluid services whose pipe material the user may choose. Defaults to every
   * service — correct for MED, too broad for a single vessel.
   */
  materialServices?: FluidType[];
  /** Equipment tag/name controls; omit when the generator tags its own items */
  identity?: SSOTIdentityConfig;
  /**
   * Pure mapping from the current calculation to SSOT records; `null` while the
   * calculator has no result. MUST be memoised — see the file header.
   */
  generate: ((options: SSOTGenerationOptions) => SSOTGeneration) | null;
}

/** Human label for a pipe material category, e.g. "SS316L" */
function materialLabel(category: MaterialCategory): string {
  return PIPE_MATERIAL_CODES[category]?.[1] ?? String(category);
}

export function GenerateSSOTDialog({
  open,
  onClose,
  source,
  title,
  notReadyMessage,
  materialServices = FLUID_TYPES,
  identity,
  generate,
}: GenerateSSOTDialogProps) {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { toast } = useToast();
  const tenantId = claims?.tenantId || 'default-entity';

  // Destructured to primitives so the reset effect below depends on values, not
  // on an object identity the caller would have to memoise as well.
  const defaultTag = identity?.defaultTag ?? '';
  const defaultName = identity?.defaultName ?? '';

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [areaCode, setAreaCode] = useState('00');
  const [equipmentTag, setEquipmentTag] = useState(defaultTag);
  const [equipmentName, setEquipmentName] = useState(defaultName);
  const [materialByFluid, setMaterialByFluid] = useState<
    Partial<Record<FluidType, MaterialCategory>>
  >({});

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<SSOTSyncPlan | null>(null);
  const [generation, setGeneration] = useState<SSOTGeneration | null>(null);
  const [result, setResult] = useState<SSOTSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rule 14b: every field re-syncs when the dialog opens — the calculation may
  // have changed since last time, so a stale plan must never survive a reopen.
  // `generate` is in the deps for the same reason: a new identity means the
  // result it closes over moved.
  useEffect(() => {
    if (!open) return;
    setPlan(null);
    setGeneration(null);
    setResult(null);
    setError(null);
    setAreaCode('00');
    setEquipmentTag(defaultTag);
    setEquipmentName(defaultName);
    setMaterialByFluid({});
  }, [open, generate, defaultTag, defaultName]);

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
    if (!generate || !projectId) return;

    setPlanning(true);
    setError(null);
    setResult(null);
    try {
      const project = projects.find((p) => p.id === projectId);
      const generated = generate({ areaCode, materialByFluid, equipmentTag, equipmentName });
      const nextPlan = await planSSOTSync(projectId, generated, source);

      setGeneration(generated);
      setPlan(nextPlan);
      logger.info('SSOT generation previewed', {
        projectId,
        projectName: project?.name,
        source,
        ...summarisePlan(nextPlan),
      });
    } catch (err) {
      logger.error('SSOT generation preview failed', { projectId, source, error: err });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanning(false);
    }
  }, [
    generate,
    projectId,
    projects,
    areaCode,
    materialByFluid,
    equipmentTag,
    equipmentName,
    source,
  ]);

  const handleApply = useCallback(async () => {
    if (!plan || !user?.uid) return;

    setApplying(true);
    setError(null);
    try {
      const applied = await applySSOTSync(plan, user.uid, accessCheck);
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
      logger.info('SSOT generation applied', { projectId: plan.projectId, source, ...applied });
    } catch (err) {
      logger.error('SSOT generation failed', { projectId: plan.projectId, source, error: err });
      setError(err instanceof Error ? err.message : String(err));
      toast.error('Failed to write SSOT records');
    } finally {
      setApplying(false);
    }
  }, [plan, user?.uid, accessCheck, toast, source]);

  const totals = plan ? summarisePlan(plan) : null;
  const canPreview = Boolean(generate && projectId) && !planning && !applying;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>

      <DialogContent dividers>
        {!generate && <Alert severity="info">{notReadyMessage}</Alert>}

        {generate && (
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

            {/* ── Equipment identity ───────────────────────────────────── */}
            {identity && (
              <Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    size="small"
                    label={identity.tagLabel}
                    value={equipmentTag}
                    onChange={(e) => {
                      setEquipmentTag(e.target.value);
                      setPlan(null);
                    }}
                    sx={{ minWidth: 180 }}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label={identity.nameLabel}
                    value={equipmentName}
                    onChange={(e) => {
                      setEquipmentName(e.target.value);
                      setPlan(null);
                    }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Give each vessel its own tag. Regenerating under a tag that is already in the
                  project updates that vessel; a new tag creates a second one.
                </Typography>
              </Box>
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
                {materialServices.map((fluid) => {
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
                    though the calculation computes a different value.
                  </Alert>
                )}

                {totals.orphans > 0 && (
                  <Alert severity="warning">
                    <AlertTitle>Records no longer produced by this calculation</AlertTitle>
                    {totals.orphans} previously generated record(s) are not in the current result —
                    most likely because the configuration changed. They are left in place; remove
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
