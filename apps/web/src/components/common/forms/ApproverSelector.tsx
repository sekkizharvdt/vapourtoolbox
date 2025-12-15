'use client';

/**
 * Approver Selector Component
 *
 * Autocomplete selector for users who can approve specific types of tasks.
 * Filters users by permission flags (APPROVE_PR, APPROVE_PO, APPROVE_TRANSACTIONS, etc.)
 * Optimized with useCallback, useMemo, and skeleton loading.
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Chip,
  Skeleton,
  Box,
  Avatar,
  Typography,
} from '@mui/material';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { PermissionFlag, hasPermission as hasTypePermission } from '@vapour/types';
import {
  PERMISSION_FLAGS,
  PERMISSION_FLAGS_2,
  hasPermission as hasConstPermission,
  hasPermission2,
} from '@vapour/constants';
import type { User } from '@vapour/types';

/**
 * Approval types that map to specific permission flags
 */
export type ApprovalType =
  | 'pr' // Purchase Requisition approval
  | 'po' // Purchase Order approval
  | 'transaction' // Financial transaction approval
  | 'estimate' // Estimate/proposal approval
  | 'document' // Document approval
  | 'leave' // Leave approval
  | 'any'; // Any approval permission

/**
 * Permission requirement with optional field specification
 */
interface PermissionRequirement {
  flag: PermissionFlag | PermissionFlag[] | number;
  field?: 'permissions' | 'permissions2';
}

/**
 * Map approval types to permission flags
 * Note: 'transaction' now uses MANAGE_ACCOUNTING from constants (simplified permission model)
 * Note: 'leave' uses APPROVE_LEAVES from permissions2 field
 */
const APPROVAL_PERMISSIONS: Record<ApprovalType, PermissionRequirement> = {
  pr: { flag: PermissionFlag.APPROVE_PR },
  po: { flag: PermissionFlag.APPROVE_PO },
  transaction: { flag: PERMISSION_FLAGS.MANAGE_ACCOUNTING },
  estimate: { flag: PermissionFlag.APPROVE_ESTIMATES },
  document: { flag: PermissionFlag.APPROVE_DOCUMENTS },
  leave: { flag: PERMISSION_FLAGS_2.APPROVE_LEAVES, field: 'permissions2' },
  any: {
    flag: [
      PermissionFlag.APPROVE_PR,
      PermissionFlag.APPROVE_PO,
      PermissionFlag.APPROVE_ESTIMATES,
      PermissionFlag.APPROVE_DOCUMENTS,
    ],
  },
};

interface ApproverSelectorProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  /** Extended callback that also receives the user's display name */
  onChangeWithName?: (userId: string | null, displayName: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  /** Type of approval - determines which permission to filter by */
  approvalType?: ApprovalType;
  /** Custom permission flag(s) to filter by (overrides approvalType) */
  customPermissions?: PermissionFlag | PermissionFlag[];
  /** Placeholder text */
  placeholder?: string;
  /** Show department in dropdown */
  showDepartment?: boolean;
  /** Exclude specific user IDs */
  excludeUserIds?: string[];
}

/**
 * Get initials from display name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Check if user has one or more of the required permissions
 * Supports both PermissionFlag (types package) and PERMISSION_FLAGS (constants package)
 * Also supports permissions2 field for extended permissions
 */
function userHasRequiredPermission(
  userPermissions: number,
  userPermissions2: number,
  requirement: PermissionRequirement
): boolean {
  const { flag, field } = requirement;
  const perms = field === 'permissions2' ? userPermissions2 : userPermissions;
  const checkFn = field === 'permissions2' ? hasPermission2 : hasConstPermission;

  if (Array.isArray(flag)) {
    return flag.some((perm) => hasTypePermission(userPermissions, perm));
  }
  return checkFn(perms, flag);
}

/**
 * Autocomplete selector for users who can approve specific types of tasks.
 * Features:
 * - Filters by approval permission type (PR, PO, Transaction, Estimate, Document)
 * - Shows user avatar, name, job title, and department
 * - Skeleton loading state for better perceived performance
 * - Real-time updates via Firestore snapshot
 */
