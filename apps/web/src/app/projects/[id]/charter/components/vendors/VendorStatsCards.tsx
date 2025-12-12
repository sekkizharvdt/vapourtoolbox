'use client';

import { Grid, Card, CardContent, Typography } from '@mui/material';
import type { OutsourcingVendor } from '@vapour/types';

interface VendorStatsCardsProps {
  vendors: OutsourcingVendor[];
}

export function VendorStatsCards({ vendors }: VendorStatsCardsProps) {
  const stats = {
    total: vendors.length,
    active: vendors.filter((v) => v.contractStatus === 'ACTIVE').length,
    negotiation: vendors.filter((v) => v.contractStatus === 'NEGOTIATION').length,
    completed: vendors.filter((v) => v.contractStatus === 'COMPLETED').length,
    totalValue: vendors.reduce((sum, v) => sum + (v.contractValue?.amount || 0), 0),
  };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 6, sm: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h4">{stats.total}</Typography>
            <Typography variant="body2" color="text.secondary">
              Total Vendors
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 6, sm: 3 }}>
        <Card sx={{ bgcolor: 'success.light' }}>
          <CardContent>
            <Typography variant="h4">{stats.active}</Typography>
            <Typography variant="body2">Active Contracts</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 6, sm: 3 }}>
        <Card sx={{ bgcolor: 'warning.light' }}>
          <CardContent>
            <Typography variant="h4">{stats.negotiation}</Typography>
            <Typography variant="body2">In Negotiation</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 6, sm: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h4">₹{(stats.totalValue / 100000).toFixed(1)}L</Typography>
            <Typography variant="body2" color="text.secondary">
              Total Contract Value
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
