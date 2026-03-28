'use client';

import React, { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Typography,
} from '@mui/material';

/**
 * Column definition for DataTable
 */
export interface DataTableColumn<T> {
  /** Unique key for this column (typically a field name on T) */
  key: string;
  /** Column header label */
  label: string;
  /** Text alignment */
  align?: 'left' | 'right' | 'center';
  /** Minimum width in px */
  minWidth?: number;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Format a cell value to string */
  format?: (value: unknown, row: T) => string;
  /** Render a custom cell (takes precedence over format) */
  render?: (row: T) => React.ReactNode;
  /** Whether to hide this column (for conditional columns) */
  hidden?: boolean;
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

export interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Row data */
  rows: T[];
  /** Unique key extractor for each row */
  getRowKey: (row: T) => string;
  /** Show pagination (default: true) */
  pagination?: boolean;
  /** Default rows per page (default: 50) */
  defaultRowsPerPage?: number;
  /** Rows per page options (default: [25, 50, 100]) */
  rowsPerPageOptions?: number[];
  /** Message when no rows */
  emptyMessage?: string;
  /** Optional row click handler */
  onRowClick?: (row: T) => void;
  /** Optional render function for action column */
  renderActions?: (row: T) => React.ReactNode;
  /** Actions column header label (default: 'Actions') */
  actionsLabel?: string;
  /** Whether the table is in a loading state */
  loading?: boolean;
  /** Enable client-side sorting */
  sortable?: boolean;
  /** Default sort column key */
  defaultSortKey?: string;
  /** Default sort direction */
  defaultSortDirection?: SortDirection;
  /** Whether to use dense padding */
  dense?: boolean;
  /** Whether to use sticky header */
  stickyHeader?: boolean;
}

/**
 * Generic data table component with pagination, sorting, and action columns.
 *
 * Replaces the repeated MUI Table + TablePagination pattern found across ~30 pages.
 *
 * @example
 * ```tsx
 * <DataTable
 *   columns={[
 *     { key: 'date', label: 'Date', format: (v) => formatDate(v) },
 *     { key: 'amount', label: 'Amount', align: 'right', format: (v) => formatCurrency(v) },
 *     { key: 'status', label: 'Status', render: (row) => <Chip label={row.status} /> },
 *   ]}
 *   rows={filteredData}
 *   getRowKey={(row) => row.id}
 *   renderActions={(row) => (
 *     <TableActionCell actions={[
 *       { icon: <EditIcon />, label: 'Edit', onClick: () => handleEdit(row) },
 *     ]} />
 *   )}
 * />
 * ```
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  pagination = true,
  defaultRowsPerPage = 50,
  rowsPerPageOptions = [25, 50, 100],
  emptyMessage = 'No records found',
  onRowClick,
  renderActions,
  actionsLabel = 'Actions',
  sortable = false,
  defaultSortKey,
  defaultSortDirection = 'asc',
  dense = false,
  stickyHeader = false,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  const visibleColumns = columns.filter((col) => !col.hidden);

  const handleChangePage = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
      setPage(0);
    },
    [sortKey]
  );

  // Sort rows if sorting is enabled
  let displayRows = rows;
  if (sortable && sortKey) {
    displayRows = [...rows].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }

  // Paginate
  const paginatedRows = pagination
    ? displayRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : displayRows;

  const totalColumns = visibleColumns.length + (renderActions ? 1 : 0);

  const getCellValue = (row: T, col: DataTableColumn<T>): React.ReactNode => {
    if (col.render) {
      return col.render(row);
    }
    const value = (row as Record<string, unknown>)[col.key];
    if (col.format) {
      return col.format(value, row);
    }
    if (value == null) return '-';
    return String(value);
  };

  return (
    <TableContainer component={Paper}>
      <Table size={dense ? 'small' : 'medium'} stickyHeader={stickyHeader}>
        <TableHead>
          <TableRow>
            {visibleColumns.map((col) => (
              <TableCell key={col.key} align={col.align} sx={{ minWidth: col.minWidth }}>
                {sortable && col.sortable !== false ? (
                  <TableSortLabel
                    active={sortKey === col.key}
                    direction={sortKey === col.key ? sortDirection : 'asc'}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                  </TableSortLabel>
                ) : (
                  col.label
                )}
              </TableCell>
            ))}
            {renderActions && <TableCell align="right">{actionsLabel}</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={totalColumns} align="center">
                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                  {emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            paginatedRows.map((row) => (
              <TableRow
                key={getRowKey(row)}
                hover
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {visibleColumns.map((col) => (
                  <TableCell key={col.key} align={col.align}>
                    {getCellValue(row, col)}
                  </TableCell>
                ))}
                {renderActions && <TableCell align="right">{renderActions(row)}</TableCell>}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pagination && (
        <TablePagination
          rowsPerPageOptions={rowsPerPageOptions}
          component="div"
          count={displayRows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}
    </TableContainer>
  );
}
