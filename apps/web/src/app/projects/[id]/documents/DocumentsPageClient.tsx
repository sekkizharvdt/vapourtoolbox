'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { DocumentsTab } from '../charter/components/DocumentsTab';

export default function DocumentsPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('documents');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Document Management"
    >
      {project && <DocumentsTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
