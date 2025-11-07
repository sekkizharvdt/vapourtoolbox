'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Alert,
  TextField,
  FormControlLabel,
  Checkbox,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  FileDownload as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { GSTR1Data, GSTR3BData } from '@/lib/accounting/gstReportGenerator';
import { exportGSTR1ToJSON, exportGSTR3BToJSON } from '@/lib/accounting/gstReportGenerator';

interface GSTFilingInterfaceProps {
  gstr1Data: GSTR1Data | null;
  gstr3bData: GSTR3BData | null;
  onClose: () => void;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const steps = ['Pre-filing Validation', 'Review Returns', 'Generate JSON Files', 'File Returns'];

export function GSTFilingInterface({ gstr1Data, gstr3bData, onClose }: GSTFilingInterfaceProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [filingInProgress, setFilingInProgress] = useState(false);
  const [gstinConfirm, setGstinConfirm] = useState('');
  const [authorizedSignatory, setAuthorizedSignatory] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  // Validate returns before filing
  const validateReturns = (): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!gstr1Data && !gstr3bData) {
      errors.push('No return data available. Please generate returns first.');
      return { isValid: false, errors, warnings };
    }

    // Validate GSTR-1
    if (gstr1Data) {
      if (!gstr1Data.gstin || gstr1Data.gstin.length !== 15) {
        errors.push('Invalid GSTIN. GSTIN must be 15 characters.');
      }

      if (gstr1Data.total.transactionCount === 0) {
        warnings.push('GSTR-1 has no transactions. Consider filing NIL return.');
      }

      if (gstr1Data.b2b.invoices.some((inv) => !inv.customerGSTIN)) {
        warnings.push('Some B2B invoices are missing customer GSTIN.');
      }

      if (gstr1Data.hsnSummary.some((hsn) => hsn.hsnCode === 'UNCLASSIFIED')) {
        warnings.push('Some items are missing HSN codes. This may cause filing issues.');
      }
    }

