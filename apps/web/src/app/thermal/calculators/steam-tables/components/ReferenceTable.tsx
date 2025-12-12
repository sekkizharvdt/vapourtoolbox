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
import { SATURATION_TABLE } from '@vapour/constants';
import type { SteamMode, LookupMode } from './types';

interface ReferenceTableProps {
  onRowClick: (steamMode: SteamMode, lookupMode: LookupMode, temperature: string) => void;
}

export function ReferenceTable({ onRowClick }: ReferenceTableProps) {
  return (
    <Accordion sx={{ mt: 4 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">Quick Reference Table (10°C intervals)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>T (°C)</TableCell>
                <TableCell align="right">P_sat (bar)</TableCell>
                <TableCell align="right">h_f (kJ/kg)</TableCell>
                <TableCell align="right">h_g (kJ/kg)</TableCell>
                <TableCell align="right">h_fg (kJ/kg)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {SATURATION_TABLE.map((row: (typeof SATURATION_TABLE)[number]) => (
                <TableRow
                  key={row.tempC}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onRowClick('saturation', 'temperature', row.tempC.toString())}
                >
                  <TableCell>{row.tempC}</TableCell>
                  <TableCell align="right">{row.pBar.toFixed(4)}</TableCell>
                  <TableCell align="right">{row.hf.toFixed(1)}</TableCell>
                  <TableCell align="right">{row.hg.toFixed(1)}</TableCell>
                  <TableCell align="right">{row.hfg.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Click any row to lookup full properties at that temperature
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}
