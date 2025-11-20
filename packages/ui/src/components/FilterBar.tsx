import React from 'react';
import { Paper, Box, Button } from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';

export interface FilterBarProps {
  children: React.ReactNode;
  onClear?: () => void;
}

export function FilterBar({ children, onClear }: FilterBarProps) {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
        {onClear && (
          <Button
            startIcon={<ClearIcon />}
            onClick={onClear}
            color="inherit"
            size="small"
            sx={{ ml: 'auto' }}
          >
            Clear Filters
          </Button>
        )}
      </Box>
    </Paper>
  );
}
