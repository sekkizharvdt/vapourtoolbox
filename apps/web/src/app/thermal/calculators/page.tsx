'use client';

/**
 * Thermal Calculators Hub Page
 *
 * Categorised directory of thermal calculation tools for desalination plant design.
 * Features: search, recently-used (localStorage), card/list view toggle.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  LocalFireDepartment as SteamIcon,
  Water as WaterIcon,
  LinearScale as PipeIcon,
  TrendingDown as PressureDropIcon,
  Speed as NPSHIcon,
  Whatshot as HeatIcon,
  Compress as CompressIcon,
  Air as AirIcon,
  PrecisionManufacturing as MfgIcon,
  WaterDrop as WaterDropIcon,
  CallSplit as SiphonIcon,
  FilterAlt as DemisterIcon,
  Science as ScienceIcon,
  Opacity as SprayIcon,
  BubbleChart as NCGIcon,
  BlurOn as VacuumIcon,
  AirlineSeatFlat as VacuumBreakerIcon,
  BarChart as GORIcon,
  Waves as FallingFilmIcon,
  Warning as ScalingIcon,
  AccountTree as MEDPlantIcon,
  ArrowForward as ArrowForwardIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  ViewModule as CardViewIcon,
  ViewList as ListViewIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Calculator {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status: 'available' | 'coming_soon';
  reference?: string;
  /** Search keywords not visible in UI but matched by the search filter */
  keywords?: string[];
}

interface CalculatorCategory {
  title: string;
  description: string;
  calculators: Calculator[];
}

// ---------------------------------------------------------------------------
// localStorage helpers for "recently used"
// ---------------------------------------------------------------------------

const RECENT_KEY = 'thermal-calculators-recent';
const MAX_RECENT = 5;

function getRecentHrefs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecentHref(href: string) {
  const current = getRecentHrefs().filter((h) => h !== href);
  current.unshift(href);
  localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, MAX_RECENT)));
}

// ---------------------------------------------------------------------------
// Flat list of all calculators (used for recently-used lookup & search index)
// ---------------------------------------------------------------------------

