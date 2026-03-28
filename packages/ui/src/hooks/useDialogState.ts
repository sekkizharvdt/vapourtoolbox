import { useReducer, useCallback } from 'react';

/**
 * Dialog mode — determines if we're creating, editing, or viewing
 */
export type DialogMode = 'create' | 'edit' | 'view';

/**
 * State shape for the dialog reducer
 */
export interface DialogState<T> {
  /** Whether the dialog is open */
  open: boolean;
  /** Current mode */
  mode: DialogMode;
  /** The item being edited or viewed (null for create) */
  item: T | null;
}

type DialogAction<T> =
  | { type: 'OPEN_CREATE' }
  | { type: 'OPEN_EDIT'; item: T }
  | { type: 'OPEN_VIEW'; item: T }
  | { type: 'CLOSE' };

function createDialogReducer<T>() {
  return (state: DialogState<T>, action: DialogAction<T>): DialogState<T> => {
    switch (action.type) {
      case 'OPEN_CREATE':
        return { open: true, mode: 'create', item: null };
      case 'OPEN_EDIT':
        return { open: true, mode: 'edit', item: action.item };
      case 'OPEN_VIEW':
        return { open: true, mode: 'view', item: action.item };
      case 'CLOSE':
        return { ...state, open: false };
      default:
        return state;
    }
  };
}

const initialState: DialogState<never> = {
  open: false,
  mode: 'create',
  item: null,
};

/**
 * Hook for managing dialog open/close/edit/view state.
 *
 * Replaces the common pattern of 3-5 separate useState calls per dialog:
 * ```typescript
 * // Before: scattered state
 * const [dialogOpen, setDialogOpen] = useState(false);
 * const [editingItem, setEditingItem] = useState<Item | null>(null);
 * const [viewOnly, setViewOnly] = useState(false);
 *
 * // After: single hook
 * const { dialog, openCreate, openEdit, openView, close } = useDialogState<Item>();
 * ```
 *
 * @example
 * ```tsx
 * const { dialog, openCreate, openEdit, openView, close } = useDialogState<Invoice>();
 *
 * // In JSX:
 * <Button onClick={openCreate}>New Invoice</Button>
 * <Button onClick={() => openEdit(invoice)}>Edit</Button>
 * <Button onClick={() => openView(invoice)}>View</Button>
 *
 * <FormDialog
 *   open={dialog.open}
 *   onClose={close}
 *   title={dialog.mode === 'create' ? 'Create Invoice' : 'Edit Invoice'}
 * >
 *   <InvoiceForm
 *     editing={dialog.item}
 *     viewOnly={dialog.mode === 'view'}
 *   />
 * </FormDialog>
 * ```
 */
export function useDialogState<T>() {
  const [dialog, dispatch] = useReducer(createDialogReducer<T>(), initialState as DialogState<T>);

  const openCreate = useCallback(() => dispatch({ type: 'OPEN_CREATE' }), []);
  const openEdit = useCallback((item: T) => dispatch({ type: 'OPEN_EDIT', item }), []);
  const openView = useCallback((item: T) => dispatch({ type: 'OPEN_VIEW', item }), []);
  const close = useCallback(() => dispatch({ type: 'CLOSE' }), []);

  return {
    dialog,
    openCreate,
    openEdit,
    openView,
    close,
  };
}
