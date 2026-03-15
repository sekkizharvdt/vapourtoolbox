import { useRef, useCallback } from 'react';

/**
 * Tally-style keyboard navigation hook.
 *
 * Gives forms Enter-key-based navigation similar to Tally (MS-DOS-style accounting software):
 * - Enter on a field -> focuses the next field
 * - Enter on the last field -> calls onSubmit
 * - Multiline fields and Autocomplete dropdowns are handled gracefully
 *
 * Usage:
 *   const { getFieldProps } = useTallyKeyboard({ onSubmit: handleSave });
 *
 *   <TextField {...getFieldProps(0)} />
 *   <AccountSelector {...getFieldProps(1, { isAutocomplete: true })} />
 *   <TextField {...getFieldProps(2, { multiline: true })} />  // skipped by Enter
 */

interface UseTallyKeyboardOptions {
  /** Called when Enter is pressed on the last field */
  onSubmit: () => void;
  /** If true, the hook is disabled (useful for view-only / loading states) */
  disabled?: boolean;
}

interface FieldOptions {
  /** Set to true for Autocomplete-based fields (EntitySelector, AccountSelector, etc.)
   *  Enter will only advance after the dropdown is closed. */
  isAutocomplete?: boolean;
  /** Set to true for multiline TextFields. Enter inserts a newline; field is skipped in the Enter chain. */
  multiline?: boolean;
}

interface FieldProps {
  /** Ref callback to register the field's input element */
  inputRef: (el: HTMLInputElement | null) => void;
  /** onKeyDown handler for Enter navigation */
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function useTallyKeyboard({ onSubmit, disabled = false }: UseTallyKeyboardOptions) {
  // Map from field index -> DOM element
  const fieldMap = useRef<Map<number, HTMLInputElement>>(new Map());
  // Track which indices are autocomplete (so we can detect open dropdowns)
  const optionsMap = useRef<Map<number, FieldOptions>>(new Map());

  const registerField = useCallback((index: number, el: HTMLInputElement | null) => {
    if (el) {
      fieldMap.current.set(index, el);
    } else {
      fieldMap.current.delete(index);
    }
  }, []);

  const focusNextField = useCallback(
    (currentIndex: number) => {
      // Get all registered indices, sorted
      const indices = Array.from(fieldMap.current.keys()).sort((a, b) => a - b);
      const currentPos = indices.indexOf(currentIndex);
      if (currentPos === -1) return;

      // Find next non-multiline, non-disabled field
      for (let i = currentPos + 1; i < indices.length; i++) {
        const nextIndex = indices[i]!;
        const nextEl = fieldMap.current.get(nextIndex);
        const nextOpts = optionsMap.current.get(nextIndex);

        if (!nextEl) continue;
        // Skip disabled fields
        if (nextEl.disabled || nextEl.readOnly) continue;
        // Skip multiline fields in the Enter chain — user can Tab into them
        if (nextOpts?.multiline) continue;

        nextEl.focus();
        // Select text for easy overwrite (Tally-like behavior)
        nextEl.select();
        return;
      }

      // No next field found — submit
      onSubmit();
    },
    [onSubmit]
  );

  const handleKeyDown = useCallback(
    (index: number, opts: FieldOptions | undefined, e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key !== 'Enter') return;
      if (e.shiftKey || e.ctrlKey || e.metaKey) return;

      // Multiline fields: Enter inserts newline, don't intercept
      if (opts?.multiline) return;

      // Autocomplete fields: check if the dropdown listbox is open
      if (opts?.isAutocomplete) {
        const el = e.currentTarget as HTMLElement;
        // MUI Autocomplete sets aria-expanded on the input when the dropdown is open
        const input =
          el.tagName === 'INPUT' ? el : (el.querySelector('input[aria-expanded]') as HTMLElement);
        if (input?.getAttribute('aria-expanded') === 'true') {
          // Dropdown is open — let MUI handle the Enter (select option)
          return;
        }
      }

      // Select fields (TextField with select prop): let MUI handle the Enter when dropdown is open
      const target = e.target as HTMLElement;
      if (
        target.getAttribute('role') === 'combobox' ||
        target.getAttribute('aria-haspopup') === 'listbox'
      ) {
        if (target.getAttribute('aria-expanded') === 'true') {
          return;
        }
      }

      e.preventDefault();
      focusNextField(index);
    },
    [disabled, focusNextField]
  );

  /**
   * Returns props to spread on a form field.
   *
   * For plain TextFields:
   *   <TextField {...getFieldProps(0)} />
   *
   * For selectors (Autocomplete-based):
   *   <AccountSelector {...getFieldProps(1, { isAutocomplete: true })} />
   *
   * For multiline TextFields (skipped by Enter):
   *   <TextField {...getFieldProps(2, { multiline: true })} />
   */
  const getFieldProps = useCallback(
    (index: number, opts?: FieldOptions): FieldProps => {
      // Store options for this index
      if (opts) {
        optionsMap.current.set(index, opts);
      } else {
        optionsMap.current.delete(index);
      }

      return {
        inputRef: (el: HTMLInputElement | null) => registerField(index, el),
        onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(index, opts, e),
      };
    },
    [registerField, handleKeyDown]
  );

  return { getFieldProps };
}
