'use client';

import { Box, Typography, Chip, Paper } from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import { formatCurrency } from '@/lib/utils/formatters';
import type { BusinessEntity } from '@vapour/types';

interface EntityInfoCardProps {
  entity: BusinessEntity;
}

export function EntityInfoCard({ entity }: EntityInfoCardProps) {
  const hasOpeningBalance = entity.openingBalance && entity.openingBalance > 0;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <BusinessIcon fontSize="large" color="primary" />
        <Box>
          <Typography variant="h6">{entity.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {entity.code} • {entity.contactPerson} • {entity.email}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          {hasOpeningBalance && (
            <Chip
              label={`Opening: ${formatCurrency(entity.openingBalance!, 'INR')} ${entity.openingBalanceType || 'DR'}`}
              size="small"
              color={entity.openingBalanceType === 'CR' ? 'error' : 'success'}
              variant="outlined"
            />
          )}
          {entity.roles.map((role) => (
            <Chip
              key={role}
              label={role}
              size="small"
              color={role === 'CUSTOMER' ? 'success' : role === 'VENDOR' ? 'info' : 'default'}
            />
          ))}
        </Box>
      </Box>
      {entity.billingAddress && (
        <Typography variant="body2" color="text.secondary">
          {[entity.billingAddress.line1, entity.billingAddress.city, entity.billingAddress.state]
            .filter(Boolean)
            .join(', ')}
        </Typography>
      )}
    </Paper>
  );
}
