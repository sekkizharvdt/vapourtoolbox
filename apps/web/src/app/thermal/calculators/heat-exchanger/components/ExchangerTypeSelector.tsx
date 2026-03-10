'use client';

/**
 * Step 1 — Select heat exchanger type.
 * Card-based selector following the pattern from HeatTransferClient.tsx.
 */

import { Box, Card, CardActionArea, CardContent, Chip, Typography } from '@mui/material';

export type ExchangerTypeId = 'CONDENSER' | 'EVAPORATOR' | 'LIQUID_LIQUID';

interface ConfigOption {
  id: ExchangerTypeId;
  label: string;
  subtitle: string;
  correlations: string;
  available: boolean;
}

const CONFIGS: ConfigOption[] = [
  {
    id: 'CONDENSER',
    label: 'Condenser (Shell & Tube)',
    subtitle: 'Steam/vapor condensing on shell side, cooling fluid in tubes',
    correlations: 'Dittus-Boelter (tube) · Nusselt Film Condensation (shell)',
    available: true,
  },
  {
    id: 'EVAPORATOR',
    label: 'Evaporator (Shell & Tube)',
    subtitle: 'Boiling on shell side, heating fluid in tubes',
    correlations: 'Chen / Mostinski (shell) · Dittus-Boelter (tube)',
    available: false,
  },
  {
    id: 'LIQUID_LIQUID',
    label: 'Liquid\u2013Liquid (Shell & Tube)',
    subtitle: 'Both sides liquid phase — general-purpose exchanger',
    correlations: 'Dittus-Boelter (tube) · Bell-Delaware (shell)',
    available: false,
  },
];

interface ExchangerTypeSelectorProps {
  value: ExchangerTypeId | null;
  onChange: (type: ExchangerTypeId) => void;
}

export function ExchangerTypeSelector({ value, onChange }: ExchangerTypeSelectorProps) {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Select Heat Exchanger Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose the type of heat transfer to design. Additional configurations are coming soon.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {CONFIGS.map((cfg) => (
          <Card
            key={cfg.id}
            variant="outlined"
            sx={{
              flex: '1 1 250px',
              maxWidth: 350,
              opacity: cfg.available ? 1 : 0.5,
              borderColor: value === cfg.id ? 'primary.main' : undefined,
              borderWidth: value === cfg.id ? 2 : 1,
            }}
          >
            <CardActionArea
              disabled={!cfg.available}
              onClick={() => onChange(cfg.id)}
              sx={{ height: '100%', p: 2 }}
            >
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  {cfg.label}
                  {!cfg.available && (
                    <Chip label="Coming Soon" size="small" sx={{ ml: 1, fontSize: '0.65rem' }} />
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {cfg.subtitle}
                </Typography>
                <Chip
                  label={cfg.correlations}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontSize: '0.65rem' }}
                />
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
