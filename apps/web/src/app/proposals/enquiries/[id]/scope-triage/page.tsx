/**
 * Scope Triage Page
 *
 * Intermediate review screen between AI parse and the proposal scope editor.
 * The user sees every parsed item as a flat row with a quick category
 * dropdown, so misplaced items can be reorganised before they cascade into
 * the proposal's matrix editor.
 */

import ScopeTriageClient from './ScopeTriageClient';

// Static export needs a placeholder; the client reads the actual id from the URL.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <ScopeTriageClient />;
}
