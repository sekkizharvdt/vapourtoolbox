'use client';

import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  ChatBubble as ChatBubbleIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import type { FeedbackType, FeedbackStatus } from './types';
import { statusConfig } from './config';

interface FeedbackFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  typeFilter: FeedbackType | 'all';
  setTypeFilter: (value: FeedbackType | 'all') => void;
  statusFilter: FeedbackStatus | 'all';
  setStatusFilter: (value: FeedbackStatus | 'all') => void;
  filteredCount: number;
  totalCount: number;
}

export function FeedbackFilters({
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  filteredCount,
  totalCount,
}: FeedbackFiltersProps) {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
        <TextField
          size="small"
          placeholder="Search feedback..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 250 }}
        />

        <ToggleButtonGroup
          value={typeFilter}
          exclusive
          onChange={(_, value) => value && setTypeFilter(value)}
          size="small"
        >
          <ToggleButton value="all">
            <FilterIcon sx={{ mr: 0.5 }} /> All Types
          </ToggleButton>
          <ToggleButton value="bug">
            <BugReportIcon sx={{ mr: 0.5 }} /> Bugs
          </ToggleButton>
          <ToggleButton value="feature">
            <LightbulbIcon sx={{ mr: 0.5 }} /> Features
          </ToggleButton>
          <ToggleButton value="general">
            <ChatBubbleIcon sx={{ mr: 0.5 }} /> General
          </ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | 'all')}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <MenuItem key={key} value={key}>
                {config.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="body2" color="text.secondary">
          {filteredCount} of {totalCount} items
        </Typography>
      </Stack>
    </Paper>
  );
}
