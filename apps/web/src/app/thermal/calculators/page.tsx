'use client';

/**
 * Thermal Calculators Hub Page
 *
 * Categorised directory of thermal calculation tools for desalination plant design.
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
  Divider,
} from '@mui/material';
import {
  LocalFireDepartment as SteamIcon,
  Water as WaterIcon,
  LinearScale as PipeIcon,
  TrendingDown as PressureDropIcon,
  Speed as NPSHIcon,
  Whatshot as HeatIcon,
  Compress as CompressIcon,
  Thermostat as ThermostatIcon,
  Air as AirIcon,
  PrecisionManufacturing as MfgIcon,
  WaterDrop as WaterDropIcon,
  CallSplit as SiphonIcon,
  FilterAlt as DemisterIcon,
  Science as ScienceIcon,
  Opacity as SprayIcon,
  BubbleChart as NCGIcon,
  BlurOn as VacuumIcon,
  BarChart as GORIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import Link from 'next/link';

interface Calculator {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  status: 'available' | 'coming_soon';
  reference?: string;
}

interface CalculatorCategory {
  title: string;
  description: string;
  calculators: Calculator[];
}

const CATEGORIES: CalculatorCategory[] = [
  {
    title: 'Property Lookups',
    description: 'Thermophysical property tables for steam and seawater.',
    calculators: [
      {
        title: 'Steam Tables',
        description:
          'Lookup saturation properties by temperature or pressure. Get P_sat, T_sat, enthalpy, density, and specific volume.',
        icon: <SteamIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/steam-tables',
        status: 'available',
        reference: 'IAPWS-IF97',
      },
      {
        title: 'Seawater Properties',
        description:
          'Calculate seawater thermophysical properties — density, specific heat, enthalpy, BPE (boiling point elevation), and viscosity.',
        icon: <WaterIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/seawater-properties',
        status: 'available',
        reference: 'MIT Correlations',
      },
    ],
  },
  {
    title: 'Thermodynamic & Process',
    description: 'Vapour compression, heat exchange, and steam treatment calculations.',
    calculators: [
      {
        title: 'Thermo Vapour Compressor',
        description:
          'Calculate entrainment ratio, flows, and performance for steam ejectors using 1-D constant pressure mixing model.',
        icon: <AirIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/tvc',
        status: 'available',
        reference: 'Huang 1999',
      },
      {
        title: 'Desuperheating',
        description:
          'Calculate spray water flow required to desuperheat steam to a target temperature using energy balance.',
        icon: <WaterDropIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/desuperheating',
        status: 'available',
        reference: 'Energy Balance',
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
      {
        title: 'Mechanical Vapour Compressor',
        description:
          'Calculate shaft power, discharge conditions, and specific energy for isentropic vapor compression in MVC desalination.',
        icon: <MfgIcon sx={{ fontSize: 40 }} />,
        status: 'coming_soon',
        reference: 'Isentropic',
      },
    ],
  },
  {
    title: 'Heat Transfer',
    description: 'Coefficients and thermal resistance calculations for heat exchanger design.',
    calculators: [
      {
        title: 'Heat Transfer Coefficients',
        description:
          'Calculate tube-side, condensation, and overall heat transfer coefficients for shell-and-tube heat exchanger design.',
        icon: <ThermostatIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/heat-transfer',
        status: 'available',
        reference: 'Dittus-Boelter / Nusselt',
      },
    ],
  },
  {
    title: 'Fluid Systems',
    description: 'Pipe sizing, pressure drops, pumps, and suction system design.',
    calculators: [
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
        title: 'Pump Sizing',
        description:
          'Calculate total differential head, hydraulic power, brake power, and motor sizing for centrifugal pumps.',
        icon: <CompressIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/pump-sizing',
        status: 'available',
        reference: 'Hydraulic Institute',
      },
      {
        title: 'Suction System Designer',
        description:
          'Design pump suction systems for vacuum vessels — pipe sizing, fitting selection, friction losses, holdup volume, and NPSHa verification.',
        icon: <NPSHIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/npsha',
        status: 'available',
        reference: 'Crane TP-410',
      },
      {
        title: 'Siphon Sizing',
        description:
          'Size inter-effect siphon pipes, calculate minimum U-bend height, pressure drop, and flash vapor for thermal desalination plants.',
        icon: <SiphonIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/siphon-sizing',
        status: 'available',
        reference: 'Darcy-Weisbach',
      },
    ],
  },
  {
    title: 'Equipment Sizing',
    description: 'Sizing tools for specific equipment items in thermal desalination plants.',
    calculators: [
      {
        title: 'Demister Sizing',
        description:
          'Size demister pads and mist eliminators for flash chambers and evaporator effects using the Souders-Brown correlation.',
        icon: <DemisterIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/demister',
        status: 'available',
        reference: 'Souders-Brown / GPSA',
      },
      {
        title: 'Spray Nozzle Selection',
        description:
          'Select spray nozzles from the Spraying Systems catalogue for desuperheating and distribution applications.',
        icon: <SprayIcon sx={{ fontSize: 40 }} />,
        status: 'coming_soon',
        reference: 'Spraying Systems Co.',
      },
    ],
  },
  {
    title: 'Water Chemistry',
    description: 'Chemical treatment dosing and scale prevention calculations.',
    calculators: [
      {
        title: 'Chemical Dosing',
        description:
          'Calculate dosing rates, daily consumption, and storage tank sizing for antiscalant (Belgard EV 2050) and anti-foam (Belite M8).',
        icon: <ScienceIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/chemical-dosing',
        status: 'available',
        reference: 'Mass Balance',
      },
    ],
  },
  {
    title: 'System Performance',
    description: 'Plant-level performance metrics and vacuum system design — coming soon.',
    calculators: [
      {
        title: 'NCG Properties Calculator',
        description:
          'Calculate thermophysical properties of NCG + water-vapour mixtures — density, enthalpy, Cp, viscosity, conductivity and partial pressures. Derives NCG load from seawater flow via Weiss (1970) dissolved-gas correlations.',
        icon: <NCGIcon sx={{ fontSize: 40 }} />,
        href: '/thermal/calculators/ncg-properties',
        status: 'available',
        reference: 'Weiss 1970 / Wilke',
      },
      {
        title: 'Vacuum System Design',
        description:
          'Size liquid ring vacuum pumps (LRVP) and steam ejector trains to maintain vacuum against NCG load and leakage.',
        icon: <VacuumIcon sx={{ fontSize: 40 }} />,
        status: 'coming_soon',
        reference: 'HEI Standards',
      },
      {
        title: 'Performance Ratio / GOR',
        description:
          'Calculate Gain Output Ratio (GOR) and Performance Ratio (PR) for MED and MSF thermal desalination plants.',
        icon: <GORIcon sx={{ fontSize: 40 }} />,
        status: 'coming_soon',
        reference: 'MED / MSF',
      },
    ],
  },
];

export default function ThermalCalculatorsPage() {
  return (
    <>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Thermal Calculators
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Engineering calculation tools for thermal desalination plant design — organised by
          function.
        </Typography>
      </Box>

      {/* Categorised sections */}
      <Stack spacing={5}>
        {CATEGORIES.map((category, idx) => (
          <Box key={category.title}>
            {idx > 0 && <Divider sx={{ mb: 4 }} />}
            <Stack direction="row" alignItems="baseline" spacing={2} mb={1}>
              <Typography variant="h6" component="h2">
                {category.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {category.description}
              </Typography>
            </Stack>

            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {category.calculators.map((calc) => (
                <Grid key={calc.title} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      opacity: calc.status === 'coming_soon' ? 0.65 : 1,
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
                        <Stack
                          direction="row"
                          spacing={0.5}
                          flexWrap="wrap"
                          justifyContent="flex-end"
                        >
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
                      <Typography variant="h6" component="h3" gutterBottom>
                        {calc.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {calc.description}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      {calc.status === 'available' && calc.href ? (
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
          </Box>
        ))}
      </Stack>
    </>
  );
}
