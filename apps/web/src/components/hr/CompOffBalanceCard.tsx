'use client';

import { Card, CardContent, Typography, Box, Chip, Alert } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';

interface CompOffBalanceCardProps {
  balance: {
    entitled: number;
    used: number;
    pending: number;
    available: number;
  } | null;
  loading?: boolean;
  expiringCount?: number; // Optional: number of comp-offs expiring soon
}

export default function CompOffBalanceCard({
  balance,
  loading = false,
  expiringCount = 0,
}: CompOffBalanceCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Compensatory Leave Balance
          </Typography>
          <Typography>Loading...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!balance) {
    return null;
  }

  const hasBalance = balance.available > 0;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Compensatory Leave Balance</Typography>
          {hasBalance && (
            <Chip
              icon={<CheckCircleIcon />}
              label={`${balance.available} day(s) available`}
              color="success"
              size="small"
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Comp-off earned by working on holidays. Use this balance when applying for leave.
        </Typography>

        {expiringCount > 0 && (
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
            {expiringCount} comp-off day(s) expiring within 30 days. Please use them soon.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Entitled
            </Typography>
            <Typography variant="h6">{balance.entitled}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Used
            </Typography>
            <Typography variant="h6">{balance.used}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Pending
            </Typography>
            <Typography variant="h6">{balance.pending}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Available
            </Typography>
            <Typography variant="h6" color={hasBalance ? 'success.main' : 'text.primary'}>
              {balance.available}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
