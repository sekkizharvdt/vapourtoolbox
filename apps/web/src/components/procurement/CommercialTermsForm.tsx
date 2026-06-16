'use client';

/**
 * Commercial Terms Form
 *
 * Comprehensive form for editing PO commercial terms with 19 structured sections.
 * Organized into collapsible groups for better UX.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  FormLabel,
  Switch,
  Checkbox,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  FormHelperText,
  InputAdornment,
  FormGroup,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type {
  POCommercialTerms,
  CommercialTermsTemplate,
  POPriceBasis,
  PODeliveryTrigger,
  PODeliveryUnit,
  POScopeAssignment,
  POErectionScope,
  PORequiredDocument,
  POInspectorType,
  POServiceTerms,
  POSafetyCompliance,
} from '@vapour/types';
import { PaymentScheduleEditor } from './PaymentScheduleEditor';
import { validatePaymentSchedule, buildWarrantyClause } from '@/lib/procurement/commercialTerms';

// Labels for display
const PRICE_BASIS_LABELS: Record<POPriceBasis, string> = {
  FOR_SITE: 'FOR Site (Free On Road - Site)',
  EX_WORKS: 'Ex-Works (Vendor Location)',
  FOR_DESTINATION: 'FOR Destination',
};

const DELIVERY_TRIGGER_LABELS: Record<PODeliveryTrigger, string> = {
  PO_DATE: 'From PO Date',
  ADVANCE_PAYMENT: 'From Advance Payment Receipt',
  DRAWING_APPROVAL: 'From Drawing Approval',
};

const DELIVERY_UNIT_LABELS: Record<PODeliveryUnit, string> = {
  READY_STOCK: 'Ready Stock',
  DAYS: 'Days',
  WEEKS: 'Weeks',
  MONTHS: 'Months',
};

const SCOPE_LABELS: Record<POScopeAssignment, string> = {
  VENDOR: 'Vendor Scope',
  CUSTOMER: 'Customer Scope',
};

const ERECTION_LABELS: Record<POErectionScope, string> = {
  VENDOR: 'Vendor Scope',
  NA: 'Not Applicable',
  CUSTOM: 'Custom (specify below)',
};

const DOCUMENT_LABELS: Record<PORequiredDocument, string> = {
  DRAWING: 'GA Drawing (GAD)',
  DATA_SHEET: 'Data Sheet',
  QAP: 'Quality Assurance Plan (QAP)',
  OTHER: 'Other Documents',
};

const INSPECTOR_LABELS: Record<POInspectorType, string> = {
  VDT: 'VDT (Internal)',
  VDT_CONSULTANT: 'VDT Consultant',
  THIRD_PARTY: 'Third Party Inspector',
};

interface CommercialTermsFormProps {
  terms: POCommercialTerms;
  template: CommercialTermsTemplate;
  onChange: (terms: POCommercialTerms) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

export function CommercialTermsForm({
  terms,
  template,
  onChange,
  disabled = false,
  errors = {},
}: CommercialTermsFormProps) {
  // Track expanded accordion sections
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'pricing',
    'delivery',
    'scope',
  ]);

  // Local state for Other Documents text input (process on blur, not every keystroke)
  const [otherDocsText, setOtherDocsText] = useState((terms.otherDocuments || []).join(', '));
  const [inspectionDocsText, setInspectionDocsText] = useState(
    (terms.inspectionDocuments || []).join(', ')
  );

  const handleSectionToggle = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handleChange = useCallback(
    <K extends keyof POCommercialTerms>(field: K, value: POCommercialTerms[K]) => {
      onChange({ ...terms, [field]: value });
    },
    [terms, onChange]
  );

  const handleServiceTermChange = useCallback(
    <K extends keyof POServiceTerms>(field: K, value: POServiceTerms[K]) => {
      onChange({ ...terms, serviceTerms: { ...(terms.serviceTerms ?? {}), [field]: value } });
    },
    [terms, onChange]
  );

  const handleSafetyChange = useCallback(
    <K extends keyof POSafetyCompliance>(field: K, value: POSafetyCompliance[K]) => {
      onChange({
        ...terms,
        safetyCompliance: { ...(terms.safetyCompliance ?? {}), [field]: value },
      });
    },
    [terms, onChange]
  );

  const serviceTerms = terms.serviceTerms ?? {};
  const safety = terms.safetyCompliance ?? {};

  const handleDocumentToggle = useCallback(
    (doc: PORequiredDocument) => {
      const current = terms.requiredDocuments || [];
      const updated = current.includes(doc) ? current.filter((d) => d !== doc) : [...current, doc];
      handleChange('requiredDocuments', updated);
    },
    [terms.requiredDocuments, handleChange]
  );

  // Validation
  const paymentScheduleValidation = useMemo(
    () => validatePaymentSchedule(terms.paymentSchedule),
    [terms.paymentSchedule]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Template Info */}
      <Alert severity="info" icon={false}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">Using template:</Typography>
          <Chip label={template.name} size="small" color="primary" />
          {template.description && (
            <Typography variant="body2" color="text.secondary">
              - {template.description}
            </Typography>
          )}
        </Stack>
      </Alert>

      {/* Section 1-3: Pricing & Payment */}
      <Accordion
        expanded={expandedSections.includes('pricing')}
        onChange={() => handleSectionToggle('pricing')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" fontWeight="medium">
              Pricing & Payment
            </Typography>
            {!paymentScheduleValidation.isValid && (
              <Chip label="Incomplete" size="small" color="error" />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            {/* 1. Price Basis */}
            <FormControl fullWidth disabled={disabled}>
              <InputLabel>Price Basis</InputLabel>
              <Select
                value={terms.priceBasis}
                label="Price Basis"
                onChange={(e) => handleChange('priceBasis', e.target.value as POPriceBasis)}
              >
                {Object.entries(PRICE_BASIS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Defines who bears freight costs and when ownership transfers
              </FormHelperText>
            </FormControl>

            {terms.priceBasis === 'EX_WORKS' && (
              <TextField
                label="Ex-Works Location"
                value={terms.priceBasisLocation ?? ''}
                onChange={(e) => handleChange('priceBasisLocation', e.target.value)}
                disabled={disabled}
                fullWidth
                placeholder="e.g. Chennai, Bangalore"
              />
            )}

            {/* 2. Payment Schedule */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Payment Terms
              </Typography>
              <PaymentScheduleEditor
                milestones={terms.paymentSchedule}
                onChange={(milestones) => handleChange('paymentSchedule', milestones)}
                disabled={disabled}
              />
            </Box>

            {/* 3. Currency */}
            <FormControl fullWidth disabled={disabled}>
              <InputLabel>Currency</InputLabel>
              <Select
                value={terms.currency}
                label="Currency"
                onChange={(e) => handleChange('currency', e.target.value)}
              >
                <MenuItem value="INR">INR - Indian Rupee</MenuItem>
                <MenuItem value="USD">USD - US Dollar</MenuItem>
                <MenuItem value="EUR">EUR - Euro</MenuItem>
                <MenuItem value="GBP">GBP - British Pound</MenuItem>
                <MenuItem value="AED">AED - UAE Dirham</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 4-5: Delivery */}
      <Accordion
        expanded={expandedSections.includes('delivery')}
        onChange={() => handleSectionToggle('delivery')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Delivery Terms
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            {/* 4. Delivery Period */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              {/* Delivery Unit Selector */}
              <FormControl sx={{ minWidth: 150 }} disabled={disabled}>
                <InputLabel>Delivery Type</InputLabel>
                <Select
                  value={terms.deliveryUnit || 'WEEKS'}
                  label="Delivery Type"
                  onChange={(e) => handleChange('deliveryUnit', e.target.value as PODeliveryUnit)}
                >
                  {Object.entries(DELIVERY_UNIT_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Delivery Period - hidden for Ready Stock */}
              {terms.deliveryUnit !== 'READY_STOCK' && (
                <TextField
                  label="Delivery Period"
                  type="number"
                  value={terms.deliveryPeriod ?? terms.deliveryWeeks ?? 8}
                  onChange={(e) => handleChange('deliveryPeriod', Number(e.target.value))}
                  disabled={disabled}
                  inputProps={{
                    min: 1,
                    max:
                      terms.deliveryUnit === 'DAYS'
                        ? 365
                        : terms.deliveryUnit === 'MONTHS'
                          ? 24
                          : 104,
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {terms.deliveryUnit === 'DAYS'
                          ? 'days'
                          : terms.deliveryUnit === 'MONTHS'
                            ? 'months'
                            : 'weeks'}
                      </InputAdornment>
                    ),
                  }}
                  sx={{ width: 180 }}
                  error={!!errors.deliveryPeriod}
                  helperText={errors.deliveryPeriod}
                />
              )}

              {/* Delivery Trigger - hidden for Ready Stock */}
              {terms.deliveryUnit !== 'READY_STOCK' && (
                <FormControl sx={{ minWidth: 250 }} disabled={disabled}>
                  <InputLabel>Delivery Trigger</InputLabel>
                  <Select
                    value={terms.deliveryTrigger}
                    label="Delivery Trigger"
                    onChange={(e) =>
                      handleChange('deliveryTrigger', e.target.value as PODeliveryTrigger)
                    }
                  >
                    {Object.entries(DELIVERY_TRIGGER_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>

            {/* Ready Stock info message */}
            {terms.deliveryUnit === 'READY_STOCK' && (
              <Alert severity="info" sx={{ mt: -1 }}>
                Items are available immediately from vendor stock. No delivery period required.
              </Alert>
            )}

            {/* Detailed delivery schedule / milestones (feedback iZqGG) */}
            <TextField
              label="Delivery Schedule / Milestones (optional)"
              value={terms.deliverySchedule ?? ''}
              onChange={(e) => handleChange('deliverySchedule', e.target.value)}
              disabled={disabled}
              multiline
              rows={3}
              fullWidth
              placeholder="e.g. First-cut drawing within 10 working days from receipt of PO and inputs; completion of engineering activities within 30 days."
              helperText="Free-text schedule shown on the PO PDF, in addition to the delivery period above."
            />

            {/* 5. Packing & Forwarding */}
            <FormControlLabel
              control={
                <Switch
                  checked={terms.packingForwardingIncluded}
                  onChange={(e) => {
                    handleChange('packingForwardingIncluded', e.target.checked);
                    if (e.target.checked) {
                      handleChange(
                        'pfChargeType',
                        undefined as unknown as 'PERCENTAGE' | 'LUMPSUM'
                      );
                      handleChange('pfChargeValue', undefined as unknown as number);
                    }
                  }}
                  disabled={disabled}
                />
              }
              label="Packing & Forwarding charges included in price"
            />
            {!terms.packingForwardingIncluded && (
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <FormControl size="small" sx={{ minWidth: 160 }} disabled={disabled}>
                  <InputLabel>P&F Charge Type</InputLabel>
                  <Select
                    value={terms.pfChargeType || ''}
                    label="P&F Charge Type"
                    onChange={(e) =>
                      handleChange('pfChargeType', e.target.value as 'PERCENTAGE' | 'LUMPSUM')
                    }
                  >
                    <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
                    <MenuItem value="LUMPSUM">Lump Sum</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={terms.pfChargeType === 'PERCENTAGE' ? 'P&F Percentage' : 'P&F Amount'}
                  type="number"
                  value={terms.pfChargeValue ?? ''}
                  onChange={(e) =>
                    handleChange(
                      'pfChargeValue',
                      e.target.value ? Number(e.target.value) : (undefined as unknown as number)
                    )
                  }
                  disabled={disabled}
                  size="small"
                  sx={{ width: 160 }}
                  InputProps={{
                    endAdornment:
                      terms.pfChargeType === 'PERCENTAGE' ? (
                        <InputAdornment position="end">%</InputAdornment>
                      ) : undefined,
                  }}
                />
              </Stack>
            )}

            {/* 11. Delivery Address */}
            <TextField
              label="Delivery Address"
              value={terms.deliveryAddress}
              onChange={(e) => handleChange('deliveryAddress', e.target.value)}
              disabled={disabled}
              multiline
              rows={3}
              fullWidth
              required
              error={!!errors.deliveryAddress}
              helperText={errors.deliveryAddress || 'Complete site delivery address'}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 6-9: Scope of Work */}
      <Accordion
        expanded={expandedSections.includes('scope')}
        onChange={() => handleSectionToggle('scope')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Scope of Work
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            {/* Section visibility — uncheck to exclude from the PO PDF (e.g. for
                a Service Order where freight/transport don't apply). Feedback iZqGG. */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Applicable sections
              </Typography>
              <FormHelperText sx={{ mt: -0.5, mb: 0.5 }}>
                Uncheck a section to exclude it from the PO PDF.
              </FormHelperText>
              <Stack direction="row" flexWrap="wrap">
                {(
                  [
                    ['freightRequired', 'Freight'],
                    ['transportRequired', 'Transport'],
                    ['transitInsuranceRequired', 'Transit Insurance'],
                    ['erectionRequired', 'Erection & Commissioning'],
                  ] as const
                ).map(([field, label]) => (
                  <FormControlLabel
                    key={field}
                    control={
                      <Switch
                        checked={terms[field] !== false}
                        onChange={(e) => handleChange(field, e.target.checked)}
                        disabled={disabled}
                      />
                    }
                    label={label}
                  />
                ))}
              </Stack>
            </Box>

            {/* 6. Freight */}
            <FormControl fullWidth disabled={disabled}>
              <InputLabel>Freight</InputLabel>
              <Select
                value={terms.freightScope}
                label="Freight"
                onChange={(e) => handleChange('freightScope', e.target.value as POScopeAssignment)}
              >
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {terms.freightScope === 'CUSTOMER' && (
              <FormControl fullWidth disabled={disabled}>
                <InputLabel>Freight Payment</InputLabel>
                <Select
                  value={terms.freightPaymentType ?? ''}
                  label="Freight Payment"
                  onChange={(e) =>
                    handleChange('freightPaymentType', e.target.value as 'PREPAID' | 'TO_PAY')
                  }
                >
                  <MenuItem value="TO_PAY">To-Pay (paid on receipt)</MenuItem>
                  <MenuItem value="PREPAID">Prepaid (vendor pays, claims via invoice)</MenuItem>
                </Select>
                <FormHelperText>How customer-scope freight is settled</FormHelperText>
              </FormControl>
            )}

            {/* 7. Transport */}
            <FormControl fullWidth disabled={disabled}>
              <InputLabel>Transport</InputLabel>
              <Select
                value={terms.transportScope}
                label="Transport"
                onChange={(e) =>
                  handleChange('transportScope', e.target.value as POScopeAssignment)
                }
              >
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Transporter Name (optional)"
                value={terms.transporterName ?? ''}
                onChange={(e) => handleChange('transporterName', e.target.value)}
                disabled={disabled}
                fullWidth
                placeholder="e.g. VRL Logistics"
              />
              <FormControl sx={{ minWidth: 200 }} disabled={disabled}>
                <InputLabel>Delivery Type</InputLabel>
                <Select
                  value={terms.deliveryType ?? ''}
                  label="Delivery Type"
                  onChange={(e) =>
                    handleChange('deliveryType', e.target.value as 'GODOWN' | 'DOOR')
                  }
                >
                  <MenuItem value="DOOR">Door Delivery</MenuItem>
                  <MenuItem value="GODOWN">Godown Delivery</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {/* 8. Transit Insurance */}
            <FormControl fullWidth disabled={disabled}>
              <InputLabel>Transit Insurance</InputLabel>
              <Select
                value={terms.transitInsuranceScope}
                label="Transit Insurance"
                onChange={(e) =>
                  handleChange('transitInsuranceScope', e.target.value as POScopeAssignment)
                }
              >
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Transit Insurance Instruction (optional)"
              value={terms.transitInsuranceInstruction ?? ''}
              onChange={(e) => handleChange('transitInsuranceInstruction', e.target.value)}
              disabled={disabled}
              multiline
              rows={2}
              fullWidth
              placeholder="e.g. Vendor to share dispatch details for transit insurance; open policy no. ... to be referenced on dispatch documents"
            />

            {/* 9. Erection & Commissioning */}
            <FormControl fullWidth disabled={disabled}>
              <InputLabel>Erection & Commissioning</InputLabel>
              <Select
                value={terms.erectionScope}
                label="Erection & Commissioning"
                onChange={(e) => handleChange('erectionScope', e.target.value as POErectionScope)}
              >
                {Object.entries(ERECTION_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {terms.erectionScope === 'VENDOR' && (
              <FormControl component="fieldset" disabled={disabled}>
                <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>
                  Vendor scope includes
                </FormLabel>
                <Stack direction="row" flexWrap="wrap">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={terms.erectionIncludesTransport ?? false}
                        onChange={(e) =>
                          handleChange('erectionIncludesTransport', e.target.checked)
                        }
                      />
                    }
                    label="Transportation"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={terms.erectionIncludesFood ?? false}
                        onChange={(e) => handleChange('erectionIncludesFood', e.target.checked)}
                      />
                    }
                    label="Food"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={terms.erectionIncludesAccommodation ?? false}
                        onChange={(e) =>
                          handleChange('erectionIncludesAccommodation', e.target.checked)
                        }
                      />
                    }
                    label="Accommodation"
                  />
                </Stack>
              </FormControl>
            )}

            {terms.erectionScope === 'CUSTOM' && (
              <TextField
                label="Erection & Commissioning Details"
                value={terms.erectionCustomText || ''}
                onChange={(e) => handleChange('erectionCustomText', e.target.value)}
                disabled={disabled}
                multiline
                rows={2}
                fullWidth
                placeholder="Specify the scope of erection and commissioning work..."
              />
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 10-11: Addresses (10 is fixed VDT billing) */}
      <Accordion
        expanded={expandedSections.includes('addresses')}
        onChange={() => handleSectionToggle('addresses')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Addresses
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            {/* 10. Billing Address (Fixed VDT) */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Billing Address (Fixed)
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {terms.billingAddress}
                </Typography>
              </Paper>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 12-14: Quality & Inspection */}
      <Accordion
        expanded={expandedSections.includes('quality')}
        onChange={() => handleSectionToggle('quality')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Quality & Inspection
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            {/* 12. Post Order Documents */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Post Order Documents
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Documents the vendor must submit before starting production (GAD, datasheet, QAP, …)
              </Typography>
              <FormGroup row>
                {(Object.keys(DOCUMENT_LABELS) as PORequiredDocument[]).map((doc) => (
                  <FormControlLabel
                    key={doc}
                    control={
                      <Checkbox
                        checked={terms.requiredDocuments.includes(doc)}
                        onChange={() => handleDocumentToggle(doc)}
                        disabled={disabled}
                      />
                    }
                    label={DOCUMENT_LABELS[doc]}
                  />
                ))}
              </FormGroup>
              <TextField
                label="Other Documents (comma-separated)"
                value={otherDocsText}
                onChange={(e) => setOtherDocsText(e.target.value)}
                onBlur={() =>
                  handleChange(
                    'otherDocuments',
                    otherDocsText
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                disabled={disabled}
                fullWidth
                size="small"
                sx={{ mt: 1 }}
                placeholder="e.g., Test Certificate, Material Certificate"
              />
            </Box>

            {/* 13. Inspection */}
            <FormControlLabel
              control={
                <Switch
                  checked={terms.inspectionRequired !== false}
                  onChange={(e) => handleChange('inspectionRequired', e.target.checked)}
                  disabled={disabled}
                />
              }
              label="Inspection applicable (uncheck to exclude from the PO PDF)"
            />
            <FormControl fullWidth disabled={disabled || terms.inspectionRequired === false}>
              <InputLabel>Inspector Type</InputLabel>
              <Select
                value={terms.inspectorType}
                label="Inspector Type"
                onChange={(e) => handleChange('inspectorType', e.target.value as POInspectorType)}
              >
                {Object.entries(INSPECTOR_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{template.fixedTexts.inspection.substring(0, 100)}...</FormHelperText>
            </FormControl>

            <FormControl fullWidth disabled={disabled}>
              <InputLabel>Inspection Type</InputLabel>
              <Select
                value={terms.inspectionType ?? ''}
                label="Inspection Type"
                onChange={(e) =>
                  handleChange('inspectionType', e.target.value as 'STAGE' | 'FINAL')
                }
              >
                <MenuItem value="FINAL">Final Inspection</MenuItem>
                <MenuItem value="STAGE">Stage Inspection</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Inspection Documents (comma-separated)"
              value={inspectionDocsText}
              onChange={(e) => setInspectionDocsText(e.target.value)}
              onBlur={() =>
                handleChange(
                  'inspectionDocuments',
                  inspectionDocsText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              disabled={disabled}
              fullWidth
              size="small"
              placeholder="Documents the vendor must submit with the inspection call, e.g. Test Certificate, IR, MTC"
              helperText="Listed in the inspection clause so the supplier submits them along with the inspection call"
            />

            {/* 14. MDCC Required */}
            <FormControlLabel
              control={
                <Switch
                  checked={terms.mdccRequired}
                  onChange={(e) => handleChange('mdccRequired', e.target.checked)}
                  disabled={disabled}
                />
              }
              label="Material Dispatch Clearance Certificate (MDCC) required before dispatch"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 15-17: Penalties & Clauses */}
      <Accordion
        expanded={expandedSections.includes('penalties')}
        onChange={() => handleSectionToggle('penalties')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Penalties & Standard Clauses
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            {/* 15. Liquidated Damages */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Liquidated Damages (LD)
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="LD per Week"
                  type="number"
                  value={terms.ldPerWeekPercent}
                  onChange={(e) => handleChange('ldPerWeekPercent', Number(e.target.value))}
                  disabled={disabled}
                  inputProps={{ min: 0, max: 5, step: 0.1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  sx={{ width: 150 }}
                />
                <TextField
                  label="Maximum LD"
                  type="number"
                  value={terms.ldMaxPercent}
                  onChange={(e) => handleChange('ldMaxPercent', Number(e.target.value))}
                  disabled={disabled}
                  inputProps={{ min: 0, max: 20, step: 0.5 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  sx={{ width: 150 }}
                />
              </Stack>
              <FormHelperText>
                Delay penalty: {terms.ldPerWeekPercent}% per week of delay, maximum{' '}
                {terms.ldMaxPercent}% of order value
              </FormHelperText>
            </Box>

            {/* 16. Force Majeure (Fixed text - read only) */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Force Majeure Clause
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  {template.fixedTexts.forceMajeure}
                </Typography>
              </Paper>
            </Box>

            {/* 17. Rejection Clause (Fixed text - read only) */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Rejection Clause
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  {template.fixedTexts.rejectionClause}
                </Typography>
              </Paper>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 18: Warranty */}
      <Accordion
        expanded={expandedSections.includes('warranty')}
        onChange={() => handleSectionToggle('warranty')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Warranty
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={terms.warrantyApplicable !== false}
                  onChange={(e) => handleChange('warrantyApplicable', e.target.checked)}
                  disabled={disabled}
                />
              }
              label="Warranty applicable"
            />
            {terms.warrantyApplicable !== false && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Warranty from Supply"
                  type="number"
                  value={terms.warrantyMonthsFromSupply}
                  onChange={(e) => handleChange('warrantyMonthsFromSupply', Number(e.target.value))}
                  disabled={disabled}
                  inputProps={{ min: 0, max: 60 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">months</InputAdornment>,
                  }}
                  sx={{ width: 200 }}
                />
                <TextField
                  label="Warranty from Commissioning"
                  type="number"
                  value={terms.warrantyMonthsFromCommissioning}
                  onChange={(e) =>
                    handleChange('warrantyMonthsFromCommissioning', Number(e.target.value))
                  }
                  disabled={disabled}
                  inputProps={{ min: 0, max: 36 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">months</InputAdornment>,
                  }}
                  sx={{ width: 200 }}
                />
                <FormControl size="small" sx={{ minWidth: 180 }} disabled={disabled}>
                  <InputLabel>Whichever is</InputLabel>
                  <Select
                    value={terms.warrantyComparison ?? 'LATER'}
                    label="Whichever is"
                    onChange={(e) =>
                      handleChange('warrantyComparison', e.target.value as 'EARLIER' | 'LATER')
                    }
                  >
                    <MenuItem value="LATER">Later</MenuItem>
                    <MenuItem value="EARLIER">Earlier</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}
            <Alert severity="info" sx={{ mt: 1 }}>
              Warranty: {buildWarrantyClause(terms)}
            </Alert>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 19: Buyer Contact */}
      <Accordion
        expanded={expandedSections.includes('contact')}
        onChange={() => handleSectionToggle('contact')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Buyer Contact
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              label="Contact Name"
              value={terms.buyerContactName}
              onChange={(e) => handleChange('buyerContactName', e.target.value)}
              disabled={disabled}
              fullWidth
              required
              error={!!errors.buyerContactName}
              helperText={errors.buyerContactName}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Phone"
                value={terms.buyerContactPhone}
                onChange={(e) => handleChange('buyerContactPhone', e.target.value)}
                disabled={disabled}
                fullWidth
                required
                error={!!errors.buyerContactPhone}
                helperText={errors.buyerContactPhone}
              />
              <TextField
                label="Email"
                type="email"
                value={terms.buyerContactEmail}
                onChange={(e) => handleChange('buyerContactEmail', e.target.value)}
                disabled={disabled}
                fullWidth
                required
                error={!!errors.buyerContactEmail}
                helperText={errors.buyerContactEmail}
              />
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 20: Service Terms (for POs that include service line items) */}
      <Accordion
        expanded={expandedSections.includes('serviceTerms')}
        onChange={() => handleSectionToggle('serviceTerms')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Service Terms
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormHelperText sx={{ mt: 0 }}>
              Fill these for service line items (e.g. inspection, calibration, erection). Leave
              blank for a pure-material PO.
            </FormHelperText>
            <TextField
              label="Scope of Work"
              value={serviceTerms.scopeOfWork ?? ''}
              onChange={(e) => handleServiceTermChange('scopeOfWork', e.target.value)}
              disabled={disabled}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Deliverables"
              value={serviceTerms.deliverables ?? ''}
              onChange={(e) => handleServiceTermChange('deliverables', e.target.value)}
              disabled={disabled}
              fullWidth
              multiline
              minRows={2}
              helperText="Outputs / reports expected from the service"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Completion Period"
                type="number"
                value={serviceTerms.completionPeriod ?? ''}
                onChange={(e) =>
                  handleServiceTermChange(
                    'completionPeriod',
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                disabled={disabled}
                inputProps={{ min: 0 }}
                sx={{ width: 180 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }} disabled={disabled}>
                <InputLabel>Period Unit</InputLabel>
                <Select
                  value={serviceTerms.completionPeriodUnit ?? 'DAYS'}
                  label="Period Unit"
                  onChange={(e) =>
                    handleServiceTermChange(
                      'completionPeriodUnit',
                      e.target.value as 'DAYS' | 'WEEKS' | 'MONTHS'
                    )
                  }
                >
                  <MenuItem value="DAYS">Days</MenuItem>
                  <MenuItem value="WEEKS">Weeks</MenuItem>
                  <MenuItem value="MONTHS">Months</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Service Location"
              value={serviceTerms.serviceLocation ?? ''}
              onChange={(e) => handleServiceTermChange('serviceLocation', e.target.value)}
              disabled={disabled}
              fullWidth
              helperText="Where the service is performed (site / vendor works / remote)"
            />
            <TextField
              label="Acceptance Criteria"
              value={serviceTerms.acceptanceCriteria ?? ''}
              onChange={(e) => handleServiceTermChange('acceptanceCriteria', e.target.value)}
              disabled={disabled}
              fullWidth
              multiline
              minRows={2}
              helperText="How completion is verified / signed off"
            />
            <TextField
              label="Exclusions"
              value={serviceTerms.exclusions ?? ''}
              onChange={(e) => handleServiceTermChange('exclusions', e.target.value)}
              disabled={disabled}
              fullWidth
              multiline
              minRows={2}
              helperText="Anything explicitly out of scope"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 21: Safety & Compliance (optional, checkbox-gated) */}
      <Accordion
        expanded={expandedSections.includes('safety')}
        onChange={() => handleSectionToggle('safety')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight="medium">
            Safety & Compliance
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormHelperText sx={{ mt: 0 }}>
              Tick a requirement to capture its details. Relevant for on-site service work.
            </FormHelperText>
            {(
              [
                ['safetyRequired', 'safetyDetails', 'Safety requirements'],
                ['ppeRequired', 'ppeDetails', 'PPE required'],
                ['workPermitRequired', 'workPermitDetails', 'Work permit required'],
                ['insuranceRequired', 'insuranceDetails', 'Insurance required'],
              ] as const
            ).map(([flagKey, detailKey, label]) => (
              <Box key={flagKey}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={safety[flagKey] === true}
                      onChange={(e) => handleSafetyChange(flagKey, e.target.checked)}
                      disabled={disabled}
                    />
                  }
                  label={label}
                />
                {safety[flagKey] === true && (
                  <TextField
                    label={`${label} — details`}
                    value={safety[detailKey] ?? ''}
                    onChange={(e) => handleSafetyChange(detailKey, e.target.value)}
                    disabled={disabled}
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

export default CommercialTermsForm;
