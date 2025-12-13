'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { ReportsTab } from '../charter/components/ReportsTab';

export default function ReportsPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('reports');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Progress Reports"
    >
      {project && <ReportsTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
