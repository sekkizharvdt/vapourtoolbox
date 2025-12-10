/**
 * User Guide Types
 */

import type { ReactNode } from 'react';

/**
 * Guide section definition
 */
export interface GuideSection {
  id: string;
  title: string;
  icon: ReactNode;
  content: ReactNode;
}
