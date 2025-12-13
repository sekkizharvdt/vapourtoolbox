'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { TimelineTab } from '../charter/components/TimelineTab';

export default function TimelinePageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('timeline');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Timeline & Milestones"
    >
      {project && <TimelineTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
