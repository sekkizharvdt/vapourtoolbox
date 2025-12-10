import { Box, Skeleton, Card, CardContent, Grid } from '@mui/material';

/**
 * Skeleton loading state for thermal calculator pages.
 * Matches the typical 2-column input/results layout of calculators.
 */
export function CalculatorSkeleton() {
  return (
    <Box>
      {/* Header */}
      <Skeleton variant="text" width={300} height={40} sx={{ mb: 1 }} />
      <Skeleton variant="text" width={500} height={24} sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />

              {/* Input fields */}
              {[1, 2, 3, 4].map((i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Skeleton variant="text" width={100} height={20} sx={{ mb: 0.5 }} />
                  <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
                </Box>
              ))}

              {/* Button */}
              <Skeleton variant="rectangular" height={42} sx={{ borderRadius: 1, mt: 2 }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />

              {/* Result items */}
              {[1, 2, 3, 4, 5].map((i) => (
                <Box key={i} sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton variant="text" width={150} height={24} />
                  <Skeleton variant="text" width={80} height={24} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default CalculatorSkeleton;
