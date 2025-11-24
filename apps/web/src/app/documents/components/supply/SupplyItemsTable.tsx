'use client';

/**
 * Supply Items Table Component
 *
 * Displays supply items in table format
 * - Item details with specifications
 * - Quantity and cost information
 * - Procurement status
 * - Action buttons
 */

import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import { Visibility as ViewIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { SupplyItem } from '@vapour/types';

interface SupplyItemsTableProps {
  items: SupplyItem[];
  onViewItem: (item: SupplyItem) => void;
  onDeleteItem: (item: SupplyItem) => void;
}

export default function SupplyItemsTable({
  items,
  onViewItem,
  onDeleteItem,
}: SupplyItemsTableProps) {
  const getProcurementStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
      NOT_INITIATED: 'default',
      PR_CREATED: 'info',
      RFQ_ISSUED: 'info',
      PO_PLACED: 'warning',
      DELIVERED: 'success',
      COMPLETED: 'success',
      CANCELLED: 'default',
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount: number | undefined, currency: string): string => {
    if (!amount) return '-';
    return `${currency} ${amount.toFixed(2)}`;
  };

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No supply items added yet. Click &quot;Add Supply Item&quot; to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Specification</TableCell>
              <TableCell width="100px" align="right">
                Quantity
              </TableCell>
              <TableCell width="120px" align="right">
                Est. Cost
              </TableCell>
              <TableCell width="130px">Procurement</TableCell>
              <TableCell width="100px" align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {item.itemName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Chip
                    label={item.itemType.replace(/_/g, ' ')}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                </TableCell>

                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                    {item.specification}
                  </Typography>
                  {item.materialGrade && (
                    <Chip
                      label={item.materialGrade}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', mt: 0.5 }}
                    />
                  )}
                </TableCell>

                <TableCell align="right">
                  <Typography variant="body2">
                    {item.quantity} {item.unit}
                  </Typography>
                </TableCell>

                <TableCell align="right">
                  <Typography variant="body2">
                    {formatCurrency(item.estimatedTotalCost, item.currency)}
                  </Typography>
                  {item.estimatedUnitCost && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      @{formatCurrency(item.estimatedUnitCost, item.currency)}/{item.unit}
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  <Chip
                    label={item.procurementStatus.replace(/_/g, ' ')}
                    size="small"
                    color={getProcurementStatusColor(item.procurementStatus)}
                    sx={{ fontSize: '0.7rem' }}
                  />
                  {item.linkedPurchaseRequestNumber && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 0.5 }}
                    >
                      PR: {item.linkedPurchaseRequestNumber}
                    </Typography>
                  )}
                </TableCell>

                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => onViewItem(item)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => onDeleteItem(item)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
