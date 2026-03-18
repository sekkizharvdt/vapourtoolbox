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
import {
  calculateTubeBundleGeometry,
  type BundleShape,
  type TubeBundleGeometryInput,
} from '@/lib/thermal';
import { BundleDiagram } from '../lateral-bundle/components/BundleDiagram';
import { LateralBundleResults } from '../lateral-bundle/components/LateralBundleResults';

const SHAPE_LABELS: Record<BundleShape, string> = {
  full_circle: 'Full Circle',
  half_circle_left: 'Half Circle (Left)',
  half_circle_right: 'Half Circle (Right)',
  rectangle: 'Rectangle',
};

export default function CustomBundleClient() {
  const [shape, setShape] = useState<BundleShape>('full_circle');
  const [shellID, setShellID] = useState<string>('');
  const [bundleWidth, setBundleWidth] = useState<string>('');
  const [bundleHeight, setBundleHeight] = useState<string>('');
  const [tubeOD, setTubeOD] = useState<string>('25.4');
  const [tubeLength, setTubeLength] = useState<string>('');
  const [pitch, setPitch] = useState<string>('33.4');
  const [tubeHoleDiameter, setTubeHoleDiameter] = useState<string>('28.4');
  const [edgeClearance, setEdgeClearance] = useState<string>('4.6');

  const isCircular = shape !== 'rectangle';

  const handleReset = () => {
    setShape('full_circle');
    setShellID('');
    setBundleWidth('');
    setBundleHeight('');
    setTubeOD('25.4');
    setTubeLength('');
    setPitch('33.4');
    setTubeHoleDiameter('28.4');
    setEdgeClearance('4.6');
  };

  const computed = useMemo(() => {
    try {
      const od = parseFloat(tubeOD);
      const p = parseFloat(pitch);
      const thd = parseFloat(tubeHoleDiameter);
      const ec = parseFloat(edgeClearance);

      if (isNaN(od) || od <= 0 || isNaN(p) || p <= 0) return null;

      const geoInput: TubeBundleGeometryInput = {
        shape,
        tubeOD: od,
        tubeHoleDiameter: !isNaN(thd) && thd > 0 ? thd : undefined,
        pitch: p,
        edgeClearance: !isNaN(ec) && ec > 0 ? ec : undefined,
      };

      if (isCircular) {
        const sid = parseFloat(shellID);
        if (isNaN(sid) || sid <= 0) return null;
        geoInput.shellID = sid;
      } else {
        const bw = parseFloat(bundleWidth);
        const bh = parseFloat(bundleHeight);
        if (isNaN(bw) || bw <= 0 || isNaN(bh) || bh <= 0) return null;
        geoInput.bundleWidth = bw;
        geoInput.bundleHeight = bh;
      }

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
  }, [
    shape,
    shellID,
    bundleWidth,
    bundleHeight,
    tubeOD,
    pitch,
    tubeHoleDiameter,
    edgeClearance,
    isCircular,
  ]);

  const result = computed?.result ?? null;
  const geoInput = computed?.geoInput ?? null;
  const error = computed?.error ?? null;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Custom Tube Bundle" />

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Custom Tube Bundle
          </Typography>
          <Chip label="Geometry" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 700 }}>
          Design a custom tube bundle — choose the boundary shape, shell diameter or bundle
          dimensions, pitch, and tube specs to calculate tube count, row distribution, and heat
          transfer surface area.
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
                Bundle Shape
              </Typography>

              <TextField
                select
                label="Shape"
                value={shape}
                onChange={(e) => setShape(e.target.value as BundleShape)}
                fullWidth
              >
                {(Object.keys(SHAPE_LABELS) as BundleShape[]).map((key) => (
                  <MenuItem key={key} value={key}>
                    {SHAPE_LABELS[key]}
                  </MenuItem>
                ))}
              </TextField>

              {isCircular ? (
                <TextField
                  label="Shell Inner Diameter"
                  value={shellID}
                  onChange={(e) => setShellID(e.target.value)}
                  type="number"
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                  }}
                />
              ) : (
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
              )}

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
                  Enter dimensions to see tube count and layout.
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
