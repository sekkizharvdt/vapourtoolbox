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
import { TYPICAL_HTC } from '@/lib/thermal';

interface HTCReferenceTableProps {
  onHTCSelect: (htc: string) => void;
}

export function HTCReferenceTable({ onHTCSelect }: HTCReferenceTableProps) {
  return (
    <Accordion sx={{ mt: 4 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">Typical Overall Heat Transfer Coefficients</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell align="right">Min (W/m²·K)</TableCell>
                <TableCell align="right">Typical (W/m²·K)</TableCell>
                <TableCell align="right">Max (W/m²·K)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(TYPICAL_HTC).map(([key, values]) => (
                <TableRow
                  key={key}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onHTCSelect(values.typical.toString())}
                >
                  <TableCell>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </TableCell>
                  <TableCell align="right">{values.min}</TableCell>
                  <TableCell align="right">{values.typical}</TableCell>
                  <TableCell align="right">{values.max}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Click any row to use that typical value
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}
