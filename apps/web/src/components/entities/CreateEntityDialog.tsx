'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
  Grid,
  Typography,
  Divider,
  FormControlLabel,
  Checkbox,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
} from '@mui/material';
import { httpsCallable } from 'firebase/functions';
import { getFirebase } from '@/lib/firebase';
import type { EntityRole } from '@vapour/types';
import { ContactsManager, EntityContactData } from './ContactsManager';
import { BankDetailsManager, BankDetailsData } from './BankDetailsManager';
import { StateSelector } from '@/components/common/forms/StateSelector';
import {
  validatePAN,
  validateGSTIN,
  checkEntityDuplicates,
  formatDuplicateErrorMessage,
} from '@vapour/validation';

interface CreateEntityDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ENTITY_ROLES: EntityRole[] = ['VENDOR', 'CUSTOMER', 'PARTNER'];

export function CreateEntityDialog({ open, onClose, onSuccess }: CreateEntityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state - Basic Information
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [roles, setRoles] = useState<EntityRole[]>([]);

  // Form state - Contacts
  const [contacts, setContacts] = useState<EntityContactData[]>([]);

  // Form state - Bank Details
  const [bankDetails, setBankDetails] = useState<BankDetailsData[]>([]);

  // Form state - Address & Tax
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

  // Form state - Shipping Address
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [shippingLine1, setShippingLine1] = useState('');
  const [shippingLine2, setShippingLine2] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [shippingCountry, setShippingCountry] = useState('India');

  // Form state - Credit Terms
  const [creditDays, setCreditDays] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  // Form state - Opening Balance
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingBalanceType, setOpeningBalanceType] = useState<'DR' | 'CR'>('CR');

  // Validate PAN in real-time
  const panValidation = useMemo(() => {
    if (!pan || !pan.trim()) {
      return { valid: true, error: '' };
    }
    const result = validatePAN(pan.trim().toUpperCase());
    return { valid: result.valid, error: result.error || '' };
  }, [pan]);

  // Validate GSTIN in real-time
  const gstinValidation = useMemo(() => {
    if (!gstin || !gstin.trim()) {
      return { valid: true, error: '' };
    }
    const result = validateGSTIN(gstin.trim().toUpperCase(), pan.trim().toUpperCase());
    return { valid: result.valid, error: result.error || '' };
  }, [gstin, pan]);

  const handleRolesChange = (event: SelectChangeEvent<EntityRole[]>) => {
    const value = event.target.value;
    setRoles(typeof value === 'string' ? [value as EntityRole] : value);
  };

  const handleCreate = async () => {
    // Validate required fields
    if (!name.trim()) {
      setError('Entity name is required');
      return;
    }
    if (roles.length === 0) {
      setError('At least one entity role is required');
      return;
    }
    if (contacts.length === 0) {
      setError('At least one contact is required');
      return;
    }

    // Validate tax identifiers
    if (pan && !panValidation.valid) {
      setError(panValidation.error);
      return;
    }
    if (gstin && !gstinValidation.valid) {
      setError(gstinValidation.error);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get primary contact for validation and creation
      const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

      const { db, functions } = getFirebase();

      // Check for duplicates before creating
      const duplicateCheck = await checkEntityDuplicates(db, {
        email: primaryContact?.email,
        taxIdentifiers: {
          pan: pan.trim() || undefined,
          gstin: gstin.trim() || undefined,
        },
      });

      if (duplicateCheck.hasDuplicates) {
        const errors = formatDuplicateErrorMessage(duplicateCheck.duplicates);
        setError(errors.join('. '));
        setLoading(false);
        return;
      }

      const createEntityFn = httpsCallable(functions, 'createEntity');

      // Prepare entity data for Cloud Function
      const entityData = {
        name: name.trim(),
        legalName: legalName.trim() || undefined,
        displayName: undefined,
        roles,
        // Primary contact fields for backward compatibility
        contactPerson: primaryContact?.name || '',
        email: primaryContact?.email || '',
        phone: primaryContact?.phone || '',
        mobile: primaryContact?.mobile || undefined,
        // Contacts array
        contacts: contacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          designation: contact.designation || undefined,
          email: contact.email,
          phone: contact.phone,
          mobile: contact.mobile || undefined,
          isPrimary: contact.isPrimary,
          notes: contact.notes || undefined,
        })),
        primaryContactId: primaryContact?.id,
        // Optional address if provided
        billingAddress:
          addressLine1.trim() || city.trim() || state.trim() || postalCode.trim()
            ? {
                line1: addressLine1.trim() || undefined,
                line2: addressLine2.trim() || undefined,
                city: city.trim() || undefined,
                state: state.trim() || undefined,
                postalCode: postalCode.trim() || undefined,
                country: country.trim() || 'India',
              }
            : undefined,
        // Optional tax identifiers if provided
        taxIdentifiers:
          gstin.trim() || pan.trim()
            ? {
                gstin: gstin.trim() || undefined,
                pan: pan.trim() || undefined,
              }
            : undefined,
        // Optional bank details
        bankDetails:
          bankDetails.length > 0
            ? bankDetails.map((bd) => ({
                bankName: bd.bankName,
                accountNumber: bd.accountNumber,
                accountName: bd.accountName,
                ifscCode: bd.ifscCode || undefined,
                swiftCode: bd.swiftCode || undefined,
                iban: bd.iban || undefined,
                branchName: bd.branchName || undefined,
                branchAddress: bd.branchAddress || undefined,
              }))
            : undefined,
        // Optional shipping address
        shippingAddress: sameAsBilling
          ? addressLine1.trim() || city.trim() || state.trim() || postalCode.trim()
            ? {
                line1: addressLine1.trim() || undefined,
                line2: addressLine2.trim() || undefined,
                city: city.trim() || undefined,
                state: state.trim() || undefined,
                postalCode: postalCode.trim() || undefined,
                country: country.trim() || 'India',
              }
            : undefined
          : shippingLine1.trim() ||
              shippingCity.trim() ||
              shippingState.trim() ||
              shippingPostalCode.trim()
            ? {
                line1: shippingLine1.trim() || undefined,
                line2: shippingLine2.trim() || undefined,
                city: shippingCity.trim() || undefined,
                state: shippingState.trim() || undefined,
                postalCode: shippingPostalCode.trim() || undefined,
                country: shippingCountry.trim() || 'India',
              }
            : undefined,
        // Optional credit terms
        creditTerms:
          creditDays || creditLimit
            ? {
                creditDays: creditDays ? parseInt(creditDays, 10) : 0,
                creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
                currency: 'INR',
              }
            : undefined,
        // Opening balance
        openingBalance:
          openingBalance && parseFloat(openingBalance) > 0 ? parseFloat(openingBalance) : undefined,
        openingBalanceType:
          openingBalance && parseFloat(openingBalance) > 0 ? openingBalanceType : undefined,
        isActive: true,
      };

      // Call Cloud Function
      await createEntityFn(entityData);

      // Reset form
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error creating entity:', err);

      // Extract error message from Cloud Function error
      let errorMessage = 'Failed to create entity. Please try again.';
      if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setLegalName('');
    setRoles([]);
    setContacts([]);
    setBankDetails([]);
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('India');
    setGstin('');
    setPan('');
    setSameAsBilling(false);
    setShippingLine1('');
    setShippingLine2('');
    setShippingCity('');
    setShippingState('');
    setShippingPostalCode('');
    setShippingCountry('India');
    setCreditDays('');
    setCreditLimit('');
    setError('');
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Entity</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Basic Information */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Basic Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Entity Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                placeholder="e.g., ABC Industries Pvt Ltd"
              />

              <TextField
                label="Legal Name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                fullWidth
                placeholder="If different from entity name"
                helperText="Leave blank if same as entity name"
              />

              <FormControl fullWidth>
                <InputLabel>Entity Roles</InputLabel>
                <Select
                  multiple
                  value={roles}
                  onChange={handleRolesChange}
                  input={<OutlinedInput label="Entity Roles" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((role) => (
                        <Chip key={role} label={role} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {ENTITY_ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Contact Details */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Contact Persons
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <ContactsManager contacts={contacts} onChange={setContacts} disabled={loading} />
          </Box>

          {/* Address & Tax Information */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Address & Tax Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Address Line 1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                fullWidth
                placeholder="Street address (optional)"
              />

              <TextField
                label="Address Line 2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                fullWidth
                placeholder="Apartment, suite, etc. (optional)"
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    fullWidth
                    placeholder="Optional"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <StateSelector
                    label="State"
                    value={state}
                    onChange={setState}
                    disabled={loading}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Postal Code"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    fullWidth
                    placeholder="Optional"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    fullWidth
                    placeholder="Optional"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="PAN"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    fullWidth
                    placeholder="e.g., AAAAA9999A"
                    error={!!pan && !panValidation.valid}
                    helperText={
                      pan && !panValidation.valid ? panValidation.error : 'Optional - 10 characters'
                    }
                    inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="GSTIN"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    fullWidth
                    placeholder="e.g., 22AAAAA0000A1Z5"
                    error={!!gstin && !gstinValidation.valid}
                    helperText={
                      gstin && !gstinValidation.valid
                        ? gstinValidation.error
                        : 'Optional - 15 characters'
                    }
                    inputProps={{ maxLength: 15, style: { textTransform: 'uppercase' } }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>

          {/* Shipping Address */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Shipping Address (Optional)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={sameAsBilling}
                    onChange={(e) => setSameAsBilling(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="Same as billing address"
              />

              {!sameAsBilling && (
                <>
                  <TextField
                    label="Address Line 1"
                    value={shippingLine1}
                    onChange={(e) => setShippingLine1(e.target.value)}
                    fullWidth
                    placeholder="Street address (optional)"
                    disabled={loading}
                  />

                  <TextField
                    label="Address Line 2"
                    value={shippingLine2}
                    onChange={(e) => setShippingLine2(e.target.value)}
                    fullWidth
                    placeholder="Apartment, suite, etc. (optional)"
                    disabled={loading}
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="City"
                        value={shippingCity}
                        onChange={(e) => setShippingCity(e.target.value)}
                        fullWidth
                        placeholder="Optional"
                        disabled={loading}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StateSelector
                        label="State"
                        value={shippingState}
                        onChange={setShippingState}
                        disabled={loading}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Postal Code"
                        value={shippingPostalCode}
                        onChange={(e) => setShippingPostalCode(e.target.value)}
                        fullWidth
                        placeholder="Optional"
                        disabled={loading}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Country"
                        value={shippingCountry}
                        onChange={(e) => setShippingCountry(e.target.value)}
                        fullWidth
                        placeholder="Optional"
                        disabled={loading}
                      />
                    </Grid>
                  </Grid>
                </>
              )}
            </Box>
          </Box>

          {/* Bank Details */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Bank Details (Optional)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <BankDetailsManager
              bankDetails={bankDetails}
              onChange={setBankDetails}
              disabled={loading}
            />
          </Box>

          {/* Credit Terms & Opening Balance */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Credit Terms & Opening Balance (Optional)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Credit Days"
                    type="number"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    fullWidth
                    placeholder="e.g., 30"
                    helperText="Payment due days from invoice date"
                    disabled={loading}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Credit Limit (INR)"
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    fullWidth
                    placeholder="e.g., 100000"
                    helperText="Maximum outstanding amount allowed"
                    disabled={loading}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
              </Grid>

              {/* Opening Balance Section */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Opening Balance from Previous Financial Year
              </Typography>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Opening Balance (INR)"
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    fullWidth
                    placeholder="e.g., 50000"
                    helperText="Balance carried forward from previous year"
                    disabled={loading}
                    inputProps={{ min: 0 }}
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 0.5, display: 'block' }}
                    >
                      Balance Type
                    </Typography>
                    <ToggleButtonGroup
                      value={openingBalanceType}
                      exclusive
                      onChange={(_e, value) => value && setOpeningBalanceType(value)}
                      disabled={loading}
                      size="small"
                      fullWidth
                    >
                      <ToggleButton value="DR" sx={{ flex: 1 }}>
                        Debit (DR)
                      </ToggleButton>
                      <ToggleButton value="CR" sx={{ flex: 1 }}>
                        Credit (CR)
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, display: 'block' }}
                    >
                      DR = They owe us (advance given) | CR = We owe them (advance received)
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Creating...' : 'Create Entity'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
