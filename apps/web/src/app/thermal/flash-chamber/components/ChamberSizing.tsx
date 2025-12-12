'use client';

/**
 * Chamber Sizing Display
 *
 * Shows the calculated chamber dimensions with zone breakdowns
 * and references the ElevationDiagram for visualization.
 */

import { Paper, Typography, Box, Stack, Divider, Grid } from '@mui/material';
import type {
  ChamberSizing as ChamberSizingType,
  FlashChamberElevations,
  NozzleSizing,
} from '@vapour/types';
import { ElevationDiagram } from './ElevationDiagram';

interface ChamberSizingProps {
  sizing: ChamberSizingType;
  elevations?: FlashChamberElevations;
  nozzles?: NozzleSizing[];
}

/**
 * Format elevation value for display
 */
const formatElevation = (value: number): string => {
  return value.toFixed(3);
};

export function ChamberSizing({ sizing, elevations, nozzles }: ChamberSizingProps) {
  const formatNumber = (value: number, decimals: number = 0) => {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Chamber Sizing
      </Typography>

      <Grid container spacing={4}>
        {/* Left: Dimensions Table */}
        <Grid size={{ xs: 12, md: 5 }}>
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Vapor Velocity</Typography>
                <Typography
                  variant="body2"
                  fontWeight="medium"
                  color={
                    sizing.vaporVelocityStatus === 'OK'
                      ? 'success.main'
                      : sizing.vaporVelocityStatus === 'HIGH'
                        ? 'warning.main'
                        : 'error.main'
                  }
                >
                  {sizing.vaporVelocity.toFixed(3)} m/s
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">Vapor Loading</Typography>
                <Typography variant="body2" fontWeight="medium">
                  {sizing.vaporLoading.toFixed(3)} ton/hr/m²
                </Typography>
              </Box>
            </Stack>

            {/* Elevation Schedule */}
            {elevations && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Elevation Schedule
                  </Typography>
                  <Stack spacing={0.5}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">TTL (Top)</Typography>
                      <Typography variant="caption" fontWeight="medium">
                        EL {formatElevation(elevations.ttl)} m
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">LG-H (High Level)</Typography>
                      <Typography variant="caption" fontWeight="medium">
                        EL {formatElevation(elevations.lgHigh)} m
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="info.main">
                        Operating Level
                      </Typography>
                      <Typography variant="caption" fontWeight="medium" color="info.main">
                        EL {formatElevation(elevations.operatingLevel)} m
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">LG-L (Low Level)</Typography>
                      <Typography variant="caption" fontWeight="medium">
                        EL {formatElevation(elevations.lgLow)} m
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">BTL</Typography>
                      <Typography variant="caption" fontWeight="medium">
                        EL {formatElevation(elevations.btl)} m
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption">Pump Centerline</Typography>
                      <Typography variant="caption" fontWeight="medium">
                        EL {formatElevation(elevations.pumpCenterline)} m
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" fontWeight="bold" color="error.main">
                        FFL (Reference)
                      </Typography>
                      <Typography variant="caption" fontWeight="bold" color="error.main">
                        EL 0.000 m
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        </Grid>

        {/* Right: SVG Elevation Diagram */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              height: '100%',
              overflow: 'auto',
            }}
          >
            {elevations ? (
              <ElevationDiagram elevations={elevations} nozzles={nozzles} />
            ) : (
              // Fallback: Simple proportional display if no elevations available
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Elevation diagram not available
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
