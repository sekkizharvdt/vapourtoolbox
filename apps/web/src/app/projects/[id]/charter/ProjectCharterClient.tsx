'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Chip,
} from '@mui/material';
import {
  Home as HomeIcon,
  Description as DescriptionIcon,
  Engineering as EngineeringIcon,
  Business as BusinessIcon,
  ShoppingCart as ShoppingCartIcon,
  Folder as FolderIcon,
  AccountBalance as AccountBalanceIcon,
  Timeline as TimelineIcon,
  Group as GroupIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProjects } from '@vapour/constants';

// Tab Components (will be implemented)
import { OverviewTab } from './components/OverviewTab';
import { CharterTab } from './components/CharterTab';
import { TechnicalTab } from './components/TechnicalTab';
import { VendorsTab } from './components/VendorsTab';
import { ProcurementTab } from './components/ProcurementTab';
import { DocumentsTab } from './components/DocumentsTab';
import { BudgetTab } from './components/BudgetTab';
import { TimelineTab } from './components/TimelineTab';
import { TeamTab } from './components/TeamTab';
import { ReportsTab } from './components/ReportsTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProjectCharterPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { claims } = useAuth();

  // Extract project ID from URL pathname
  // For static export with dynamic routes, params.id might initially be 'placeholder'
  // from pre-generated HTML, so we parse the actual ID from the pathname
  const projectId = useMemo(() => {
    const paramsId = params.id as string;

    // If params has a real ID (not placeholder), use it
    if (paramsId && paramsId !== 'placeholder') {
      return paramsId;
    }

    // Otherwise, extract from pathname
    const match = pathname?.match(/\/projects\/([^/]+)\/charter/);
    const extractedId = match?.[1] || paramsId;
    return extractedId;
  }, [params.id, pathname]);

  const [activeTab, setActiveTab] = useState(0);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewProjects(claims.permissions) : false;

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
        console.error('[ProjectCharter] Error loading project:', err);
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, hasViewAccess]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
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
            href="/projects"
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
            {project.code} • {project.client.entityName}
          </Typography>
          {project.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {project.description}
            </Typography>
          )}
        </Box>

        {/* Tab Navigation */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 64,
              },
            }}
          >
            <Tab icon={<HomeIcon />} label="Overview" iconPosition="start" />
            <Tab icon={<DescriptionIcon />} label="Charter" iconPosition="start" />
            <Tab icon={<EngineeringIcon />} label="Technical" iconPosition="start" />
            <Tab icon={<BusinessIcon />} label="Vendors" iconPosition="start" />
            <Tab icon={<ShoppingCartIcon />} label="Procurement" iconPosition="start" />
            <Tab icon={<FolderIcon />} label="Documents" iconPosition="start" />
            <Tab icon={<AccountBalanceIcon />} label="Budget" iconPosition="start" />
            <Tab icon={<TimelineIcon />} label="Timeline" iconPosition="start" />
            <Tab icon={<GroupIcon />} label="Team" iconPosition="start" />
            <Tab icon={<AssessmentIcon />} label="Reports" iconPosition="start" />
          </Tabs>
        </Paper>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <OverviewTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <CharterTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          <TechnicalTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          <VendorsTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={4}>
          <ProcurementTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={5}>
          <DocumentsTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={6}>
          <BudgetTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={7}>
          <TimelineTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={8}>
          <TeamTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={9}>
          <ReportsTab project={project} />
        </TabPanel>
      </Box>
    </Container>
  );
}
