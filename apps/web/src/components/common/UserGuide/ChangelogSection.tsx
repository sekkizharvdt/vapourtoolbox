'use client';

/**
 * Changelog Section
 *
 * Lists recent updates and version history. Data lives in
 * @vapour/constants/changelog — see that file to add a new release.
 */

import { Box, Typography, Chip, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import BuildIcon from '@mui/icons-material/Build';
import BugReportIcon from '@mui/icons-material/BugReport';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { APP_META, CHANGELOG, type ChangeType } from '@vapour/constants';

function ChangeIcon({ type }: { type: ChangeType }) {
  switch (type) {
    case 'feature':
      return <AddCircleIcon fontSize="small" color="success" />;
    case 'improvement':
      return <BuildIcon fontSize="small" color="info" />;
    case 'fix':
      return <BugReportIcon fontSize="small" color="warning" />;
    case 'removed':
      return <RemoveCircleIcon fontSize="small" color="error" />;
  }
}

function ChangeTypeChip({ type }: { type: ChangeType }) {
  const colors = {
    feature: 'success' as const,
    improvement: 'info' as const,
    fix: 'warning' as const,
    removed: 'error' as const,
  };
  const labels = {
    feature: 'New',
    improvement: 'Improved',
    fix: 'Fixed',
    removed: 'Removed',
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

      {CHANGELOG.map((entry) => (
        <Box key={entry.version} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6">v{entry.version}</Typography>
            <Chip label={entry.date} size="small" variant="outlined" />
            {entry.version === APP_META.VERSION && (
              <Chip label="Current" size="small" color="primary" />
            )}
          </Box>
          {entry.title && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
              {entry.title}
            </Typography>
          )}

          <List dense>
            {entry.changes.map((change, index) => (
              <ListItem key={index}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ChangeIcon type={change.type} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
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
