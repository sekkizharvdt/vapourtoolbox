/**
 * Review Step Component
 *
 * Third step of purchase request form for reviewing before submission
 */

'use client';

import {
  Paper,
  Typography,
  Divider,
  Stack,
  Box,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { FormData } from './usePurchaseRequestForm';
import type { CreatePurchaseRequestItemInput } from '@/lib/procurement/purchaseRequest';
import { formatDate } from '@/lib/utils/formatters';

interface ReviewStepProps {
  formData: FormData;
  lineItems: CreatePurchaseRequestItemInput[];
}

export function ReviewStep({ formData, lineItems }: ReviewStepProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Review & Submit
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Stack spacing={3}>
        {/* Basic Info Summary */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Basic Information
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>Type:</strong> {formData.type}
            </Typography>
            <Typography variant="body2">
              <strong>Category:</strong> {formData.category}
            </Typography>
            {formData.projectName && (
              <Typography variant="body2">
                <strong>Project:</strong> {formData.projectName}
              </Typography>
            )}
            <Typography variant="body2">
              <strong>Title:</strong> {formData.title}
            </Typography>
            <Typography variant="body2">
              <strong>Description:</strong> {formData.description}
            </Typography>
            <Typography variant="body2">
              <strong>Priority:</strong> {formData.priority}
            </Typography>
            {formData.requiredBy && (
              <Typography variant="body2">
                <strong>Required By:</strong> {formatDate(new Date(formData.requiredBy))}
              </Typography>
            )}
          </Stack>
        </Box>

        <Divider />

        {/* Line Items Summary */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Line Items ({lineItems.length})
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Line #</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lineItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Alert severity="info">
          Once submitted, this purchase request will be sent to the Engineering Head for approval.
        </Alert>
      </Stack>
    </Paper>
  );
}
