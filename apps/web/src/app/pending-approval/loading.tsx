import { Box, CircularProgress } from '@mui/material';

/**
 * Loading state for Pending Approval module
 */
export default function PendingApprovalLoading() {
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
