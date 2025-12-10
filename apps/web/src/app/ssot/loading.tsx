import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading state for SSOT (Process Data) module
 */
export default function SSOTLoading() {
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
        Loading process data...
      </Typography>
    </Box>
  );
}