const ALL_CALCULATORS: Calculator[] = [
  // --- Properties & Lookups ---
  {
    title: 'Steam Tables',
    description:
      'Lookup saturation properties by temperature or pressure. Get P_sat, T_sat, enthalpy, density, and specific volume.',
    icon: <SteamIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/steam-tables',
    status: 'available',
    reference: 'IAPWS-IF97',
    keywords: ['saturation', 'pressure', 'enthalpy', 'density', 'specific volume', 'steam'],
  },
  {
    title: 'Seawater Properties',
    description:
      'Calculate seawater thermophysical properties — density, specific heat, enthalpy, BPE (boiling point elevation), and viscosity.',
    icon: <WaterIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/seawater-properties',
    status: 'available',
    reference: 'MIT Correlations',
    keywords: ['bpe', 'boiling point elevation', 'salinity', 'brine', 'viscosity', 'cp'],
  },
  {
    title: 'NCG Properties',
    description:
      'Calculate thermophysical properties of NCG + water-vapour mixtures — density, enthalpy, Cp, viscosity, conductivity and partial pressures.',
    icon: <NCGIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/ncg-properties',
    status: 'available',
    reference: 'Weiss 1970 / Wilke',
    keywords: ['non-condensable', 'gas', 'dissolved', 'oxygen', 'nitrogen', 'CO2'],
  },

  // --- Heat Exchange & Thermal ---
  {
    title: 'Heat Exchanger Calculator',
    description:
      'Unified tool — quick heat duty calc (sensible/latent/LMTD), detailed HTC analysis, and full iterative exchanger sizing in one place.',
    icon: <HeatIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/heat-exchanger',
    status: 'available',
    reference: 'TEMA / Kern / Nusselt',
    keywords: ['heat duty', 'LMTD', 'HTC', 'U value', 'shell and tube', 'area', 'sizing'],
  },
  {
    title: 'Falling Film Evaporator',
    description:
      'Design horizontal-tube falling film evaporators with wetting rate analysis, heat transfer coefficients, and tube bundle layout for MED plants.',
    icon: <FallingFilmIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/falling-film',
    status: 'available',
    reference: 'Chun-Seban 1971',
    keywords: ['wetting rate', 'tube bundle', 'MED', 'evaporator', 'horizontal tube'],
  },
  {
    title: 'Desuperheating',
    description:
      'Calculate spray water flow required to desuperheat steam to a target temperature using energy balance.',
    icon: <WaterDropIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/desuperheating',
    status: 'available',
    reference: 'Energy Balance',
    keywords: ['spray water', 'superheated steam', 'attemperator'],
  },
  {
    title: 'Fouling & Scaling Prediction',
    description:
      'Predict CaSO\u2084 and CaCO\u2083 scaling tendency at various operating temperatures. Determine maximum TBT and recommended fouling resistances.',
    icon: <ScalingIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/fouling-scaling',
    status: 'available',
    reference: 'Langelier / Ostroff',
    keywords: ['calcium sulphate', 'calcium carbonate', 'TBT', 'fouling resistance', 'scale'],
  },

  // --- Compression & Ejectors ---
  {
    title: 'Thermo Vapour Compressor',
    description:
      'Calculate entrainment ratio, flows, and performance for steam ejectors using 1-D constant pressure mixing model.',
    icon: <AirIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/tvc',
    status: 'available',
    reference: 'Huang 1999',
    keywords: ['ejector', 'entrainment ratio', 'motive steam', 'suction', 'TVC'],
  },
  {
    title: 'Mechanical Vapour Compressor',
    description:
      'Calculate shaft power, discharge conditions, and specific energy for isentropic vapor compression in MVC desalination.',
    icon: <MfgIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/mvc',
    status: 'available',
    reference: 'Isentropic',
    keywords: ['shaft power', 'compression ratio', 'MVC', 'centrifugal compressor'],
  },

  // --- Fluid Systems & Equipment ---
  {
    title: 'Pipe Sizing',
    description:
      'Size pipes based on flow rate and velocity constraints, or calculate velocity for a given pipe size.',
    icon: <PipeIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/pipe-sizing',
    status: 'available',
    reference: 'ASME B36.10',
    keywords: ['pipe schedule', 'velocity', 'diameter', 'flow rate', 'nominal bore'],
  },
  {
    title: 'Pressure Drop',
    description:
      'Calculate pressure drop in piping systems including straight pipe and fittings using Darcy-Weisbach.',
    icon: <PressureDropIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/pressure-drop',
    status: 'available',
    reference: 'Darcy-Weisbach',
    keywords: ['friction', 'fittings', 'K factor', 'Reynolds', 'Moody'],
  },
  {
    title: 'Pump Sizing',
    description:
      'Calculate total differential head, hydraulic power, brake power, and motor sizing for centrifugal pumps.',
    icon: <CompressIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/pump-sizing',
    status: 'available',
    reference: 'Hydraulic Institute',
    keywords: ['TDH', 'hydraulic power', 'brake power', 'motor', 'centrifugal pump', 'NPSH'],
  },
  {
    title: 'Suction System Designer',
    description:
      'Design pump suction systems for vacuum vessels — pipe sizing, fitting selection, friction losses, holdup volume, and NPSHa verification.',
    icon: <NPSHIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/npsha',
    status: 'available',
    reference: 'Crane TP-410',
    keywords: ['NPSH', 'suction', 'holdup', 'vacuum vessel', 'friction loss'],
  },
  {
    title: 'Siphon Sizing',
    description:
      'Size inter-effect siphon pipes, calculate minimum U-bend height, pressure drop, and flash vapor for thermal desalination plants.',
    icon: <SiphonIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/siphon-sizing',
    status: 'available',
    reference: 'Darcy-Weisbach',
    keywords: ['siphon', 'U-bend', 'inter-effect', 'flash', 'MED'],
  },
  {
    title: 'Demister Sizing',
    description:
      'Size demister pads and mist eliminators for flash chambers and evaporator effects using the Souders-Brown correlation.',
    icon: <DemisterIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/demister',
    status: 'available',
    reference: 'Souders-Brown / GPSA',
    keywords: ['mist eliminator', 'flash chamber', 'droplet', 'Souders-Brown'],
  },

  // --- Plant Design & Auxiliaries ---
  {
    title: 'Performance Ratio / GOR',
    description:
      'Estimate Gain Output Ratio, specific thermal energy, and effect-by-effect temperature profile for MED desalination plants.',
    icon: <GORIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/gor',
    status: 'available',
    reference: 'El-Dessouky 2002',
    keywords: [
      'GOR',
      'gain output ratio',
      'MED',
      'effects',
      'temperature profile',
      'specific energy',
    ],
  },
  {
    title: 'MED Plant Heat & Mass Balance',
    description:
      'Full effect-by-effect heat and mass balance for Multi-Effect Distillation plants with preheater integration, final condenser sizing, and iterative GOR convergence.',
    icon: <MEDPlantIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/med-plant',
    status: 'available',
    reference: 'El-Dessouky 2002',
    keywords: [
      'MED',
      'multi-effect distillation',
      'heat balance',
      'mass balance',
      'GOR',
      'preheater',
      'condenser',
      'desalination plant',
      'parallel feed',
    ],
  },
  {
    title: 'Vacuum System Design',
    description:
      'Size liquid ring vacuum pumps (LRVP) and steam ejector trains to maintain vacuum against NCG load and leakage.',
    icon: <VacuumIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/vacuum-system',
    status: 'available',
    reference: 'HEI Standards',
    keywords: ['LRVP', 'ejector', 'vacuum', 'NCG', 'leakage', 'hogging'],
  },
  {
    title: 'Chemical Dosing',
    description:
      'Calculate dosing rates, daily consumption, and storage tank sizing for antiscalant (Belgard EV 2050) and anti-foam (Belite M8).',
    icon: <ScienceIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/chemical-dosing',
    status: 'available',
    reference: 'Mass Balance',
    keywords: ['antiscalant', 'anti-foam', 'Belgard', 'Belite', 'dosing', 'storage tank'],
  },
  {
    title: 'Vacuum Breaker Sizing',
    description:
      'Size vacuum breaker valves for MED thermal desalination plants using compressible flow theory based on HEI surface condenser methodology.',
    icon: <VacuumBreakerIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/vacuum-breaker',
    status: 'available',
    reference: 'HEI / ISO 9300',
    keywords: [
      'vacuum breaker',
      'air admission',
      'pressure equalization',
      'MED',
      'orifice',
      'valve sizing',
    ],
  },
  {
    title: 'Spray Nozzle Selection',
    description:
      'Select spray nozzles from the Spraying Systems catalogue for desuperheating and distribution applications.',
    icon: <SprayIcon sx={{ fontSize: 40 }} />,
    href: '/thermal/calculators/spray-nozzle',
    status: 'available',
    reference: 'Spraying Systems Co.',
    keywords: ['nozzle', 'spray', 'catalogue', 'distribution', 'orifice'],
  },
];

