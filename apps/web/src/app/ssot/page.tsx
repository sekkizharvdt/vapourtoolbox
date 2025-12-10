'use client';

/**
 * SSOT (Single Source of Truth) Main Page
 *
 * Process master data management for thermal desalination projects.
 * Provides tabs for Streams, Equipment, Lines, Instruments, Valves, and Pipe Table.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
  Tabs,
  Tab,
  Paper,
  Button,
} from '@mui/material';
import { TableChart as TableChartIcon, Download as DownloadIcon } from '@mui/icons-material';
import { PageHeader, LoadingState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/lib/projects/projectService';
import type { Project } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import StreamsTab from './components/StreamsTab';
import EquipmentTab from './components/EquipmentTab';
import LinesTab from './components/LinesTab';
import InstrumentsTab from './components/InstrumentsTab';
import ValvesTab from './components/ValvesTab';
import PipeTableTab from './components/PipeTableTab';

const logger = createLogger({ context: 'SSOTPage' });

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ssot-tabpanel-${index}`}
      aria-labelledby={`ssot-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `ssot-tab-${index}`,
    'aria-controls': `ssot-tabpanel-${index}`,
  };
}

export default function SSOTPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      setError('');
      try {
        const projectList = await getProjects();
        setProjects(projectList);
        // Auto-select first project if available
        const firstProject = projectList[0];
        if (projectList.length > 0 && firstProject) {
          setSelectedProjectId((prev) => prev || firstProject.id);
        }
      } catch (err) {
        logger.error('Error loading projects', { error: err });
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const handleProjectChange = (event: SelectChangeEvent) => {
    setSelectedProjectId(event.target.value);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExportExcel = useCallback(async () => {
    if (!selectedProjectId) return;
    // Excel export (future enhancement)
    logger.info('Export Excel requested', { projectId: selectedProjectId });
    alert('Excel export coming soon!');
  }, [selectedProjectId]);

  if (loading && projects.length === 0) {
    return (
      <Container maxWidth="xl">
        <LoadingState message="Loading projects..." />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="Process Data (SSOT)"
          subtitle="Single Source of Truth for process engineering data"
          action={
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportExcel}
              disabled={!selectedProjectId}
            >
              Export Excel
            </Button>
          }
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Project Selector */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Select Project</InputLabel>
            <Select value={selectedProjectId} onChange={handleProjectChange} label="Select Project">
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.code} - {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {!selectedProjectId ? (
          <Alert severity="info">Please select a project to view and manage process data.</Alert>
        ) : (
          <>
            {/* Tabs */}
            <Paper sx={{ mb: 2 }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="SSOT data tabs"
              >
                <Tab
                  icon={<TableChartIcon />}
                  iconPosition="start"
                  label="Streams"
                  {...a11yProps(0)}
                />
                <Tab
                  icon={<TableChartIcon />}
                  iconPosition="start"
                  label="Equipment"
                  {...a11yProps(1)}
                />
                <Tab
                  icon={<TableChartIcon />}
                  iconPosition="start"
                  label="Lines"
                  {...a11yProps(2)}
                />
                <Tab
                  icon={<TableChartIcon />}
                  iconPosition="start"
                  label="Instruments"
                  {...a11yProps(3)}
                />
                <Tab
                  icon={<TableChartIcon />}
                  iconPosition="start"
                  label="Valves"
                  {...a11yProps(4)}
                />
                <Tab
                  icon={<TableChartIcon />}
                  iconPosition="start"
                  label="Pipe Table"
                  {...a11yProps(5)}
                />
              </Tabs>
            </Paper>

            {/* Tab Panels */}
            <TabPanel value={tabValue} index={0}>
              <StreamsTab projectId={selectedProjectId} userId={user?.uid || ''} />
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <EquipmentTab projectId={selectedProjectId} userId={user?.uid || ''} />
            </TabPanel>
            <TabPanel value={tabValue} index={2}>
              <LinesTab projectId={selectedProjectId} userId={user?.uid || ''} />
            </TabPanel>
            <TabPanel value={tabValue} index={3}>
              <InstrumentsTab projectId={selectedProjectId} userId={user?.uid || ''} />
            </TabPanel>
            <TabPanel value={tabValue} index={4}>
              <ValvesTab projectId={selectedProjectId} userId={user?.uid || ''} />
            </TabPanel>
            <TabPanel value={tabValue} index={5}>
              <PipeTableTab projectId={selectedProjectId} userId={user?.uid || ''} />
            </TabPanel>
          </>
        )}
      </Box>
    </Container>
  );
}
