'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { getFirebase } from '@/lib/firebase';
import { getAllFiscalYears } from '@/lib/accounting/fiscalYearService';
import type { FiscalYear } from '@vapour/types';

/**
 * A concrete fiscal-year selection with resolved date range.
 * `id === 'ALL'` means no date filter.
 */
export interface FiscalYearRange {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean;
}

const ALL_YEARS_OPTION: FiscalYearRange = {
  id: 'ALL',
  name: 'All Years',
  startDate: null,
  endDate: null,
  isCurrent: false,
};

const STORAGE_KEY = 'vt.accounting.fiscalYearFilter';
const DEFAULT_ID = 'CURRENT';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return null;
}

export interface UseFiscalYearFilterResult {
  fiscalYears: FiscalYear[];
  options: FiscalYearRange[];
  selected: FiscalYearRange;
  selectedId: string;
  setSelectedId: (id: string) => void;
  range: { startDate: Date; endDate: Date } | null;
  loading: boolean;
}

/**
 * Loads fiscal years and tracks the user's selection.
 *
 * Default selection is the fiscal year marked `isCurrent` (falls back to
 * `ALL` if none is set). The selection is persisted to localStorage so the
 * same FY stays applied when the user navigates between accounting pages.
 *
 * Pages consume the returned `range` to filter their data:
 *   const { range } = useFiscalYearFilter();
 *   const matchesFY = !range || (txnDate >= range.startDate && txnDate <= range.endDate);
 */
export function useFiscalYearFilter(): UseFiscalYearFilterResult {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_ID;
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_ID;
  });

  useEffect(() => {
    let cancelled = false;
    const { db } = getFirebase();
    getAllFiscalYears(db)
      .then((years) => {
        if (!cancelled) setFiscalYears(years);
      })
      .catch(() => {
        // Swallow — UI will show an empty list and default to 'ALL'
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo<FiscalYearRange[]>(() => {
    const fyOptions: FiscalYearRange[] = fiscalYears.map((fy) => ({
      id: fy.id,
      name: fy.name,
      startDate: toDate(fy.startDate),
      endDate: toDate(fy.endDate),
      isCurrent: fy.isCurrent,
    }));
    // Named FYs first (newest → oldest), "All Years" as the catch-all at the bottom.
    return [...fyOptions, ALL_YEARS_OPTION];
  }, [fiscalYears]);

  const selected = useMemo<FiscalYearRange>(() => {
    if (selectedId === DEFAULT_ID) {
      const current = options.find((o) => o.isCurrent);
      if (current) return current;
      return ALL_YEARS_OPTION;
    }
    return options.find((o) => o.id === selectedId) ?? ALL_YEARS_OPTION;
  }, [options, selectedId]);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const range = useMemo<{ startDate: Date; endDate: Date } | null>(() => {
    if (!selected.startDate || !selected.endDate) return null;
    const start = new Date(selected.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selected.endDate);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end };
  }, [selected]);

  return { fiscalYears, options, selected, selectedId, setSelectedId, range, loading };
}

export interface FiscalYearFilterProps {
  options: FiscalYearRange[];
  selectedId: string;
  onChange: (id: string) => void;
  /** Width override — defaults to 200px */
  minWidth?: number;
  /** Make the control fill its container width (overrides minWidth) */
  fullWidth?: boolean;
  /** Label override — defaults to "Fiscal Year" */
  label?: string;
}

/**
 * Dropdown for selecting a fiscal year. Pairs with `useFiscalYearFilter`.
 *
 * Usage:
 *   const fy = useFiscalYearFilter();
 *   <FiscalYearFilter
 *     options={fy.options}
 *     selectedId={fy.selectedId}
 *     onChange={fy.setSelectedId}
 *   />
 */
export function FiscalYearFilter({
  options,
  selectedId,
  onChange,
  minWidth = 200,
  fullWidth,
  label = 'Fiscal Year',
}: FiscalYearFilterProps) {
  // Resolve the 'CURRENT' sentinel (the stored default) to the actual FY id so
  // the Select can find a matching MenuItem. Falls back to 'ALL' if no FY is
  // flagged as current yet.
  const resolvedValue =
    selectedId === DEFAULT_ID ? (options.find((o) => o.isCurrent)?.id ?? 'ALL') : selectedId;

  return (
    <FormControl size="small" fullWidth={fullWidth} sx={fullWidth ? undefined : { minWidth }}>
      <InputLabel>{label}</InputLabel>
      <Select value={resolvedValue} label={label} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.name}
            {option.isCurrent ? ' (current year)' : ''}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/**
 * Returns true when `date` falls within `range` (inclusive).
 * Returns true when `range` is null — callers treat "no range" as "no filter".
 */
export function matchesFiscalYear(
  date: Date | null | undefined,
  range: { startDate: Date; endDate: Date } | null
): boolean {
  if (!range) return true;
  if (!date) return false;
  const t = date.getTime();
  return t >= range.startDate.getTime() && t <= range.endDate.getTime();
}
