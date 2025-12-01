/**
 * Keyboard Shortcuts System
 *
 * A centralized system for managing keyboard shortcuts across the application.
 * Supports:
 * - Global shortcuts (work everywhere)
 * - Scoped shortcuts (work in specific contexts)
 * - Shortcut discovery dialog
 * - Conflict detection
 */

import { useEffect, useCallback, useState, createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Shortcut definition
 */
export interface ShortcutDefinition {
  id: string;
  keys: string; // e.g., 'cmd+k', 'g d', 'shift+?'
  description: string;
  category: 'navigation' | 'action' | 'editing' | 'system';
  action: () => void;
  scope?: string; // Optional scope (e.g., 'flow', 'procurement')
  enabled?: boolean;
}

/**
 * Shortcut context type
 */
interface ShortcutContextType {
  shortcuts: ShortcutDefinition[];
  registerShortcut: (shortcut: ShortcutDefinition) => void;
  unregisterShortcut: (id: string) => void;
  isHelpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  currentScope: string | null;
  setScope: (scope: string | null) => void;
}

const ShortcutContext = createContext<ShortcutContextType | null>(null);

/**
 * Parse key combination string into components
 */
function parseKeys(keys: string): { modifiers: string[]; key: string; sequence: string[] } {
  // Check if it's a sequence (e.g., 'g d' for Go to Dashboard)
  if (keys.includes(' ') && !keys.includes('+')) {
    return {
      modifiers: [],
      key: '',
      sequence: keys.toLowerCase().split(' '),
    };
  }

  const parts = keys.toLowerCase().split('+');
  const modifiers: string[] = [];
  let key = '';

  parts.forEach((part) => {
    const trimmed = part.trim();
    if (['cmd', 'ctrl', 'alt', 'shift', 'meta'].includes(trimmed)) {
      modifiers.push(trimmed);
    } else {
      key = trimmed;
    }
  });

  return { modifiers, key, sequence: [] };
}

/**
 * Check if a keyboard event matches a shortcut
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition,
  sequenceBuffer: string[]
): boolean {
  const { modifiers, key, sequence } = parseKeys(shortcut.keys);

  // Handle key sequences (e.g., 'g d')
  if (sequence.length > 0) {
    const currentSequence = [...sequenceBuffer, event.key.toLowerCase()];

    // Check if current sequence matches the shortcut sequence
    if (currentSequence.length === sequence.length) {
      return currentSequence.every((k, i) => k === sequence[i]);
    }

    // Partial match - continue building sequence
    if (currentSequence.length < sequence.length) {
      const matches = currentSequence.every((k, i) => k === sequence[i]);
      return matches && currentSequence.length === sequence.length;
    }

    return false;
  }

  // Handle modifier combinations
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  const cmdPressed = isMac ? event.metaKey : event.ctrlKey;
  const shiftPressed = event.shiftKey;
  const altPressed = event.altKey;

  const needsCmd =
    modifiers.includes('cmd') || modifiers.includes('ctrl') || modifiers.includes('meta');
  const needsShift = modifiers.includes('shift');
  const needsAlt = modifiers.includes('alt');

  if (needsCmd !== cmdPressed) return false;
  if (needsShift !== shiftPressed) return false;
  if (needsAlt !== altPressed) return false;

  // Check the main key
  const eventKey = event.key.toLowerCase();
  return eventKey === key || event.code.toLowerCase() === `key${key}`;
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}

/**
 * Hook to register a shortcut
 */
export function useShortcut(shortcut: Omit<ShortcutDefinition, 'id'> & { id?: string }) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const id = shortcut.id || `shortcut-${shortcut.keys}`;

  useEffect(() => {
    registerShortcut({ ...shortcut, id });
    return () => unregisterShortcut(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, shortcut.keys, shortcut.enabled]);
}

/**
 * Provider props
 */
interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
}

/**
 * Keyboard Shortcuts Provider
 */
