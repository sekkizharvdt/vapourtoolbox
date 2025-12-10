import { Box, CircularProgress } from '@mui/material';

/**
 * Loading state for Login module
 */
export default function LoginLoading() {
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
