'use client';

/**
 * Chemical Dosing Calculator
 *
 * Calculates dosing rates for:
 *   1. Antiscalant — Belgard EV 2050 (Chemtreat / Nouryon)
 *   2. Anti-foam   — Belite M8
 */

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
  TextField,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tab,
  Tabs,
} from '@mui/material';
import { Science as ScienceIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateDosing, CHEMICAL_PRODUCTS, type ChemicalType } from '@/lib/thermal';

// ── Per-chemical input form ───────────────────────────────────────────────────

interface ChemicalFormProps {
  chemType: ChemicalType;
  feedFlow: string;
  setFeedFlow: (v: string) => void;
  dose: string;
  setDose: (v: string) => void;
  density: string;
  setDensity: (v: string) => void;
  storageDays: string;
  setStorageDays: (v: string) => void;
}

function ChemicalForm({
  chemType,
  feedFlow,
  setFeedFlow,
  dose,
  setDose,
  density,
  setDensity,
  storageDays,
  setStorageDays,
}: ChemicalFormProps) {
  const product = CHEMICAL_PRODUCTS[chemType];
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          p: 1.5,
          bgcolor: 'primary.50',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'primary.200',
        }}
      >
        <Typography variant="body2" fontWeight="bold" color="primary.dark">
          {product.productName}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {product.manufacturer} — {product.purpose}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
          {product.notes}
        </Typography>
      </Box>

      <TextField
        label="Feed Seawater Flow Rate"
        value={feedFlow}
        onChange={(e) => setFeedFlow(e.target.value)}
        fullWidth
        size="small"
        type="number"
        slotProps={{
          input: {
            endAdornment: (
              <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                m³/h
              </Typography>
            ),
          },
        }}
      />

      <TextField
        label="Dose"
        value={dose}
        onChange={(e) => setDose(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText={`Typical: ${product.typicalDoseMin}–${product.typicalDoseMax} mg/L (ppm)`}
        slotProps={{
          input: {
            endAdornment: (
              <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                mg/L
              </Typography>
            ),
          },
        }}
      />

      <TextField
        label="Solution Density"
        value={density}
        onChange={(e) => setDensity(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText={`Default: ${product.defaultDensity} kg/L`}
        slotProps={{
          input: {
            endAdornment: (
              <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                kg/L
              </Typography>
            ),
          },
        }}
      />

      <TextField
        label="Storage Days (optional)"
        value={storageDays}
        onChange={(e) => setStorageDays(e.target.value)}
        fullWidth
        size="small"
        type="number"
        helperText="For storage tank sizing — leave blank to skip"
        slotProps={{
          input: {
            endAdornment: (
              <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                days
              </Typography>
            ),
          },
        }}
      />
    </Stack>
  );
}

// ── Result panel ──────────────────────────────────────────────────────────────

interface ResultPanelProps {
  chemType: ChemicalType;
  feedFlow: string;
  dose: string;
  density: string;
  storageDays: string;
}

function ResultPanel({ chemType, feedFlow, dose, density, storageDays }: ResultPanelProps) {
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    try {
      const flow = parseFloat(feedFlow);
      const d = parseFloat(dose);
      const rho = parseFloat(density);
      if (isNaN(flow) || flow <= 0 || isNaN(d) || d < 0 || isNaN(rho) || rho <= 0) return null;
      const days = parseFloat(storageDays);
      return calculateDosing({
        feedFlowM3h: flow,
        doseMgL: d,
        solutionDensityKgL: rho,
        storageDays: isNaN(days) || days <= 0 ? undefined : days,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [feedFlow, dose, density, storageDays]);

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
          Enter feed flow and dose to calculate
        </Typography>
      </Paper>
    );
  }

  const product = CHEMICAL_PRODUCTS[chemType];

  return (
    <Stack spacing={2}>
      {/* Key result cards */}
      <Grid container spacing={2}>
        {[
          {
            label: 'Dosing Flow',
            value:
              result.chemicalFlowLh < 1
                ? `${result.chemicalFlowMlMin.toFixed(1)} mL/min`
                : `${result.chemicalFlowLh.toFixed(2)} L/h`,
            sub:
              result.chemicalFlowLh < 1
                ? `${result.chemicalFlowLh.toFixed(4)} L/h`
                : `${result.chemicalFlowMlMin.toFixed(1)} mL/min`,
            color: '#e3f2fd',
            border: '#1565c0',
            text: 'primary.dark',
          },
          {
            label: 'Daily Consumption',
            value: `${result.dailyConsumptionKg.toFixed(2)} kg/day`,
            sub: `${result.monthlyConsumptionKg.toFixed(1)} kg/month`,
            color: '#e8f5e9',
            border: '#2e7d32',
            text: 'success.dark',
          },
          {
            label: 'Annual Consumption',
            value: `${result.annualConsumptionKg.toFixed(0)} kg/yr`,
            sub: product.productName,
            color: '#fff8e1',
            border: '#f57f17',
            text: 'warning.dark',
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

      {/* Detail table */}
      <Paper sx={{ p: 2 }}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Dosing pump flow
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                {result.chemicalFlowLh.toFixed(4)} L/h
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                {result.chemicalFlowMlMin.toFixed(2)} mL/min
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Active chemical rate
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                {result.activeChemicalGh.toFixed(2)} g/h
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                {((result.activeChemicalGh * 24) / 1000).toFixed(3)} kg/day
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Weekly consumption
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                {(result.dailyConsumptionKg * 7).toFixed(2)} kg/week
              </TableCell>
              <TableCell />
            </TableRow>
            <TableRow>
              <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Monthly consumption
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                {result.monthlyConsumptionKg.toFixed(2)} kg/month
              </TableCell>
              <TableCell />
            </TableRow>
            {result.storageTankM3 !== undefined && (
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                  Storage tank volume
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                  {result.storageTankM3.toFixed(3)} m³
                </TableCell>
                <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                  {(result.storageTankM3 * 1000).toFixed(0)} litres
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChemicalDosingClient() {
  const [tab, setTab] = useState<ChemicalType>('antiscalant');

  // Antiscalant state
  const [asFlow, setAsFlow] = useState<string>('');
  const [asDose, setAsDose] = useState<string>('2');
  const [asDensity, setAsDensity] = useState<string>('1.10');
  const [asStorage, setAsStorage] = useState<string>('30');

  // Anti-foam state
  const [afFlow, setAfFlow] = useState<string>('');
  const [afDose, setAfDose] = useState<string>('0.1');
  const [afDensity, setAfDensity] = useState<string>('1.0');
  const [afStorage, setAfStorage] = useState<string>('30');

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Chemical Dosing" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Chemical Dosing Calculator
        </Typography>
        <Chip label="Belgard EV 2050 · Belite M8" size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Calculate dosing pump flow rates, daily consumption, and storage tank volumes for thermal
        desalination plant chemical treatment.
      </Typography>

      {/* Chemical tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as ChemicalType)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="antiscalant"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <ScienceIcon fontSize="small" />
              <span>Antiscalant (Belgard EV 2050)</span>
            </Stack>
          }
        />
        <Tab
          value="antifoam"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <ScienceIcon fontSize="small" />
              <span>Anti-foam (Belite M8)</span>
            </Stack>
          }
        />
      </Tabs>

      {tab === 'antiscalant' && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Inputs
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <ChemicalForm
                chemType="antiscalant"
                feedFlow={asFlow}
                setFeedFlow={setAsFlow}
                dose={asDose}
                setDose={setAsDose}
                density={asDensity}
                setDensity={setAsDensity}
                storageDays={asStorage}
                setStorageDays={setAsStorage}
              />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <ResultPanel
              chemType="antiscalant"
              feedFlow={asFlow}
              dose={asDose}
              density={asDensity}
              storageDays={asStorage}
            />
          </Grid>
        </Grid>
      )}

      {tab === 'antifoam' && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Inputs
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <ChemicalForm
                chemType="antifoam"
                feedFlow={afFlow}
                setFeedFlow={setAfFlow}
                dose={afDose}
                setDose={setAfDose}
                density={afDensity}
                setDensity={setAfDensity}
                storageDays={afStorage}
                setStorageDays={setAfStorage}
              />
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <ResultPanel
              chemType="antifoam"
              feedFlow={afFlow}
              dose={afDose}
              density={afDensity}
              storageDays={afStorage}
            />
          </Grid>
        </Grid>
      )}

      {/* Formula reference */}
      <Box sx={{ mt: 4, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          <strong>Formula:</strong> Chemical flow [L/h] = Feed [m³/h] × Dose [mg/L] / (Density
          [kg/L] × 1000) &nbsp;|&nbsp; Daily [kg/day] = Chemical flow × Density × 24 &nbsp;|&nbsp;
          Storage tank [m³] = Daily [kg/day] × Days / (Density × 1000)
        </Typography>
      </Box>
    </Container>
  );
}
