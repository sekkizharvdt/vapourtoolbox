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
  Layers as PlatesIcon,
  Circle as PipesIcon,
  Architecture as FittingsIcon,
  Build as FastenersIcon,
  Cake as FlangesIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { MaterialCategory } from '@vapour/types';
import { MaterialCategory as MC } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'MaterialsPage' });

interface MaterialCategoryModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  comingSoon?: boolean;
  categories?: MaterialCategory[];
}

export default function MaterialsPage() {
  const router = useRouter();
  const { db } = getFirebase();
  const [plateCounts, setPlateCounts] = useState(0);
  const [pipeCounts, setPipeCounts] = useState(0);
  const [loading, setLoading] = useState(true);

  const modules: MaterialCategoryModule[] = [
    {
      title: 'Plates',
      description:
        'Carbon Steel, Stainless Steel, Duplex, and Alloy plates with thickness variants',
      icon: <PlatesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/plates',
      comingSoon: false,
      categories: [
        MC.PLATES_CARBON_STEEL,
        MC.PLATES_STAINLESS_STEEL,
        MC.PLATES_DUPLEX_STEEL,
        MC.PLATES_ALLOY_STEEL,
      ],
    },
    {
      title: 'Pipes',
      description:
        'Carbon Steel, SS 304L, SS 316L seamless pipes with ASTM schedules (Sch 10, 40, 80)',
      icon: <PipesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/pipes',
      comingSoon: false,
      categories: [MC.PIPES_CARBON_STEEL, MC.PIPES_STAINLESS_304L, MC.PIPES_STAINLESS_316L],
    },
    {
      title: 'Fittings',
      description: 'Butt weld elbows, tees, reducers, and other pipe fittings',
      icon: <FittingsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/fittings',
      comingSoon: true,
    },
    {
      title: 'Fasteners',
      description: 'Bolts, nuts, washers, and other fasteners with grade specifications',
      icon: <FastenersIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/fasteners',
      comingSoon: true,
    },
    {
      title: 'Flanges',
      description: 'Weld neck, slip-on, blind, and other flanges by pressure rating',
      icon: <FlangesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/materials/flanges',
      comingSoon: true,
    },
  ];

  // Load material counts
  useEffect(() => {
    async function loadCounts() {
      if (!db) return;

      try {
        // Load all counts in parallel for better performance
        const plateCategories = [
          MC.PLATES_CARBON_STEEL,
          MC.PLATES_STAINLESS_STEEL,
          MC.PLATES_DUPLEX_STEEL,
          MC.PLATES_ALLOY_STEEL,
        ];

        const pipeCategories = [
          MC.PIPES_CARBON_STEEL,
          MC.PIPES_STAINLESS_304L,
          MC.PIPES_STAINLESS_316L,
        ];

        const platesQuery = query(
          collection(db, COLLECTIONS.MATERIALS),
          where('category', 'in', plateCategories),
          where('isActive', '==', true)
        );

        const pipesQuery = query(
          collection(db, COLLECTIONS.MATERIALS),
          where('category', 'in', pipeCategories),
          where('isActive', '==', true)
        );

        // Execute both queries in parallel
        const [platesSnapshot, pipesSnapshot] = await Promise.all([
          getCountFromServer(platesQuery),
          getCountFromServer(pipesQuery),
        ]);

        setPlateCounts(platesSnapshot.data().count);
        setPipeCounts(pipesSnapshot.data().count);
      } catch (error) {
        logger.error('Error loading material counts', { error });
      } finally {
        setLoading(false);
      }
    }

    loadCounts();
  }, [db]);

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Materials
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Engineering materials database with technical specifications and variants
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {modules.map((module, index) => (
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

              {/* Show count badge for active modules */}
              {!module.comingSoon && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                  }}
                >
                  {loading
                    ? '...'
                    : `${index === 0 ? plateCounts : index === 1 ? pipeCounts : 0} materials`}
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
