'use client';

import { useState, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress, Chip } from '@mui/material';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity, EntityRole } from '@vapour/types';

interface EntitySelectorProps {
  value: string | null;
  onChange: (entityId: string | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  filterByRole?: EntityRole | EntityRole[];
}

/**
 * Autocomplete selector for Business Entities (Vendors/Customers/Partners)
 * Features:
 * - Searchable by code and name
 * - Shows entity roles as chips
 * - Can filter by role (vendor/customer/partner)
 */
export function EntitySelector({
  value,
  onChange,
  label = 'Entity',
  required = false,
  disabled = false,
  error = false,
  helperText,
  filterByRole,
}: EntitySelectorProps) {
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<BusinessEntity | null>(null);

  // Load entities from Firestore
  useEffect(() => {
    const { db } = getFirebase();
    const entitiesRef = collection(db, COLLECTIONS.ENTITIES);

    // Build query
    const q = query(entitiesRef, orderBy('name', 'asc'));

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entitiesData: BusinessEntity[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        entitiesData.push({
          id: doc.id,
          code: data.code,
          name: data.name,
          nameNormalized: data.nameNormalized || data.name.toLowerCase(),
          legalName: data.legalName,
          roles: data.roles || [],
          contactPerson: data.contactPerson || '',
          email: data.email || '',
          phone: data.phone || '',
          mobile: data.mobile,
          website: data.website,
          contacts: data.contacts || [],
          billingAddress: data.billingAddress || data.address || {},
          shippingAddress: data.shippingAddress,
          taxIdentifiers: data.taxIdentifiers,
          bankDetails: data.bankDetails,
          creditTerms: data.creditTerms,
          paymentTerms: data.paymentTerms,
          industry: data.industry,
          category: data.category,
          tags: data.tags || [],
          notes: data.notes,
          status: data.status || 'ACTIVE',
          isActive: data.isActive ?? true,
          primaryContactId: data.primaryContactId,
          assignedToUserId: data.assignedToUserId,
          totalProjects: data.totalProjects,
          totalTransactions: data.totalTransactions,
          outstandingAmount: data.outstandingAmount,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy || '',
          updatedAt: data.updatedAt?.toDate() || new Date(),
          updatedBy: data.updatedBy,
          isDeleted: data.isDeleted || false,
          deletedAt: data.deletedAt?.toDate() || null,
          deletedBy: data.deletedBy || null,
        } as BusinessEntity);
      });

      // Apply client-side filters
      let filteredEntities = entitiesData;

      // Filter by role
      if (filterByRole) {
        const roles = Array.isArray(filterByRole) ? filterByRole : [filterByRole];
        filteredEntities = filteredEntities.filter((entity) =>
          entity.roles.some((role) => roles.includes(role))
        );
      }

      setEntities(filteredEntities);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filterByRole]);

  // Update selected entity when value changes
  useEffect(() => {
    if (value) {
      const entity = entities.find((ent) => ent.id === value);
      setSelectedEntity(entity || null);
    } else {
      setSelectedEntity(null);
    }
  }, [value, entities]);

  return (
    <Autocomplete
      value={selectedEntity}
      onChange={(_, newValue) => {
        onChange(newValue?.id || null);
      }}
      options={entities}
      getOptionLabel={(option) => `${option.code} - ${option.name}`}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <div style={{ width: '100%' }}>
            <div>
              <strong>{option.code}</strong> - {option.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'text.secondary', marginTop: 4 }}>
              {option.roles.map((role) => (
                <Chip
                  key={role}
                  label={role}
                  size="small"
                  sx={{ mr: 0.5, height: 20, fontSize: '0.7rem' }}
                />
              ))}
            </div>
          </div>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      loading={loading}
      disabled={disabled}
      isOptionEqualToValue={(option, value) => option.id === value.id}
    />
  );
}
