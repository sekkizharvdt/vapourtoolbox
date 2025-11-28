/**
 * Edit Proposal Page
 *
 * Loads ProposalWizard in edit mode with the proposal ID
 */

import EditProposalClient from './EditProposalClient';

// For static export, we need to provide at least one path
// Client-side component will parse actual ID from URL pathname
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <EditProposalClient />;
}