// Build a lookup map by href for recently-used resolution
const CALC_BY_HREF = new Map(ALL_CALCULATORS.map((c) => [c.href, c]));

// ---------------------------------------------------------------------------
// Categories (reorganised)
// ---------------------------------------------------------------------------

const CATEGORIES: CalculatorCategory[] = [
  {
    title: 'Properties & Lookups',
    description: 'Thermophysical property tables — no design decisions, just data.',
    calculators: ALL_CALCULATORS.filter((c) =>
      [
        '/thermal/calculators/steam-tables',
        '/thermal/calculators/seawater-properties',
        '/thermal/calculators/ncg-properties',
      ].includes(c.href)
    ),
  },
  {
    title: 'Heat Exchange & Thermal',
    description: 'Heat transfer surfaces, thermal performance, and fouling.',
    calculators: ALL_CALCULATORS.filter((c) =>
      [
        '/thermal/calculators/heat-exchanger',
        '/thermal/calculators/falling-film',
        '/thermal/calculators/desuperheating',
        '/thermal/calculators/fouling-scaling',
      ].includes(c.href)
    ),
  },
  {
    title: 'Compression & Ejectors',
    description: 'Vapour compression and steam ejector performance.',
    calculators: ALL_CALCULATORS.filter((c) =>
      ['/thermal/calculators/tvc', '/thermal/calculators/mvc'].includes(c.href)
    ),
  },
  {
    title: 'Fluid Systems & Equipment',
    description: 'Piping, pumps, and flow-related equipment sizing.',
    calculators: ALL_CALCULATORS.filter((c) =>
      [
        '/thermal/calculators/pipe-sizing',
        '/thermal/calculators/pressure-drop',
        '/thermal/calculators/pump-sizing',
        '/thermal/calculators/npsha',
        '/thermal/calculators/siphon-sizing',
        '/thermal/calculators/demister',
      ].includes(c.href)
    ),
  },
  {
    title: 'Plant Design & Auxiliaries',
    description: 'Plant-level performance, vacuum systems, chemistry, and spray nozzles.',
    calculators: ALL_CALCULATORS.filter((c) =>
      [
        '/thermal/calculators/gor',
        '/thermal/calculators/med-plant',
        '/thermal/calculators/vacuum-system',
        '/thermal/calculators/vacuum-breaker',
        '/thermal/calculators/chemical-dosing',
        '/thermal/calculators/spray-nozzle',
      ].includes(c.href)
    ),
  },
];

// ---------------------------------------------------------------------------
// Search helper
// ---------------------------------------------------------------------------

