'use client';

/**
 * Documents Page Client — Tabbed Document Hub
 *
 * Entry point for the project documents module.
 * Tab 0: Master Document List
 * Tab 1: Transmittals
 * Tab 2: Submissions
 * Tab 3: Templates
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, Tabs, Tab, Paper } from '@mui/material';
import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';

// Dynamic imports for code splitting
const MasterDocumentListTab = dynamic(() => import('./components/MasterDocumentListTab'), {
  ssr: false,
});
const TransmittalsTab = dynamic(() => import('./components/TransmittalsTab'), {
  ssr: false,
});
const SubmissionsTab = dynamic(() => import('./components/SubmissionsTab'), {
  ssr: false,
});
const TemplatesTab = dynamic(() => import('./components/TemplatesTab'), {
  ssr: false,
});

export default function DocumentsPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('documents');
  const [activeTab, setActiveTab] = useState(0);

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Document Management"
    >
      {project && (
        <Box>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, val) => setActiveTab(val)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Master Document List" />
              <Tab label="Transmittals" />
              <Tab label="Submissions" />
              <Tab label="Templates" />
            </Tabs>
          </Paper>

          {activeTab === 0 && <MasterDocumentListTab project={project} />}
          {activeTab === 1 && <TransmittalsTab project={project} />}
          {activeTab === 2 && <SubmissionsTab project={project} />}
          {activeTab === 3 && <TemplatesTab project={project} />}
        </Box>
      )}
    </ProjectSubPageWrapper>
  );
}
