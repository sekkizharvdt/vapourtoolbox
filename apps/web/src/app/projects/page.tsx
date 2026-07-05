// rule28-exempt: created via CreateProjectDialog on this page; edits happen on dedicated sub-route pages — [id]/charter, [id]/scope, [id]/budget, [id]/team, [id]/timeline, [id]/technical — not a single edit form

'use client';

/**
 * Projects Module — landing page
 *
 * Renders the single list view directly (status filter chips replace the
 * old hub-of-cards + list two-step). /projects/list renders the same
 * component so existing deep links (e.g. ?status=PLANNING) keep working.
 */

import ProjectsListClient from './ProjectsListClient';

export default function ProjectsPage() {
  return <ProjectsListClient />;
}
