'use client';

import { useState } from 'react';

/**
 * Hook for managing AI Help dialog state.
 * This is extracted to a separate file to allow the heavy AIHelpWidget
 * component to be lazy loaded while keeping the hook in the main bundle.
 */
export function useAIHelp() {
  const [open, setOpen] = useState(false);

  return {
    open,
    setOpen,
    toggle: () => setOpen((prev) => !prev),
    close: () => setOpen(false),
  };
}
