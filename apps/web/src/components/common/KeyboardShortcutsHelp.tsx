'use client';

/**
 * Keyboard Shortcuts Help Dialog
 *
 * Shows all available keyboard shortcuts organized by category.
 * Triggered by pressing Shift+?
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  Divider,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import {
  useKeyboardShortcuts,
  formatShortcutKeys,
  type ShortcutDefinition,
} from '@/hooks/useKeyboardShortcuts';
import { useMemo } from 'react';

/**
 * Format category name for display
 */
function formatCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    navigation: 'Navigation',
    action: 'Actions',
    editing: 'Editing',
    system: 'System',
  };
  return categoryMap[category] || category;
}

/**
 * Shortcut Row Component
 */
function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  const keyParts = keys.includes(' ') ? keys.split(' ') : [keys];

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {keyParts.map((part, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {index > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5 }}>
                then
              </Typography>
            )}
            <Chip
              label={formatShortcutKeys(part)}
              size="small"
              variant="outlined"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                minWidth: 32,
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Main Keyboard Shortcuts Help Dialog
 */
export function KeyboardShortcutsHelp() {
  const { shortcuts, isHelpOpen, closeHelp } = useKeyboardShortcuts();

  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, ShortcutDefinition[]> = {};

    shortcuts.forEach((shortcut) => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category]!.push(shortcut);
    });

    // Sort categories in preferred order
    const categoryOrder = ['navigation', 'action', 'editing', 'system'];
    const sortedGroups: Record<string, ShortcutDefinition[]> = {};

    categoryOrder.forEach((cat) => {
      if (groups[cat]) {
        sortedGroups[cat] = groups[cat]!;
      }
    });

    // Add any remaining categories
    Object.keys(groups).forEach((cat) => {
      if (!sortedGroups[cat]) {
        sortedGroups[cat] = groups[cat]!;
      }
    });

    return sortedGroups;
  }, [shortcuts]);

  return (
    <Dialog
      open={isHelpOpen}
      onClose={closeHelp}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <KeyboardIcon />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Keyboard Shortcuts
        </Typography>
        <IconButton onClick={closeHelp} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 4,
          }}
        >
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <Box key={category}>
              <Typography
                variant="subtitle2"
                fontWeight={600}
                color="primary"
                gutterBottom
                sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
              >
                {formatCategory(category)}
              </Typography>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2 }}>
                {categoryShortcuts.map((shortcut, index) => (
                  <Box key={shortcut.id}>
                    {index > 0 && <Divider sx={{ my: 0.5 }} />}
                    <ShortcutRow keys={shortcut.keys} description={shortcut.description} />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Footer tip */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Press{' '}
            <Chip
              label="⌘K"
              size="small"
              variant="outlined"
              sx={{ fontFamily: 'monospace', mx: 0.5 }}
            />{' '}
            to open the command palette for more actions
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
