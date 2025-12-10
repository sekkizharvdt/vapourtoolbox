import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading state for Documents module
 */
export default function DocumentsLoading() {
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
        Loading documents...
      </Typography>
    </Box>
  );
}
