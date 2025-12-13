'use client';

import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { VendorsTab } from '../charter/components/VendorsTab';

export default function VendorsPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('vendors');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Outsourcing Vendors"
    >
      {project && <VendorsTab project={project} />}
    </ProjectSubPageWrapper>
  );
}
