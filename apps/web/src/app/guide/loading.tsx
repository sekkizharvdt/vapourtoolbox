import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading state for Guide module
 */
export default function GuideLoading() {
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
        Loading user guide...
      </Typography>
    </Box>
  );
}
