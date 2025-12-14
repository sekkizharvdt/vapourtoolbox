'use client';

import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  AccountBalance as AccountingIcon,
  ShoppingCart as ProcurementIcon,
  FolderOpen as ProjectsIcon,
  Engineering as EngineeringIcon,
  Description as DocumentIcon,
  Hub as IntegrationIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface ModuleCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  status: 'active' | 'coming-soon';
  integrationCount?: number;
}

export default function SuperAdminPage() {
  const router = useRouter();

  const modules: ModuleCard[] = [
    {
      title: 'Accounting Module',
      description: 'View and manage Accounting module integrations with other system modules',
      icon: <AccountingIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/super-admin/module-integrations/accounting',
      status: 'active',
      integrationCount: 18,
    },
    {
      title: 'Procurement Module',
      description: 'View and manage Procurement module integrations',
      icon: <ProcurementIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
      path: '#',
      status: 'coming-soon',
    },
    {
      title: 'Projects Module',
      description: 'View and manage Projects module integrations',
      icon: <ProjectsIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
      path: '#',
      status: 'coming-soon',
    },
    {
      title: 'Engineering Module',
      description: 'View and manage Engineering module integrations',
      icon: <EngineeringIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
      path: '#',
      status: 'coming-soon',
    },
    {
      title: 'Document Management',
      description: 'View and manage Document Management module integrations',
      icon: <DocumentIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
      path: '#',
      status: 'coming-soon',
    },
    {
      title: 'Integration Overview',
      description: 'System-wide integration monitoring and management',
      icon: <IntegrationIcon sx={{ fontSize: 48, color: 'text.secondary' }} />,
      path: '#',
      status: 'coming-soon',
    },
    {
      title: 'System Status',
      description: 'Package versions, security vulnerabilities, and update recommendations',
      icon: <SecurityIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/super-admin/system-status',
      status: 'active',
    },
  ];

  const handleNavigate = (module: ModuleCard) => {
    if (module.status === 'active') {
      router.push(module.path);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="h4">Super Admin Dashboard</Typography>
        <Typography variant="body1" color="text.secondary">
          System-wide module integration management and monitoring
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        {modules.map((module) => (
          <Grid key={module.title} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                opacity: module.status === 'coming-soon' ? 0.6 : 1,
                position: 'relative',
                '&:hover': module.status === 'active' ? { boxShadow: 3 } : {},
              }}
            >
              {module.status === 'coming-soon' && (
                <Chip
                  label="Coming Soon"
                  size="small"
                  color="default"
                  sx={{ position: 'absolute', top: 16, right: 16 }}
                />
              )}
              {module.status === 'active' && module.integrationCount && (
                <Chip
                  label={`${module.integrationCount} Integrations`}
                  size="small"
                  color="primary"
                  sx={{ position: 'absolute', top: 16, right: 16 }}
                />
              )}
              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ mb: 2 }}>{module.icon}</Box>
                <Typography variant="h6" gutterBottom>
                  {module.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {module.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  variant={module.status === 'active' ? 'contained' : 'outlined'}
                  disabled={module.status === 'coming-soon'}
                  onClick={() => handleNavigate(module)}
                >
                  {module.status === 'active' ? 'View Integrations' : 'Coming Soon'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
