/**
 * Cost Breakdown Panel
 *
 * Displays detailed cost breakdown for BOM with expandable sections
 * for direct costs, indirect costs (overhead/contingency/profit), and services.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { BOMSummary, Money } from '@vapour/types';

interface CostBreakdownPanelProps {
  summary: BOMSummary;
}

export function CostBreakdownPanel({ summary }: CostBreakdownPanelProps) {
  const formatMoney = (money: Money) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(money.amount);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Cost Breakdown
        </Typography>

        {/* Summary Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Weight
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {summary.totalWeight.toFixed(2)} kg
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Items
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {summary.itemCount}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Cost
            </Typography>
            <Typography variant="h6" color="primary" fontWeight="bold">
              {formatMoney(summary.totalCost)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Direct Costs */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 2 }}>
              <Typography fontWeight="medium">Direct Costs</Typography>
              <Typography fontWeight="medium">{formatMoney(summary.totalDirectCost)}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Material Cost</TableCell>
                  <TableCell align="right">{formatMoney(summary.totalMaterialCost)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Fabrication Cost</TableCell>
                  <TableCell align="right">{formatMoney(summary.totalFabricationCost)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Service Cost</TableCell>
                  <TableCell align="right">{formatMoney(summary.totalServiceCost)}</TableCell>
                </TableRow>
                <TableRow sx={{ '& td': { borderBottom: 'none', fontWeight: 'bold', pt: 1 } }}>
                  <TableCell>Subtotal</TableCell>
                  <TableCell align="right">{formatMoney(summary.totalDirectCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>

        {/* Service Breakdown */}
        {summary.serviceBreakdown && Object.keys(summary.serviceBreakdown).length > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="medium">Service Breakdown</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table size="small">
                <TableBody>
                  {Object.entries(summary.serviceBreakdown).map(([serviceId, cost]) => (
                    <TableRow key={serviceId}>
                      <TableCell>
                        <Chip label={serviceId} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{formatMoney(cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Indirect Costs */}
        {(summary.overhead.amount > 0 ||
          summary.contingency.amount > 0 ||
          summary.profit.amount > 0) && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                <Typography fontWeight="medium">Indirect Costs & Margin</Typography>
                <Typography fontWeight="medium">
                  {formatMoney({
                    amount:
                      summary.overhead.amount + summary.contingency.amount + summary.profit.amount,
                    currency: summary.currency,
                  })}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Table size="small">
                <TableBody>
                  {summary.overhead.amount > 0 && (
                    <TableRow>
                      <TableCell>
                        Overhead
                        {summary.costConfigId && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            From cost config
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{formatMoney(summary.overhead)}</TableCell>
                    </TableRow>
                  )}
                  {summary.contingency.amount > 0 && (
                    <TableRow>
                      <TableCell>Contingency</TableCell>
                      <TableCell align="right">{formatMoney(summary.contingency)}</TableCell>
                    </TableRow>
                  )}
                  {summary.profit.amount > 0 && (
                    <TableRow>
                      <TableCell>Profit Margin</TableCell>
                      <TableCell align="right">{formatMoney(summary.profit)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Calculation Info */}
        {summary.lastCalculated && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            Last calculated:{' '}
            {new Date(summary.lastCalculated.seconds * 1000).toLocaleString('en-IN')}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
