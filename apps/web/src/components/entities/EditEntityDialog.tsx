'use client';

import { useState, useEffect } from 'react';
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
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity, EntityRole } from '@vapour/types';
import { ContactsManager, EntityContactData } from './ContactsManager';

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

  // Form state - Address & Tax
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');

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
        setContacts([{
          id: `legacy-${entity.id}`,
          name: entity.contactPerson,
          email: entity.email,
          phone: entity.phone,
          mobile: entity.mobile,
          isPrimary: true,
        }]);
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

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const entityRef = doc(db, COLLECTIONS.ENTITIES, entity.id);

      // Get primary contact for backward compatibility fields
      const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];

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

      await updateDoc(entityRef, updateData);

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error updating entity:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update entity. Please try again.';
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
