'use client';

/**
 * Settings Tab
 *
 * Currency configuration and settings.
 */

import { Box, Typography, Grid, Card, CardContent, Chip, Button } from '@mui/material';
import { CURRENCY_INFO, type SettingsTabProps } from './types';

export function SettingsTab({ currencyConfig, baseCurrency, hasCreateAccess }: SettingsTabProps) {
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Currency Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage active currencies and default settings
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {Object.entries(CURRENCY_INFO).map(([code, info]) => {
          const config = currencyConfig.find((c) => c.currency === code);
          const isActive = config?.isActive ?? (code === 'INR' || code === 'USD');
          const isBase = code === baseCurrency;

          return (
            <Grid size={{ xs: 12, md: 6 }} key={code}>
              <Card
                variant={isBase ? 'outlined' : 'elevation'}
                sx={{
                  borderColor: isBase ? 'primary.main' : undefined,
                  borderWidth: isBase ? 2 : 1,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h3">{info.flag}</Typography>
                      <Box>
                        <Typography variant="h6">
                          {code} - {info.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Symbol: {info.symbol}
                        </Typography>
                      </Box>
                    </Box>
                    {isBase && <Chip label="Base Currency" color="primary" />}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Chip
                      label={isActive ? 'Active' : 'Inactive'}
                      color={isActive ? 'success' : 'default'}
                      size="small"
                    />
                    {hasCreateAccess && !isBase && (
                      <Button size="small" variant="outlined">
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </>
  );
}
