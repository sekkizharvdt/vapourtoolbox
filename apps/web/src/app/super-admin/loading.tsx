import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading state for Super Admin module
 */
export default function SuperAdminLoading() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Loading super admin...
      </Typography>
    </Box>
  );
}
