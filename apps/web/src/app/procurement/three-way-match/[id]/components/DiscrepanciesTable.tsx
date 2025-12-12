'use client';

import {
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import type { MatchDiscrepancy } from '@vapour/types';

interface DiscrepanciesTableProps {
  discrepancies: MatchDiscrepancy[];
  onResolve: (discrepancy: MatchDiscrepancy) => void;
}

export function DiscrepanciesTable({ discrepancies, onResolve }: DiscrepanciesTableProps) {
  const unresolvedDiscrepancies = discrepancies.filter((d) => !d.resolved);

  if (discrepancies.length === 0) return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Discrepancies ({discrepancies.length})</Typography>
        {unresolvedDiscrepancies.length > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${unresolvedDiscrepancies.length} Unresolved`}
            color="warning"
            size="small"
          />
        )}
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Expected</TableCell>
              <TableCell align="right">Actual</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {discrepancies.map((discrepancy) => (
              <TableRow key={discrepancy.id}>
                <TableCell>
                  <Chip label={discrepancy.discrepancyType} size="small" />
                </TableCell>
                <TableCell>{discrepancy.description}</TableCell>
                <TableCell align="right">{String(discrepancy.expectedValue)}</TableCell>
                <TableCell align="right">{String(discrepancy.actualValue)}</TableCell>
                <TableCell>
                  {discrepancy.resolved ? (
                    <Chip label="Resolved" color="success" size="small" />
                  ) : (
                    <Chip label="Pending" color="warning" size="small" />
                  )}
                </TableCell>
                <TableCell>
                  {!discrepancy.resolved && (
                    <Button size="small" onClick={() => onResolve(discrepancy)}>
                      Resolve
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
