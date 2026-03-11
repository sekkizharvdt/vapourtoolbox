'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack, Button } from '@mui/material';
import { FolderOpen as LoadIcon, RestartAlt as ResetIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateVacuumBreaker, type ValveType } from '@/lib/thermal/vacuumBreakerCalculator';
import { VacuumBreakerInputs } from './components/VacuumBreakerInputs';
import { VacuumBreakerResults } from './components/VacuumBreakerResults';
import { LoadCalculationDialog } from '../siphon-sizing/components/LoadCalculationDialog';

export default function VacuumBreakerClient() {
  const [totalVolume, setTotalVolume] = useState<string>('');
  const [numberOfBreakers, setNumberOfBreakers] = useState<string>('2');
  const [operatingPressure, setOperatingPressure] = useState<string>('');
  const [equalizationTime, setEqualizationTime] = useState<string>('60');
  const [ambientTemperature, setAmbientTemperature] = useState<string>('35');
  const [valveType, setValveType] = useState<ValveType>('BUTTERFLY');

  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  const handleReset = () => {
    setTotalVolume('');
    setNumberOfBreakers('2');
    setOperatingPressure('');
    setEqualizationTime('60');
    setAmbientTemperature('35');
    setValveType('BUTTERFLY');
  };

  const computed = useMemo(() => {
    try {
      const vol = parseFloat(totalVolume);
      const breakers = parseInt(numberOfBreakers, 10);
      const pressure = parseFloat(operatingPressure);
      const time = parseFloat(equalizationTime);
      const temp = parseFloat(ambientTemperature);

      if (
        isNaN(vol) ||
        vol <= 0 ||
        isNaN(breakers) ||
        breakers < 1 ||
        isNaN(pressure) ||
        pressure <= 0 ||
        isNaN(time) ||
        time <= 0 ||
        isNaN(temp)
      ) {
        return null;
      }

      return {
        result: calculateVacuumBreaker({
          totalVolume: vol,
          numberOfBreakers: breakers,
          operatingPressureKPa: pressure,
          equalizationTimeMin: time,
          ambientTemperature: temp,
          valveType,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [
    totalVolume,
    numberOfBreakers,
    operatingPressure,
    equalizationTime,
    ambientTemperature,
    valveType,
  ]);

  const result = computed?.result ?? null;
  const error = computed?.error ?? null;

  const reportInputs = {
    totalVolume,
    numberOfBreakers,
    operatingPressure,
    equalizationTime,
    ambientTemperature,
    valveType,
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
          Size vacuum breaker valves for MED thermal desalination plants. Uses isentropic
          compressible flow theory with time-stepping integration, based on HEI surface condenser
          methodology.
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
              totalVolume={totalVolume}
              numberOfBreakers={numberOfBreakers}
              operatingPressure={operatingPressure}
              equalizationTime={equalizationTime}
              ambientTemperature={ambientTemperature}
              valveType={valveType}
              onTotalVolumeChange={setTotalVolume}
              onNumberOfBreakersChange={setNumberOfBreakers}
              onOperatingPressureChange={setOperatingPressure}
              onEqualizationTimeChange={setEqualizationTime}
              onAmbientTemperatureChange={setAmbientTemperature}
              onValveTypeChange={setValveType}
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
              <strong>Air mass:</strong> m = (P_atm - P_operating) &times; V / (R_air &times; T)
            </li>
            <li>
              <strong>Choked flow</strong> (P_vessel &lt; 0.528 &times; P_atm): &#7745; = C_d
              &times; A &times; P_1 &times; &radic;(&gamma;/(R&middot;T)) &times;
              [2/(&gamma;+1)]^((&gamma;+1)/(2(&gamma;-1)))
            </li>
            <li>
              <strong>Subsonic flow</strong> (P_vessel &gt; 0.528 &times; P_atm): standard
              isentropic nozzle equation with pressure ratio
            </li>
            <li>
              <strong>Time-stepping:</strong> 500-step numerical integration accounts for pressure
              rise and choked-to-subsonic transition
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Reference:</strong> HEI Tech Sheet #131 — Vacuum Breaker Valve; HEI Standards for
          Steam Surface Condensers (HEI 2629); ISO 9300 — Compressible Flow
        </Typography>
      </Box>

      <LoadCalculationDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        calculatorType="VACUUM_BREAKER"
        onLoad={(inputs) => {
          if (typeof inputs.totalVolume === 'string') setTotalVolume(inputs.totalVolume);
          if (typeof inputs.numberOfBreakers === 'string')
            setNumberOfBreakers(inputs.numberOfBreakers);
          if (typeof inputs.operatingPressure === 'string')
            setOperatingPressure(inputs.operatingPressure);
          if (typeof inputs.equalizationTime === 'string')
            setEqualizationTime(inputs.equalizationTime);
          if (typeof inputs.ambientTemperature === 'string')
            setAmbientTemperature(inputs.ambientTemperature);
          if (typeof inputs.valveType === 'string') setValveType(inputs.valveType as ValveType);
        }}
      />
    </Container>
  );
}
