'use client';

/**
 * PRLinkageSelector — the one control that answers "what is this PR raised for".
 *
 * `raisedFor` decides both the question and its source:
 *   PROJECT  → pick a project      → projectId / projectName
 *   PROPOSAL → pick a proposal     → proposalId / proposalNumber
 *   INTERNAL → nothing to pick     → the standing CC-ADMIN cost centre
 *
 * Internal requests are always charged to administration, so asking would be
 * asking a question with one answer; the component resolves it and reports it
 * upward instead. Shared by the New and Edit forms — do not fork it (rule 32).
 */

import { useEffect, useState } from 'react';
import { Autocomplete, TextField, Box, Chip, Alert, Typography } from '@mui/material';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import {
  ADMIN_COST_CENTRE_CODE,
  PURCHASE_REQUEST_LINKAGE_LABELS,
  getStatusColor,
} from '@vapour/constants';
import type { PurchaseRequestRaisedFor, ProposalStatus } from '@vapour/types';

const logger = createLogger({ context: 'PRLinkageSelector' });

/** What the PR ends up storing, whichever branch produced it. */
export interface PRLinkage {
  projectId?: string;
  projectName?: string;
  proposalId?: string;
  proposalNumber?: string;
  costCentreId?: string;
  costCentreCode?: string;
}

interface LinkOption {
  id: string;
  /** Primary display line — project name or proposal number. */
  label: string;
  /** Secondary line — project code or proposal title. */
  detail: string;
  status?: string;
}

interface PRLinkageSelectorProps {
  raisedFor: PurchaseRequestRaisedFor;
  /** Current linkage; the component only reads the field matching `raisedFor`. */
  value: PRLinkage;
  onChange: (linkage: PRLinkage) => void;
  disabled?: boolean;
}

/**
 * Proposals worth raising a PR against — every `ProposalStatus` except the
 * dead ends. Pricing a rejected or expired proposal is not a real case.
 */
const LIVE_PROPOSAL_STATUSES: ProposalStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SUBMITTED',
  'UNDER_NEGOTIATION',
  'ACCEPTED',
];

export function PRLinkageSelector({
  raisedFor,
  value,
  onChange,
  disabled = false,
}: PRLinkageSelectorProps) {
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adminCostCentre, setAdminCostCentre] = useState<{ id: string; code: string } | null>(null);

  // Load whichever source `raisedFor` points at. Re-runs on switch, so the
  // stale option list from the previous mode never shows.
  useEffect(() => {
    let cancelled = false;
    const { db } = getFirebase();

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (raisedFor === 'PROJECT') {
          const snap = await getDocs(
            query(collection(db, COLLECTIONS.PROJECTS), orderBy('name', 'asc'))
          );
          const loaded: LinkOption[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.isDeleted) return; // rule 3 — filter client-side
            loaded.push({
              id: docSnap.id,
              label: data.name ?? '(unnamed project)',
              detail: data.code ?? '',
              status: data.status,
            });
          });
          if (!cancelled) setOptions(loaded);
        } else if (raisedFor === 'PROPOSAL') {
          const snap = await getDocs(
            query(collection(db, COLLECTIONS.PROPOSALS), orderBy('createdAt', 'desc'), limit(200))
          );
          const loaded: LinkOption[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.isDeleted) return;
            if (data.status && !LIVE_PROPOSAL_STATUSES.includes(data.status)) return;
            loaded.push({
              id: docSnap.id,
              label: data.proposalNumber ?? '(unnumbered proposal)',
              detail: data.title ?? data.customerName ?? '',
              status: data.status,
            });
          });
          if (!cancelled) setOptions(loaded);
        } else {
          // INTERNAL — resolve the administration cost centre by code. The id
          // differs per environment, so it is never hardcoded.
          const snap = await getDocs(
            query(
              collection(db, COLLECTIONS.COST_CENTRES),
              where('code', '==', ADMIN_COST_CENTRE_CODE)
            )
          );
          const found = snap.docs[0];
          if (!found) {
            if (!cancelled) {
              setLoadError(
                `No cost centre with the code ${ADMIN_COST_CENTRE_CODE} exists, so this internal ` +
                  `request cannot be charged anywhere. Create it under Accounting → Cost Centres.`
              );
              setAdminCostCentre(null);
            }
            return;
          }
          if (!cancelled) {
            setAdminCostCentre({ id: found.id, code: found.data().code });
            setOptions([]);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to load purchase request linkage options', {
          raisedFor,
          error: message,
        });
        if (!cancelled)
          setLoadError(`Could not load ${raisedFor.toLowerCase()} options: ${message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [raisedFor]);

  // Report the resolved administration cost centre upward once it is known.
  // Guarded on the current value so this does not loop on every render.
  useEffect(() => {
    if (raisedFor !== 'INTERNAL' || !adminCostCentre) return;
    if (value.costCentreId === adminCostCentre.id) return;
    onChange({ costCentreId: adminCostCentre.id, costCentreCode: adminCostCentre.code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raisedFor, adminCostCentre, value.costCentreId]);

  if (raisedFor === 'INTERNAL') {
    return (
      <Box sx={{ flex: 1 }}>
        {loadError ? (
          <Alert severity="error">{loadError}</Alert>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Charged to <strong>{adminCostCentre?.code ?? ADMIN_COST_CENTRE_CODE}</strong> —
            Administration. Internal requests are not charged to a project.
          </Typography>
        )}
      </Box>
    );
  }

  const selectedId = raisedFor === 'PROJECT' ? value.projectId : value.proposalId;
  const selected = options.find((option) => option.id === selectedId) ?? null;
  const label = PURCHASE_REQUEST_LINKAGE_LABELS[raisedFor];

  return (
    <Autocomplete
      sx={{ flex: 1 }}
      options={options}
      value={selected}
      loading={loading}
      disabled={disabled}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, chosen) => option.id === chosen.id}
      onChange={(_event, option) => {
        if (!option) {
          onChange({});
          return;
        }
        onChange(
          raisedFor === 'PROJECT'
            ? { projectId: option.id, projectName: option.label }
            : { proposalId: option.id, proposalNumber: option.label }
        );
      }}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2">{option.label}</Typography>
            {option.detail && (
              <Typography variant="caption" color="text.secondary">
                {option.detail}
              </Typography>
            )}
          </Box>
          {option.status && (
            <Chip
              label={option.status}
              size="small"
              color={getStatusColor(option.status, raisedFor === 'PROJECT' ? 'project' : undefined)}
            />
          )}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label={label}
          required
          error={Boolean(loadError)}
          helperText={loadError ?? undefined}
        />
      )}
    />
  );
}
