/**
 * Pipe Sizing Helper Functions
 */

import type { FlowUnit } from './types';

export function convertFlowToTonHr(value: number, unit: FlowUnit): number {
  switch (unit) {
    case 'tonhr':
      return value;
    case 'kghr':
      return value / 1000;
    case 'kgsec':
      return (value * 3600) / 1000;
    case 'm3hr':
      return value; // Will multiply by density later
    default:
      return value;
  }
}
