import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading state for Material detail page
 */
export default function MaterialDetailLoading() {
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
        Loading material...
      </Typography>
    </Box>
  );
}
