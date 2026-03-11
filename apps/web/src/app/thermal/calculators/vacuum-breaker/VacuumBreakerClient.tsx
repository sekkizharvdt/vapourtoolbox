'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack, Button } from '@mui/material';
import { FolderOpen as LoadIcon, RestartAlt as ResetIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateVacuumBreaker,
  type CalculationMode,
  type ValveType,
} from '@/lib/thermal/vacuumBreakerCalculator';
import { VacuumBreakerInputs } from './components/VacuumBreakerInputs';
import { VacuumBreakerResults } from './components/VacuumBreakerResults';
import { LoadCalculationDialog } from '../siphon-sizing/components/LoadCalculationDialog';

export default function VacuumBreakerClient() {
  // Shared inputs
  const [calcMode, setCalcMode] = useState<CalculationMode>('MANUAL_VALVE');
  const [totalVolume, setTotalVolume] = useState<string>('');
  const [numberOfBreakers, setNumberOfBreakers] = useState<string>('2');
  const [operatingPressure, setOperatingPressure] = useState<string>('');
  const [ambientTemperature, setAmbientTemperature] = useState<string>('35');

  // Manual valve inputs
  const [equalizationTime, setEqualizationTime] = useState<string>('60');
  const [valveType, setValveType] = useState<ValveType>('BUTTERFLY');

  // Diaphragm inputs
  const [burstPressure, setBurstPressure] = useState<string>('50');
  const [selectedDN, setSelectedDN] = useState<string>('50');
  const [maxRiseRate, setMaxRiseRate] = useState<string>('0.5');

  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  const handleReset = () => {
    setTotalVolume('');
    setNumberOfBreakers('2');
    setOperatingPressure('');
    setAmbientTemperature('35');
    setEqualizationTime('60');
    setValveType('BUTTERFLY');
    setBurstPressure('50');
    setSelectedDN('50');
    setMaxRiseRate('0.5');
  };

  const computed = useMemo(() => {
    try {
      const vol = parseFloat(totalVolume);
      const breakers = parseInt(numberOfBreakers, 10);
      const pressure = parseFloat(operatingPressure);
      const temp = parseFloat(ambientTemperature);

      if (
        isNaN(vol) ||
        vol <= 0 ||
        isNaN(breakers) ||
        breakers < 1 ||
        isNaN(pressure) ||
        pressure <= 0 ||
        isNaN(temp)
      ) {
        return null;
      }

      const base = {
        totalVolume: vol,
        numberOfBreakers: breakers,
        operatingPressureKPa: pressure,
        ambientTemperature: temp,
      };

      if (calcMode === 'MANUAL_VALVE') {
        const time = parseFloat(equalizationTime);
        if (isNaN(time) || time <= 0) return null;
        return {
          result: calculateVacuumBreaker({
            ...base,
            mode: 'MANUAL_VALVE',
            equalizationTimeMin: time,
            valveType,
          }),
          error: null,
        };
      } else if (calcMode === 'DIAPHRAGM_ANALYSIS') {
        const burst = parseFloat(burstPressure);
        const dn = parseInt(selectedDN, 10);
        if (isNaN(burst) || burst <= 0 || isNaN(dn)) return null;
        return {
          result: calculateVacuumBreaker({
            ...base,
            mode: 'DIAPHRAGM_ANALYSIS',
            burstPressureMbar: burst,
            selectedDN: dn,
          }),
          error: null,
        };
      } else {
        const burst = parseFloat(burstPressure);
        const rate = parseFloat(maxRiseRate);
        if (isNaN(burst) || burst <= 0 || isNaN(rate) || rate <= 0) return null;
        return {
          result: calculateVacuumBreaker({
            ...base,
            mode: 'DIAPHRAGM_DESIGN',
            burstPressureMbar: burst,
            maxPressureRiseRate: rate,
          }),
          error: null,
        };
      }
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [
    calcMode,
    totalVolume,
    numberOfBreakers,
    operatingPressure,
    ambientTemperature,
    equalizationTime,
    valveType,
    burstPressure,
    selectedDN,
    maxRiseRate,
  ]);

  const result = computed?.result ?? null;
  const error = computed?.error ?? null;

  const reportInputs = {
    calcMode,
    totalVolume,
    numberOfBreakers,
    operatingPressure,
    ambientTemperature,
    equalizationTime,
    valveType,
    burstPressure,
    selectedDN,
    maxRiseRate,
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Vacuum Breaker Sizing" />

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Vacuum Breaker Sizing
          </Typography>
          <Chip label="HEI / Compressible Flow" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Size vacuum breakers for MED thermal desalination plants — manual valves or burst
          diaphragms. Uses isentropic compressible flow with time-stepping integration.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<LoadIcon />} size="small" onClick={() => setLoadDialogOpen(true)}>
            Load Saved
          </Button>
          <Button startIcon={<ResetIcon />} size="small" onClick={handleReset}>
            Reset
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>
            <VacuumBreakerInputs
              calcMode={calcMode}
              totalVolume={totalVolume}
              numberOfBreakers={numberOfBreakers}
              operatingPressure={operatingPressure}
              ambientTemperature={ambientTemperature}
              equalizationTime={equalizationTime}
              valveType={valveType}
              burstPressure={burstPressure}
              selectedDN={selectedDN}
              maxRiseRate={maxRiseRate}
              onCalcModeChange={setCalcMode}
              onTotalVolumeChange={setTotalVolume}
              onNumberOfBreakersChange={setNumberOfBreakers}
              onOperatingPressureChange={setOperatingPressure}
              onAmbientTemperatureChange={setAmbientTemperature}
              onEqualizationTimeChange={setEqualizationTime}
              onValveTypeChange={setValveType}
              onBurstPressureChange={setBurstPressure}
              onSelectedDNChange={setSelectedDN}
              onMaxRiseRateChange={setMaxRiseRate}
            />
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          {result ? (
            <VacuumBreakerResults result={result} inputs={reportInputs} />
          ) : (
            !error && (
              <Paper
                sx={{
                  p: 6,
                  textAlign: 'center',
                  bgcolor: 'action.hover',
                  border: '2px dashed',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Enter vessel volume and operating conditions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Methodology
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Air mass:</strong> m = (P_atm - P_vessel) &times; V / (R_air &times; T)
            </li>
            <li>
              <strong>Choked flow</strong> (P_vessel &lt; 53.5 kPa): constant mass flux through
              orifice
            </li>
            <li>
              <strong>Subsonic flow</strong> (P_vessel &gt; 53.5 kPa): isentropic nozzle equation
              with pressure ratio
            </li>
            <li>
              <strong>Diaphragm:</strong> C_d = 0.60 (sharp-edged orifice after burst)
            </li>
            <li>
              <strong>Tube protection:</strong> Pressure rise rate limited to prevent mechanical
              disturbance to tubes with rubber grommets
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Reference:</strong> HEI Tech Sheet #131; HEI 2629; ISO 9300
        </Typography>
      </Box>

      <LoadCalculationDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        calculatorType="VACUUM_BREAKER"
        onLoad={(inputs) => {
          if (typeof inputs.calcMode === 'string') setCalcMode(inputs.calcMode as CalculationMode);
          if (typeof inputs.totalVolume === 'string') setTotalVolume(inputs.totalVolume);
          if (typeof inputs.numberOfBreakers === 'string')
            setNumberOfBreakers(inputs.numberOfBreakers);
          if (typeof inputs.operatingPressure === 'string')
            setOperatingPressure(inputs.operatingPressure);
          if (typeof inputs.ambientTemperature === 'string')
            setAmbientTemperature(inputs.ambientTemperature);
          if (typeof inputs.equalizationTime === 'string')
            setEqualizationTime(inputs.equalizationTime);
          if (typeof inputs.valveType === 'string') setValveType(inputs.valveType as ValveType);
          if (typeof inputs.burstPressure === 'string') setBurstPressure(inputs.burstPressure);
          if (typeof inputs.selectedDN === 'string') setSelectedDN(inputs.selectedDN);
          if (typeof inputs.maxRiseRate === 'string') setMaxRiseRate(inputs.maxRiseRate);
        }}
      />
    </Container>
  );
}
