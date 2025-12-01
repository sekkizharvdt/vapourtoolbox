'use client';

/**
 * Chamber Sizing Display
 *
 * Shows the calculated chamber dimensions with a visual height breakdown.
 */

import { Paper, Typography, Box, Stack, Divider, Grid } from '@mui/material';
import type { ChamberSizing as ChamberSizingType } from '@vapour/types';

interface ChamberSizingProps {
  sizing: ChamberSizingType;
}

export function ChamberSizing({ sizing }: ChamberSizingProps) {
  const formatNumber = (value: number, decimals: number = 0) => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Calculate percentages for visual representation
  const totalHeight = sizing.totalHeight;
  const retentionPct = (sizing.retentionZoneHeight / totalHeight) * 100;
  const flashingPct = (sizing.flashingZoneHeight / totalHeight) * 100;
  const sprayPct = (sizing.sprayZoneHeight / totalHeight) * 100;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Chamber Sizing
      </Typography>

      <Grid container spacing={4}>
        {/* Left: Dimensions Table */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Diameter (ID)
              </Typography>
              <Typography variant="h5" fontWeight="medium">
                {formatNumber(sizing.diameter)} mm
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Cross-section: {sizing.crossSectionArea.toFixed(2)} m²
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Height (T/T)
              </Typography>
              <Typography variant="h5" fontWeight="medium">
                {formatNumber(sizing.totalHeight)} mm
              </Typography>
            </Box>

            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Spray Zone</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatNumber(sizing.sprayZoneHeight)} mm
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Flashing Zone</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatNumber(sizing.flashingZoneHeight)} mm
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Retention Zone</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatNumber(sizing.retentionZoneHeight)} mm
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Total Volume</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {sizing.totalVolume.toFixed(2)} m³
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Liquid Holdup</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {sizing.liquidHoldupVolume.toFixed(2)} m³
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Grid>

        {/* Right: Visual Representation */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}
          >
            <Box
              sx={{
                width: 120,
                height: 300,
                border: 2,
                borderColor: 'primary.main',
                borderRadius: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {/* Spray Zone (Top) */}
              <Box
                sx={{
                  height: `${sprayPct}%`,
                  bgcolor: 'info.dark',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: 'white',
                    fontSize: '0.65rem',
                    textAlign: 'center',
                    px: 0.5,
                  }}
                >
                  Spray
                </Typography>
              </Box>

              {/* Flashing Zone (Middle) */}
              <Box
                sx={{
                  height: `${flashingPct}%`,
                  bgcolor: 'warning.dark',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: 'white',
                    fontSize: '0.65rem',
                    textAlign: 'center',
                    px: 0.5,
                  }}
                >
                  Flash
                </Typography>
              </Box>

              {/* Retention Zone (Bottom) */}
              <Box
                sx={{
                  height: `${retentionPct}%`,
                  bgcolor: 'primary.dark',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: 'white',
                    fontSize: '0.65rem',
                    textAlign: 'center',
                    px: 0.5,
                  }}
                >
                  Retention
                </Typography>
              </Box>

              {/* Height labels */}
              <Box
                sx={{
                  position: 'absolute',
                  right: -50,
                  top: 0,
                  bottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  py: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  {formatNumber(sizing.sprayZoneHeight)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  {formatNumber(sizing.flashingZoneHeight)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  {formatNumber(sizing.retentionZoneHeight)}
                </Typography>
              </Box>
            </Box>

            {/* Diameter label */}
            <Box sx={{ ml: 4 }}>
              <Typography variant="caption" color="text.secondary">
                ID: {formatNumber(sizing.diameter)} mm
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
