'use client';

/**
 * Basic Info Section
 *
 * Form section for entity basic information (name, legal name, roles).
 */

import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Typography,
  Divider,
  SelectChangeEvent,
} from '@mui/material';
import type { EntityRole } from '@vapour/types';
import { ENTITY_ROLES, type BasicInfoSectionProps } from './types';

export function BasicInfoSection({
  name,
  setName,
  legalName,
  setLegalName,
  roles,
  onRolesChange,
}: BasicInfoSectionProps) {
  const handleRolesChange = (event: SelectChangeEvent<EntityRole[]>) => {
    const value = event.target.value;
    onRolesChange(typeof value === 'string' ? [value as EntityRole] : value);
  };

  return (
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
  );
}
