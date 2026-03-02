'use client';

/**
 * Documents Page Client — Tabbed MDL Hub
 *
 * Entry point for the project documents module.
 * Tab 1: Master Document List (active)
 * Tab 2: Transmittals (coming soon)
 * Tab 3: Submissions (coming soon)
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, Tabs, Tab, Tooltip, Paper } from '@mui/material';
import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';

// Dynamic import for code splitting
const MasterDocumentListTab = dynamic(() => import('./components/MasterDocumentListTab'), {
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
              <Tooltip title="Coming soon">
                <span>
                  <Tab label="Transmittals" disabled />
                </span>
              </Tooltip>
              <Tooltip title="Coming soon">
                <span>
                  <Tab label="Submissions" disabled />
                </span>
              </Tooltip>
            </Tabs>
          </Paper>

          {activeTab === 0 && <MasterDocumentListTab project={project} />}
        </Box>
      )}
    </ProjectSubPageWrapper>
  );
}
