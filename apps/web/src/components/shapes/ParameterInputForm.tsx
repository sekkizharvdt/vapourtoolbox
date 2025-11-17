'use client';

import { useState, useEffect } from 'react';
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Typography,
  Box,
  Tooltip,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

interface ParameterInputFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shape: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  material: any;
  onParameterChange: (values: Record<string, number>) => void;
  onQuantityChange: (quantity: number) => void;
}

export default function ParameterInputForm({
  shape,
  material,
  onParameterChange,
  onQuantityChange,
}: ParameterInputFormProps) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);

  // Initialize with default values
  useEffect(() => {
    const initialValues: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (shape.parameters as Array<any>)?.forEach((param) => {
      if (param.defaultValue !== undefined) {
        initialValues[param.name] = param.defaultValue;
      }
    });
    setValues(initialValues);
    onParameterChange(initialValues);
  }, [shape]);

  const handleValueChange = (name: string, value: number) => {
    const newValues = { ...values, [name]: value };
    setValues(newValues);
    onParameterChange(newValues);
  };

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
    onQuantityChange(newQuantity);
  };

  // Sort parameters by order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedParams = [...(shape.parameters || [])].sort((a: any, b: any) => a.order - b.order);

  return (
    <Box>
      {/* Quantity Input */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
            fullWidth
            inputProps={{ min: 1, max: 10000 }}
            helperText="Number of items to calculate"
          />
        </Grid>
      </Grid>

      {/* Parameter Inputs */}
      <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
        Shape Parameters
      </Typography>

      <Grid container spacing={2}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {sortedParams.map((param: any) => {
          if (param.dataType === 'SELECT') {
            return (
              <Grid size={{ xs: 12, sm: 6 }} key={param.name}>
                <FormControl fullWidth required={param.required}>
                  <InputLabel>{param.label}</InputLabel>
                  <Select
                    value={values[param.name] || param.defaultValue || ''}
                    onChange={(e) => handleValueChange(param.name, e.target.value as number)}
                    label={param.label}
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(param.options as Array<any>)?.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                        {option.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            - {option.description}
                          </Typography>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                  {param.helpText && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      {param.helpText}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
            );
          }

          if (param.dataType === 'BOOLEAN') {
            return (
              <Grid size={{ xs: 12, sm: 6 }} key={param.name}>
                <FormControl fullWidth>
                  <InputLabel>{param.label}</InputLabel>
                  <Select
                    value={values[param.name] ?? param.defaultValue ?? 0}
                    onChange={(e) => handleValueChange(param.name, e.target.value as number)}
                    label={param.label}
                  >
                    <MenuItem value={0}>No</MenuItem>
                    <MenuItem value={1}>Yes</MenuItem>
                  </Select>
                  {param.helpText && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      {param.helpText}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
            );
          }

          // NUMBER input (default)
          return (
            <Grid size={{ xs: 12, sm: 6 }} key={param.name}>
              <TextField
                label={param.label}
                type="number"
                value={values[param.name] ?? param.defaultValue ?? ''}
                onChange={(e) => handleValueChange(param.name, parseFloat(e.target.value) || 0)}
                fullWidth
                required={param.required}
                inputProps={{
                  min: param.minValue,
                  max: param.maxValue,
                  step: 'any',
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {param.unit}
                      {param.description && (
                        <Tooltip title={param.description}>
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ),
                }}
                helperText={
                  param.helpText ||
                  (param.minValue !== undefined && param.maxValue !== undefined
                    ? `Range: ${param.minValue} - ${param.maxValue} ${param.unit}`
                    : undefined)
                }
              />
            </Grid>
          );
        })}
      </Grid>

      {/* Material Info Display */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Selected Material
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Name:
            </Typography>
            <Typography variant="body2">{material.name}</Typography>
          </Grid>
          {material.physicalProperties?.density && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Density:
              </Typography>
              <Typography variant="body2">{material.physicalProperties.density} kg/m³</Typography>
            </Grid>
          )}
          {material.pricingDetails?.basePrice && (
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Price:
              </Typography>
              <Typography variant="body2">
                ₹{material.pricingDetails.basePrice.toFixed(2)}/kg
              </Typography>
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
}
