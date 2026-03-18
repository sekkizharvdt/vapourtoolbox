'use client';

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Chip,
  Stack,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Divider,
} from '@mui/material';
import { RestartAlt as ResetIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateTubeBundleGeometry, type TubeBundleGeometryInput } from '@/lib/thermal';
import { BundleDiagram } from '../lateral-bundle/components/BundleDiagram';
import { LateralBundleResults } from '../lateral-bundle/components/LateralBundleResults';

export default function CentralBundleClient() {
  const [shellID, setShellID] = useState<string>('2338');
  const [bundleWidth, setBundleWidth] = useState<string>('');
  const [bundleHeight, setBundleHeight] = useState<string>('');
  const [tubeOD, setTubeOD] = useState<string>('25.4');
  const [tubeLength, setTubeLength] = useState<string>('');
  const [pitch, setPitch] = useState<string>('33.4');
  const [tubeHoleDiameter, setTubeHoleDiameter] = useState<string>('28.4');
  const [edgeClearance, setEdgeClearance] = useState<string>('4.6');
  const [sprayFluidType, setSprayFluidType] = useState<string>('SEAWATER');

  const handleReset = () => {
    setShellID('2338');
    setBundleWidth('');
    setBundleHeight('');
    setTubeOD('25.4');
    setTubeLength('');
    setPitch('33.4');
    setTubeHoleDiameter('28.4');
    setEdgeClearance('4.6');
    setSprayFluidType('SEAWATER');
  };

  // Auto-calculate max rectangle that fits inside the shell
  const maxDims = useMemo(() => {
    const sid = parseFloat(shellID);
    if (isNaN(sid) || sid <= 0) return null;
    const r = sid / 2;
    // Maximum inscribed rectangle (square): side = r × √2
    const maxSide = r * Math.SQRT2;
    return { maxWidth: Math.floor(maxSide), maxHeight: Math.floor(maxSide), shellRadius: r };
  }, [shellID]);

  const computed = useMemo(() => {
    try {
      const bw = parseFloat(bundleWidth);
      const bh = parseFloat(bundleHeight);
      const od = parseFloat(tubeOD);
      const p = parseFloat(pitch);
      const thd = parseFloat(tubeHoleDiameter);
      const ec = parseFloat(edgeClearance);

      if ([bw, bh, od, p].some((v) => isNaN(v) || v <= 0)) return null;

      const geoInput: TubeBundleGeometryInput = {
        shape: 'rectangle',
        bundleWidth: bw,
        bundleHeight: bh,
        tubeOD: od,
        tubeHoleDiameter: !isNaN(thd) && thd > 0 ? thd : undefined,
        pitch: p,
        edgeClearance: !isNaN(ec) && ec > 0 ? ec : undefined,
      };

      return {
        result: calculateTubeBundleGeometry(geoInput),
        geoInput,
        error: null,
      };
    } catch (err) {
      return {
        result: null,
        geoInput: null,
        error: err instanceof Error ? err.message : 'Calculation error',
      };
    }
  }, [bundleWidth, bundleHeight, tubeOD, pitch, tubeHoleDiameter, edgeClearance]);

  const result = computed?.result ?? null;
  const geoInput = computed?.geoInput ?? null;
  const error = computed?.error ?? null;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Central Tube Bundle" />

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Central Tube Bundle
          </Typography>
          <Chip label="Rectangular" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 700 }}>
          Design a rectangular tube bundle centred inside a cylindrical shell. Seawater or brine is
          sprayed over the tubes. Specify the bundle width and height constrained by the shell ID.
        </Typography>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} size="small">
          Reset
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Inputs */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Shell Geometry
              </Typography>

              <TextField
                label="Shell Inner Diameter"
                value={shellID}
                onChange={(e) => setShellID(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                }}
                helperText={
                  maxDims
                    ? `Max inscribed rectangle: ${maxDims.maxWidth} × ${maxDims.maxHeight} mm`
                    : undefined
                }
              />

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Bundle Width"
                  value={bundleWidth}
                  onChange={(e) => setBundleWidth(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                  }}
                />
                <TextField
                  label="Bundle Height"
                  value={bundleHeight}
                  onChange={(e) => setBundleHeight(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                  }}
                />
              </Stack>

              <TextField
                select
                label="Spray Fluid"
                value={sprayFluidType}
                onChange={(e) => setSprayFluidType(e.target.value)}
                fullWidth
              >
                <MenuItem value="SEAWATER">Seawater</MenuItem>
                <MenuItem value="BRINE">Brine</MenuItem>
              </TextField>

              <Divider />

              <Typography variant="subtitle2" color="text.secondary">
                Tube Geometry
              </Typography>

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Tube OD"
                  value={tubeOD}
                  onChange={(e) => setTubeOD(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                  }}
                />
                <TextField
                  label="Tube Length"
                  value={tubeLength}
                  onChange={(e) => setTubeLength(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">m</InputAdornment>,
                  }}
                />
              </Stack>

              <Divider />

              <Typography variant="subtitle2" color="text.secondary">
                Pitch &amp; Layout
              </Typography>

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Pitch"
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                  }}
                />
                <TextField
                  label="Tube Hole Dia"
                  value={tubeHoleDiameter}
                  onChange={(e) => setTubeHoleDiameter(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                  }}
                />
              </Stack>

              <TextField
                label="Edge Clearance"
                value={edgeClearance}
                onChange={(e) => setEdgeClearance(e.target.value)}
                type="number"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                }}
              />
            </Stack>
          </Paper>
        </Grid>

        {/* Diagram */}
        <Grid size={{ xs: 12, md: 4 }}>
          <BundleDiagram result={result} input={geoInput} />
        </Grid>

        {/* Results */}
        <Grid size={{ xs: 12, md: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {result ? (
            <LateralBundleResults
              result={result}
              tubeOD={parseFloat(tubeOD) || 25.4}
              tubeLength={parseFloat(tubeLength) || 0}
            />
          ) : (
            !error && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Enter bundle width and height to see results.
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
