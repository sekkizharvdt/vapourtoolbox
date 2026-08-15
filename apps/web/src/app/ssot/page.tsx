'use client';

/**
 * SSOT (Single Source of Truth) Main Page
 *
 * Process master data management for thermal desalination projects.
 * Provides tabs for Streams, Equipment, Lines, Instruments, Valves, and Pipe Table.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
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
import {
  TableChart as TableChartIcon,
  Download as DownloadIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getProjectsForUser } from '@/lib/projects/projectService';
import type { SSOTAccessCheck } from '@/lib/ssot/ssotAuth';
import type { Project } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { useToast } from '@/components/common/Toast';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import { listStreams } from '@/lib/ssot/streamService';
import { listEquipment } from '@/lib/ssot/equipmentService';
import { listLines } from '@/lib/ssot/lineService';
import { listInstruments } from '@/lib/ssot/instrumentService';
import { listValves } from '@/lib/ssot/valveService';
import { listPipeSizes } from '@/lib/ssot/pipeTableService';
import { buildSSOTWorkbook, ssotWorkbookFilename, XLSX_MIME_TYPE } from '@/lib/ssot/ssotExcel';
import { ImportSSOTDialog } from '@/components/ssot/ImportSSOTDialog';
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
  const { user, claims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Bumped after an import so every tab re-reads its register
  const [refreshKey, setRefreshKey] = useState(0);

  // PE-6: Load projects scoped to user access
  useEffect(() => {
    if (!user?.uid) return;

    const tenantId = claims?.tenantId || 'default-entity';
    const loadProjects = async () => {
      setLoading(true);
      setError('');
      try {
        const projectList = await getProjectsForUser(tenantId, user.uid, claims?.permissions ?? 0);
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
  }, [user?.uid, claims]);

  // PE-14/PE-18: write-access check passed to every tab — MANAGE_SSOT
  // permission plus project scope (the visible project list is already
  // "assignedProjects, or all projects for MANAGE_PROJECTS holders").
  const accessCheck = useMemo<SSOTAccessCheck>(
    () => ({
      userPermissions2: claims?.permissions2 ?? 0,
      userAssignedProjects: projects.map((p) => p.id),
    }),
    [claims?.permissions2, projects]
  );

  const handleProjectChange = (event: SelectChangeEvent) => {
    setSelectedProjectId(event.target.value);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExportExcel = useCallback(async () => {
    if (!selectedProjectId) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return;

    setExporting(true);
    try {
      // Rule 35: a token that has gone stale fails on whichever read runs
      // first, so the whole set is wrapped rather than the first one.
      const [streams, equipment, lines, instruments, valves, pipeTable] = await retryOnStaleToken(
        () =>
          Promise.all([
            listStreams(selectedProjectId),
            listEquipment(selectedProjectId),
            listLines(selectedProjectId),
            listInstruments(selectedProjectId),
            listValves(selectedProjectId),
            listPipeSizes(selectedProjectId),
          ])
      );

      const buffer = await buildSSOTWorkbook({
        projectCode: project.code,
        projectName: project.name,
        streams,
        equipment,
        lines,
        instruments,
        valves,
        pipeTable,
      });

      const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME_TYPE }));
      const link = document.createElement('a');
      link.href = url;
      link.download = ssotWorkbookFilename(project.code);
      link.click();
      URL.revokeObjectURL(url);

      toast.success(
        `Exported ${streams.length} streams, ${equipment.length} equipment and ${lines.length} lines`
      );
    } catch (err) {
      logger.error('Export failed', { error: err });
      toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }, [selectedProjectId, projects, toast]);

  if (loading && projects.length === 0) {
    return <LoadingState message="Loading projects..." />;
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="Process Data (SSOT)"
          subtitle="Single Source of Truth for process engineering data"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportExcel}
                disabled={!selectedProjectId || exporting}
              >
                {exporting ? 'Exporting…' : 'Export Excel'}
              </Button>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => setImportOpen(true)}
                disabled={!selectedProjectId}
              >
                Import
              </Button>
            </Box>
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
            <TabPanel key={refreshKey} value={tabValue} index={0}>
              <StreamsTab
                projectId={selectedProjectId}
                userId={user?.uid || ''}
                accessCheck={accessCheck}
              />
            </TabPanel>
            <TabPanel key={refreshKey} value={tabValue} index={1}>
              <EquipmentTab
                projectId={selectedProjectId}
                userId={user?.uid || ''}
                accessCheck={accessCheck}
              />
            </TabPanel>
            <TabPanel key={refreshKey} value={tabValue} index={2}>
              <LinesTab
                projectId={selectedProjectId}
                userId={user?.uid || ''}
                accessCheck={accessCheck}
              />
            </TabPanel>
            <TabPanel key={refreshKey} value={tabValue} index={3}>
              <InstrumentsTab
                projectId={selectedProjectId}
                userId={user?.uid || ''}
                accessCheck={accessCheck}
              />
            </TabPanel>
            <TabPanel key={refreshKey} value={tabValue} index={4}>
              <ValvesTab
                projectId={selectedProjectId}
                userId={user?.uid || ''}
                accessCheck={accessCheck}
              />
            </TabPanel>
            <TabPanel key={refreshKey} value={tabValue} index={5}>
              <PipeTableTab
                projectId={selectedProjectId}
                userId={user?.uid || ''}
                accessCheck={accessCheck}
              />
            </TabPanel>
          </>
        )}
      </Box>

      {selectedProjectId && (
        <ImportSSOTDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          projectId={selectedProjectId}
          projectLabel={projects.find((p) => p.id === selectedProjectId)?.code ?? 'this project'}
          userId={user?.uid || ''}
          accessCheck={accessCheck}
          onImported={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
}