export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentScope, setCurrentScope] = useState<string | null>(null);
  const [sequenceBuffer, setSequenceBuffer] = useState<string[]>([]);
  const [sequenceTimeout, setSequenceTimeout] = useState<NodeJS.Timeout | null>(null);

  // Default global shortcuts
  const defaultShortcuts = useMemo<ShortcutDefinition[]>(
    () => [
      {
        id: 'help',
        keys: 'shift+?',
        description: 'Show keyboard shortcuts',
        category: 'system',
        action: () => setIsHelpOpen(true),
      },
      {
        id: 'go-dashboard',
        keys: 'g d',
        description: 'Go to Dashboard',
        category: 'navigation',
        action: () => router.push('/dashboard'),
      },
      {
        id: 'go-flow',
        keys: 'g f',
        description: 'Go to Flow',
        category: 'navigation',
        action: () => router.push('/flow'),
      },
      {
        id: 'go-procurement',
        keys: 'g p',
        description: 'Go to Procurement',
        category: 'navigation',
        action: () => router.push('/procurement'),
      },
      {
        id: 'go-documents',
        keys: 'g o',
        description: 'Go to Documents',
        category: 'navigation',
        action: () => router.push('/documents'),
      },
      {
        id: 'go-accounting',
        keys: 'g a',
        description: 'Go to Accounting',
        category: 'navigation',
        action: () => router.push('/accounting'),
      },
      {
        id: 'go-proposals',
        keys: 'g r',
        description: 'Go to Proposals',
        category: 'navigation',
        action: () => router.push('/proposals'),
      },
      {
        id: 'go-projects',
        keys: 'g j',
        description: 'Go to Projects',
        category: 'navigation',
        action: () => router.push('/projects'),
      },
      {
        id: 'go-entities',
        keys: 'g e',
        description: 'Go to Entities',
        category: 'navigation',
        action: () => router.push('/entities'),
      },
      {
        id: 'escape',
        keys: 'escape',
        description: 'Close dialog/modal',
        category: 'system',
        action: () => {
          // This is a placeholder - actual escape handling is in individual components
          setIsHelpOpen(false);
        },
      },
    ],
    [router]
  );

  const registerShortcut = useCallback((shortcut: ShortcutDefinition) => {
    setShortcuts((prev) => {
      const exists = prev.find((s) => s.id === shortcut.id);
      if (exists) {
        return prev.map((s) => (s.id === shortcut.id ? shortcut : s));
      }
      return [...prev, shortcut];
    });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // All shortcuts (default + registered)
  const allShortcuts = useMemo(
    () => [...defaultShortcuts, ...shortcuts],
    [defaultShortcuts, shortcuts]
  );

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Escape to work even in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      // Update sequence buffer
      const newBuffer = [...sequenceBuffer, event.key.toLowerCase()];

      // Clear existing timeout
      if (sequenceTimeout) {
        clearTimeout(sequenceTimeout);
      }

      // Set new timeout to clear buffer after 1 second
      const timeout = setTimeout(() => {
        setSequenceBuffer([]);
      }, 1000);
      setSequenceTimeout(timeout);

      // Check all shortcuts
      for (const shortcut of allShortcuts) {
        // Skip disabled shortcuts
        if (shortcut.enabled === false) continue;

        // Skip scoped shortcuts if not in scope
        if (shortcut.scope && shortcut.scope !== currentScope) continue;

        if (matchesShortcut(event, shortcut, sequenceBuffer)) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          setSequenceBuffer([]);
          return;
        }
      }

      // Check if current key could be start of a sequence
      const couldBeSequence = allShortcuts.some((s) => {
        const { sequence } = parseKeys(s.keys);
        if (sequence.length === 0) return false;
        return newBuffer.every((k, i) => k === sequence[i]);
      });

      if (couldBeSequence) {
        setSequenceBuffer(newBuffer);
      } else {
        setSequenceBuffer([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (sequenceTimeout) {
        clearTimeout(sequenceTimeout);
      }
    };
  }, [allShortcuts, currentScope, sequenceBuffer, sequenceTimeout]);

  const value = useMemo<ShortcutContextType>(
    () => ({
      shortcuts: allShortcuts,
      registerShortcut,
      unregisterShortcut,
      isHelpOpen,
      openHelp: () => setIsHelpOpen(true),
      closeHelp: () => setIsHelpOpen(false),
      currentScope,
      setScope: setCurrentScope,
    }),
    [allShortcuts, registerShortcut, unregisterShortcut, isHelpOpen, currentScope]
  );

  return <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>;
}

/**
 * Format shortcut keys for display
 */
export function formatShortcutKeys(keys: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  return keys
    .split('+')
    .map((part) => {
      const trimmed = part.trim().toLowerCase();
      switch (trimmed) {
        case 'cmd':
        case 'ctrl':
        case 'meta':
          return isMac ? '⌘' : 'Ctrl';
        case 'shift':
          return isMac ? '⇧' : 'Shift';
        case 'alt':
          return isMac ? '⌥' : 'Alt';
        case 'escape':
          return 'Esc';
        default:
          return trimmed.toUpperCase();
      }
    })
    .join(isMac ? '' : '+');
}
