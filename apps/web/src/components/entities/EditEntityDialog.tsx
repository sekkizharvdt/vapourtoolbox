'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  CircularProgress,
  Typography,
  Divider,
} from '@mui/material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity, EntityRole } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  logAuditEvent,
  createAuditContext,
  createFieldChanges,
} from '@/lib/audit/clientAuditService';
import { ContactsManager, EntityContactData } from './ContactsManager';
import { BankDetailsManager, BankDetailsData } from './BankDetailsManager';
import {
  validatePAN,
  validateGSTIN,
  checkEntityDuplicates,
  formatDuplicateErrorMessage,
} from '@vapour/validation';
import {
  BasicInfoSection,
  AddressTaxSection,
  ShippingAddressSection,
  CreditTermsSection,
} from './edit-entity';

interface EditEntityDialogProps {
  open: boolean;
  entity: BusinessEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditEntityDialog({ open, entity, onClose, onSuccess }: EditEntityDialogProps) {
  const { user } = useAuth();
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

      // Load opening balance
      setOpeningBalance(entity.openingBalance?.toString() || '');
      setOpeningBalanceType(entity.openingBalanceType || 'CR');
    }
  }, [entity]);

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

      // Add opening balance
      if (openingBalance && parseFloat(openingBalance) > 0) {
        updateData.openingBalance = parseFloat(openingBalance);
        updateData.openingBalanceType = openingBalanceType;
      } else {
        updateData.openingBalance = null;
        updateData.openingBalanceType = null;
      }

      await updateDoc(entityRef, updateData);

      // Log audit event for entity update
      if (user) {
        const auditContext = createAuditContext(
          user.uid,
          user.email || '',
          user.displayName || user.email || ''
        );

        // Track field changes for audit trail
        const changes = createFieldChanges(
          {
            name: entity.name,
            legalName: entity.legalName,
            roles: entity.roles,
            contactPerson: entity.contactPerson,
            email: entity.email,
            gstin: entity.taxIdentifiers?.gstin,
            pan: entity.taxIdentifiers?.pan,
          },
          {
            name: name.trim(),
            legalName: legalName.trim() || name.trim(),
            roles,
            contactPerson: primaryContact.name,
            email: primaryContact.email,
            gstin: gstin.trim() || null,
            pan: pan.trim() || null,
          }
        );

        await logAuditEvent(
          db,
          auditContext,
          'ENTITY_UPDATED',
          'ENTITY',
          entity.id,
          `Updated entity "${name.trim()}"`,
          {
            entityName: name.trim(),
            changes,
            metadata: {
              previousName: entity.name,
              roles,
            },
          }
        );
      }

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
          <BasicInfoSection
            name={name}
            setName={setName}
            legalName={legalName}
            setLegalName={setLegalName}
            roles={roles}
            onRolesChange={setRoles}
          />

          {/* Contact Details */}
          <Box>
            <ContactsManager contacts={contacts} onChange={setContacts} disabled={loading} />
          </Box>

          {/* Address & Tax Information */}
          <AddressTaxSection
            addressLine1={addressLine1}
            setAddressLine1={setAddressLine1}
            addressLine2={addressLine2}
            setAddressLine2={setAddressLine2}
            city={city}
            setCity={setCity}
            state={state}
            setState={setState}
            postalCode={postalCode}
            setPostalCode={setPostalCode}
            country={country}
            setCountry={setCountry}
            pan={pan}
            setPan={setPan}
            gstin={gstin}
            setGstin={setGstin}
            panValidation={panValidation}
            gstinValidation={gstinValidation}
            disabled={loading}
          />

          {/* Shipping Address */}
          <ShippingAddressSection
            sameAsBilling={sameAsBilling}
            setSameAsBilling={setSameAsBilling}
            shippingLine1={shippingLine1}
            setShippingLine1={setShippingLine1}
            shippingLine2={shippingLine2}
            setShippingLine2={setShippingLine2}
            shippingCity={shippingCity}
            setShippingCity={setShippingCity}
            shippingState={shippingState}
            setShippingState={setShippingState}
            shippingPostalCode={shippingPostalCode}
            setShippingPostalCode={setShippingPostalCode}
            shippingCountry={shippingCountry}
            setShippingCountry={setShippingCountry}
            disabled={loading}
          />

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
          <CreditTermsSection
            creditDays={creditDays}
            setCreditDays={setCreditDays}
            creditLimit={creditLimit}
            setCreditLimit={setCreditLimit}
            openingBalance={openingBalance}
            setOpeningBalance={setOpeningBalance}
            openingBalanceType={openingBalanceType}
            setOpeningBalanceType={setOpeningBalanceType}
            disabled={loading}
          />
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
