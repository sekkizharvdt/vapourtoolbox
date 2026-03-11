'use client';

/**
 * Project Files Client Component
 *
 * Document browser for a specific project
 * Shows all project-related documents across all modules
 */

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Box } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSION_FLAGS, hasAnyPermission } from '@vapour/constants';
import { DocumentBrowser, UploadDocumentDialog } from '@/components/documents/browser';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { DocumentRecord, Project } from '@vapour/types';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';

export default function ProjectFilesClient() {
  const pathname = usePathname();
  const { claims } = useAuth();
  const { db } = getFirebase();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Extract project ID from pathname
  const projectId = pathname?.split('/projects/')[1]?.split('/')[0] || '';

  // Check permissions
  const hasViewAccess = claims?.permissions
    ? hasAnyPermission(
        claims.permissions,
        PERMISSION_FLAGS.VIEW_PROJECTS,
        PERMISSION_FLAGS.MANAGE_PROJECTS
      )
    : false;

  // Load project details
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || projectId === 'placeholder' || !db) {
        setLoading(false);
        return;
      }

      try {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          setProject({
            id: projectSnap.id,
            ...projectSnap.data(),
          } as Project);
        } else {
          setError('Project not found');
        }
      } catch (err) {
        console.error('[ProjectFilesClient] Error loading project:', err);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, db]);

  // Handle document view
  const handleViewDocument = useCallback((document: DocumentRecord) => {
    if (document.fileUrl) {
      window.open(document.fileUrl, '_blank');
    }
  }, []);

  // Handle document download
  const handleDownloadDocument = useCallback((document: DocumentRecord) => {
    if (document.fileUrl) {
      const link = window.document.createElement('a');
      link.href = document.fileUrl;
      link.download = document.fileName;
      link.click();
    }
  }, []);

  // Handle upload click
  const handleUploadClick = useCallback(() => {
    setUploadDialogOpen(true);
  }, []);

  // Handle upload success - refresh the browser
  const handleUploadSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Project Files"
    >
      <Box sx={{ height: 'calc(100vh - 280px)' }}>
        <DocumentBrowser
          key={refreshKey}
          module="PROJECTS"
          projectId={projectId}
          showViewToggle={false}
          allowFolderCreation={true}
          allowUpload={true}
          onViewDocument={handleViewDocument}
          onDownloadDocument={handleDownloadDocument}
          onUploadClick={handleUploadClick}
        />
      </Box>

      {/* Upload Dialog */}
      <UploadDocumentDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
        module="PROJECTS"
        projectId={projectId}
      />
    </ProjectSubPageWrapper>
  );
}
