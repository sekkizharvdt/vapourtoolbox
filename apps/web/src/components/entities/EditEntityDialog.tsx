'use client';

import { useState, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity, EntityRole } from '@vapour/types';
import { ContactsManager, EntityContactData } from './ContactsManager';
import { BankDetailsManager, BankDetailsData } from './BankDetailsManager';
import { StateSelector } from '@/components/common/forms/StateSelector';
import {
  validatePAN,
  validateGSTIN,
  checkEntityDuplicates,
  formatDuplicateErrorMessage,
} from '@vapour/validation';

interface EditEntityDialogProps {
  open: boolean;
  entity: BusinessEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ENTITY_ROLES: EntityRole[] = ['VENDOR', 'CUSTOMER', 'PARTNER'];

export function EditEntityDialog({ open, entity, onClose, onSuccess }: EditEntityDialogProps) {
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

  // Pre-populate form when entity changes
  useEffect(() => {
    if (entity) {
      setName(entity.name || '');
      setLegalName(entity.legalName || '');
      setRoles(entity.roles || []);

      // Load contacts - check for new contacts array or fallback to old single contact fields
      if (entity.contacts && Array.isArray(entity.contacts) && entity.contacts.length > 0) {
        setContacts(entity.contacts as unknown as EntityContactData[]);
      } else if (entity.contactPerson && entity.email && entity.phone) {
        // Fallback: create contact from old fields for backward compatibility
        setContacts([
          {
            id: `legacy-${entity.id}`,
            name: entity.contactPerson,
            email: entity.email,
            phone: entity.phone,
            mobile: entity.mobile,
            isPrimary: true,
          },
        ]);
      } else {
        setContacts([]);
      }

      setAddressLine1(entity.billingAddress?.line1 || '');
      setAddressLine2(entity.billingAddress?.line2 || '');
      setCity(entity.billingAddress?.city || '');
      setState(entity.billingAddress?.state || '');
      setPostalCode(entity.billingAddress?.postalCode || '');
      setCountry(entity.billingAddress?.country || 'India');
      setGstin(entity.taxIdentifiers?.gstin || '');
      setPan(entity.taxIdentifiers?.pan || '');

      // Load bank details
      if (
        entity.bankDetails &&
        Array.isArray(entity.bankDetails) &&
        entity.bankDetails.length > 0
      ) {
        setBankDetails(
          entity.bankDetails.map((bd, index) => ({
            id: `bank-${index}`,
            bankName: bd.bankName,
            accountNumber: bd.accountNumber,
            accountName: bd.accountName,
            ifscCode: bd.ifscCode,
            swiftCode: bd.swiftCode,
            iban: bd.iban,
            branchName: bd.branchName,
            branchAddress: bd.branchAddress,
          }))
        );
      } else {
        setBankDetails([]);
      }

      // Load shipping address
      if (entity.shippingAddress) {
        // Check if shipping address is same as billing
        const isSame =
          entity.billingAddress?.line1 === entity.shippingAddress.line1 &&
          entity.billingAddress?.city === entity.shippingAddress.city &&
          entity.billingAddress?.state === entity.shippingAddress.state &&
          entity.billingAddress?.postalCode === entity.shippingAddress.postalCode;

        setSameAsBilling(isSame);
        if (!isSame) {
          setShippingLine1(entity.shippingAddress.line1 || '');
          setShippingLine2(entity.shippingAddress.line2 || '');
          setShippingCity(entity.shippingAddress.city || '');
          setShippingState(entity.shippingAddress.state || '');
          setShippingPostalCode(entity.shippingAddress.postalCode || '');
          setShippingCountry(entity.shippingAddress.country || 'India');
        }
      } else {
        setSameAsBilling(false);
        setShippingLine1('');
        setShippingLine2('');
        setShippingCity('');
        setShippingState('');
        setShippingPostalCode('');
        setShippingCountry('India');
      }

      // Load credit terms
      if (entity.creditTerms) {
        setCreditDays(entity.creditTerms.creditDays?.toString() || '');
        setCreditLimit(entity.creditTerms.creditLimit?.toString() || '');
      } else {
        setCreditDays('');
        setCreditLimit('');
      }
    }
  }, [entity]);

  const handleRolesChange = (event: SelectChangeEvent<EntityRole[]>) => {
    const value = event.target.value;
    setRoles(typeof value === 'string' ? [value as EntityRole] : value);
  };

  const handleUpdate = async () => {
    if (!entity?.id) return;

    // Validate only required fields: name and at least one contact
    if (!name.trim()) {
      setError('Entity name is required');
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
      // Get primary contact for validation and update
      const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

      const { db } = getFirebase();

      // Check for duplicates before updating (exclude current entity)
      const duplicateCheck = await checkEntityDuplicates(
        db,
        {
          email: primaryContact?.email,
          taxIdentifiers: {
            pan: pan.trim() || undefined,
            gstin: gstin.trim() || undefined,
          },
        },
        entity.id // Exclude current entity from duplicate check
      );

      if (duplicateCheck.hasDuplicates) {
        const errors = formatDuplicateErrorMessage(duplicateCheck.duplicates);
        setError(errors.join('. '));
        setLoading(false);
        return;
      }

      const entityRef = doc(db, COLLECTIONS.ENTITIES, entity.id);

      // This should never happen due to validation, but TypeScript needs the check
      if (!primaryContact) {
        setError('No primary contact found');
        setLoading(false);
        return;
      }

      // Create update data
      const updateData: Record<string, unknown> = {
        name: name.trim(),
        legalName: legalName.trim() || name.trim(),
        roles: roles.length > 0 ? roles : [],
        // Primary contact fields for backward compatibility
        contactPerson: primaryContact.name,
        email: primaryContact.email,
        phone: primaryContact.phone,
        mobile: primaryContact.mobile || null,
        // Contacts array
        contacts: contacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          designation: contact.designation || null,
          email: contact.email,
          phone: contact.phone,
          mobile: contact.mobile || null,
          isPrimary: contact.isPrimary,
          notes: contact.notes || null,
        })),
        primaryContactId: primaryContact.id,
        updatedAt: Timestamp.now(),
      };

