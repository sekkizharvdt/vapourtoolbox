'use client';

import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { SCHEDULE_40_PIPES } from '@/lib/thermal';
import type { CalculationMode } from './types';

interface PipeReferenceTablesProps {
  onPipeSelect: (mode: CalculationMode, nps: string) => void;
}

export function PipeReferenceTables({ onPipeSelect }: PipeReferenceTablesProps) {
  return (
    <>
      {/* Reference Table */}
      <Accordion sx={{ mt: 4 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Schedule 40 Pipe Data (ASME B36.10)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>NPS</TableCell>
                  <TableCell>DN</TableCell>
                  <TableCell align="right">OD (mm)</TableCell>
                  <TableCell align="right">WT (mm)</TableCell>
                  <TableCell align="right">ID (mm)</TableCell>
                  <TableCell align="right">Area (mm²)</TableCell>
                  <TableCell align="right">Weight (kg/m)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {SCHEDULE_40_PIPES.map((pipe) => (
                  <TableRow
                    key={pipe.nps}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => onPipeSelect('check_velocity', pipe.nps)}
                  >
                    <TableCell>{pipe.nps}&quot;</TableCell>
                    <TableCell>{pipe.dn}</TableCell>
                    <TableCell align="right">{pipe.od_mm.toFixed(2)}</TableCell>
                    <TableCell align="right">{pipe.wt_mm.toFixed(2)}</TableCell>
                    <TableCell align="right">{pipe.id_mm.toFixed(2)}</TableCell>
                    <TableCell align="right">{pipe.area_mm2.toFixed(1)}</TableCell>
                    <TableCell align="right">{pipe.weight_kgm.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Click any row to check velocity for that pipe size
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* Velocity Guidelines */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Typical Velocity Guidelines</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Min (m/s)</TableCell>
                  <TableCell align="right">Typical (m/s)</TableCell>
                  <TableCell align="right">Max (m/s)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Water (liquid)</TableCell>
                  <TableCell align="right">0.5</TableCell>
                  <TableCell align="right">1.5 - 2.0</TableCell>
                  <TableCell align="right">3.0</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Seawater (liquid)</TableCell>
                  <TableCell align="right">0.5</TableCell>
                  <TableCell align="right">1.5</TableCell>
                  <TableCell align="right">2.5</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Steam (saturated)</TableCell>
                  <TableCell align="right">15</TableCell>
                  <TableCell align="right">25 - 35</TableCell>
                  <TableCell align="right">40</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Vacuum Vapor</TableCell>
                  <TableCell align="right">20</TableCell>
                  <TableCell align="right">35 - 45</TableCell>
                  <TableCell align="right">60</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Pump Suction</TableCell>
                  <TableCell align="right">0.3</TableCell>
                  <TableCell align="right">0.6 - 1.0</TableCell>
                  <TableCell align="right">1.5</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
    </>
  );
}
