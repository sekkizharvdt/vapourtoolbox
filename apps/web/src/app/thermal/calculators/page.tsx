'use client';

/**
 * Thermal Calculators Hub Page
 *
 * Directory of thermal calculation building blocks.
 */

import {
  Container,
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
  LocalFireDepartment as SteamIcon,
  Water as WaterIcon,
  LinearScale as PipeIcon,
  TrendingDown as PressureDropIcon,
  Speed as NPSHIcon,
  Whatshot as HeatIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import Link from 'next/link';

interface Calculator {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status: 'available' | 'coming_soon';
  reference?: string;
}

const calculators: Calculator[] = [
  {
    title: 'Steam Tables',
    description:
      'Lookup saturation properties by temperature or pressure. Get Psat, Tsat, enthalpy, density, and specific volume.',
    icon: <SteamIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/steam-tables',
    status: 'available',
    reference: 'IAPWS-IF97',
  },
  {
    title: 'Seawater Properties',
    description:
      'Calculate seawater thermophysical properties including density, specific heat, enthalpy, BPE, and viscosity.',
    icon: <WaterIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/seawater-properties',
    status: 'available',
    reference: 'MIT Correlations',
  },
  {
    title: 'Pipe Sizing',
    description:
      'Size pipes based on flow rate and velocity constraints, or calculate velocity for a given pipe size.',
    icon: <PipeIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/pipe-sizing',
    status: 'available',
    reference: 'ASME B36.10',
  },
  {
    title: 'Pressure Drop',
    description:
      'Calculate pressure drop in piping systems including straight pipe and fittings using Darcy-Weisbach.',
    icon: <PressureDropIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/pressure-drop',
    status: 'available',
    reference: 'Darcy-Weisbach',
  },
  {
    title: 'NPSHa Calculator',
    description:
      'Calculate Net Positive Suction Head Available for pump suction systems under various conditions.',
    icon: <NPSHIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/npsha',
    status: 'available',
    reference: 'Hydraulic Institute',
  },
  {
    title: 'Heat Duty',
    description:
      'Calculate sensible and latent heat duty for heating, cooling, evaporation, and condensation processes.',
    icon: <HeatIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/heat-duty',
    status: 'available',
    reference: 'First Law',
  },
];

export default function ThermalCalculatorsPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Thermal Calculators
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Fundamental calculation tools for thermal desalination design. These building blocks
          provide quick property lookups and engineering calculations used throughout the design
          process.
        </Typography>
      </Box>

      {/* Calculators Grid */}
      <Grid container spacing={3}>
        {calculators.map((calc) => (
          <Grid key={calc.title} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                opacity: calc.status === 'coming_soon' ? 0.7 : 1,
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  mb={2}
                >
                  <Box sx={{ color: 'primary.main' }}>{calc.icon}</Box>
                  <Stack direction="row" spacing={0.5}>
                    {calc.reference && (
                      <Chip
                        label={calc.reference}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                    {calc.status === 'coming_soon' && (
                      <Chip label="Coming Soon" size="small" color="default" />
                    )}
                  </Stack>
                </Stack>
                <Typography variant="h6" component="h2" gutterBottom>
                  {calc.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {calc.description}
                </Typography>
              </CardContent>
              <CardActions>
                {calc.status === 'available' ? (
                  <Button
                    component={Link}
                    href={calc.href}
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

      {/* Info Section */}
      <Box sx={{ mt: 6, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Reference Sources
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>IAPWS-IF97:</strong> International Association for the Properties of Water and
              Steam - Industrial Formulation 1997
            </li>
            <li>
              <strong>MIT Correlations:</strong> Sharqawy, Lienhard V, and Zubair seawater property
              correlations
            </li>
            <li>
              <strong>ASME B36.10:</strong> Welded and Seamless Wrought Steel Pipe
            </li>
            <li>
              <strong>Darcy-Weisbach:</strong> Friction factor method with Colebrook equation
            </li>
          </ul>
        </Typography>
      </Box>
    </Container>
  );
}