function ApproverSelectorComponent({
  value,
  onChange,
  onChangeWithName,
  label = 'Approver',
  required = false,
  disabled = false,
  error = false,
  helperText,
  approvalType = 'any',
  customPermissions,
  placeholder = 'Select an approver...',
  showDepartment = true,
  excludeUserIds = [],
}: ApproverSelectorProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Determine which permissions to filter by
  const permissionRequirement = useMemo((): PermissionRequirement => {
    if (customPermissions) {
      return { flag: customPermissions };
    }
    return APPROVAL_PERMISSIONS[approvalType];
  }, [customPermissions, approvalType]);

  // Memoize excluded user IDs set for O(1) lookup
  const excludedSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  // Load users from Firestore
  useEffect(() => {
    const { db } = getFirebase();
    const usersRef = collection(db, COLLECTIONS.USERS);

    // Query active users only - permission filtering is done client-side
    const q = query(usersRef, where('isActive', '==', true), orderBy('displayName', 'asc'));

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersData: User[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const user: User = {
            uid: doc.id,
            email: data.email || '',
            displayName: data.displayName || data.email || 'Unknown',
            photoURL: data.photoURL,
            department: data.department,
            permissions: data.permissions || 0,
            permissions2: data.permissions2 || 0,
            allowedModules: data.allowedModules,
            jobTitle: data.jobTitle,
            phone: data.phone,
            mobile: data.mobile,
            status: data.status || 'active',
            isActive: data.isActive ?? true,
            assignedProjects: data.assignedProjects || [],
            preferences: data.preferences,
            lastLoginAt: data.lastLoginAt,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };

          // Filter by required permissions (client-side)
          if (
            userHasRequiredPermission(
              user.permissions,
              user.permissions2 || 0,
              permissionRequirement
            )
          ) {
            // Exclude specific users if needed
            if (!excludedSet.has(user.uid)) {
              usersData.push(user);
            }
          }
        });

        setUsers(usersData);
        setLoading(false);
      },
      (error) => {
        console.error('[ApproverSelector] Error fetching users:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [permissionRequirement, excludedSet]);

  // Update selected user when value changes
  useEffect(() => {
    if (value) {
      const user = users.find((u) => u.uid === value);
      setSelectedUser(user || null);
    } else {
      setSelectedUser(null);
    }
  }, [value, users]);

  // Memoize change handler
  const handleChange = useCallback(
    (_: unknown, newValue: User | null) => {
      onChange(newValue?.uid || null);
      // Also call onChangeWithName if provided
      if (onChangeWithName) {
        onChangeWithName(newValue?.uid || null, newValue?.displayName || '');
      }
    },
    [onChange, onChangeWithName]
  );

  // Memoize option label getter
  const getOptionLabel = useCallback((option: User) => option.displayName, []);

  // Memoize option equality checker
  const isOptionEqualToValue = useCallback((option: User, val: User) => option.uid === val.uid, []);

  // Show skeleton during initial load
  if (loading && users.length === 0) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }

  return (
    <Autocomplete
      value={selectedUser}
      onChange={handleChange}
      options={users}
      getOptionLabel={getOptionLabel}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        return (
          <li key={key} {...otherProps}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Avatar src={option.photoURL} alt={option.displayName} sx={{ width: 36, height: 36 }}>
                {getInitials(option.displayName)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight="medium" noWrap>
                  {option.displayName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  {option.jobTitle && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {option.jobTitle}
                    </Typography>
                  )}
                  {showDepartment && option.department && (
                    <Chip
                      label={option.department}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem' }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
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
      isOptionEqualToValue={isOptionEqualToValue}
      noOptionsText={
        loading ? 'Loading...' : `No users with ${approvalType} approval permission found`
      }
    />
  );
}

// Memoize the component
export const ApproverSelector = memo(ApproverSelectorComponent);
