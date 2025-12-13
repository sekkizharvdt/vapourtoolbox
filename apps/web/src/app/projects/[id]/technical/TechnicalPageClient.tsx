'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { TechnicalTab } from '../charter/components/TechnicalTab';

export default function TechnicalPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('technical');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Technical Specifications"
    >
      {project && <TechnicalTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
