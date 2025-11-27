'use client';

/**
 * ShapeParameterInput Component
 *
 * Renders dynamic input fields for shape parameters based on the selected shape's definition.
 * Supports NUMBER, SELECT, and BOOLEAN parameter types.
 */

import { useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import type { Shape, ShapeParameter } from '@vapour/types';

interface ShapeParameterInputProps {
  shape: Shape;
  values: Record<string, number | string | boolean>;
  onChange: (values: Record<string, number | string | boolean>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export default function ShapeParameterInput({
  shape,
  values,
  onChange,
  errors = {},
  disabled = false,
}: ShapeParameterInputProps) {
  // Initialize with default values when shape changes
  useEffect(() => {
    const defaultValues: Record<string, number | string | boolean> = {};
    let hasDefaults = false;

    shape.parameters.forEach((param) => {
      if (values[param.name] === undefined && param.defaultValue !== undefined) {
        defaultValues[param.name] = param.defaultValue;
        hasDefaults = true;
      }
    });

    if (hasDefaults) {
      onChange({ ...values, ...defaultValues });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape.id]); // Only run when shape changes - intentionally excluding other deps

  const handleValueChange = useCallback(
    (paramName: string, value: number | string | boolean) => {
      onChange({ ...values, [paramName]: value });
    },
    [values, onChange]
  );

  // Sort parameters by order
  const sortedParams = [...shape.parameters].sort((a, b) => a.order - b.order);

  // Group parameters by type for better organization
  const requiredParams = sortedParams.filter((p) => p.required);
  const optionalParams = sortedParams.filter((p) => !p.required);

  const renderParameter = (param: ShapeParameter) => {
    const value = values[param.name];
    const error = errors[param.name];

    switch (param.dataType) {
      case 'NUMBER':
        return (
          <TextField
            key={param.name}
            label={param.label}
            type="number"
            value={value ?? param.defaultValue ?? ''}
            onChange={(e) => {
              const numValue = parseFloat(e.target.value);
              handleValueChange(param.name, isNaN(numValue) ? 0 : numValue);
            }}
            fullWidth
            required={param.required}
            disabled={disabled}
            error={!!error}
            helperText={error || param.helpText || param.description}
            InputProps={{
              endAdornment: param.unit ? (
                <InputAdornment position="end">{param.unit}</InputAdornment>
              ) : undefined,
            }}
            inputProps={{
              min: param.minValue,
              max: param.maxValue,
              step: 'any',
            }}
            sx={{ mb: 2 }}
          />
        );

      case 'SELECT':
        return (
          <TextField
            key={param.name}
            select
            label={param.label}
            value={value ?? param.defaultValue ?? ''}
            onChange={(e) => handleValueChange(param.name, e.target.value)}
            fullWidth
            required={param.required}
            disabled={disabled}
            error={!!error}
            helperText={error || param.helpText || param.description}
            sx={{ mb: 2 }}
          >
            {param.options?.map((option) => (
              <MenuItem key={String(option.value)} value={option.value}>
                {option.label}
                {option.description && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    ({option.description})
                  </Typography>
                )}
              </MenuItem>
            ))}
          </TextField>
        );

      case 'BOOLEAN':
        return (
          <FormControl key={param.name} fullWidth sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(value)}
                  onChange={(e) => handleValueChange(param.name, e.target.checked)}
                  disabled={disabled}
                />
              }
              label={param.label}
            />
            {(param.helpText || param.description) && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                {param.helpText || param.description}
              </Typography>
            )}
          </FormControl>
        );

      case 'TEXT':
        return (
          <TextField
            key={param.name}
            label={param.label}
            value={value ?? ''}
            onChange={(e) => handleValueChange(param.name, e.target.value)}
            fullWidth
            required={param.required}
            disabled={disabled}
            error={!!error}
            helperText={error || param.helpText || param.description}
            sx={{ mb: 2 }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Required Parameters */}
      {requiredParams.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Dimensions
          </Typography>
          {requiredParams.map(renderParameter)}
        </Box>
      )}

      {/* Optional Parameters */}
      {optionalParams.length > 0 && (
        <Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Optional Parameters
          </Typography>
          {optionalParams.map(renderParameter)}
        </Box>
      )}

      {/* Validation messages */}
      {shape.validationRules && shape.validationRules.length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            This shape has validation rules. Invalid dimensions will be highlighted.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
