'use client';

/**
 * Thermal Desalination Module Landing Page
 *
 * Overview of available thermal desalination design calculators.
 */

import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
} from '@mui/material';
import {
  Thermostat as ThermostatIcon,
  Science as ScienceIcon,
  Opacity as OpacityIcon,
  ArrowForward as ArrowForwardIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import Link from 'next/link';

interface DesignTool {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status: 'available' | 'coming_soon';
}

const designTools: DesignTool[] = [
  {
    title: 'Flash Chamber',
    description:
      'Design flash evaporation chambers with heat/mass balance, sizing calculations, nozzle sizing, and NPSHa calculation.',
    icon: <ThermostatIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/flash-chamber',
    status: 'available',
  },
  {
    title: 'Condenser',
    description:
      'Design surface condensers for vapor condensation with tube layout, heat transfer, and cooling water calculations.',
    icon: <OpacityIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/condenser',
    status: 'coming_soon',
  },
  {
    title: 'Ejector',
    description:
      'Design steam ejectors for vacuum generation with entrainment ratio and performance curve calculations.',
    icon: <ScienceIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/ejector',
    status: 'coming_soon',
  },
];

export default function ThermalLandingPage() {
  return (
    <>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Thermal Desalination Design
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Engineering design calculators for thermal desalination processes including Multi-Effect
          Distillation (MED) and Multi-Stage Flash (MSF) systems.
        </Typography>
      </Box>

      {/* Calculators Quick Access */}
      <Card sx={{ mb: 4, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <CalculateIcon sx={{ fontSize: 40 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Thermal Calculators</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Quick property lookups and engineering calculations: steam tables, seawater
                properties, pipe sizing, pressure drop, NPSHa, and heat duty.
              </Typography>
            </Box>
            <Button
              component={Link}
              href="/thermal/calculators"
              variant="contained"
              color="inherit"
              sx={{ color: 'primary.main', bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
              endIcon={<ArrowForwardIcon />}
            >
              Open Calculators
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Design Tools Section */}
      <Typography variant="h5" gutterBottom>
        Design Tools
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Complete design calculators for thermal desalination equipment.
      </Typography>

      {/* Design Tools Grid */}
      <Grid container spacing={3}>
        {designTools.map((tool) => (
          <Grid key={tool.title} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                opacity: tool.status === 'coming_soon' ? 0.7 : 1,
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  mb={2}
                >
                  <Box sx={{ color: 'primary.main' }}>{tool.icon}</Box>
                  {tool.status === 'coming_soon' && (
                    <Chip label="Coming Soon" size="small" color="default" />
                  )}
                </Stack>
                <Typography variant="h6" component="h2" gutterBottom>
                  {tool.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tool.description}
                </Typography>
              </CardContent>
              <CardActions>
                {tool.status === 'available' ? (
                  <Button
                    component={Link}
                    href={tool.href}
                    endIcon={<ArrowForwardIcon />}
                    fullWidth
                  >
                    Open Calculator
                  </Button>
                ) : (
                  <Button disabled fullWidth>
                    Coming Soon
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
