import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading state for Bought Out item detail page
 */
export default function BoughtOutDetailLoading() {
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
        Loading bought-out item...
      </Typography>
    </Box>
  );
}
