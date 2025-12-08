'use client';

/**
 * State Selector Component
 *
 * Autocomplete selector for Indian states and union territories
 * Includes "International" option for foreign entities (no GST)
 */

import { useCallback, memo } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { STATE_OPTIONS, type StateOption } from '@vapour/constants';

interface StateSelectorProps {
  value: string;
  onChange: (state: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  size?: 'small' | 'medium';
}

/**
 * Autocomplete selector for Indian states
 * Features:
 * - All 36 Indian states and union territories
 * - "International" option for foreign entities (sets state to empty string)
 * - Searchable by state name
 */
function StateSelectorComponent({
  value,
  onChange,
  label = 'State',
  required = false,
  disabled = false,
  error = false,
  helperText,
  size = 'medium',
}: StateSelectorProps) {
  // Find the current selected option based on value
  const selectedOption =
    STATE_OPTIONS.find((opt) => opt.name === value) ||
    (value === '' ? STATE_OPTIONS.find((opt) => opt.name === 'International') : null);

  // Handle change
  const handleChange = useCallback(
    (_: unknown, newValue: StateOption | null) => {
      // Store the state name (or empty string for International)
      onChange(newValue?.name === 'International' ? '' : newValue?.name || '');
    },
    [onChange]
  );

  // Get option label
  const getOptionLabel = useCallback((option: StateOption) => option.name, []);

  // Check option equality
  const isOptionEqualToValue = useCallback(
    (option: StateOption, val: StateOption) => option.name === val.name,
    []
  );

  return (
    <Autocomplete
      value={selectedOption}
      onChange={handleChange}
      options={STATE_OPTIONS}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      disabled={disabled}
      size={size}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.name}>
          <span style={{ fontWeight: option.name === 'International' ? 600 : 400 }}>
            {option.name}
          </span>
          {option.code && (
            <span style={{ marginLeft: 8, color: '#666', fontSize: '0.85rem' }}>
              ({option.code})
            </span>
          )}
        </li>
      )}
    />
  );
}

// Memoize the component
export const StateSelector = memo(StateSelectorComponent);
