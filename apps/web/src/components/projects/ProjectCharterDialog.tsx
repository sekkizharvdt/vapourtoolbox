'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  IconButton,
  Typography,
  Chip,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Dashboard as OverviewIcon,
  Description as CharterIcon,
  ViewAgenda as ScopeIcon,
  Engineering as TechnicalIcon,
  Business as VendorsIcon,
  ShoppingCart as ProcurementIcon,
  FolderOpen as DocumentsIcon,
  AccountBalance as BudgetIcon,
  Timeline as TimelineIcon,
  People as TeamIcon,
  Assessment as ReportsIcon,
} from '@mui/icons-material';
import type { Project, ProjectStatus, ProjectPriority } from '@vapour/types';

// Import all charter tab components
import { OverviewTab } from '@/app/projects/[id]/charter/components/OverviewTab';
import { CharterTab } from '@/app/projects/[id]/charter/components/CharterTab';
import { ScopeTab } from '@/app/projects/[id]/charter/components/ScopeTab';
import { TechnicalTab } from '@/app/projects/[id]/charter/components/TechnicalTab';
import { VendorsTab } from '@/app/projects/[id]/charter/components/VendorsTab';
import { ProcurementTab } from '@/app/projects/[id]/charter/components/ProcurementTab';
import { DocumentsTab } from '@/app/projects/[id]/charter/components/DocumentsTab';
import { BudgetTab } from '@/app/projects/[id]/charter/components/BudgetTab';
import { TimelineTab } from '@/app/projects/[id]/charter/components/TimelineTab';
import { TeamTab } from '@/app/projects/[id]/charter/components/TeamTab';
import { ReportsTab } from '@/app/projects/[id]/charter/components/ReportsTab';

interface ProjectCharterDialogProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
}

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`charter-tabpanel-${index}`}
      aria-labelledby={`charter-tab-${index}`}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export function ProjectCharterDialog({ open, project, onClose }: ProjectCharterDialogProps) {
  const [activeTab, setActiveTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (!project) return null;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Get status color
  const getStatusColor = (
    status: ProjectStatus
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

  // Get priority color
  const getPriorityColor = (priority: ProjectPriority): 'default' | 'warning' | 'error' => {
    switch (priority) {
      case 'CRITICAL':
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      sx={{
        '& .MuiDialog-paper': {
          height: isMobile ? '100%' : '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="h6">{project.name}</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                Code: {project.code}
              </Typography>
              <Chip label={project.status} size="small" color={getStatusColor(project.status)} />
              <Chip
                label={project.priority}
                size="small"
                color={getPriorityColor(project.priority)}
              />
            </Box>
          </Box>
          <IconButton onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="project charter tabs"
        >
          <Tab icon={<OverviewIcon />} label="Overview" iconPosition="start" />
          <Tab icon={<CharterIcon />} label="Charter" iconPosition="start" />
          <Tab icon={<ScopeIcon />} label="Scope" iconPosition="start" />
          <Tab icon={<TechnicalIcon />} label="Technical" iconPosition="start" />
          <Tab icon={<VendorsIcon />} label="Vendors" iconPosition="start" />
          <Tab icon={<ProcurementIcon />} label="Procurement" iconPosition="start" />
          <Tab icon={<DocumentsIcon />} label="Documents" iconPosition="start" />
          <Tab icon={<BudgetIcon />} label="Budget" iconPosition="start" />
          <Tab icon={<TimelineIcon />} label="Timeline" iconPosition="start" />
          <Tab icon={<TeamIcon />} label="Team" iconPosition="start" />
          <Tab icon={<ReportsIcon />} label="Reports" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <DialogContent
        sx={{
          p: 3,
          overflow: 'auto',
          height: '100%',
        }}
      >
        <TabPanel value={activeTab} index={0}>
          <OverviewTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <CharterTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          <ScopeTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          <TechnicalTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={4}>
          <VendorsTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={5}>
          <ProcurementTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={6}>
          <DocumentsTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={7}>
          <BudgetTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={8}>
          <TimelineTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={9}>
          <TeamTab project={project} />
        </TabPanel>
        <TabPanel value={activeTab} index={10}>
          <ReportsTab project={project} />
        </TabPanel>
      </DialogContent>
    </Dialog>
  );
}
