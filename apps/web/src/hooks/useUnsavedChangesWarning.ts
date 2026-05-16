import { useEffect } from 'react';

/**
 * Browser-level warning when leaving a page with unsaved edits.
 *
 * Adds a `beforeunload` listener while `hasChanges` is true so the
 * browser prompts on close / refresh / hard navigation. Does NOT catch
 * in-app tab switches (those need a callback model with confirmation
 * — tracked as a remaining piece of audit #15).
 *
 * Usage:
 *   useUnsavedChangesWarning(hasChanges);
 */
export function useUnsavedChangesWarning(hasChanges: boolean): void {
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set (the string is ignored).
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);
}
