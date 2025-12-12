'use client';

import { Paper, Typography, Box, Stack, Divider, Chip, Button } from '@mui/material';
import { useRouter } from 'next/navigation';
import type { ThreeWayMatch } from '@vapour/types';
import { formatPercentage } from '@/lib/procurement/threeWayMatchHelpers';
import { formatDate } from '@/lib/utils/formatters';

interface MatchSidebarProps {
  match: ThreeWayMatch;
}

export function MatchSidebar({ match }: MatchSidebarProps) {
  const router = useRouter();

  return (
    <>
      {/* Match Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Match Status
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Overall Match %
            </Typography>
            <Chip
              label={formatPercentage(match.overallMatchPercentage)}
              color={
                match.overallMatchPercentage >= 95
                  ? 'success'
                  : match.overallMatchPercentage >= 80
                    ? 'warning'
                    : 'error'
              }
            />
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Matched Lines
            </Typography>
            <Typography variant="body1">
              {match.matchedLines} / {match.totalLines}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Variance %
            </Typography>
            <Typography
              variant="body1"
              color={Math.abs(match.variancePercentage) < 1 ? 'success.main' : 'error.main'}
            >
              {formatPercentage(match.variancePercentage)}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Reference Documents */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Reference Documents
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Purchase Order
            </Typography>
            <Button
              size="small"
              onClick={() => router.push(`/procurement/pos/${match.purchaseOrderId}`)}
            >
              {match.poNumber}
            </Button>
          </Box>
          <Divider />
          <Box>
            <Typography variant="body2" color="text.secondary">
              Goods Receipt
            </Typography>
            <Button
              size="small"
              onClick={() => router.push(`/procurement/goods-receipts/${match.goodsReceiptId}`)}
            >
              {match.grNumber}
            </Button>
          </Box>
          <Divider />
          <Box>
            <Typography variant="body2" color="text.secondary">
              Vendor Bill
            </Typography>
            <Typography variant="body1">{match.vendorBillNumber}</Typography>
            <Typography variant="caption" color="text.secondary">
              Invoice: {match.vendorInvoiceNumber}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Timeline */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Timeline
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Matched At
            </Typography>
            <Typography variant="body1">{formatDate(match.matchedAt)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Vendor
            </Typography>
            <Typography variant="body1">{match.vendorName}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Project
            </Typography>
            <Typography variant="body1">{match.projectName}</Typography>
          </Box>
        </Stack>
      </Paper>
    </>
  );
}
