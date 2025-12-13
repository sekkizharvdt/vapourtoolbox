'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { ProcurementTab } from '../charter/components/ProcurementTab';

export default function ProcurementPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('procurement');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Procurement Planning"
    >
      {project && <ProcurementTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
