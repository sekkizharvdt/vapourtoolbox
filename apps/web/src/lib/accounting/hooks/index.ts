/**
 * Accounting Module - React Query Hooks
 *
 * Re-exports all hooks for convenient importing.
 *
 * @example
 * ```typescript
 * import { useAccounts, useBankAccounts } from '@/lib/accounting/hooks';
 *
 * function MyComponent() {
 *   const { data: accounts, isLoading } = useAccounts();
 *   // ...
 * }
 * ```
 */

export {
  useAccounts,
  useAccount,
  useAccountsByType,
  useBankAccounts,
  usePostableAccounts,
} from './useAccounts';
