'use client';

import { memo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Rating,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as VendorIcon,
} from '@mui/icons-material';
import type { OutsourcingVendor } from '@vapour/types';

interface VendorTableProps {
  vendors: OutsourcingVendor[];
  hasManageAccess: boolean;
  onEdit: (vendor: OutsourcingVendor) => void;
  onDelete: (vendor: OutsourcingVendor) => void;
}

function getStatusColor(
  status: OutsourcingVendor['contractStatus']
): 'default' | 'primary' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'NEGOTIATION':
      return 'warning';
    case 'COMPLETED':
      return 'primary';
    case 'TERMINATED':
      return 'error';
    case 'DRAFT':
    default:
      return 'default';
  }
}

function calculateContractDuration(vendor: OutsourcingVendor): string {
  if (!vendor.contractStartDate || !vendor.contractEndDate) {
    return 'Not specified';
  }

  let startDate: Date;
  if (vendor.contractStartDate instanceof Date) {
    startDate = vendor.contractStartDate;
  } else if (typeof vendor.contractStartDate === 'object' && 'toDate' in vendor.contractStartDate) {
    startDate = vendor.contractStartDate.toDate();
  } else if (typeof vendor.contractStartDate === 'string') {
    startDate = new Date(vendor.contractStartDate);
  } else {
    return 'Not specified';
  }

  let endDate: Date;
  if (vendor.contractEndDate instanceof Date) {
    endDate = vendor.contractEndDate;
  } else if (typeof vendor.contractEndDate === 'object' && 'toDate' in vendor.contractEndDate) {
    endDate = vendor.contractEndDate.toDate();
  } else if (typeof vendor.contractEndDate === 'string') {
    endDate = new Date(vendor.contractEndDate);
  } else {
    return 'Not specified';
  }

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths > 0) {
    return `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
  }
  return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
}

export const VendorTable = memo(function VendorTable({
  vendors,
  hasManageAccess,
  onEdit,
  onDelete,
}: VendorTableProps) {
  if (vendors.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <VendorIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          No vendors assigned yet. Click &quot;Add Vendor&quot; to get started.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Vendor Name</TableCell>
            <TableCell>Scope of Work</TableCell>
            <TableCell>Contract Value</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Contact</TableCell>
            <TableCell>Performance</TableCell>
            <TableCell>Deliverables</TableCell>
            {hasManageAccess && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {vendor.vendorName}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                  {vendor.scopeOfWork}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {vendor.contractValue
                    ? `₹${(vendor.contractValue.amount / 100000).toFixed(2)}L`
                    : '-'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{calculateContractDuration(vendor)}</Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={vendor.contractStatus.replace(/_/g, ' ')}
                  size="small"
                  color={getStatusColor(vendor.contractStatus)}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">{vendor.contactPerson}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {vendor.contactEmail}
                </Typography>
              </TableCell>
              <TableCell>
                {vendor.performanceRating ? (
                  <Rating value={vendor.performanceRating} readOnly size="small" />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Not rated
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 200 }}>
                  {vendor.deliverables.slice(0, 2).map((deliverable, idx) => (
                    <Chip key={idx} label={deliverable} size="small" variant="outlined" />
                  ))}
                  {vendor.deliverables.length > 2 && (
                    <Chip
                      label={`+${vendor.deliverables.length - 2}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </TableCell>
              {hasManageAccess && (
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => onEdit(vendor)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => onDelete(vendor)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
});
