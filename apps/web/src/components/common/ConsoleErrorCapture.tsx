'use client';

/**
 * Starts capturing console errors so bug reports can carry them without asking
 * the user to open devtools. Renders nothing.
 *
 * See lib/feedback/consoleErrorBuffer.ts for what is and is not captured.
 */

import { useEffect } from 'react';
import { installConsoleErrorCapture } from '@/lib/feedback/consoleErrorBuffer';

export function ConsoleErrorCapture() {
  useEffect(() => {
    installConsoleErrorCapture();
  }, []);

  return null;
}
