'use client';

/**
 * Generate New Tab
 *
 * Form for generating new RFQ PDFs with customization options.
 */

import {
  Box,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Chip,
  FormControl,
  RadioGroup,
  Radio,
  FormLabel,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  Storefront as VendorIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import type { RFQPDFMode } from '@vapour/types';
import type { GenerateNewTabProps } from './types';

export function GenerateNewTab({
  rfq,
  mode,
  setMode,
  selectedVendorIds,
  onVendorToggle,
  onSelectAllVendors,
  onDeselectAllVendors,
  companyName,
  setCompanyName,
  companyAddress,
  setCompanyAddress,
  companyPhone,
  setCompanyPhone,
  companyEmail,
  setCompanyEmail,
  companyGSTIN,
  setCompanyGSTIN,
  contactPersonName,
  setContactPersonName,
  contactPersonEmail,
  setContactPersonEmail,
  contactPersonPhone,
  setContactPersonPhone,
  useDefaultTerms,
  setUseDefaultTerms,
  generalTerms,
  setGeneralTerms,
  paymentTerms,
  setPaymentTerms,
  deliveryTerms,
  setDeliveryTerms,
  warrantyTerms,
  setWarrantyTerms,
  showItemSpecifications,
  setShowItemSpecifications,
  showDeliveryDates,
  setShowDeliveryDates,
  showEquipmentCodes,
  setShowEquipmentCodes,
  watermark,
  setWatermark,
  customNotes,
  setCustomNotes,
}: GenerateNewTabProps) {
  const handleTermsChange = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter(value.split('\n').filter((line) => line.trim()));
  };

  return (
    <Stack spacing={3}>
      {/* Generation Mode */}
      <Box>
        <FormControl>
          <FormLabel>PDF Generation Mode</FormLabel>
          <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as RFQPDFMode)}>
            <FormControlLabel value="INDIVIDUAL" control={<Radio />} label="One PDF per vendor" />
            <FormControlLabel value="COMBINED" control={<Radio />} label="One combined PDF" />
            <FormControlLabel value="BOTH" control={<Radio />} label="Both" />
          </RadioGroup>
        </FormControl>
      </Box>

      {/* Vendor Selection */}
      {mode !== 'COMBINED' && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VendorIcon />
              <Typography>Select Vendors ({selectedVendorIds.length} selected)</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 1 }}>
              <Button size="small" onClick={onSelectAllVendors}>
                Select All
              </Button>
              <Button size="small" onClick={onDeselectAllVendors}>
                Deselect All
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {rfq.vendorIds.map((vendorId, index) => (
                <Chip
                  key={vendorId}
                  label={rfq.vendorNames[index] || vendorId}
                  onClick={() => onVendorToggle(vendorId)}
                  color={selectedVendorIds.includes(vendorId) ? 'primary' : 'default'}
                  variant={selectedVendorIds.includes(vendorId) ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Company Information */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon />
            <Typography>Company Information</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              label="Company Name *"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Company Address"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Phone"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                fullWidth
              />
              <TextField
                label="Email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label="GSTIN"
              value={companyGSTIN}
              onChange={(e) => setCompanyGSTIN(e.target.value)}
              fullWidth
            />
            <Divider />
            <Typography variant="subtitle2" color="text.secondary">
              Contact Person (for queries)
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Name"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                fullWidth
              />
              <TextField
                label="Email"
                value={contactPersonEmail}
                onChange={(e) => setContactPersonEmail(e.target.value)}
                fullWidth
              />
              <TextField
                label="Phone"
                value={contactPersonPhone}
                onChange={(e) => setContactPersonPhone(e.target.value)}
                fullWidth
              />
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Terms & Conditions */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DescriptionIcon />
            <Typography>Terms & Conditions</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={useDefaultTerms}
                  onChange={(e) => setUseDefaultTerms(e.target.checked)}
                />
              }
              label="Use default terms"
            />

            {!useDefaultTerms && (
              <>
                <TextField
                  label="General Terms (one per line)"
                  value={generalTerms.join('\n')}
                  onChange={(e) => handleTermsChange(setGeneralTerms, e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                />
                <TextField
                  label="Payment Terms (one per line)"
                  value={paymentTerms.join('\n')}
                  onChange={(e) => handleTermsChange(setPaymentTerms, e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                />
                <TextField
                  label="Delivery Terms (one per line)"
                  value={deliveryTerms.join('\n')}
                  onChange={(e) => handleTermsChange(setDeliveryTerms, e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                />
                <TextField
                  label="Warranty Terms (one per line)"
                  value={warrantyTerms.join('\n')}
                  onChange={(e) => handleTermsChange(setWarrantyTerms, e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                />
              </>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Display Options */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon />
            <Typography>Display Options</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showItemSpecifications}
                  onChange={(e) => setShowItemSpecifications(e.target.checked)}
                />
              }
              label="Show item specifications"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showDeliveryDates}
                  onChange={(e) => setShowDeliveryDates(e.target.checked)}
                />
              }
              label="Show required by dates"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showEquipmentCodes}
                  onChange={(e) => setShowEquipmentCodes(e.target.checked)}
                />
              }
              label="Show equipment codes"
            />
            <Divider sx={{ my: 1 }} />
            <TextField
              label="Watermark (optional)"
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
              placeholder="e.g., DRAFT, CONFIDENTIAL"
              helperText="Leave empty for no watermark"
            />
            <TextField
              label="Additional Notes (optional)"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              multiline
              rows={2}
              placeholder="Any additional notes to include in the RFQ"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
