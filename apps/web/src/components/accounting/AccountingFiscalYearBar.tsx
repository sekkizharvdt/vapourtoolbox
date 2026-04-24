'use client';

import { Box, Typography } from '@mui/material';
import { FiscalYearFilter, useFiscalYearFilter } from '@/components/accounting/FiscalYearFilter';

/**
 * Always-visible fiscal-year selector for the accounting module.
 *
 * Writes to the shared `vt.accounting.fiscalYearFilter` localStorage key, so
 * sub-pages that call `useFiscalYearFilter` pick up the selection without any
 * extra wiring. A visible single source of truth beats 13 per-page chips.
 */
export function AccountingFiscalYearBar() {
  const fy = useFiscalYearFilter();
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 1,
        mb: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Fiscal year:
      </Typography>
      <FiscalYearFilter
        options={fy.options}
        selectedId={fy.selectedId}
        onChange={fy.setSelectedId}
        label=""
        minWidth={180}
      />
    </Box>
  );
}
