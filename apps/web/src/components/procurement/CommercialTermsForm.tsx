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
  POScopeAssignment,
  POErectionScope,
  PORequiredDocument,
  POInspectorType,
} from '@vapour/types';
import { PaymentScheduleEditor } from './PaymentScheduleEditor';
import { validatePaymentSchedule } from '@/lib/procurement/commercialTerms';

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
  DRAWING: 'Drawing',
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

  const handleDocumentToggle = useCallback(
    (doc: PORequiredDocument) => {
      const current = terms.requiredDocuments || [];
      const updated = current.includes(doc)
        ? current.filter((d) => d !== doc)
        : [...current, doc];
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
              <FormHelperText>Defines who bears freight costs and when ownership transfers</FormHelperText>
            </FormControl>

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
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Delivery Period"
                type="number"
                value={terms.deliveryWeeks}
                onChange={(e) => handleChange('deliveryWeeks', Number(e.target.value))}
                disabled={disabled}
                inputProps={{ min: 1, max: 104 }}
                InputProps={{ endAdornment: <InputAdornment position="end">weeks</InputAdornment> }}
                sx={{ width: 180 }}
                error={!!errors.deliveryWeeks}
                helperText={errors.deliveryWeeks}
              />

              <FormControl sx={{ minWidth: 250 }} disabled={disabled}>
                <InputLabel>Delivery Trigger</InputLabel>
                <Select
                  value={terms.deliveryTrigger}
                  label="Delivery Trigger"
                  onChange={(e) => handleChange('deliveryTrigger', e.target.value as PODeliveryTrigger)}
                >
                  {Object.entries(DELIVERY_TRIGGER_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {/* 5. Packing & Forwarding */}
            <FormControlLabel
              control={
                <Switch
                  checked={terms.packingForwardingIncluded}
                  onChange={(e) => handleChange('packingForwardingIncluded', e.target.checked)}
                  disabled={disabled}
                />
              }
              label="Packing & Forwarding charges included in price"
            />

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

            {/* 7. Transport */}
            <FormControl fullWidth disabled={disabled}>
              <InputLabel>Transport</InputLabel>
              <Select
                value={terms.transportScope}
                label="Transport"
                onChange={(e) => handleChange('transportScope', e.target.value as POScopeAssignment)}
              >
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
            {/* 12. Document Submission */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Required Documents
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
                value={(terms.otherDocuments || []).join(', ')}
                onChange={(e) =>
                  handleChange(
                    'otherDocuments',
                    e.target.value
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
            <FormControl fullWidth disabled={disabled}>
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
              <FormHelperText>
                {template.fixedTexts.inspection.substring(0, 100)}...
              </FormHelperText>
            </FormControl>

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
                Delay penalty: {terms.ldPerWeekPercent}% per week of delay, maximum {terms.ldMaxPercent}% of order value
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
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Warranty from Supply"
                type="number"
                value={terms.warrantyMonthsFromSupply}
                onChange={(e) => handleChange('warrantyMonthsFromSupply', Number(e.target.value))}
                disabled={disabled}
                inputProps={{ min: 0, max: 60 }}
                InputProps={{ endAdornment: <InputAdornment position="end">months</InputAdornment> }}
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
                InputProps={{ endAdornment: <InputAdornment position="end">months</InputAdornment> }}
                sx={{ width: 200 }}
              />
            </Stack>
            <Alert severity="info" sx={{ mt: 1 }}>
              Warranty: {terms.warrantyMonthsFromSupply} months from supply or{' '}
              {terms.warrantyMonthsFromCommissioning} months from commissioning, whichever is later
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
    </Box>
  );
}

export default CommercialTermsForm;
