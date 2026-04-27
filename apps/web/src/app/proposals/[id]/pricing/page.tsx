/**
 * Legacy /proposals/[id]/pricing route — redirect-only stub.
 *
 * Pricing now lives as a tab inside ProposalDetailClient (stage 2.5a). This
 * stub keeps the old URL working: anyone landing here is bounced to the
 * tabbed UI with the Pricing tab pre-selected.
 */

import LegacyPricingRedirect from './LegacyPricingRedirect';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <LegacyPricingRedirect />;
}
