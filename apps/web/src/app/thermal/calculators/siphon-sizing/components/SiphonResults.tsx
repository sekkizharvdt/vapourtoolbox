'use client';

import { useState, type RefObject } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Box,
  Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { Download as DownloadIcon } from '@mui/icons-material';
import type { SiphonSizingResult } from '@/lib/thermal/siphonSizingCalculator';
import { FITTING_NAMES, type FittingType } from '@/lib/thermal/pressureDropCalculator';
import { GenerateReportDialog } from './GenerateReportDialog';
import type { SiphonReportInputs } from './SiphonReportPDF';

interface SiphonResultsProps {
  result: SiphonSizingResult;
  inputs: SiphonReportInputs;
  diagramSvgRef?: RefObject<SVGSVGElement | null>;
}

function getVelocityColor(status: 'OK' | 'HIGH' | 'LOW'): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'OK':
      return 'success';
    case 'HIGH':
      return 'error';
    case 'LOW':
      return 'warning';
  }
}

export function SiphonResults({ result, inputs, diagramSvgRef }: SiphonResultsProps) {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  return (
    <Stack spacing={3}>
      {/* === Download Report Button === */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => setReportDialogOpen(true)}
        >
          Download Report
        </Button>
      </Box>

      {/* === Primary Result: Pipe Selection === */}
      <Card
        variant="outlined"
        sx={{
          borderColor: `${getVelocityColor(result.velocityStatus)}.main`,
          borderWidth: 2,
        }}
      >
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            {result.velocityStatus === 'OK' ? (
              <CheckCircleIcon color="success" />
            ) : (
              <WarningIcon color={getVelocityColor(result.velocityStatus)} />
            )}
            <Typography variant="h4">
              {result.pipe.nps === 'CUSTOM'
                ? `Custom ID ${result.pipe.id_mm} mm`
                : `${result.pipe.nps}" Sch 40`}
            </Typography>
            <Chip
              label={result.velocityStatus}
              color={getVelocityColor(result.velocityStatus)}
              size="small"
            />
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Nominal Diameter
              </Typography>
              <Typography variant="body1">DN{result.pipe.dn}</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Inner Diameter
              </Typography>
              <Typography variant="body1">{result.pipe.id_mm.toFixed(1)} mm</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Outer Diameter
              </Typography>
              <Typography variant="body1">{result.pipe.od_mm.toFixed(1)} mm</Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Wall Thickness
              </Typography>
              <Typography variant="body1">{result.pipe.wt_mm.toFixed(2)} mm</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* === Key Metrics Grid === */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Velocity
              </Typography>
              <Typography variant="h6">{result.velocity.toFixed(2)}</Typography>
              <Typography variant="caption" color="text.secondary">
                m/s
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Min. Siphon Height
              </Typography>
              <Typography variant="h6">{result.minimumHeight.toFixed(2)}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                m
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Flash Vapor
              </Typography>
              <Typography variant="h6">
                {result.flashOccurs ? (result.flashVaporFraction * 100).toFixed(2) : '0'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                %
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Total &Delta;P
              </Typography>
              <Typography variant="h6">
                {result.pressureDrop.totalPressureDropMbar.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                mbar
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* === Siphon Height Breakdown === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Siphon Height Breakdown
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell align="right">Value (m)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Static head (&Delta;P / &rho;g)</TableCell>
                <TableCell align="right">{result.staticHead.toFixed(3)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Friction losses (pipe + fittings)</TableCell>
                <TableCell align="right">{result.frictionHead.toFixed(3)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Safety margin (
                  {(
                    (result.safetyMargin / (result.staticHead + result.frictionHead)) *
                    100
                  ).toFixed(0)}
                  %)
                </TableCell>
                <TableCell align="right">{result.safetyMargin.toFixed(3)}</TableCell>
              </TableRow>
              <TableRow
                sx={{ '& td': { fontWeight: 'bold', borderTop: 2, borderColor: 'divider' } }}
              >
                <TableCell>Minimum Siphon Height</TableCell>
                <TableCell align="right">{result.minimumHeight.toFixed(3)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* === Pressure Drop Details === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Pressure Drop Details
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Reynolds Number
            </Typography>
            <Typography variant="body2">{result.pressureDrop.reynoldsNumber.toFixed(0)}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Flow Regime
            </Typography>
            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
              {result.pressureDrop.flowRegime}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Friction Factor
            </Typography>
            <Typography variant="body2">{result.pressureDrop.frictionFactor.toFixed(5)}</Typography>
          </Grid>
        </Grid>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell align="right">m H&#8322;O</TableCell>
                <TableCell align="right">mbar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Straight pipe ({result.totalPipeLength.toFixed(1)} m)</TableCell>
                <TableCell align="right">
                  {result.pressureDrop.straightPipeLoss.toFixed(3)}
                </TableCell>
                <TableCell align="right">
                  {(
                    (result.pressureDrop.straightPipeLoss * result.fluidDensity * 9.81) /
                    100
                  ).toFixed(1)}
                </TableCell>
              </TableRow>
              {result.pressureDrop.fittingsBreakdown.map((f) => (
                <TableRow key={f.type}>
                  <TableCell>
                    {FITTING_NAMES[f.type as FittingType]} &times; {f.count} (K={f.kFactor})
                  </TableCell>
                  <TableCell align="right">{f.loss.toFixed(3)}</TableCell>
                  <TableCell align="right">
                    {((f.loss * result.fluidDensity * 9.81) / 100).toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow
                sx={{ '& td': { fontWeight: 'bold', borderTop: 2, borderColor: 'divider' } }}
              >
                <TableCell>Total</TableCell>
                <TableCell align="right">
                  {result.pressureDrop.totalPressureDropMH2O.toFixed(3)}
                </TableCell>
                <TableCell align="right">
                  {result.pressureDrop.totalPressureDropMbar.toFixed(1)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* === Flash Vapor Section === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Flash Vapor at Downstream Effect
        </Typography>

        {result.flashOccurs ? (
          <>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Downstream Sat. Temp
                </Typography>
                <Typography variant="body2">
                  {result.downstreamSatTemp.toFixed(1)} &deg;C
                </Typography>
              </Grid>
              {result.downstreamSatTemp !== result.downstreamSatTempPure && (
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Pure Sat. Temp
                  </Typography>
                  <Typography variant="body2">
                    {result.downstreamSatTempPure.toFixed(1)} &deg;C
                  </Typography>
                </Grid>
              )}
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Vapor Flow
                </Typography>
                <Typography variant="body2">{result.flashVaporFlow.toFixed(3)} ton/hr</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Liquid After Flash
                </Typography>
                <Typography variant="body2">
                  {result.liquidFlowAfterFlash.toFixed(3)} ton/hr
                </Typography>
              </Grid>
            </Grid>
          </>
        ) : (
          <Alert severity="info" variant="outlined">
            No flash — fluid temperature ({result.downstreamSatTemp.toFixed(1)} &deg;C sat.) is
            above inlet temperature. Liquid remains subcooled.
          </Alert>
        )}
      </Paper>

      {/* === Geometry & Fluid Summary === */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Pipe Geometry &amp; Fluid Properties
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Elbows
            </Typography>
            <Typography variant="body2">{result.elbowCount}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Total Pipe Length
            </Typography>
            <Typography variant="body2">{result.totalPipeLength.toFixed(1)} m</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Fluid Temperature
            </Typography>
            <Typography variant="body2">{result.fluidTemperature.toFixed(1)} &deg;C</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Fluid Density
            </Typography>
            <Typography variant="body2">{result.fluidDensity.toFixed(2)} kg/m&sup3;</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Fluid Viscosity
            </Typography>
            <Typography variant="body2">
              {(result.fluidViscosity * 1000).toFixed(3)} mPa&middot;s
            </Typography>
          </Grid>
          {result.upstreamSatTempPure !== result.fluidTemperature && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary">
                BPE
              </Typography>
              <Typography variant="body2">
                {(result.fluidTemperature - result.upstreamSatTempPure).toFixed(2)} &deg;C
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* === Warnings === */}
      {result.warnings.length > 0 && (
        <Box>
          {result.warnings.map((warning, i) => (
            <Alert key={i} severity="warning" sx={{ mb: 1 }}>
              {warning}
            </Alert>
          ))}
        </Box>
      )}

      <Divider />

      {/* === Pressure Difference Summary === */}
      <Typography variant="caption" color="text.secondary">
        &Delta;P = {(result.pressureDiffBar * 1000).toFixed(1)} mbar ={' '}
        {result.pressureDiffBar.toFixed(4)} bar = {(result.pressureDiffBar * 100).toFixed(2)} kPa
      </Typography>

      {/* === Report Dialog === */}
      <GenerateReportDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        result={result}
        inputs={inputs}
        diagramSvgRef={diagramSvgRef}
      />
    </Stack>
  );
}