      // Add optional address if provided
      if (addressLine1.trim() || city.trim() || state.trim() || postalCode.trim()) {
        updateData.billingAddress = {
          line1: addressLine1.trim() || null,
          line2: addressLine2.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          postalCode: postalCode.trim() || null,
          country: country.trim() || 'India',
        };
      }

      // Add optional tax identifiers if provided
      if (gstin.trim() || pan.trim()) {
        updateData.taxIdentifiers = {
          gstin: gstin.trim() || null,
          pan: pan.trim() || null,
        };
      }

      // Add optional bank details
      if (bankDetails.length > 0) {
        updateData.bankDetails = bankDetails.map((bd) => ({
          bankName: bd.bankName,
          accountNumber: bd.accountNumber,
          accountName: bd.accountName,
          ifscCode: bd.ifscCode || null,
          swiftCode: bd.swiftCode || null,
          iban: bd.iban || null,
          branchName: bd.branchName || null,
          branchAddress: bd.branchAddress || null,
        }));
      } else {
        updateData.bankDetails = null;
      }

      // Add optional shipping address
      if (sameAsBilling) {
        // Copy billing address to shipping
        if (addressLine1.trim() || city.trim() || state.trim() || postalCode.trim()) {
          updateData.shippingAddress = {
            line1: addressLine1.trim() || null,
            line2: addressLine2.trim() || null,
            city: city.trim() || null,
            state: state.trim() || null,
            postalCode: postalCode.trim() || null,
            country: country.trim() || 'India',
          };
        } else {
          updateData.shippingAddress = null;
        }
      } else if (
        shippingLine1.trim() ||
        shippingCity.trim() ||
        shippingState.trim() ||
        shippingPostalCode.trim()
      ) {
        updateData.shippingAddress = {
          line1: shippingLine1.trim() || null,
          line2: shippingLine2.trim() || null,
          city: shippingCity.trim() || null,
          state: shippingState.trim() || null,
          postalCode: shippingPostalCode.trim() || null,
          country: shippingCountry.trim() || 'India',
        };
      } else {
        updateData.shippingAddress = null;
      }

      // Add optional credit terms
      if (creditDays || creditLimit) {
        updateData.creditTerms = {
          creditDays: creditDays ? parseInt(creditDays, 10) : 0,
          creditLimit: creditLimit ? parseFloat(creditLimit) : null,
          currency: 'INR',
        };
      } else {
        updateData.creditTerms = null;
      }

      await updateDoc(entityRef, updateData);

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error updating entity:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update entity. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Entity</DialogTitle>
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

          {/* Credit Terms */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Credit Terms (Optional)
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
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Updating...' : 'Update Entity'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
