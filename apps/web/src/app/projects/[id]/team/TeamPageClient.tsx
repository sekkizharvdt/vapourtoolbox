'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { TeamTab } from '../charter/components/TeamTab';

export default function TeamPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('team');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Project Team"
    >
      {project && <TeamTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
