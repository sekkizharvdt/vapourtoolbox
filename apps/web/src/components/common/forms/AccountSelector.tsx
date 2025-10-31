'use client';

import { useState, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Account, AccountType } from '@vapour/types';

interface AccountSelectorProps {
  value: string | null;
  onChange: (accountId: string | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  filterByType?: AccountType | AccountType[];
  excludeGroups?: boolean;
}

/**
 * Autocomplete selector for Chart of Accounts
 * Features:
 * - Searchable by code and name
 * - Shows account hierarchy
 * - Can filter by account type
 * - Can exclude group accounts
 */
export function AccountSelector({
  value,
  onChange,
  label = 'Account',
  required = false,
  disabled = false,
  error = false,
  helperText,
  filterByType,
  excludeGroups = false,
}: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Load accounts from Firestore
  useEffect(() => {
    const { db } = getFirebase();
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

    // Build query with filters
    const q = query(accountsRef, where('isActive', '==', true), orderBy('code', 'asc'));

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsData: Account[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        accountsData.push({
          id: doc.id,
          code: data.code,
          name: data.name,
          description: data.description,
          accountType: data.accountType,
          accountCategory: data.accountCategory,
          accountGroup: data.accountGroup,
          parentAccountId: data.parentAccountId,
          level: data.level,
          isGroup: data.isGroup,
          isActive: data.isActive ?? true,
          isSystemAccount: data.isSystemAccount ?? false,
          openingBalance: data.openingBalance ?? 0,
          currentBalance: data.currentBalance ?? 0,
          currency: data.currency ?? 'INR',
          isGSTAccount: data.isGSTAccount ?? false,
          gstType: data.gstType,
          gstDirection: data.gstDirection,
          isTDSAccount: data.isTDSAccount ?? false,
          tdsSection: data.tdsSection,
          isBankAccount: data.isBankAccount ?? false,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          ifscCode: data.ifscCode,
          branch: data.branch,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy || '',
          updatedAt: data.updatedAt?.toDate() || new Date(),
          updatedBy: data.updatedBy,
        } as Account);
      });

      // Apply client-side filters
      let filteredAccounts = accountsData;

      // Filter by type
      if (filterByType) {
        const types = Array.isArray(filterByType) ? filterByType : [filterByType];
        filteredAccounts = filteredAccounts.filter((acc) => types.includes(acc.accountType));
      }

      // Exclude groups
      if (excludeGroups) {
        filteredAccounts = filteredAccounts.filter((acc) => !acc.isGroup);
      }

      setAccounts(filteredAccounts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filterByType, excludeGroups]);

  // Update selected account when value changes
  useEffect(() => {
    if (value) {
      const account = accounts.find((acc) => acc.id === value);
      setSelectedAccount(account || null);
    } else {
      setSelectedAccount(null);
    }
  }, [value, accounts]);

  return (
    <Autocomplete
      value={selectedAccount}
      onChange={(_, newValue) => {
        onChange(newValue?.id || null);
      }}
      options={accounts}
      getOptionLabel={(option) => `${option.code} - ${option.name}`}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <div>
            <div>
              <strong>{option.code}</strong> - {option.name}
            </div>
            {option.accountGroup && (
              <div style={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                {option.accountGroup}
              </div>
            )}
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
