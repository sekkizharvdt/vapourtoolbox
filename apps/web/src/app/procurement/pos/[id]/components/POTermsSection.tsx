/**
 * PO Terms Section Component
 *
 * Displays payment terms, delivery terms, warranty, and penalty clauses.
 * Supports both legacy text fields and new structured commercial terms.
 */

'use client';

import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { PurchaseOrder } from '@vapour/types';
import {
  getTemplateById,
  getDefaultTemplate,
  buildWarrantyClause,
} from '@/lib/procurement/commercialTerms';

// Labels for display
const PRICE_BASIS_LABELS: Record<string, string> = {
  FOR_SITE: 'FOR Site (Free On Road - Site)',
  EX_WORKS: 'Ex-Works (Vendor Location)',
  FOR_DESTINATION: 'FOR Destination',
};

const DELIVERY_TRIGGER_LABELS: Record<string, string> = {
  PO_DATE: 'PO Date',
  ADVANCE_PAYMENT: 'Advance Payment Receipt',
  DRAWING_APPROVAL: 'Drawing Approval',
};

const SCOPE_LABELS: Record<string, string> = {
  VENDOR: 'Vendor Scope',
  CUSTOMER: 'Customer Scope',
};

const ERECTION_LABELS: Record<string, string> = {
  VENDOR: 'Vendor Scope',
  NA: 'Not Applicable',
  CUSTOM: 'Custom',
};

const DOCUMENT_LABELS: Record<string, string> = {
  DRAWING: 'Drawing',
  DATA_SHEET: 'Data Sheet',
  QAP: 'Quality Assurance Plan (QAP)',
  OTHER: 'Other Documents',
};

const INSPECTOR_LABELS: Record<string, string> = {
  VDT: 'VDT (Internal)',
  VDT_CONSULTANT: 'VDT Consultant',
  THIRD_PARTY: 'Third Party Inspector',
};

interface POTermsSectionProps {
  po: PurchaseOrder;
}

