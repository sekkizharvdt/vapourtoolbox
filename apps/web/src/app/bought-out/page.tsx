'use client';

import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
} from '@mui/material';
import {
  Settings as ValvesIcon,
  Loop as PumpsIcon,
  Speed as InstrumentsIcon,
  FilterAlt as StrainersIcon,
  Gradient as SeparatorsIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { MaterialCategory } from '@vapour/types';
import { MaterialCategory as MC } from '@vapour/types';

interface BoughtOutCategoryModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  comingSoon?: boolean;
  categories?: MaterialCategory[];
}

export default function BoughtOutPage() {
  const router = useRouter();

  const modules: BoughtOutCategoryModule[] = [
    {
      title: 'Valves',
      description: 'Gate, Globe, Ball, Butterfly, Check, Control, and specialty valves',
      icon: <ValvesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/bought-out/valves',
      comingSoon: true,
      categories: [MC.VALVES],
    },
    {
      title: 'Pumps',
      description: 'Centrifugal, dosing, vacuum, gear, and specialty pumps',
      icon: <PumpsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/bought-out/pumps',
      comingSoon: true,
      categories: [MC.PUMPS],
    },
    {
      title: 'Instruments',
      description: 'Pressure, temperature, flow, level, and conductivity measurement devices',
      icon: <InstrumentsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/bought-out/instruments',
      comingSoon: true,
      categories: [MC.INSTRUMENTATION],
    },
    {
      title: 'Strainers & Filters',
      description: 'Y-type, basket, duplex strainers and filtration equipment',
      icon: <StrainersIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/bought-out/strainers',
      comingSoon: true,
      categories: [MC.STRAINERS],
    },
    {
      title: 'Separators',
      description: 'Demisters, grommets, and separation equipment',
      icon: <SeparatorsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/bought-out/separators',
      comingSoon: true,
      categories: [MC.SEPARATORS],
    },
  ];

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Bought-Out Items
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Procurement-ready equipment and components database with technical specifications
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {modules.map((module) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={module.path}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                ...(module.comingSoon && {
                  opacity: 0.7,
                  backgroundColor: 'action.hover',
                }),
              }}
            >
              {module.comingSoon && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'warning.main',
                    color: 'warning.contrastText',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                  }}
                >
                  Coming Soon
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ mb: 2 }}>{module.icon}</Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {module.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {module.description}
                </Typography>
              </CardContent>

              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => router.push(module.path)}
                  disabled={module.comingSoon}
                >
                  {module.comingSoon ? 'Coming Soon' : 'Open Module'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
