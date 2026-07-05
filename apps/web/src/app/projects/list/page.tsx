'use client';

/**
 * Projects List — legacy route
 *
 * The list now lives at /projects directly; this route stays so existing
 * deep links and shortcuts (e.g. /projects/list?status=ACTIVE) keep
 * working. Renders the same component.
 */

import ProjectsListClient from '../ProjectsListClient';

export default function ProjectsListPage() {
  return <ProjectsListClient />;
}
