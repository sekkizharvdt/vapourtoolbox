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
    version: '1.5.0',
    date: '2026-02-16',
    changes: [
      { type: 'feature', description: 'AI Help assistant powered by Claude for in-app guidance' },
      { type: 'feature', description: 'TDS rate categories with manual override on vendor bills' },
      { type: 'feature', description: 'Journal Entry balances included in Entity Ledger totals' },
      { type: 'feature', description: 'Payment batch categories (Salary, Taxes, Projects, etc.)' },
      {
        type: 'feature',
        description: 'Email notifications for 17+ business events via Nodemailer',
      },
      { type: 'feature', description: 'Manual backup trigger and backup history in Admin' },
      { type: 'feature', description: 'Entity opening balance linked to Entity Ledger' },
      {
        type: 'improvement',
        description: 'Command palette updated with HR, Accounting, and Flow actions',
      },
      {
        type: 'improvement',
        description: 'Data health tools for auditing GL entries and account mappings',
      },
      {
        type: 'fix',
        description: 'Forex aggregation uses base amount (INR) across accounting pages',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-02-01',
    changes: [
      {
        type: 'feature',
        description: 'Comprehensive security audit with 50+ fixes across all modules',
      },
      { type: 'feature', description: 'Audit logging for sensitive operations' },
      { type: 'feature', description: 'State machine enforcement for all status transitions' },
      { type: 'improvement', description: 'Authorization checks and self-approval prevention' },
      { type: 'improvement', description: 'Multi-tenancy entityId filtering on all queries' },
      { type: 'fix', description: 'PO PDF generation crash on legacy commercial terms' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-01-20',
    changes: [
      {
        type: 'feature',
        description: 'Flow module redesign: My Tasks, Inbox, Team Board, Meeting Minutes',
      },
      {
        type: 'feature',
        description: 'Meeting Minutes with two-step creation and batch finalization',
      },
      { type: 'feature', description: 'PO PDF generation and document parse improvements' },
      { type: 'feature', description: 'GRN Send to Accounting workflow' },
      { type: 'improvement', description: 'Redesigned task cards for direct action navigation' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-01-10',
    changes: [
      { type: 'feature', description: 'On-Duty requests with comp-off leave accrual' },
      { type: 'feature', description: 'Holiday working overrides for admins' },
      { type: 'feature', description: 'Contextual help system on page headers' },
      { type: 'improvement', description: 'Redesigned permissions UI with accordion layout' },
      { type: 'improvement', description: 'HR module opened to all users' },
    ],
  },
  {
    version: '1.1.0',
    date: '2025-12-30',
    changes: [
      {
        type: 'feature',
        description: 'Leave module redesign with 2-step approval and admin controls',
      },
      { type: 'feature', description: 'Enquiry contact person dropdown with auto-fill' },
      { type: 'feature', description: 'Employee Directory with team details' },
      { type: 'feature', description: 'Holiday Management with calendar' },
      { type: 'improvement', description: 'Standardized date format (dd/MM/yyyy) across the app' },
      { type: 'fix', description: 'Enquiries page infinite loading spinner' },
    ],
  },
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
