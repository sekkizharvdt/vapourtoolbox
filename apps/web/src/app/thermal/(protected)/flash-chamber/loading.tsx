import { Box, Skeleton, Card, CardContent, Grid, Stepper, Step, StepLabel } from '@mui/material';

/**
 * Loading skeleton for Flash Chamber Calculator
 * Matches the multi-step wizard layout
 */
export default function FlashChamberLoading() {
  return (
    <Box>
      {/* Header */}
      <Skeleton variant="text" width={350} height={40} sx={{ mb: 1 }} />
      <Skeleton variant="text" width={450} height={24} sx={{ mb: 3 }} />

      {/* Stepper */}
      <Stepper activeStep={0} sx={{ mb: 4 }}>
        {['Input', 'Results', 'Chamber Sizing', 'Export'].map((label) => (
          <Step key={label}>
            <StepLabel>
              <Skeleton variant="text" width={80} />
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={200} height={32} sx={{ mb: 3 }} />

              {/* Form fields */}
              <Grid container spacing={2}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={i}>
                    <Skeleton variant="text" width={120} height={20} sx={{ mb: 0.5 }} />
                    <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 1 }} />
                  </Grid>
                ))}
              </Grid>

              {/* Buttons */}
              <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
                <Skeleton variant="rectangular" width={100} height={42} sx={{ borderRadius: 1 }} />
                <Skeleton variant="rectangular" width={120} height={42} sx={{ borderRadius: 1 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Side panel */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width={150} height={28} sx={{ mb: 2 }} />
              {[1, 2, 3, 4].map((i) => (
                <Box key={i} sx={{ mb: 1.5, display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton variant="text" width={100} />
                  <Skeleton variant="text" width={60} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
