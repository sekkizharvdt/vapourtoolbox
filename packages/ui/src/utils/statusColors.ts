/**
 * Status color utility
 *
 * Re-exports the canonical status→color logic from @vapour/constants (where
 * it's co-located with the domain label maps). Kept here too since existing
 * call sites import from @vapour/ui — do not re-add logic in this file.
 */

export {
  getStatusColor,
  getPriorityColor,
  getRoleColor,
  type StatusChipColor,
  type StatusColorContext,
} from '@vapour/constants';
