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
} from '@mui/material';
import { httpsCallable } from 'firebase/functions';
import { getFirebase } from '@/lib/firebase';
import type { EntityRole } from '@vapour/types';
import { ContactsManager, EntityContactData } from './ContactsManager';
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

  // Form state - Address & Tax
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

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
        status: 'ACTIVE' as const,
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
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('India');
    setGstin('');
    setPan('');
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
                  <TextField
                    label="State"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    fullWidth
                    placeholder="Optional"
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
