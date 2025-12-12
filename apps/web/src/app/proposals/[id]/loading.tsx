import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading state for Proposal detail page
 */
export default function ProposalDetailLoading() {
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
        Loading proposal...
      </Typography>
    </Box>
  );
}
