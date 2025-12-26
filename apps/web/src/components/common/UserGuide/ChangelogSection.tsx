'use client';

/**
 * Changelog Section
 *
 * Lists recent updates and version history.
 */

import { Box, Typography, Chip, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import BuildIcon from '@mui/icons-material/Build';
import BugReportIcon from '@mui/icons-material/BugReport';
import { APP_META } from '@vapour/constants';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'feature' | 'improvement' | 'fix';
    description: string;
  }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2025-12-26',
    changes: [
      { type: 'feature', description: 'Travel Expenses module with receipt upload and PDF export' },
      { type: 'feature', description: 'Leave Management with approval workflow' },
      { type: 'feature', description: 'Version information displayed in footer' },
      { type: 'improvement', description: 'Updated User Guide with comprehensive documentation' },
      { type: 'improvement', description: 'Improved code organization and consistency' },
    ],
  },
  {
    version: '0.9.0',
    date: '2025-12-15',
    changes: [
      { type: 'feature', description: 'Bank Reconciliation with auto-matching' },
      { type: 'feature', description: 'Three-Way Match for PO/GR/Invoice verification' },
      { type: 'improvement', description: 'Enhanced procurement workflow' },
      { type: 'fix', description: 'Fixed document numbering sequence issues' },
    ],
  },
  {
    version: '0.8.0',
    date: '2025-12-01',
    changes: [
      { type: 'feature', description: 'Project Charter with milestone tracking' },
      { type: 'feature', description: 'Document transmittal system' },
      { type: 'improvement', description: 'Better task notification system' },
    ],
  },
];

function ChangeIcon({ type }: { type: 'feature' | 'improvement' | 'fix' }) {
  switch (type) {
    case 'feature':
      return <AddCircleIcon fontSize="small" color="success" />;
    case 'improvement':
      return <BuildIcon fontSize="small" color="info" />;
    case 'fix':
      return <BugReportIcon fontSize="small" color="warning" />;
  }
}

function ChangeTypeChip({ type }: { type: 'feature' | 'improvement' | 'fix' }) {
  const colors = {
    feature: 'success' as const,
    improvement: 'info' as const,
    fix: 'warning' as const,
  };
  const labels = {
    feature: 'New',
    improvement: 'Improved',
    fix: 'Fixed',
  };
  return <Chip label={labels[type]} size="small" color={colors[type]} sx={{ ml: 1 }} />;
}

export function ChangelogSection() {
  return (
    <Box id="changelog">
      <Typography variant="body1" paragraph>
        Track the latest updates and improvements to Vapour Toolbox.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          p: 2,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 1,
        }}
      >
        <NewReleasesIcon />
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            Current Version: {APP_META.VERSION}
          </Typography>
          <Typography variant="body2">
            Last updated:{' '}
            {new Date(APP_META.LAST_UPDATED).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </Typography>
        </Box>
      </Box>

      {changelog.map((entry) => (
        <Box key={entry.version} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography variant="h6">v{entry.version}</Typography>
            <Chip label={entry.date} size="small" variant="outlined" />
            {entry.version === APP_META.VERSION && (
              <Chip label="Current" size="small" color="primary" />
            )}
          </Box>

          <List dense>
            {entry.changes.map((change, index) => (
              <ListItem key={index}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ChangeIcon type={change.type} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {change.description}
                      <ChangeTypeChip type={change.type} />
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  );
}
