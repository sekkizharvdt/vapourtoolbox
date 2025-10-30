'use client';

import { useState } from 'react';
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
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { EntityRole } from '@vapour/types';
import { ContactsManager, EntityContactData } from './ContactsManager';

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

  const handleRolesChange = (event: SelectChangeEvent<EntityRole[]>) => {
    const value = event.target.value;
    setRoles(typeof value === 'string' ? [value as EntityRole] : value);
  };

  const handleCreate = async () => {
    // Validate only required fields: name and at least one contact
    if (!name.trim()) {
      setError('Entity name is required');
      return;
    }
    if (contacts.length === 0) {
      setError('At least one contact is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const entitiesRef = collection(db, COLLECTIONS.ENTITIES);

      // Generate entity code
      const timestamp = Date.now().toString().slice(-6);
      const rolePrefix = (roles[0] || 'ENT').substring(0, 3).toUpperCase();
      const code = `${rolePrefix}-${timestamp}`;

      // Get primary contact for backward compatibility fields
      const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];

      // This should never happen due to validation, but TypeScript needs the check
      if (!primaryContact) {
        setError('No primary contact found');
        setLoading(false);
        return;
      }

      // Create entity document
      const entityData: Record<string, unknown> = {
        code,
        name: name.trim(),
        legalName: legalName.trim() || name.trim(),
        roles: roles.length > 0 ? roles : [],
        // Primary contact fields for backward compatibility
        contactPerson: primaryContact.name,
        email: primaryContact.email,
        phone: primaryContact.phone,
        mobile: primaryContact.mobile || null,
        // Contacts array
        contacts: contacts.map(contact => ({
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
        status: 'active' as const,
        isActive: true,
        isDeleted: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Add optional address if provided
      if (addressLine1.trim() || city.trim() || state.trim() || postalCode.trim()) {
        entityData.billingAddress = {
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
        entityData.taxIdentifiers = {
          gstin: gstin.trim() || null,
          pan: pan.trim() || null,
        };
      }

      await addDoc(entitiesRef, entityData);

      // Reset form
      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error creating entity:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create entity. Please try again.';
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
            <ContactsManager
              contacts={contacts}
              onChange={setContacts}
              disabled={loading}
            />
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
                    label="GSTIN"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    fullWidth
                    placeholder="GST Identification Number"
                    helperText="Optional"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="PAN"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    fullWidth
                    placeholder="Permanent Account Number"
                    helperText="Optional"
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
