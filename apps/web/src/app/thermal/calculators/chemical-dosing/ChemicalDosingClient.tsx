'use client';

/**
 * Chemical Dosing & CIP Calculator
 *
 * Two tabs:
 *   1. Chemical Dosing — shared feed flow, toggle antiscalant / anti-foam
 *   2. Acid CIP        — heat exchanger cleaning system design
 */

import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Chip,
  Stack,
  TextField,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  Tab,
  Tabs,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Science as ScienceIcon,
  CleaningServices as CleanIcon,
  ExpandMore as ExpandMoreIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateDosing,
  calculateCIP,
  CHEMICAL_PRODUCTS,
  ACID_PRODUCTS,
  type ChemicalType,
  type AcidType,
  type DosingResult,
  type CIPResult,
} from '@/lib/thermal';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({
    default: m.GenerateReportDialog,
  }))
);

type TabValue = 'dosing' | 'cip';

// ── Shared table cell helpers ────────────────────────────────────────────────

function Adornment({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
      {children}
    </Typography>
  );
}

function TdLabel({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <TableCell
      sx={{
        color: 'text.secondary',
        fontSize: '0.8rem',
        ...(bold && { fontWeight: 'bold', color: 'text.primary' }),
      }}
    >
      {children}
    </TableCell>
  );
}

function TdValue({ children, bold }: { children?: React.ReactNode; bold?: boolean }) {
  return (
    <TableCell align="right" sx={{ fontSize: '0.8rem', ...(bold && { fontWeight: 'bold' }) }}>
      {children}
    </TableCell>
  );
}

function TankDimLabel({
  tank,
}: {
  tank: import('@/lib/thermal/chemicalDosingCalculator').TankDimensions;
}) {
  if (tank.type === 'cylindrical' && tank.diameter) {
    return (
      <>
        D = {(tank.diameter * 1000).toFixed(0)} mm, H = {(tank.height * 1000).toFixed(0)} mm
      </>
    );
  }
  if (tank.type === 'rectangular' && tank.length && tank.width) {
    return (
      <>
        L = {(tank.length * 1000).toFixed(0)} mm, W = {(tank.width * 1000).toFixed(0)} mm, H ={' '}
        {(tank.height * 1000).toFixed(0)} mm
      </>
    );
  }
  return <>H = {(tank.height * 1000).toFixed(0)} mm</>;
}

// ── Per-chemical input section (no feed flow — shared) ───────────────────────

interface ChemicalInputProps {
  chemType: ChemicalType;
  dose: string;
  setDose: (v: string) => void;
  density: string;
  setDensity: (v: string) => void;
  storageDays: string;
  setStorageDays: (v: string) => void;
  linePressure: string;
  setLinePressure: (v: string) => void;
  neatConc: string;
  setNeatConc: (v: string) => void;
  workingConc: string;
  setWorkingConc: (v: string) => void;
  dilutionTankDays: string;
  setDilutionTankDays: (v: string) => void;
}