export function POTermsSection({ po }: POTermsSectionProps) {
  const template = po.commercialTermsTemplateId
    ? getTemplateById(po.commercialTermsTemplateId) || getDefaultTemplate()
    : getDefaultTemplate();

  // Legacy display for old POs without structured terms
  if (!po.commercialTerms) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Terms and Conditions
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Payment Terms
            </Typography>
            <Typography variant="body2">{po.paymentTerms || 'Not specified'}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Delivery Terms
            </Typography>
            <Typography variant="body2">{po.deliveryTerms || 'Not specified'}</Typography>
          </Box>
          {po.warrantyTerms && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Warranty Terms
              </Typography>
              <Typography variant="body2">{po.warrantyTerms}</Typography>
            </Box>
          )}
          {po.penaltyClause && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Penalty Clause
              </Typography>
              <Typography variant="body2">{po.penaltyClause}</Typography>
            </Box>
          )}
        </Stack>
      </Paper>
    );
  }

  // Structured commercial terms display
  // At this point, TypeScript knows po.commercialTerms is defined
  const terms = po.commercialTerms;

  // Service terms / safety blocks render only when populated (a Service Order
  // is just a PO carrying service lines + these terms) — mirrors POPDFDocument.
  const serviceTerms = terms.serviceTerms;
  const hasServiceTerms =
    !!serviceTerms && Object.values(serviceTerms).some((v) => v !== undefined && v !== '');
  const safety = terms.safetyCompliance;
  const hasSafety =
    !!safety &&
    (!!safety.safetyRequired ||
      !!safety.ppeRequired ||
      !!safety.workPermitRequired ||
      !!safety.insuranceRequired);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Commercial Terms</Typography>
        {po.commercialTermsTemplateName && (
          <Chip label={po.commercialTermsTemplateName} size="small" color="primary" />
        )}
      </Stack>
      <Divider sx={{ my: 2 }} />

      <Stack spacing={2}>
        {/* Pricing & Payment */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="medium">
              Pricing & Payment
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {/* Price Basis */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Price Basis
                </Typography>
                <Typography variant="body2">
                  {PRICE_BASIS_LABELS[terms.priceBasis] || terms.priceBasis}
                  {terms.priceBasis === 'EX_WORKS' && terms.priceBasisLocation && (
                    <> — {terms.priceBasisLocation}</>
                  )}
                </Typography>
              </Box>

              {/* Payment Schedule */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Payment Schedule
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell width={60}>S.No</TableCell>
                        <TableCell>Payment Type</TableCell>
                        <TableCell align="right" width={80}>
                          %
                        </TableCell>
                        <TableCell>Deliverables</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {terms.paymentSchedule.map((milestone) => (
                        <TableRow key={milestone.id}>
                          <TableCell>{milestone.serialNumber}</TableCell>
                          <TableCell>
                            {milestone.paymentType}
                            {milestone.carriesTax && (
                              <Chip
                                label="+ tax"
                                size="small"
                                color="info"
                                variant="outlined"
                                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">{milestone.percentage}%</TableCell>
                          <TableCell>{milestone.deliverables}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Currency */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Currency
                </Typography>
                <Typography variant="body2">{terms.currency}</Typography>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Delivery Terms */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="medium">
              Delivery Terms
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Delivery Period
                </Typography>
                <Typography variant="body2">
                  {terms.deliveryUnit === 'READY_STOCK'
                    ? 'Ready Stock'
                    : terms.deliveryUnit
                      ? `${terms.deliveryPeriod} ${terms.deliveryUnit.toLowerCase()} from ${
                          DELIVERY_TRIGGER_LABELS[terms.deliveryTrigger] || terms.deliveryTrigger
                        }`
                      : terms.deliveryWeeks
                        ? `${terms.deliveryWeeks} weeks from ${
                            DELIVERY_TRIGGER_LABELS[terms.deliveryTrigger] || terms.deliveryTrigger
                          }`
                        : 'Not specified'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Packing & Forwarding
                </Typography>
                <Typography variant="body2">
                  {terms.packingForwardingIncluded
                    ? 'Included in price'
                    : terms.pfChargeType === 'PERCENTAGE'
                      ? `Extra — ${terms.pfChargeValue}% of basic amount`
                      : terms.pfChargeType === 'LUMPSUM'
                        ? `Extra — Lump sum ₹${terms.pfChargeValue?.toLocaleString('en-IN') ?? '—'}`
                        : 'Not included'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Delivery Address
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {terms.deliveryAddress}
                </Typography>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Service Terms — only when the PO covers service line items. */}
        {hasServiceTerms && serviceTerms && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1" fontWeight="medium">
                Service Terms
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {serviceTerms.scopeOfWork && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Scope of Work
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                      {serviceTerms.scopeOfWork}
                    </Typography>
                  </Box>
                )}
                {serviceTerms.deliverables && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Deliverables
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                      {serviceTerms.deliverables}
                    </Typography>
                  </Box>
                )}
                {serviceTerms.completionPeriod && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Completion Period
                    </Typography>
                    <Typography variant="body2">
                      {serviceTerms.completionPeriod}{' '}
                      {(serviceTerms.completionPeriodUnit ?? 'DAYS').toLowerCase()}
                    </Typography>
                  </Box>
                )}
                {serviceTerms.serviceLocation && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Service Location
                    </Typography>
                    <Typography variant="body2">{serviceTerms.serviceLocation}</Typography>
                  </Box>
                )}
                {serviceTerms.acceptanceCriteria && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Acceptance Criteria
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                      {serviceTerms.acceptanceCriteria}
                    </Typography>
                  </Box>
                )}
                {serviceTerms.exclusions && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Exclusions
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                      {serviceTerms.exclusions}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Safety & Compliance — only the requirements that are switched on. */}
        {hasSafety && safety && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1" fontWeight="medium">
                Safety & Compliance
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {safety.safetyRequired && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Safety
                    </Typography>
                    <Typography variant="body2">{safety.safetyDetails || 'Required'}</Typography>
                  </Box>
                )}
                {safety.ppeRequired && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      PPE
                    </Typography>
                    <Typography variant="body2">{safety.ppeDetails || 'Required'}</Typography>
                  </Box>
                )}
                {safety.workPermitRequired && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Work Permit
                    </Typography>
                    <Typography variant="body2">
                      {safety.workPermitDetails || 'Required'}
                    </Typography>
                  </Box>
                )}
                {safety.insuranceRequired && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Insurance
                    </Typography>
                    <Typography variant="body2">{safety.insuranceDetails || 'Required'}</Typography>
                  </Box>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Scope of Work */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="medium">
              Scope of Work
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Stack direction="row" spacing={4}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Freight
                  </Typography>
                  <Typography variant="body2">
                    {SCOPE_LABELS[terms.freightScope] || terms.freightScope}
                    {terms.freightScope === 'CUSTOMER' && terms.freightPaymentType && (
                      <> — {terms.freightPaymentType === 'PREPAID' ? 'Prepaid' : 'To-Pay'}</>
                    )}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Transport
                  </Typography>
                  <Typography variant="body2">
                    {SCOPE_LABELS[terms.transportScope] || terms.transportScope}
                    {terms.deliveryType && (
                      <> — {terms.deliveryType === 'DOOR' ? 'Door' : 'Godown'} delivery</>
                    )}
                  </Typography>
                  {terms.transporterName && (
                    <Typography variant="caption" color="text.secondary">
                      Transporter: {terms.transporterName}
                    </Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Transit Insurance
                  </Typography>
                  <Typography variant="body2">
                    {SCOPE_LABELS[terms.transitInsuranceScope] || terms.transitInsuranceScope}
                  </Typography>
                </Box>
              </Stack>
              {terms.transitInsuranceInstruction && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Transit Insurance Instruction
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {terms.transitInsuranceInstruction}
                  </Typography>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Erection & Commissioning
                </Typography>
                <Typography variant="body2">
                  {ERECTION_LABELS[terms.erectionScope] || terms.erectionScope}
                  {terms.erectionScope === 'CUSTOM' && terms.erectionCustomText && (
                    <> - {terms.erectionCustomText}</>
                  )}
                  {terms.erectionScope === 'VENDOR' &&
                    (() => {
                      const inc = [
                        terms.erectionIncludesTransport && 'transportation',
                        terms.erectionIncludesFood && 'food',
                        terms.erectionIncludesAccommodation && 'accommodation',
                      ].filter(Boolean);
                      return inc.length > 0 ? <> — incl. {inc.join(', ')}</> : null;
                    })()}
                </Typography>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Quality & Inspection */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="medium">
              Quality & Inspection
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Post Order Documents
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                  {terms.requiredDocuments.map((doc) => (
                    <Chip key={doc} label={DOCUMENT_LABELS[doc] || doc} size="small" />
                  ))}
                  {terms.otherDocuments?.map((doc) => (
                    <Chip key={doc} label={doc} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Inspection
                </Typography>
                <Typography variant="body2">
                  {INSPECTOR_LABELS[terms.inspectorType] || terms.inspectorType}
                  {terms.inspectionType && (
                    <> — {terms.inspectionType === 'STAGE' ? 'Stage' : 'Final'} inspection</>
                  )}
                </Typography>
              </Box>
              {terms.inspectionDocuments && terms.inspectionDocuments.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Inspection Documents
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                    {terms.inspectionDocuments.map((doc) => (
                      <Chip key={doc} label={doc} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  MDCC Required
                </Typography>
                <Typography variant="body2">{terms.mdccRequired ? 'Yes' : 'No'}</Typography>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Penalties & Warranty */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="medium">
              Penalties & Warranty
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Liquidated Damages
                </Typography>
                <Typography variant="body2">
                  {terms.ldPerWeekPercent}% per week of delay, maximum {terms.ldMaxPercent}% of
                  order value
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Warranty
                </Typography>
                <Alert severity="info" sx={{ mt: 1 }}>
                  {buildWarrantyClause(terms)}
                </Alert>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Standard Clauses */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="medium">
              Standard Clauses
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Force Majeure
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                  {template.fixedTexts.forceMajeure}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Rejection Clause
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                  {template.fixedTexts.rejectionClause}
                </Typography>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Billing & Contact */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="medium">
              Addresses & Contact
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Billing Address
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {terms.billingAddress}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Buyer Contact
                </Typography>
                <Typography variant="body2">{terms.buyerContactName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {terms.buyerContactPhone} | {terms.buyerContactEmail}
                </Typography>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Paper>
  );
}
