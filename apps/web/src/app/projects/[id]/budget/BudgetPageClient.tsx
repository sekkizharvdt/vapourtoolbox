'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { BudgetTab } from '../charter/components/BudgetTab';

export default function BudgetPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('budget');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Budget Management"
    >
      {project && <BudgetTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