    // Validate GSTR-3B
    if (gstr3bData) {
      if (!gstr3bData.gstin || gstr3bData.gstin.length !== 15) {
        errors.push('Invalid GSTIN in GSTR-3B. GSTIN must be 15 characters.');
      }

      if (gstr3bData.gstPayable.total < 0) {
        warnings.push(
          'Net GST is refundable. Ensure you have proper documentation for refund claim.'
        );
      }

      if (gstr3bData.interestLatePayment.total > 0) {
        warnings.push('Late payment interest has been calculated. Ensure timely filing.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Run validation
      const result = validateReturns();
      setValidationResult(result);
      if (!result.isValid) {
        return; // Don't proceed if validation fails
      }
    }

    if (activeStep === steps.length - 2) {
      // Before final step, show confirmation dialog
      setConfirmDialogOpen(true);
      return;
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleFileReturns = async () => {
    setConfirmDialogOpen(false);
    setFilingInProgress(true);

    try {
      // Simulate filing process (in production, this would call GST API)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In a real implementation, this would:
      // 1. Call GST Portal API with credentials
      // 2. Upload JSON files
      // 3. Receive ARN (Application Reference Number)
      // 4. Store filing details in database

      setActiveStep(steps.length - 1);
    } catch (error) {
      console.error('Filing failed:', error);
    } finally {
      setFilingInProgress(false);
    }
  };

  const handleDownloadJSON = (type: 'gstr1' | 'gstr3b') => {
    if (type === 'gstr1' && gstr1Data) {
      const json = exportGSTR1ToJSON(gstr1Data);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${gstr1Data.period.month}_${gstr1Data.period.year}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (type === 'gstr3b' && gstr3bData) {
      const json = exportGSTR3BToJSON(gstr3bData);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR3B_${gstr3bData.period.month}_${gstr3bData.period.year}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const canProceed = () => {
    if (activeStep === 0) {
      return validationResult?.isValid || false;
    }
    if (activeStep === 1) {
      return true;
    }
    if (activeStep === 2) {
      return true;
    }
    return false;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        GST Filing Interface
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Follow the steps below to validate and file your GST returns
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 0: Pre-filing Validation */}
      {activeStep === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Pre-filing Validation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We'll check your returns for common issues before filing
          </Typography>

          {!validationResult ? (
            <Alert severity="info">
              Click "Next" to run validation checks on your GST returns.
            </Alert>
          ) : (
            <Box>
              {validationResult.errors.length > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Errors Found ({validationResult.errors.length})
                  </Typography>
                  <List dense>
                    {validationResult.errors.map((error, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <ErrorIcon color="error" />
                        </ListItemIcon>
                        <ListItemText primary={error} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}

              {validationResult.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Warnings ({validationResult.warnings.length})
                  </Typography>
                  <List dense>
                    {validationResult.warnings.map((warning, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <WarningIcon color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={warning} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}

              {validationResult.isValid && validationResult.warnings.length === 0 && (
                <Alert severity="success">
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText primary="All validation checks passed! Ready to proceed." />
                  </ListItem>
                </Alert>
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* Step 1: Review Returns */}
      {activeStep === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Review Your Returns
          </Typography>
          <Grid container spacing={2}>
            {gstr1Data && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      GSTR-1
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Period: {gstr1Data.period.month.toString().padStart(2, '0')}/
                      {gstr1Data.period.year}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        Total Invoices: {gstr1Data.total.transactionCount}
                      </Typography>
                      <Typography variant="body2">
                        Taxable Value: {formatCurrency(gstr1Data.total.taxableValue)}
                      </Typography>
                      <Typography variant="body2">
                        Total GST: {formatCurrency(gstr1Data.total.total)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {gstr3bData && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      GSTR-3B
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Period: {gstr3bData.period.month.toString().padStart(2, '0')}/
                      {gstr3bData.period.year}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        Outward Supplies: {formatCurrency(gstr3bData.outwardSupplies.total)}
                      </Typography>
                      <Typography variant="body2">
                        ITC Available: {formatCurrency(gstr3bData.netITC.total)}
                      </Typography>
                      <Typography
                        variant="body2"
                        color={gstr3bData.gstPayable.total > 0 ? 'error.main' : 'success.main'}
                      >
                        Net GST Payable: {formatCurrency(gstr3bData.gstPayable.total)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Step 2: Generate JSON Files */}
      {activeStep === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Generate JSON Files
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Download JSON files in GST portal format for offline upload
          </Typography>

          <Grid container spacing={2}>
            {gstr1Data && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      GSTR-1 JSON
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Compatible with GST portal offline tool
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownloadJSON('gstr1')}
                      sx={{ mt: 2 }}
                    >
                      Download GSTR-1 JSON
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {gstr3bData && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      GSTR-3B JSON
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Compatible with GST portal offline tool
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownloadJSON('gstr3b')}
                      sx={{ mt: 2 }}
                    >
                      Download GSTR-3B JSON
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>How to file offline:</strong>
            </Typography>
            <Typography variant="body2" component="div">
              <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Download the JSON files above</li>
                <li>Visit the GST Portal: https://www.gst.gov.in</li>
                <li>Login with your credentials</li>
                <li>Navigate to Returns → File Returns</li>
                <li>Select the relevant return type and period</li>
                <li>Upload the JSON file using the "Prepare Offline" option</li>
                <li>Review and submit the return</li>
              </ol>
            </Typography>
          </Alert>
        </Paper>
      )}

      {/* Step 3: File Returns (Placeholder for future API integration) */}
      {activeStep === 3 && (
        <Paper sx={{ p: 3 }}>
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Returns Generated Successfully!
            </Typography>
            <Typography variant="body2">
              Your GST returns have been validated and JSON files are ready for download. You can
              now file them on the GST portal.
            </Typography>
          </Alert>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Next Steps:
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Download JSON files from Step 3"
                    secondary="Use these files to upload on GST portal"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <UploadIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="File on GST Portal"
                    secondary="Visit https://www.gst.gov.in and upload the JSON files"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Make Payment (if applicable)"
                    secondary={
                      gstr3bData && gstr3bData.gstPayable.total > 0
                        ? `Pay ${formatCurrency(gstr3bData.gstPayable.total)} via GST portal`
                        : 'No payment required'
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Alert severity="info">
            <Typography variant="body2">
              <strong>Note:</strong> Automatic filing via API will be available in a future update.
              Currently, you need to manually upload the JSON files to the GST portal.
            </Typography>
          </Alert>
        </Paper>
      )}

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {activeStep > 0 && activeStep < steps.length - 1 && (
            <Button onClick={handleBack}>Back</Button>
          )}
          {activeStep < steps.length - 2 && (
            <Button variant="contained" onClick={handleNext} disabled={!canProceed()}>
              Next
            </Button>
          )}
          {activeStep === steps.length - 2 && (
            <Button variant="contained" onClick={handleNext}>
              Complete
            </Button>
          )}
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm GST Filing</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            Please review carefully. Filing incorrect returns may result in penalties.
          </Alert>

          <TextField
            fullWidth
            label="Confirm GSTIN"
            value={gstinConfirm}
            onChange={(e) => setGstinConfirm(e.target.value)}
            helperText={`Enter your GSTIN: ${gstr1Data?.gstin || gstr3bData?.gstin || ''}`}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Authorized Signatory Name"
            value={authorizedSignatory}
            onChange={(e) => setAuthorizedSignatory(e.target.value)}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={declarationAccepted}
                onChange={(e) => setDeclarationAccepted(e.target.checked)}
              />
            }
            label="I declare that the information provided is true and correct to the best of my knowledge"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleFileReturns}
            variant="contained"
            disabled={
              !declarationAccepted ||
              !authorizedSignatory ||
              gstinConfirm !== (gstr1Data?.gstin || gstr3bData?.gstin) ||
              filingInProgress
            }
          >
            {filingInProgress ? <CircularProgress size={24} /> : 'Confirm & File'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
