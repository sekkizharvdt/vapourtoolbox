'use client';

/**
 * Application Footer
 *
 * Displays version number and last updated date at the bottom of the page.
 * Only shown on desktop; hidden on mobile where bottom navigation is used.
 */

import { Box, Typography, Link as MuiLink } from '@mui/material';
import NextLink from 'next/link';
import { APP_META } from '@vapour/constants';

export function AppFooter() {
  // Format the date for display
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Box
      component="footer"
      sx={{
        py: 2,
        px: 3,
        mt: 'auto',
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: { xs: 'none', md: 'block' }, // Hide on mobile (bottom nav used instead)
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {APP_META.NAME} v{APP_META.VERSION} &middot; Last updated:{' '}
          {formatDate(APP_META.LAST_UPDATED)}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <MuiLink
            component={NextLink}
            href="/guide"
            variant="caption"
            color="text.secondary"
            sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            User Guide
          </MuiLink>
          <MuiLink
            component={NextLink}
            href="/feedback"
            variant="caption"
            color="text.secondary"
            sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            Feedback
          </MuiLink>
          <Typography variant="caption" color="text.secondary">
            &copy; {new Date().getFullYear()} {APP_META.COMPANY}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
