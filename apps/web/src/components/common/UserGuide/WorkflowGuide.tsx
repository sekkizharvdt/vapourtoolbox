'use client';

/**
 * Workflow Guide
 *
 * Renders the step-by-step workflows for one guide section, plus the known issues
 * for that section, from the generated dataset in `@/data/workflowGuide`.
 *
 * Content is generated from docs/workflows/user-testing/*.md by
 * scripts/generate-workflow-guide.mjs — edit the markdown, not the data files.
 *
 * Each section's content is loaded on demand so the guide bundle stays small.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { LoadingState } from '@vapour/ui';
import { createLogger } from '@vapour/logger';

import {
  WORKFLOW_GUIDE_LOADERS,
  WORKFLOW_GUIDE_SUMMARY,
  type WorkflowGuideModule,
} from '@/data/workflowGuide';
import type { WorkflowBlock, WorkflowCase } from '@/data/workflowGuide/types';

const logger = createLogger({ context: 'WorkflowGuide' });

/* ------------------------------------------------------------------ inline */

/**
 * Renders the small markdown subset used in the guide text: `**bold**` and
 * `` `code` ``. Anything else is plain text.
 */
function RichText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: { t: 'plain' | 'bold' | 'code'; v: string }[] = [];
    const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ t: 'plain', v: text.slice(last, m.index) });
      if (m[1] !== undefined) out.push({ t: 'bold', v: m[1] });
      else out.push({ t: 'code', v: m[2] ?? '' });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ t: 'plain', v: text.slice(last) });
    return out;
  }, [text]);

  return (
    <>
      {parts.map((p, i) => {
        if (p.t === 'bold') {
          return (
            <Box component="strong" key={i} sx={{ fontWeight: 600 }}>
              {p.v}
            </Box>
          );
        }
        if (p.t === 'code') {
          return (
            <Box
              component="code"
              key={i}
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.85em',
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                bgcolor: 'action.hover',
              }}
            >
              {p.v}
            </Box>
          );
        }
        return (
          <Box component="span" key={i}>
            {p.v}
          </Box>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ blocks */

const META_COLORS: Record<string, 'default' | 'warning'> = {
  'Should NOT be possible': 'warning',
};

function BlockList({ blocks }: { blocks: WorkflowBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.k) {
          case 'h':
            return (
              <Typography key={i} variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 0.5 }}>
                <RichText text={b.text} />
              </Typography>
            );

          case 'p':
            return (
              <Typography key={i} variant="body2" sx={{ mb: 1 }}>
                <RichText text={b.text} />
              </Typography>
            );

          case 'meta':
            return (
              <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                <Chip
                  label={b.label}
                  size="small"
                  color={META_COLORS[b.label] ?? 'default'}
                  variant="outlined"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                />
                {b.text ? (
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 200 }}>
                    <RichText text={b.text} />
                  </Typography>
                ) : null}
              </Box>
            );

          case 'note':
            return (
              <Alert key={i} severity={b.warn ? 'warning' : 'info'} sx={{ mb: 1.5 }}>
                <RichText text={b.text} />
              </Alert>
            );

          case 'ul':
          case 'ol':
            return (
              <Box
                key={i}
                component={b.k}
                sx={{ pl: 3, mb: 1.5, '& li': { mb: 0.5 }, typography: 'body2' }}
              >
                {b.items.map((it, j) => (
                  <li key={j}>
                    <RichText text={it} />
                  </li>
                ))}
              </Box>
            );

          case 'table':
            return (
              <TableContainer
                key={i}
                component={Paper}
                variant="outlined"
                sx={{ mb: 2, overflowX: 'auto' }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {b.head.map((h, j) => (
                        <TableCell
                          key={j}
                          sx={{
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            bgcolor: 'action.hover',
                            ...(b.steps && j === 0 ? { width: 48 } : {}),
                          }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {b.rows.map((r, j) => (
                      <TableRow key={j} hover>
                        {r.map((c, k) => (
                          <TableCell
                            key={k}
                            sx={{
                              verticalAlign: 'top',
                              ...(b.steps && k === 0
                                ? { color: 'text.secondary', fontFamily: 'monospace' }
                                : {}),
                              ...(c.includes('⚠') ? { color: 'warning.main' } : {}),
                            }}
                          >
                            <RichText text={c} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            );

          default:
            return null;
        }
      })}
    </>
  );
}

/* ------------------------------------------------------------------- cases */

function WorkflowAccordion({ wf }: { wf: WorkflowCase }) {
  return (
    <Accordion
      disableGutters
      TransitionProps={{ unmountOnExit: true }}
      sx={{ '&:before': { display: 'none' }, borderBottom: 1, borderColor: 'divider' }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
        >
          <Chip
            label={wf.id}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
          />
          <Typography variant="body2" fontWeight={500}>
            {wf.title}
          </Typography>
          {wf.knownIssue ? (
            <Chip
              icon={<ReportProblemOutlinedIcon />}
              label="Known issue"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.68rem' }}
            />
          ) : null}
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <BlockList blocks={wf.blocks} />
      </AccordionDetails>
    </Accordion>
  );
}

/* ------------------------------------------------------------------- main */

export function WorkflowGuide({ moduleId }: { moduleId: string }) {
  const summary = WORKFLOW_GUIDE_SUMMARY[moduleId];
  const [data, setData] = useState<WorkflowGuideModule | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const loader = WORKFLOW_GUIDE_LOADERS[moduleId];
    if (!loader) {
      setFailed(true);
      return;
    }
    try {
      setData(await loader());
    } catch (error) {
      logger.error(`Failed to load workflow content for "${moduleId}"`, {
        error: error instanceof Error ? error.message : String(error),
      });
      setFailed(true);
    }
  }, [moduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!summary) return null;

  if (failed) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        The workflow list could not be loaded. Reload the page, and report it from the Feedback page
        if it keeps happening.
      </Alert>
    );
  }

  if (!data) return <LoadingState message="Loading workflows…" />;

  return (
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 3 }} />

      <Typography variant="h6" gutterBottom>
        Workflows you can test
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Every workflow this module supports, with the exact steps and what you should see at each
        one. Work through any that matter to you and check the app behaves as described. If it does
        not, report it from the <strong>Feedback</strong> page and start the title with the workflow
        code (for example <em>{data.workflows[0]?.id ?? 'UAT-PROC-01'}</em>) — that tells us exactly
        which steps you ran.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', rowGap: 1 }}>
        <Chip label={`${summary.workflows} workflows`} size="small" />
        {summary.gaps > 0 ? (
          <Chip
            label={`${summary.gaps} known issues`}
            size="small"
            color="warning"
            variant="outlined"
          />
        ) : null}
      </Stack>

      {data.gaps.length > 0 ? (
        <Alert severity="warning" icon={<ReportProblemOutlinedIcon />} sx={{ mb: 3 }}>
          <AlertTitle>Known issues — please do not report these</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            These are already recorded and being worked on. If you see one behaving differently from
            how it is described here, that <strong>is</strong> worth reporting.
          </Typography>
          <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 0.75 }, typography: 'body2' }}>
            {data.gaps.map((g, i) => (
              <li key={i}>
                <RichText text={g.text} />
              </li>
            ))}
          </Box>
        </Alert>
      ) : null}

      {data.intro.map((s, i) => (
        <Box key={i} sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {s.section}
          </Typography>
          <BlockList blocks={s.blocks} />
        </Box>
      ))}

      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Step-by-step workflows
      </Typography>
      <Paper variant="outlined">
        {data.workflows.map((wf) => (
          <WorkflowAccordion key={wf.id} wf={wf} />
        ))}
      </Paper>
    </Box>
  );
}