function ChemicalInputSection({
  chemType,
  dose,
  setDose,
  density,
  setDensity,
  storageDays,
  setStorageDays,
  linePressure,
  setLinePressure,
  neatConc,
  setNeatConc,
  workingConc,
  setWorkingConc,
  dilutionTankDays,
  setDilutionTankDays,
}: ChemicalInputProps) {
  const product = CHEMICAL_PRODUCTS[chemType];
  return (
    <Stack spacing={1.5}>
      {/* Product info */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: chemType === 'antiscalant' ? 'primary.50' : 'success.50',
          borderRadius: 1,
          border: '1px solid',
          borderColor: chemType === 'antiscalant' ? 'primary.200' : 'success.200',
        }}
      >
        <Typography
          variant="body2"
          fontWeight="bold"
          color={chemType === 'antiscalant' ? 'primary.dark' : 'success.dark'}
        >
          {product.productName}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {product.manufacturer} — {product.purpose}
        </Typography>
      </Box>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6 }}>
          <TextField
            label="Dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            fullWidth
            size="small"
            type="number"
            helperText={`${product.typicalDoseMin}–${product.typicalDoseMax} mg/L`}
            slotProps={{ input: { endAdornment: <Adornment>mg/L</Adornment> } }}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label="Solution Density"
            value={density}
            onChange={(e) => setDensity(e.target.value)}
            fullWidth
            size="small"
            type="number"
            helperText={`Default: ${product.defaultDensity} kg/L`}
            slotProps={{ input: { endAdornment: <Adornment>kg/L</Adornment> } }}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label="Storage Days"
            value={storageDays}
            onChange={(e) => setStorageDays(e.target.value)}
            fullWidth
            size="small"
            type="number"
            helperText="Bulk tank sizing"
            slotProps={{ input: { endAdornment: <Adornment>days</Adornment> } }}
          />
        </Grid>
        <Grid size={{ xs: 6 }}>
          <TextField
            label="Line Pressure"
            value={linePressure}
            onChange={(e) => setLinePressure(e.target.value)}
            fullWidth
            size="small"
            type="number"
            helperText="At injection point"
            slotProps={{ input: { endAdornment: <Adornment>bar(g)</Adornment> } }}
          />
        </Grid>
      </Grid>

      {/* Dilution — collapsed by default */}
      <Accordion
        disableGutters
        sx={{ '&:before': { display: 'none' }, boxShadow: 'none', bgcolor: 'transparent' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 32 }}>
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
            Dilution (optional)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0 }}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Neat Conc."
                value={neatConc}
                onChange={(e) => setNeatConc(e.target.value)}
                fullWidth
                size="small"
                type="number"
                slotProps={{ input: { endAdornment: <Adornment>%</Adornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Working Conc."
                value={workingConc}
                onChange={(e) => setWorkingConc(e.target.value)}
                fullWidth
                size="small"
                type="number"
                slotProps={{ input: { endAdornment: <Adornment>%</Adornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Day Tank"
                value={dilutionTankDays}
                onChange={(e) => setDilutionTankDays(e.target.value)}
                fullWidth
                size="small"
                type="number"
                slotProps={{ input: { endAdornment: <Adornment>days</Adornment> } }}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}

// ── Dosing result card (compact, per chemical) ───────────────────────────────

function DosingResultCard({ chemType, result }: { chemType: ChemicalType; result: DosingResult }) {
  const product = CHEMICAL_PRODUCTS[chemType];
  const colorScheme =
    chemType === 'antiscalant'
      ? { bg: '#e3f2fd', border: '#1565c0', text: 'primary.dark' as const }
      : { bg: '#e8f5e9', border: '#2e7d32', text: 'success.dark' as const };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {product.productName}
      </Typography>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
          {result.warnings.map((w, i) => (
            <Typography key={i} variant="caption">
              {w}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Key metrics */}
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        {[
          {
            label: 'Dosing Flow',
            value:
              result.chemicalFlowLh < 1
                ? `${result.chemicalFlowMlMin.toFixed(1)} mL/min`
                : `${result.chemicalFlowLh.toFixed(2)} L/h`,
          },
          { label: 'Daily', value: `${result.dailyConsumptionKg.toFixed(2)} kg/day` },
          { label: 'Annual', value: `${result.annualConsumptionKg.toFixed(0)} kg/yr` },
        ].map((m) => (
          <Grid key={m.label} size={{ xs: 4 }}>
            <Box
              sx={{
                bgcolor: colorScheme.bg,
                border: `1px solid ${colorScheme.border}`,
                borderRadius: 1,
                p: 1,
                textAlign: 'center',
              }}
            >
              <Typography variant="caption" color={colorScheme.text} display="block">
                {m.label}
              </Typography>
              <Typography variant="body2" color={colorScheme.text} fontWeight="bold">
                {m.value}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Detail table */}
      <Table size="small">
        <TableBody>
          <TableRow>
            <TdLabel>Pump flow</TdLabel>
            <TdValue>{result.chemicalFlowLh.toFixed(4)} L/h</TdValue>
            <TdValue>{result.chemicalFlowMlMin.toFixed(2)} mL/min</TdValue>
          </TableRow>
          <TableRow>
            <TdLabel>Active chemical</TdLabel>
            <TdValue>{result.activeChemicalGh.toFixed(2)} g/h</TdValue>
            <TdValue>{((result.activeChemicalGh * 24) / 1000).toFixed(3)} kg/day</TdValue>
          </TableRow>
          <TableRow>
            <TdLabel>Monthly</TdLabel>
            <TdValue bold>{result.monthlyConsumptionKg.toFixed(2)} kg/mo</TdValue>
            <TdValue />
          </TableRow>
          <TableRow>
            <TdLabel>Dosing tubing</TdLabel>
            <TdValue>
              {result.dosingLine.tubingOD} mm OD / {result.dosingLine.tubingID} mm ID
            </TdValue>
            <TdValue>
              {result.dosingLine.velocity.toFixed(2)} m/s
              {result.dosingLine.velocityStatus !== 'ok' &&
                ` (${result.dosingLine.velocityStatus})`}
            </TdValue>
          </TableRow>
          {result.pumpPressure && (
            <TableRow>
              <TdLabel>Pump discharge</TdLabel>
              <TdValue bold>
                {result.pumpPressure.requiredDischargePressure.toFixed(1)} bar(g)
              </TdValue>
              <TdValue>
                {result.pumpPressure.linePressure} + {result.pumpPressure.backPressureValve} +{' '}
                {result.pumpPressure.injectionLoss}
              </TdValue>
            </TableRow>
          )}
          {result.dilution && (
            <>
              <TableRow>
                <TdLabel>Dilution</TdLabel>
                <TdValue>
                  {result.dilution.neatConcentration}% → {result.dilution.workingConcentration}% (
                  {result.dilution.dilutionRatio.toFixed(1)}:1)
                </TdValue>
                <TdValue>{result.dilution.dilutedSolutionFlowLh.toFixed(4)} L/h total</TdValue>
              </TableRow>
              {result.dilution.dilutionTank && (
                <TableRow>
                  <TdLabel>Dilution tank</TdLabel>
                  <TdValue>{result.dilution.dilutionTank.volumeLitres.toFixed(0)} L</TdValue>
                  <TdValue>
                    <TankDimLabel tank={result.dilution.dilutionTank} />
                  </TdValue>
                </TableRow>
              )}
            </>
          )}
          {result.storageTank && (
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TdLabel bold>Storage tank</TdLabel>
              <TdValue bold>
                {result.storageTank.volumeLitres.toFixed(0)} L (
                {result.storageTank.volume.toFixed(3)} m³)
              </TdValue>
              <TdValue>
                <TankDimLabel tank={result.storageTank} />
              </TdValue>
            </TableRow>
          )}
          {result.bundVolume !== undefined && (
            <TableRow>
              <TdLabel>Bund volume (110%)</TdLabel>
              <TdValue>{result.bundVolume.toFixed(3)} m³</TdValue>
              <TdValue />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ── CIP Input Form ───────────────────────────────────────────────────────────

interface CIPFormProps {
  acidType: AcidType;
  setAcidType: (v: AcidType) => void;
  hxArea: string;
  setHxArea: (v: string) => void;
  specificVolume: string;
  setSpecificVolume: (v: string) => void;
  pipingHoldup: string;
  setPipingHoldup: (v: string) => void;
  cleaningConc: string;
  setCleaningConc: (v: string) => void;
  recircFlow: string;
  setRecircFlow: (v: string) => void;
  cleaningDuration: string;
  setCleaningDuration: (v: string) => void;
  numRinses: string;
  setNumRinses: (v: string) => void;
  cleaningsPerYear: string;
  setCleaningsPerYear: (v: string) => void;
  storageDays: string;
  setStorageDays: (v: string) => void;
  tankType: 'cylindrical' | 'rectangular';
  setTankType: (v: 'cylindrical' | 'rectangular') => void;
}

function CIPForm({
  acidType,
  setAcidType,
  hxArea,
  setHxArea,
  specificVolume,
  setSpecificVolume,
  pipingHoldup,
  setPipingHoldup,
  cleaningConc,
  setCleaningConc,
  recircFlow,
  setRecircFlow,
  cleaningDuration,
  setCleaningDuration,
  numRinses,
  setNumRinses,
  cleaningsPerYear,
  setCleaningsPerYear,
  storageDays,
  setStorageDays,
  tankType,
  setTankType,
}: CIPFormProps) {
  const acid = ACID_PRODUCTS[acidType];

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          p: 1.5,
          bgcolor: 'warning.50',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'warning.200',
        }}
      >
        <Typography variant="body2" fontWeight="bold" color="warning.dark">
          {acid.name} ({acid.formula})
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Supplied at {acid.neatConcentration}% w/w, density {acid.neatDensity} kg/L
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          {acid.notes}
        </Typography>
      </Box>

      <FormControl fullWidth size="small">
        <InputLabel>Acid Type</InputLabel>
        <Select
          value={acidType}
          label="Acid Type"
          onChange={(e) => setAcidType(e.target.value as AcidType)}
        >
          {Object.values(ACID_PRODUCTS).map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name} ({a.formula})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Heat Exchanger Surface Area"
        value={hxArea}
        onChange={(e) => setHxArea(e.target.value)}
        fullWidth
        size="small"
        type="number"
        slotProps={{ input: { endAdornment: <Adornment>m²</Adornment> } }}
      />

      <TextField
        label="Specific Volume"
        value={specificVolume}
        onChange={(e) => setSpecificVolume(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText="Litres per m² of HX surface (default 3)"
        slotProps={{ input: { endAdornment: <Adornment>L/m²</Adornment> } }}
      />

      <TextField
        label="Piping Hold-up Volume"
        value={pipingHoldup}
        onChange={(e) => setPipingHoldup(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText="Additional piping volume"
        slotProps={{ input: { endAdornment: <Adornment>m³</Adornment> } }}
      />

      <Divider />

      <TextField
        label="Cleaning Concentration"
        value={cleaningConc}
        onChange={(e) => setCleaningConc(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText={`Typical: ${acid.typicalCleaningMin}–${acid.typicalCleaningMax}% w/w`}
        slotProps={{ input: { endAdornment: <Adornment>% w/w</Adornment> } }}
      />

      <TextField
        label="Recirculation Flow (Brine Pump)"
        value={recircFlow}
        onChange={(e) => setRecircFlow(e.target.value)}
        fullWidth
        size="small"
        type="number"
        slotProps={{ input: { endAdornment: <Adornment>m³/h</Adornment> } }}
      />

      <TextField
        label="Cleaning Duration"
        value={cleaningDuration}
        onChange={(e) => setCleaningDuration(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText="Acid recirculation time"
        slotProps={{ input: { endAdornment: <Adornment>hours</Adornment> } }}
      />

      <TextField
        label="Number of Rinses"
        value={numRinses}
        onChange={(e) => setNumRinses(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText="Fresh water rinses after acid"
      />

      <TextField
        label="Cleanings per Year"
        value={cleaningsPerYear}
        onChange={(e) => setCleaningsPerYear(e.target.value)}
        fullWidth
        size="small"
        type="number"
      />

      <Divider />

      <TextField
        label="Acid Storage Days"
        value={storageDays}
        onChange={(e) => setStorageDays(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText="Neat acid bulk storage"
        slotProps={{ input: { endAdornment: <Adornment>days</Adornment> } }}
      />

      <FormControl fullWidth size="small">
        <InputLabel>Tank Shape</InputLabel>
        <Select
          value={tankType}
          label="Tank Shape"
          onChange={(e) => setTankType(e.target.value as 'cylindrical' | 'rectangular')}
        >
          <MenuItem value="cylindrical">Cylindrical</MenuItem>
          <MenuItem value="rectangular">Rectangular</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}

// ── CIP Result Panel ─────────────────────────────────────────────────────────

function CIPResultPanel({
  acidType,
  hxArea,
  specificVolume,
  pipingHoldup,
  cleaningConc,
  recircFlow,
  cleaningDuration,
  numRinses,
  cleaningsPerYear,
  storageDays,
  tankType,
  onResult,
}: {
  acidType: AcidType;
  hxArea: string;
  specificVolume: string;
  pipingHoldup: string;
  cleaningConc: string;
  recircFlow: string;
  cleaningDuration: string;
  numRinses: string;
  cleaningsPerYear: string;
  storageDays: string;
  tankType: 'cylindrical' | 'rectangular';
  onResult?: (result: CIPResult | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const computed = useMemo(() => {
    try {
      const area = parseFloat(hxArea);
      const conc = parseFloat(cleaningConc);
      const flow = parseFloat(recircFlow);
      const dur = parseFloat(cleaningDuration);
      const rinses = parseInt(numRinses, 10);
      const cpy = parseFloat(cleaningsPerYear);

      if (isNaN(area) || area <= 0 || isNaN(conc) || conc <= 0 || isNaN(flow) || flow <= 0) {
        return { result: null, error: null };
      }
      if (isNaN(dur) || dur <= 0 || isNaN(rinses) || rinses < 0 || isNaN(cpy) || cpy <= 0) {
        return { result: null, error: null };
      }

      const sv = parseFloat(specificVolume);
      const ph = parseFloat(pipingHoldup);
      const sd = parseFloat(storageDays);

      const result = calculateCIP({
        acidType,
        heatExchangerArea: area,
        specificVolume: isNaN(sv) || sv <= 0 ? undefined : sv,
        pipingHoldup: isNaN(ph) || ph < 0 ? undefined : ph,
        cleaningConcentration: conc,
        recirculationFlowM3h: flow,
        cleaningDurationHrs: dur,
        numberOfRinses: rinses,
        cleaningsPerYear: cpy,
        storageDays: isNaN(sd) || sd <= 0 ? undefined : sd,
        tankType,
      });
      return { result, error: null };
    } catch (err) {
      return {
        result: null,
        error: err instanceof Error ? err.message : 'Calculation error',
      };
    }
  }, [
    acidType,
    hxArea,
    specificVolume,
    pipingHoldup,
    cleaningConc,
    recircFlow,
    cleaningDuration,
    numRinses,
    cleaningsPerYear,
    storageDays,
    tankType,
  ]);

  useEffect(() => {
    setError(computed.error);
  }, [computed.error]);

  useEffect(() => {
    onResult?.(computed.result);
  }, [computed.result, onResult]);

  const result = computed.result;
  const acid = ACID_PRODUCTS[acidType];

  if (error) return <Alert severity="error">{error}</Alert>;

  if (!result) {
    return (
      <Paper
        sx={{
          p: 4,
          textAlign: 'center',
          bgcolor: 'action.hover',
          border: '2px dashed',
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Enter heat exchanger area, cleaning concentration, and recirculation flow to calculate
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      {result.warnings.length > 0 && (
        <Alert severity="warning">
          {result.warnings.map((w, i) => (
            <Typography key={i} variant="body2">
              {w}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Key cards */}
      <Grid container spacing={2}>
        {[
          {
            label: 'System Volume',
            value: `${result.systemVolumeLitres.toFixed(0)} L`,
            sub: `${result.systemVolume.toFixed(3)} m³`,
            color: '#e3f2fd',
            border: '#1565c0',
            text: 'primary.dark',
          },
          {
            label: `Neat ${acid.name} / Clean`,
            value: `${result.neatAcidLitres.toFixed(1)} L`,
            sub: `${result.neatAcidMassKg.toFixed(1)} kg`,
            color: '#fff3e0',
            border: '#e65100',
            text: 'warning.dark',
          },
          {
            label: 'Annual Acid',
            value: `${result.annualNeatAcidKg.toFixed(0)} kg/yr`,
            sub: `${result.annualNeatAcidLitres.toFixed(0)} L/yr`,
            color: '#fce4ec',
            border: '#c62828',
            text: 'error.dark',
          },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 4 }}>
            <Box
              sx={{
                bgcolor: card.color,
                border: `1.5px solid ${card.border}`,
                borderRadius: 2,
                p: 2,
                textAlign: 'center',
              }}
            >
              <Typography variant="caption" color={card.text} display="block">
                {card.label}
              </Typography>
              <Typography variant="subtitle1" color={card.text} fontWeight="bold">
                {card.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {card.sub}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* System volume breakdown */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          System Volume
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TdLabel>Heat exchanger volume</TdLabel>
              <TdValue>{(result.hxVolume * 1000).toFixed(0)} L</TdValue>
              <TdValue>{result.hxVolume.toFixed(3)} m³</TdValue>
            </TableRow>
            <TableRow>
              <TdLabel>Piping hold-up</TdLabel>
              <TdValue>{(result.pipingVolume * 1000).toFixed(0)} L</TdValue>
              <TdValue>{result.pipingVolume.toFixed(3)} m³</TdValue>
            </TableRow>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TdLabel bold>Total</TdLabel>
              <TdValue bold>{result.systemVolumeLitres.toFixed(0)} L</TdValue>
              <TdValue bold>{result.systemVolume.toFixed(3)} m³</TdValue>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Per-clean quantities */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Per-Clean Quantities
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TdLabel>Dilute solution volume</TdLabel>
              <TdValue>{(result.diluteSolutionVolume * 1000).toFixed(0)} L</TdValue>
            </TableRow>
            <TableRow>
              <TdLabel>
                Neat {acid.name} ({acid.neatConcentration}%)
              </TdLabel>
              <TdValue bold>
                {result.neatAcidLitres.toFixed(1)} L ({result.neatAcidMassKg.toFixed(1)} kg)
              </TdValue>
            </TableRow>
            <TableRow>
              <TdLabel>Dilution water</TdLabel>
              <TdValue>{(result.dilutionWaterVolume * 1000).toFixed(0)} L</TdValue>
            </TableRow>
            <TableRow>
              <TdLabel>Rinse water ({numRinses} rinses)</TdLabel>
              <TdValue>{(result.totalRinseWater * 1000).toFixed(0)} L</TdValue>
            </TableRow>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TdLabel bold>Total water per clean</TdLabel>
              <TdValue bold>
                {(result.totalWaterPerClean * 1000).toFixed(0)} L (
                {result.totalWaterPerClean.toFixed(2)} m³)
              </TdValue>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Recirculation */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Recirculation
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TdLabel>Volume turnovers</TdLabel>
              <TdValue>
                {result.volumeTurnovers.toFixed(1)}×
                {result.turnoverStatus === 'low' && (
                  <Chip
                    label="LOW"
                    size="small"
                    color="error"
                    sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                  />
                )}
                {result.turnoverStatus === 'ok' && (
                  <Chip
                    label="OK"
                    size="small"
                    color="success"
                    sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                  />
                )}
              </TdValue>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Annual + tanks */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Annual Consumption &amp; Tank Sizing</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TdLabel>Neat {acid.name} / year</TdLabel>
                <TdValue>{result.annualNeatAcidKg.toFixed(0)} kg</TdValue>
                <TdValue>{result.annualNeatAcidLitres.toFixed(0)} L</TdValue>
              </TableRow>
              <TableRow>
                <TdLabel>Total water / year</TdLabel>
                <TdValue>{result.annualWaterM3.toFixed(1)} m³</TdValue>
                <TdValue />
              </TableRow>
            </TableBody>
          </Table>
          <Divider sx={{ my: 1 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>Tank</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>Volume</TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>Dimensions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TdLabel>CIP Mixing Tank</TdLabel>
                <TdValue>
                  {result.cipTank.volumeLitres.toFixed(0)} L ({result.cipTank.volume.toFixed(3)} m³)
                </TdValue>
                <TdValue>
                  <TankDimLabel tank={result.cipTank} />
                </TdValue>
              </TableRow>
              {result.storageTank && (
                <>
                  <TableRow>
                    <TdLabel>Neat Acid Storage</TdLabel>
                    <TdValue>
                      {result.storageTank.volumeLitres.toFixed(0)} L (
                      {result.storageTank.volume.toFixed(3)} m³)
                    </TdValue>
                    <TdValue>
                      <TankDimLabel tank={result.storageTank} />
                    </TdValue>
                  </TableRow>
                  {result.bundVolume !== undefined && (
                    <TableRow>
                      <TdLabel>Bund (110%)</TdLabel>
                      <TdValue>{result.bundVolume.toFixed(3)} m³</TdValue>
                      <TdValue />
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ChemicalDosingClient() {
  const [tab, setTab] = useState<TabValue>('dosing');

  // Shared feed flow
  const [feedFlow, setFeedFlow] = useState('');

  // Chemical selection
  const [enableAntiscalant, setEnableAntiscalant] = useState(true);
  const [enableAntifoam, setEnableAntifoam] = useState(false);

  // Shared tank type
  const [tankType, setTankType] = useState<'cylindrical' | 'rectangular'>('cylindrical');

  // Antiscalant state
  const [asDose, setAsDose] = useState('2');
  const [asDensity, setAsDensity] = useState('1.10');
  const [asStorage, setAsStorage] = useState('30');
  const [asLinePressure, setAsLinePressure] = useState('');
  const [asNeatConc, setAsNeatConc] = useState('100');
  const [asWorkingConc, setAsWorkingConc] = useState('');
  const [asDilutionDays, setAsDilutionDays] = useState('');

  // Anti-foam state
  const [afDose, setAfDose] = useState('0.1');
  const [afDensity, setAfDensity] = useState('1.0');
  const [afStorage, setAfStorage] = useState('30');
  const [afLinePressure, setAfLinePressure] = useState('');
  const [afNeatConc, setAfNeatConc] = useState('100');
  const [afWorkingConc, setAfWorkingConc] = useState('');
  const [afDilutionDays, setAfDilutionDays] = useState('');

  // CIP state
  const [cipAcidType, setCipAcidType] = useState<AcidType>('formic');
  const [cipHxArea, setCipHxArea] = useState('');
  const [cipSpecVol, setCipSpecVol] = useState('3');
  const [cipPipingHoldup, setCipPipingHoldup] = useState('');
  const [cipCleaningConc, setCipCleaningConc] = useState('3');
  const [cipRecircFlow, setCipRecircFlow] = useState('');
  const [cipDuration, setCipDuration] = useState('6');
  const [cipRinses, setCipRinses] = useState('3');
  const [cipCleansPerYear, setCipCleansPerYear] = useState('4');
  const [cipStorageDays, setCipStorageDays] = useState('90');
  const [cipTankType, setCipTankType] = useState<'cylindrical' | 'rectangular'>('cylindrical');

  // Report dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [cipResult, setCipResult] = useState<CIPResult | null>(null);

  // ── Compute dosing results reactively ──────────────────────────────────
  const asComputed = useMemo(() => {
    if (!enableAntiscalant) return null;
    try {
      const flow = parseFloat(feedFlow);
      const d = parseFloat(asDose);
      const rho = parseFloat(asDensity);
      if (isNaN(flow) || flow <= 0 || isNaN(d) || d < 0 || isNaN(rho) || rho <= 0) return null;
      const days = parseFloat(asStorage);
      const lp = parseFloat(asLinePressure);
      const nc = parseFloat(asNeatConc);
      const wc = parseFloat(asWorkingConc);
      const dtd = parseFloat(asDilutionDays);
      return calculateDosing({
        feedFlowM3h: flow,
        doseMgL: d,
        solutionDensityKgL: rho,
        storageDays: isNaN(days) || days <= 0 ? undefined : days,
        linePressureBarG: isNaN(lp) || lp < 0 ? undefined : lp,
        neatConcentration: isNaN(nc) || nc <= 0 ? undefined : nc,
        workingConcentration: isNaN(wc) || wc <= 0 ? undefined : wc,
        dilutionTankDays: isNaN(dtd) || dtd <= 0 ? undefined : dtd,
        tankType,
      });
    } catch {
      return null;
    }
  }, [
    enableAntiscalant,
    feedFlow,
    asDose,
    asDensity,
    asStorage,
    asLinePressure,
    asNeatConc,
    asWorkingConc,
    asDilutionDays,
    tankType,
  ]);

  const afComputed = useMemo(() => {
    if (!enableAntifoam) return null;
    try {
      const flow = parseFloat(feedFlow);
      const d = parseFloat(afDose);
      const rho = parseFloat(afDensity);
      if (isNaN(flow) || flow <= 0 || isNaN(d) || d < 0 || isNaN(rho) || rho <= 0) return null;
      const days = parseFloat(afStorage);
      const lp = parseFloat(afLinePressure);
      const nc = parseFloat(afNeatConc);
      const wc = parseFloat(afWorkingConc);
      const dtd = parseFloat(afDilutionDays);
      return calculateDosing({
        feedFlowM3h: flow,
        doseMgL: d,
        solutionDensityKgL: rho,
        storageDays: isNaN(days) || days <= 0 ? undefined : days,
        linePressureBarG: isNaN(lp) || lp < 0 ? undefined : lp,
        neatConcentration: isNaN(nc) || nc <= 0 ? undefined : nc,
        workingConcentration: isNaN(wc) || wc <= 0 ? undefined : wc,
        dilutionTankDays: isNaN(dtd) || dtd <= 0 ? undefined : dtd,
        tankType,
      });
    } catch {
      return null;
    }
  }, [
    enableAntifoam,
    feedFlow,
    afDose,
    afDensity,
    afStorage,
    afLinePressure,
    afNeatConc,
    afWorkingConc,
    afDilutionDays,
    tankType,
  ]);

  const hasAnyResult = asComputed !== null || afComputed !== null || cipResult !== null;

  const handleCipResult = useCallback((r: CIPResult | null) => setCipResult(r), []);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Chemical Dosing & CIP" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Chemical Dosing &amp; CIP Calculator
        </Typography>
        <Chip label="Dosing + Acid CIP" size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary" mb={1}>
        Calculate dosing pump flow rates, dilution, storage tanks, and acid clean-in-place system
        design.
      </Typography>

      <Stack direction="row" spacing={1} mb={3}>
        {hasAnyResult && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<PdfIcon />}
            onClick={() => setReportOpen(true)}
          >
            Generate Report
          </Button>
        )}
      </Stack>

      {/* Tabs: Dosing vs CIP */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as TabValue)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="dosing"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <ScienceIcon fontSize="small" />
              <span>Chemical Dosing</span>
            </Stack>
          }
        />
        <Tab
          value="cip"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <CleanIcon fontSize="small" />
              <span>Acid CIP</span>
            </Stack>
          }
        />
      </Tabs>

      {/* ── Dosing Tab ── */}
      {tab === 'dosing' && (
        <Grid container spacing={3}>
          {/* Left: Inputs */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3 }}>
              {/* Shared feed flow */}
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Process Conditions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TextField
                label="Feed Seawater Flow Rate"
                value={feedFlow}
                onChange={(e) => setFeedFlow(e.target.value)}
                fullWidth
                size="small"
                type="number"
                sx={{ mb: 2 }}
                slotProps={{
                  input: { endAdornment: <Adornment>m³/h</Adornment> },
                }}
              />

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Tank Shape</InputLabel>
                <Select
                  value={tankType}
                  label="Tank Shape"
                  onChange={(e) => setTankType(e.target.value as 'cylindrical' | 'rectangular')}
                >
                  <MenuItem value="cylindrical">Cylindrical</MenuItem>
                  <MenuItem value="rectangular">Rectangular</MenuItem>
                </Select>
              </FormControl>

              <Divider sx={{ mb: 2 }} />

              {/* Chemical selection */}
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Chemical Selection
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={enableAntiscalant}
                    onChange={(e) => setEnableAntiscalant(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    Antiscalant ({CHEMICAL_PRODUCTS.antiscalant.productName})
                  </Typography>
                }
              />
              {enableAntiscalant && (
                <Box sx={{ mb: 2, pl: 1 }}>
                  <ChemicalInputSection
                    chemType="antiscalant"
                    dose={asDose}
                    setDose={setAsDose}
                    density={asDensity}
                    setDensity={setAsDensity}
                    storageDays={asStorage}
                    setStorageDays={setAsStorage}
                    linePressure={asLinePressure}
                    setLinePressure={setAsLinePressure}
                    neatConc={asNeatConc}
                    setNeatConc={setAsNeatConc}
                    workingConc={asWorkingConc}
                    setWorkingConc={setAsWorkingConc}
                    dilutionTankDays={asDilutionDays}
                    setDilutionTankDays={setAsDilutionDays}
                  />
                </Box>
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={enableAntifoam}
                    onChange={(e) => setEnableAntifoam(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    Anti-foam ({CHEMICAL_PRODUCTS.antifoam.productName})
                  </Typography>
                }
              />
              {enableAntifoam && (
                <Box sx={{ pl: 1 }}>
                  <ChemicalInputSection
                    chemType="antifoam"
                    dose={afDose}
                    setDose={setAfDose}
                    density={afDensity}
                    setDensity={setAfDensity}
                    storageDays={afStorage}
                    setStorageDays={setAfStorage}
                    linePressure={afLinePressure}
                    setLinePressure={setAfLinePressure}
                    neatConc={afNeatConc}
                    setNeatConc={setAfNeatConc}
                    workingConc={afWorkingConc}
                    setWorkingConc={setAfWorkingConc}
                    dilutionTankDays={afDilutionDays}
                    setDilutionTankDays={setAfDilutionDays}
                  />
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Right: Results */}
          <Grid size={{ xs: 12, md: 8 }}>
            {!asComputed && !afComputed ? (
              <Paper
                sx={{
                  p: 4,
                  textAlign: 'center',
                  bgcolor: 'action.hover',
                  border: '2px dashed',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {!feedFlow
                    ? 'Enter feed seawater flow rate and select chemicals to calculate'
                    : 'Select at least one chemical and enter valid parameters'}
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {asComputed && <DosingResultCard chemType="antiscalant" result={asComputed} />}
                {afComputed && <DosingResultCard chemType="antifoam" result={afComputed} />}
              </Stack>
            )}
          </Grid>
        </Grid>
      )}

      {/* ── CIP Tab ── */}
      {tab === 'cip' && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Acid CIP — Inputs
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <CIPForm
                acidType={cipAcidType}
                setAcidType={setCipAcidType}
                hxArea={cipHxArea}
                setHxArea={setCipHxArea}
                specificVolume={cipSpecVol}
                setSpecificVolume={setCipSpecVol}
                pipingHoldup={cipPipingHoldup}
                setPipingHoldup={setCipPipingHoldup}
                cleaningConc={cipCleaningConc}
                setCleaningConc={setCipCleaningConc}
                recircFlow={cipRecircFlow}
                setRecircFlow={setCipRecircFlow}
                cleaningDuration={cipDuration}
                setCleaningDuration={setCipDuration}
                numRinses={cipRinses}
                setNumRinses={setCipRinses}
                cleaningsPerYear={cipCleansPerYear}
                setCleaningsPerYear={setCipCleansPerYear}
                storageDays={cipStorageDays}
                setStorageDays={setCipStorageDays}
                tankType={cipTankType}
                setTankType={setCipTankType}
              />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <CIPResultPanel
              acidType={cipAcidType}
              hxArea={cipHxArea}
              specificVolume={cipSpecVol}
              pipingHoldup={cipPipingHoldup}
              cleaningConc={cipCleaningConc}
              recircFlow={cipRecircFlow}
              cleaningDuration={cipDuration}
              numRinses={cipRinses}
              cleaningsPerYear={cipCleansPerYear}
              storageDays={cipStorageDays}
              tankType={cipTankType}
              onResult={handleCipResult}
            />
          </Grid>
        </Grid>
      )}

      {/* Formula reference */}
      <Box sx={{ mt: 4, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          <strong>Dosing:</strong> Flow [L/h] = Feed [m³/h] × Dose [mg/L] / (Density [kg/L] × 1000)
          &nbsp;|&nbsp; Pump P = P_line + P_bpv + P_injection &nbsp;|&nbsp;
          <strong>CIP:</strong> System vol = HX area × specific vol + piping &nbsp;|&nbsp; Neat acid
          = System vol × C_target / C_neat
        </Typography>
      </Box>

      {/* Report dialog */}
      {reportOpen && (
        <Suspense fallback={<CircularProgress />}>
          <GenerateReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            antiscalantResult={asComputed}
            antifoamResult={afComputed}
            cipResult={cipResult}
            antiscalantInputs={
              asComputed
                ? {
                    feedFlow,
                    dose: asDose,
                    density: asDensity,
                    storageDays: asStorage,
                    linePressure: asLinePressure,
                    neatConc: asNeatConc,
                    workingConc: asWorkingConc,
                  }
                : undefined
            }
            antifoamInputs={
              afComputed
                ? {
                    feedFlow,
                    dose: afDose,
                    density: afDensity,
                    storageDays: afStorage,
                    linePressure: afLinePressure,
                    neatConc: afNeatConc,
                    workingConc: afWorkingConc,
                  }
                : undefined
            }
            cipInputs={
              cipResult
                ? {
                    acidType: cipAcidType,
                    hxArea: cipHxArea,
                    specificVolume: cipSpecVol,
                    pipingHoldup: cipPipingHoldup,
                    cleaningConc: cipCleaningConc,
                    recircFlow: cipRecircFlow,
                    cleaningDuration: cipDuration,
                    numRinses: cipRinses,
                    cleaningsPerYear: cipCleansPerYear,
                  }
                : undefined
            }
          />
        </Suspense>
      )}
    </Container>
  );
}
