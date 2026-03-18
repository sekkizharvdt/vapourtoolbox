'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack, Button } from '@mui/material';
import { RestartAlt as ResetIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateTubeBundleGeometry,
  generateDefaultVapourLanes,
  type TubeBundleGeometryInput,
  type ExclusionZone,
} from '@/lib/thermal';
import { LateralBundleInputs, LateralBundleResults, BundleDiagram } from './components';

export default function LateralBundleClient() {
  // --- Shell geometry ---
  const [shellID, setShellID] = useState<string>('2338');
  const [side, setSide] = useState<'left' | 'right'>('left');

  // --- Tube geometry ---
  const [tubeOD, setTubeOD] = useState<string>('25.4');
  const [wallThickness, setWallThickness] = useState<string>('1.0');
  const [tubeLength, setTubeLength] = useState<string>('');
  const [tubeMaterialName, setTubeMaterialName] = useState<string>('Aluminium 5052');
  const [wallConductivity, setWallConductivity] = useState<string>('138');

  // --- Pitch & layout ---
  const [pitch, setPitch] = useState<string>('33.4');
  const [tubeHoleDiameter, setTubeHoleDiameter] = useState<string>('28.4');
  const [edgeClearance, setEdgeClearance] = useState<string>('4.6');

  // --- Vapour lanes ---
  const [numberOfLanes, setNumberOfLanes] = useState<string>('4');
  const [laneWidth, setLaneWidth] = useState<string>('60');

  // --- Nozzle exclusions ---
  const [nozzleDia1, setNozzleDia1] = useState<string>('175');
  const [nozzleDia2, setNozzleDia2] = useState<string>('273');

  // --- Spray system ---
  const [sprayFlowRate, setSprayFlowRate] = useState<string>('');
  const [sprayPressure, setSprayPressure] = useState<string>('1.5');

  const handleReset = () => {
    setShellID('2338');
    setSide('left');
    setTubeOD('25.4');
    setWallThickness('1.0');
    setTubeLength('');
    setTubeMaterialName('Aluminium 5052');
    setWallConductivity('138');
    setPitch('33.4');
    setTubeHoleDiameter('28.4');
    setEdgeClearance('4.6');
    setNumberOfLanes('4');
    setLaneWidth('60');
    setNozzleDia1('175');
    setNozzleDia2('273');
    setSprayFlowRate('');
    setSprayPressure('1.5');
  };

  // --- Live calculation ---
  const computed = useMemo(() => {
    try {
      const sid = parseFloat(shellID);
      const od = parseFloat(tubeOD);
      const p = parseFloat(pitch);
      const thd = parseFloat(tubeHoleDiameter);
      const ec = parseFloat(edgeClearance);
      const nl = parseInt(numberOfLanes, 10);
      const lw = parseFloat(laneWidth);
      const nd1 = parseFloat(nozzleDia1);
      const nd2 = parseFloat(nozzleDia2);

      if (isNaN(sid) || sid <= 0 || isNaN(od) || od <= 0 || isNaN(p) || p <= 0) return null;

      // Build exclusion zones for nozzles (positioned on the open side)
      const exclusionZones: ExclusionZone[] = [];
      const shellR = sid / 2;
      const nozzleXOffset = shellR * 0.3; // positioned on the open side

      if (!isNaN(nd1) && nd1 > 0) {
        exclusionZones.push({
          cx: side === 'left' ? nozzleXOffset : -nozzleXOffset,
          cy: shellR * 0.25, // upper nozzle
          diameter: nd1,
        });
      }
      if (!isNaN(nd2) && nd2 > 0) {
        exclusionZones.push({
          cx: side === 'left' ? nozzleXOffset : -nozzleXOffset,
          cy: -shellR * 0.1, // centre-lower nozzle
          diameter: nd2,
        });
      }

      // Generate vapour lanes
      const vapourLanes =
        !isNaN(nl) && nl > 0 && !isNaN(lw) && lw > 0
          ? generateDefaultVapourLanes(shellR, nl, lw)
          : undefined;

      const geoInput: TubeBundleGeometryInput = {
        shape: side === 'left' ? 'half_circle_left' : 'half_circle_right',
        shellID: sid,
        tubeOD: od,
        tubeHoleDiameter: !isNaN(thd) && thd > 0 ? thd : undefined,
        pitch: p,
        edgeClearance: !isNaN(ec) && ec > 0 ? ec : undefined,
        vapourLanes,
        exclusionZones: exclusionZones.length > 0 ? exclusionZones : undefined,
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
  }, [
    shellID,
    side,
    tubeOD,
    pitch,
    tubeHoleDiameter,
    edgeClearance,
    numberOfLanes,
    laneWidth,
    nozzleDia1,
    nozzleDia2,
  ]);

  const result = computed?.result ?? null;
  const geoInput = computed?.geoInput ?? null;
  const error = computed?.error ?? null;
  const tubeLenNum = parseFloat(tubeLength) || 0;
  const tubeODNum = parseFloat(tubeOD) || 25.4;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Lateral Tube Bundle" />

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Lateral Tube Bundle
          </Typography>
          <Chip label="Half-Shell" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 700 }}>
          Design a half-shell tube bundle with equilateral-triangular pitch, diagonal vapour escape
          lanes, nozzle penetration exclusions, and integrated spray nozzle selection. Based on the
          standard MED evaporator tube geometry (28.4 mm grommet hole, 33.4 mm pitch).
        </Typography>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} size="small">
          Reset
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Left: Inputs */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <LateralBundleInputs
              shellID={shellID}
              side={side}
              tubeOD={tubeOD}
              wallThickness={wallThickness}
              tubeLength={tubeLength}
              tubeMaterialName={tubeMaterialName}
              wallConductivity={wallConductivity}
              pitch={pitch}
              tubeHoleDiameter={tubeHoleDiameter}
              edgeClearance={edgeClearance}
              numberOfLanes={numberOfLanes}
              laneWidth={laneWidth}
              nozzleDia1={nozzleDia1}
              nozzleDia2={nozzleDia2}
              sprayFlowRate={sprayFlowRate}
              sprayPressure={sprayPressure}
              onShellIDChange={setShellID}
              onSideChange={setSide}
              onTubeODChange={setTubeOD}
              onWallThicknessChange={setWallThickness}
              onTubeLengthChange={setTubeLength}
              onTubeMaterialNameChange={setTubeMaterialName}
              onWallConductivityChange={setWallConductivity}
              onPitchChange={setPitch}
              onTubeHoleDiameterChange={setTubeHoleDiameter}
              onEdgeClearanceChange={setEdgeClearance}
              onNumberOfLanesChange={setNumberOfLanes}
              onLaneWidthChange={setLaneWidth}
              onNozzleDia1Change={setNozzleDia1}
              onNozzleDia2Change={setNozzleDia2}
              onSprayFlowRateChange={setSprayFlowRate}
              onSprayPressureChange={setSprayPressure}
            />
          </Paper>
        </Grid>

        {/* Centre: Diagram */}
        <Grid size={{ xs: 12, md: 4 }}>
          <BundleDiagram result={result} input={geoInput} />
        </Grid>

        {/* Right: Results */}
        <Grid size={{ xs: 12, md: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {result ? (
            <LateralBundleResults result={result} tubeOD={tubeODNum} tubeLength={tubeLenNum} />
          ) : (
            !error && (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Enter shell ID and tube geometry to see results.
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
