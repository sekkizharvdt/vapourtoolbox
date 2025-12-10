import { Box, CircularProgress } from '@mui/material';

/**
 * Loading state for Unauthorized module
 */
export default function UnauthorizedLoading() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
    </Box>
  );
}
