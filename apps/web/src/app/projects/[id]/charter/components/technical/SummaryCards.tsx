'use client';

import { Grid, Card, CardContent, Typography } from '@mui/material';
import type { Project } from '@vapour/types';

interface SummaryCardsProps {
  specs: Project['technicalSpecs'];
}

export function SummaryCards({ specs }: SummaryCardsProps) {
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Tools
            </Typography>
            <Typography variant="h3">{specs?.toolsRequired?.length || 0}</Typography>
            <Typography variant="body2" color="text.secondary">
              Tools required
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Equipment
            </Typography>
            <Typography variant="h3">{specs?.equipmentRequired?.length || 0}</Typography>
            <Typography variant="body2" color="text.secondary">
              Equipment required
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Facilities
            </Typography>
            <Typography variant="h3">{specs?.facilitiesRequired?.length || 0}</Typography>
            <Typography variant="body2" color="text.secondary">
              Facilities required
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
