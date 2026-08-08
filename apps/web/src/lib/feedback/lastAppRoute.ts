/**
 * Last app route, for feedback context capture.
 *
 * The feedback form is a page at /feedback, reached by client-side navigation.
 * Next.js does not set `document.referrer` on a client-side route change, so
 * the referrer is empty for most submissions — which is why only 20 of 122
 * feature requests carried a pageUrl, while bugs reached 100% purely because
 * the field is rendered and required and users paste it by hand.
 *
 * Recording the route as the user moves around gives the form the screen they
 * came from without asking them for it (Phase D2 of
 * docs/reviews/2026-08-07-feedback-intake-plan.md).
 *
 * sessionStorage rather than a React context: it survives a full page load of
 * /feedback (opened in a new tab from the command palette) and needs no
 * provider plumbing. Scoped to the tab, cleared when it closes.
 */

const STORAGE_KEY = 'vapour:lastAppRoute';

/** Routes that are never useful as "where the user came from". */
function isFeedbackRoute(path: string): boolean {
  return path.startsWith('/feedback');
}

/**
 * Remember a route the user visited. No-ops on the server, for feedback routes
 * themselves, and when storage is unavailable (private browsing, quota).
 */
export function recordAppRoute(path: string): void {
  if (typeof window === 'undefined') return;
  if (!path || isFeedbackRoute(path)) return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, path);
  } catch {
    // Storage unavailable — context capture degrades to empty, which is the
    // behaviour before this existed. Not worth surfacing to the user.
  }
}

/**
 * The last non-feedback route, as an absolute URL so it matches the shape of
 * the pageUrl bugs already carry (`https://host/procurement/pos/<id>`).
 * Returns '' when nothing was recorded.
 */
export function getLastAppRouteUrl(): string {
  if (typeof window === 'undefined') return '';

  try {
    const path = window.sessionStorage.getItem(STORAGE_KEY);
    if (!path) return '';
    return new URL(path, window.location.origin).toString();
  } catch {
    return '';
  }
}