function matchesSearch(calc: Calculator, query: string): boolean {
  const q = query.toLowerCase();
  return (
    calc.title.toLowerCase().includes(q) ||
    calc.description.toLowerCase().includes(q) ||
    (calc.reference ?? '').toLowerCase().includes(q) ||
    (calc.keywords ?? []).some((kw) => kw.toLowerCase().includes(q))
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CalculatorCard({
  calc,
  onNavigate,
}: {
  calc: Calculator;
  onNavigate: (href: string) => void;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: calc.status === 'coming_soon' ? 0.65 : 1,
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box sx={{ color: 'primary.main' }}>{calc.icon}</Box>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end">
            {calc.reference && (
              <Chip label={calc.reference} size="small" variant="outlined" color="primary" />
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
            onClick={() => onNavigate(calc.href)}
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
  );
}

function CalculatorListItem({
  calc,
  onNavigate,
}: {
  calc: Calculator;
  onNavigate: (href: string) => void;
}) {
  const router = useRouter();
  return (
    <ListItemButton
      onClick={() => {
        onNavigate(calc.href);
        router.push(calc.href);
      }}
      sx={{ borderRadius: 1, mb: 0.5 }}
    >
      <ListItemIcon sx={{ color: 'primary.main', minWidth: 44 }}>{calc.icon}</ListItemIcon>
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2">{calc.title}</Typography>
            {calc.reference && (
              <Chip
                label={calc.reference}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Stack>
        }
        secondary={calc.description}
        secondaryTypographyProps={{ noWrap: true }}
      />
      <ArrowForwardIcon fontSize="small" sx={{ color: 'text.disabled', ml: 1 }} />
    </ListItemButton>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ThermalCalculatorsPage() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);

  // Load recently used on mount
  useEffect(() => {
    setRecentHrefs(getRecentHrefs());
  }, []);

  const handleNavigate = useCallback((href: string) => {
    pushRecentHref(href);
    setRecentHrefs(getRecentHrefs());
  }, []);

  // Recently used calculators (resolved from hrefs)
  const recentCalcs = useMemo(
    () => recentHrefs.map((h) => CALC_BY_HREF.get(h)).filter(Boolean) as Calculator[],
    [recentHrefs]
  );

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      calculators: cat.calculators.filter((c) => matchesSearch(c, search)),
    })).filter((cat) => cat.calculators.length > 0);
  }, [search]);

  const totalResults = filteredCategories.reduce((sum, cat) => sum + cat.calculators.length, 0);

  return (
    <>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Thermal Calculators
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Engineering calculation tools for thermal desalination plant design — organised by
          function.
        </Typography>
      </Box>

      {/* Search & view toggle */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <TextField
          size="small"
          placeholder="Search calculators..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 360 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        {search && (
          <Typography variant="body2" color="text.secondary">
            {totalResults} result{totalResults !== 1 ? 's' : ''}
          </Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
        >
          <ToggleButton value="cards">
            <Tooltip title="Card view">
              <CardViewIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="list">
            <Tooltip title="List view">
              <ListViewIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Recently Used */}
      {!search && recentCalcs.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <HistoryIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" color="text.secondary">
              Recently Used
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {recentCalcs.map((calc) => (
              <Chip
                key={calc.href}
                label={calc.title}
                component={Link}
                href={calc.href}
                onClick={() => handleNavigate(calc.href)}
                clickable
                variant="outlined"
                size="medium"
                icon={<>{calc.icon}</>}
                sx={{
                  '& .MuiChip-icon': { fontSize: 18 },
                  '& .MuiChip-icon > .MuiSvgIcon-root': { fontSize: 18 },
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* No results */}
      {search && totalResults === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No calculators match &ldquo;{search}&rdquo;
          </Typography>
        </Paper>
      )}

      {/* Categorised sections */}
      <Stack spacing={viewMode === 'cards' ? 5 : 3}>
        {filteredCategories.map((category, idx) => (
          <Box key={category.title}>
            {idx > 0 && <Divider sx={{ mb: viewMode === 'cards' ? 4 : 2 }} />}
            <Stack direction="row" alignItems="baseline" spacing={2} mb={1}>
              <Typography variant="h6" component="h2">
                {category.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {category.description}
              </Typography>
            </Stack>

            {viewMode === 'cards' ? (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {category.calculators.map((calc) => (
                  <Grid key={calc.title} size={{ xs: 12, sm: 6, md: 4 }}>
                    <CalculatorCard calc={calc} onNavigate={handleNavigate} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <List dense disablePadding>
                {category.calculators.map((calc) => (
                  <CalculatorListItem key={calc.title} calc={calc} onNavigate={handleNavigate} />
                ))}
              </List>
            )}
          </Box>
        ))}
      </Stack>
    </>
  );
}
