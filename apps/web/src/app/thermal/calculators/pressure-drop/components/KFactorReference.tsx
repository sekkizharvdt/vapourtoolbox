'use client';

import {
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { getAvailableFittings } from '@/lib/thermal';

const AVAILABLE_FITTINGS = getAvailableFittings();

export function KFactorReference() {
  return (
    <Accordion sx={{ mt: 4 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">K-Factor Reference (Crane TP-410)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fitting</TableCell>
                <TableCell align="right">K-Factor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {AVAILABLE_FITTINGS.map((f) => (
                <TableRow key={f.type}>
                  <TableCell>{f.name}</TableCell>
                  <TableCell align="right">{f.kFactor.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
}

export function MethodInfo() {
  return (
    <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Method
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        <strong>Darcy-Weisbach equation:</strong> ΔP = f × (L/D) × (ρv²/2) + ΣK × (ρv²/2) + ρgh
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        <strong>Friction factor:</strong> Swamee-Jain approximation for Colebrook-White equation
      </Typography>
      <Typography variant="body2" color="text.secondary">
        <strong>Reference:</strong> Crane Technical Paper No. 410 &quot;Flow of Fluids Through
        Valves, Fittings, and Pipe&quot;
      </Typography>
    </Box>
  );
}
