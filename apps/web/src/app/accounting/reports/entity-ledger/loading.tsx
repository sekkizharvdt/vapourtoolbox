import { Box, Skeleton, Paper, Stack } from '@mui/material';

export default function EntityLedgerLoading() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="text" width={350} height={24} />
      </Box>

      {/* Filters Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Skeleton variant="rounded" width={200} height={56} />
          <Skeleton variant="rounded" width={200} height={56} />
          <Skeleton variant="rounded" width={150} height={56} />
          <Skeleton variant="rounded" width={150} height={56} />
          <Skeleton variant="rounded" width={120} height={40} />
        </Stack>
      </Paper>

      {/* Summary Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {[1, 2, 3, 4].map((i) => (
          <Paper key={i} sx={{ p: 2, flex: 1 }}>
            <Skeleton variant="text" width={80} height={20} />
            <Skeleton variant="text" width={120} height={36} />
          </Paper>
        ))}
      </Stack>

      {/* Table */}
      <Paper sx={{ p: 2 }}>
        {/* Table Header */}
        <Stack
          direction="row"
          spacing={2}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 1 }}
        >
          <Skeleton variant="text" width={100} height={24} />
          <Skeleton variant="text" width={150} height={24} />
          <Skeleton variant="text" width={200} height={24} sx={{ flex: 1 }} />
          <Skeleton variant="text" width={100} height={24} />
          <Skeleton variant="text" width={100} height={24} />
          <Skeleton variant="text" width={100} height={24} />
        </Stack>

        {/* Table Rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Stack
            key={i}
            direction="row"
            spacing={2}
            sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Skeleton variant="text" width={100} height={20} />
            <Skeleton variant="text" width={150} height={20} />
            <Skeleton variant="text" width={200} height={20} sx={{ flex: 1 }} />
            <Skeleton variant="text" width={100} height={20} />
            <Skeleton variant="text" width={100} height={20} />
            <Skeleton variant="text" width={100} height={20} />
          </Stack>
        ))}
      </Paper>
    </Box>
  );
}
