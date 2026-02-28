import { Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import FlashChamberClient from './FlashChamberClient';

function LoadingFallback() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">Loading Flash Chamber Calculator...</Typography>
    </Box>
  );
}

export default function FlashChamberPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FlashChamberClient />
    </Suspense>
  );
}
