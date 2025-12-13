'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { ScopeTab } from '../charter/components/ScopeTab';

export default function ScopePageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('scope');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Project Scope"
    >
      {project && <ScopeTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
