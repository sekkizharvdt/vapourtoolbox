'use client';

/**
 * Project Detail Hub
 *
 * Overview dashboard + categorized navigation to project sub-modules
 * Combines project summary with card-based navigation
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  Divider,
} from '@mui/material';
import {
  Home as HomeIcon,
  Assignment as CharterIcon,
  ListAlt as ScopeIcon,
  Flag as ObjectivesIcon,
  Engineering as TechnicalIcon,
  Business as VendorsIcon,
  ShoppingCart as ProcurementIcon,
  Description as DocumentsIcon,
  AccountBalance as BudgetIcon,
  Timeline as TimelineIcon,
  Group as TeamIcon,
  Assessment as ReportsIcon,
  Folder as FilesIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProjects } from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';

interface ModuleCategory {
  title: string;
  description: string;
  modules: {
    title: string;
    path: string;
    icon: React.ReactNode;
    comingSoon?: boolean;
  }[];
}

export default function ProjectDetailPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { claims } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewProjects(claims.permissions) : false;

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/projects\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setProjectId(extractedId);
      }
    }
  }, [pathname]);

  // Load project data
  useEffect(() => {
    if (!projectId || !hasViewAccess) {
      setLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        const { db } = getFirebase();
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          setError('Project not found');
          return;
        }

        const projectData = projectSnap.data();
        setProject({
          id: projectSnap.id,
          ...projectData,
          createdAt: projectData.createdAt?.toDate?.() || new Date(),
          updatedAt: projectData.updatedAt?.toDate?.() || new Date(),
          dates: {
            ...projectData.dates,
            startDate: projectData.dates?.startDate?.toDate?.() || new Date(),
            endDate: projectData.dates?.endDate?.toDate?.(),
            actualStartDate: projectData.dates?.actualStartDate?.toDate?.(),
            actualEndDate: projectData.dates?.actualEndDate?.toDate?.(),
          },
        } as Project);
      } catch (err) {
        console.error('[ProjectDetail] Error loading project:', err);
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, hasViewAccess]);

  const formatCurrency = (amount?: number, currency = 'INR') => {
    if (amount === undefined || amount === null) return 'Not set';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PLANNING':
      case 'PROPOSAL':
        return 'primary';
      case 'ON_HOLD':
        return 'warning';
      case 'COMPLETED':
        return 'default';
      case 'CANCELLED':
      case 'ARCHIVED':
        return 'error';
      default:
        return 'default';
    }
  };

  // Module categories for navigation
  const moduleCategories: ModuleCategory[] = [
    {
      title: 'Project Initiation',
      description: 'Charter, scope, and objectives from proposal',
      modules: [
        {
          title: 'Charter',
          path: 'charter',
          icon: <CharterIcon sx={{ fontSize: 36, color: 'primary.main' }} />,
        },
        {
          title: 'Scope',
          path: 'scope',
          icon: <ScopeIcon sx={{ fontSize: 36, color: 'primary.main' }} />,
          comingSoon: true,
        },
        {
          title: 'Objectives',
          path: 'objectives',
          icon: <ObjectivesIcon sx={{ fontSize: 36, color: 'primary.main' }} />,
          comingSoon: true,
        },
      ],
    },
    {
      title: 'Project Execution',
      description: 'Technical work, vendors, procurement, and documents',
      modules: [
        {
          title: 'Technical',
          path: 'technical',
          icon: <TechnicalIcon sx={{ fontSize: 36, color: 'info.main' }} />,
          comingSoon: true,
        },
        {
          title: 'Vendors',
          path: 'vendors',
          icon: <VendorsIcon sx={{ fontSize: 36, color: 'info.main' }} />,
          comingSoon: true,
        },
        {
          title: 'Procurement',
          path: 'procurement',
          icon: <ProcurementIcon sx={{ fontSize: 36, color: 'info.main' }} />,
          comingSoon: true,
        },
        {
          title: 'Documents',
          path: 'documents',
          icon: <DocumentsIcon sx={{ fontSize: 36, color: 'info.main' }} />,
          comingSoon: true,
        },
      ],
    },
    {
      title: 'Project Tracking',
      description: 'Budget, timeline, team, and progress reports',
      modules: [
        {
          title: 'Budget',
          path: 'budget',
          icon: <BudgetIcon sx={{ fontSize: 36, color: 'success.main' }} />,
          comingSoon: true,
        },
        {
          title: 'Timeline',
          path: 'timeline',
          icon: <TimelineIcon sx={{ fontSize: 36, color: 'success.main' }} />,
          comingSoon: true,
        },
        {
          title: 'Team',
          path: 'team',
          icon: <TeamIcon sx={{ fontSize: 36, color: 'success.main' }} />,
          comingSoon: true,
        },
        {
          title: 'Reports',
          path: 'reports',
          icon: <ReportsIcon sx={{ fontSize: 36, color: 'success.main' }} />,
          comingSoon: true,
        },
      ],
    },
    {
      title: 'Files',
      description: 'Project documents and attachments',
      modules: [
        {
          title: 'Files',
          path: 'files',
          icon: <FilesIcon sx={{ fontSize: 36, color: 'primary.main' }} />,
        },
      ],
    },
  ];

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">You do not have permission to view project details.</Alert>
        </Box>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !project) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">{error || 'Project not found'}</Alert>
        </Box>
      </Container>
    );
  }

  const progress = project.progress?.percentage || 0;

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            underline="hover"
            color="inherit"
            href="/dashboard"
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Home
          </Link>
          <Link
            underline="hover"
            color="inherit"
            sx={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              router.push('/projects');
            }}
          >
            Projects
          </Link>
          <Typography color="text.primary">{project.code}</Typography>
        </Breadcrumbs>

        {/* Project Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography variant="h4" component="h1">
              {project.name}
            </Typography>
            <Chip label={project.status} color={getStatusColor(project.status)} size="small" />
            <Chip label={project.priority} color="default" size="small" />
          </Box>
          <Typography variant="body1" color="text.secondary">
            {project.code} • {project.client.entityName} • PM: {project.projectManager?.userName}
          </Typography>
        </Box>

        {/* Overview Summary Cards */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Overview Summary
        </Typography>
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {/* Progress Card */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Progress
                  </Typography>
                </Box>
                <Typography variant="h5" gutterBottom>
                  {progress}%
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </CardContent>
            </Card>
          </Grid>

          {/* Budget Card */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <MoneyIcon sx={{ mr: 1, fontSize: 20, color: 'success.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    Budget
                  </Typography>
                </Box>
                <Typography variant="h6">
                  {formatCurrency(project.budget?.estimated?.amount, project.budget?.currency)}
                </Typography>
                {project.budget?.actual && (
                  <Typography variant="body2" color="text.secondary">
                    Spent: {formatCurrency(project.budget.actual.amount, project.budget.currency)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Timeline Card */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CalendarIcon sx={{ mr: 1, fontSize: 20, color: 'info.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    Timeline
                  </Typography>
                </Box>
                <Typography variant="body2">
                  <strong>Start:</strong> {formatDate(project.dates?.startDate)}
                </Typography>
                <Typography variant="body2">
                  <strong>End:</strong> {formatDate(project.dates?.endDate)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Team Card */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <PeopleIcon sx={{ mr: 1, fontSize: 20, color: 'warning.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    Team
                  </Typography>
                </Box>
                <Typography variant="h6">{project.team?.length || 0} Members</Typography>
                <Typography variant="body2" color="text.secondary">
                  {project.vendors?.length || 0} Vendors
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Module Categories */}
        {moduleCategories.map((category) => (
          <Box key={category.title} sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              {category.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {category.description}
            </Typography>

            <Grid container spacing={2}>
              {category.modules.map((module) => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={module.path}>
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
                          top: 4,
                          right: 4,
                          bgcolor: 'warning.main',
                          color: 'warning.contrastText',
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 0.5,
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                        }}
                      >
                        Soon
                      </Box>
                    )}

                    <CardContent sx={{ flexGrow: 1, textAlign: 'center', py: 2 }}>
                      <Box sx={{ mb: 1 }}>{module.icon}</Box>
                      <Typography variant="body1" fontWeight="medium">
                        {module.title}
                      </Typography>
                    </CardContent>

                    <CardActions sx={{ justifyContent: 'center', pb: 1.5 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => router.push(`/projects/${projectId}/${module.path}`)}
                        disabled={module.comingSoon}
                      >
                        {module.comingSoon ? 'Soon' : 'Open'}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Box>
    </Container>
  );
}
