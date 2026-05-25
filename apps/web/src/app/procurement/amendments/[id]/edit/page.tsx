/**
 * PO Amendment Edit Page (Server Component)
 *
 * Wrapper for the amendment edit client component.
 */

import AmendmentEditClient from './AmendmentEditClient';

// Generate static params for static export — actual ID is read from the
// pathname on the client (rule 30).
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function AmendmentEditPage() {
  return <AmendmentEditClient />;
}
