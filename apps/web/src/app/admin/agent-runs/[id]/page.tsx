/**
 * Agent Run Detail Page (server entry)
 *
 * Static export pre-renders against a single 'placeholder' id (rule #30);
 * the actual id is read from usePathname() inside AgentRunDetailClient.
 */

import AgentRunDetailClient from './AgentRunDetailClient';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function AgentRunDetailPage() {
  return <AgentRunDetailClient />;
}
