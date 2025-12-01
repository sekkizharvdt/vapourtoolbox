'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  InputAdornment,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DescriptionIcon from '@mui/icons-material/Description';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CalculateIcon from '@mui/icons-material/Calculate';
import InventoryIcon from '@mui/icons-material/Inventory';
import CategoryIcon from '@mui/icons-material/Category';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES, hasModuleAccess } from '@vapour/constants';

/**
 * Command definition
 */
interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'navigation' | 'action' | 'search';
  keywords: string[];
  action: () => void;
  shortcut?: string;
  requiredPermissions?: number;
}

/**
 * Icon map for modules
 */
const iconMap: Record<string, React.ReactNode> = {
  Schedule: <ScheduleIcon />,
  Description: <DescriptionIcon />,
  ShoppingCart: <ShoppingCartIcon />,
  AccountBalance: <AccountBalanceIcon />,
  Calculate: <CalculateIcon />,
  Inventory: <InventoryIcon />,
  Category: <CategoryIcon />,
  Business: <BusinessIcon />,
  People: <PeopleIcon />,
  Assignment: <AssignmentIcon />,
  Dashboard: <DashboardIcon />,
  Settings: <SettingsIcon />,
  Folder: <FolderIcon />,
  Add: <AddIcon />,
};

/**
 * Get icon component from string name
 */
function getIcon(iconName: string): React.ReactNode {
  return iconMap[iconName] || <FolderIcon />;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { claims } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const userPermissions = claims?.permissions || 0;

  /**
   * Build command list based on available modules and actions
   */
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    // Dashboard
    cmds.push({
      id: 'go-dashboard',
      label: 'Go to Dashboard',
      description: 'View your dashboard',
      icon: <DashboardIcon />,
      category: 'navigation',
      keywords: ['home', 'dashboard', 'main'],
      action: () => router.push('/dashboard'),
      shortcut: 'G D',
    });

    // User Guide
    cmds.push({
      id: 'go-guide',
      label: 'Open User Guide',
      description: 'View documentation and help',
      icon: <HelpOutlineIcon />,
      category: 'navigation',
      keywords: ['help', 'guide', 'documentation', 'docs', 'how to', 'tutorial'],
      action: () => router.push('/guide'),
      shortcut: 'G H',
    });

    // Module navigation commands
    Object.values(MODULES).forEach((module) => {
      if (module.status !== 'active') return;
      if (!hasModuleAccess(module.id, userPermissions)) return;

      cmds.push({
        id: `go-${module.id}`,
        label: `Go to ${module.name}`,
        description: module.description,
        icon: getIcon(module.icon),
        category: 'navigation',
        keywords: [
          module.name.toLowerCase(),
          module.shortName?.toLowerCase() || '',
          module.path.replace('/', ''),
        ].filter(Boolean),
        action: () => router.push(module.path),
        requiredPermissions: module.requiredPermissions,
      });
    });

    // Quick actions
    if (hasModuleAccess('proposal-management', userPermissions)) {
      cmds.push({
        id: 'create-proposal',
        label: 'Create New Proposal',
        description: 'Start a new proposal',
        icon: <AddIcon />,
        category: 'action',
        keywords: ['new', 'proposal', 'create', 'add'],
        action: () => router.push('/proposals/new'),
      });

      cmds.push({
        id: 'create-enquiry',
        label: 'Create New Enquiry',
        description: 'Log a new customer enquiry',
        icon: <AddIcon />,
        category: 'action',
        keywords: ['new', 'enquiry', 'create', 'add', 'customer'],
        action: () => router.push('/proposals/enquiries/new'),
      });
    }

    if (hasModuleAccess('procurement', userPermissions)) {
      cmds.push({
        id: 'create-pr',
        label: 'Create Purchase Request',
        description: 'Submit a new purchase request',
        icon: <AddIcon />,
        category: 'action',
        keywords: ['new', 'purchase', 'request', 'pr', 'create', 'add'],
        action: () => router.push('/procurement/purchase-requests/new'),
      });

      cmds.push({
        id: 'create-rfq',
        label: 'Create RFQ',
        description: 'Create a request for quotation',
        icon: <AddIcon />,
        category: 'action',
        keywords: ['new', 'rfq', 'quotation', 'create', 'add'],
        action: () => router.push('/procurement/rfqs/new'),
      });

      cmds.push({
        id: 'create-po',
        label: 'Create Purchase Order',
        description: 'Create a new purchase order',
        icon: <AddIcon />,
        category: 'action',
        keywords: ['new', 'purchase', 'order', 'po', 'create', 'add'],
        action: () => router.push('/procurement/pos/new'),
      });
    }

    if (hasModuleAccess('time-tracking', userPermissions)) {
      cmds.push({
        id: 'log-time',
        label: 'Log Time Entry',
        description: 'Record time spent on a task',
        icon: <ScheduleIcon />,
        category: 'action',
        keywords: ['time', 'log', 'entry', 'track', 'hours'],
        action: () => router.push('/flow'),
      });
    }

    if (hasModuleAccess('document-management', userPermissions)) {
      cmds.push({
        id: 'upload-document',
        label: 'Upload Document',
        description: 'Upload a new document',
        icon: <DescriptionIcon />,
        category: 'action',
        keywords: ['upload', 'document', 'file', 'add'],
        action: () => router.push('/documents'),
      });
    }

    // Entity management
    if (hasModuleAccess('entity-management', userPermissions)) {
      cmds.push({
        id: 'create-entity',
        label: 'Create New Entity',
        description: 'Add a vendor, customer, or partner',
        icon: <BusinessIcon />,
        category: 'action',
        keywords: ['new', 'entity', 'vendor', 'customer', 'partner', 'create', 'add'],
        action: () => router.push('/entities/new'),
      });
    }

    // Project management
    if (hasModuleAccess('project-management', userPermissions)) {
      cmds.push({
        id: 'create-project',
        label: 'Create New Project',
        description: 'Start a new project',
        icon: <FolderIcon />,
        category: 'action',
        keywords: ['new', 'project', 'create', 'add'],
        action: () => router.push('/projects/new'),
      });
    }

    return cmds;
  }, [router, userPermissions]);

  /**
   * Filter commands based on query
   */
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }

    const lowerQuery = query.toLowerCase().trim();
    const queryParts = lowerQuery.split(/\s+/);

    return commands
      .map((cmd) => {
        // Calculate relevance score
        let score = 0;

        // Exact match in label
        if (cmd.label.toLowerCase().includes(lowerQuery)) {
          score += 100;
        }

        // Word matches in label
        const labelWords = cmd.label.toLowerCase().split(/\s+/);
        queryParts.forEach((qp) => {
          if (labelWords.some((lw) => lw.startsWith(qp))) {
            score += 50;
          }
        });

        // Keyword matches
        cmd.keywords.forEach((kw) => {
          if (kw.includes(lowerQuery)) {
            score += 30;
          }
          queryParts.forEach((qp) => {
            if (kw.startsWith(qp)) {
              score += 20;
            }
          });
        });

        // Description match
        if (cmd.description?.toLowerCase().includes(lowerQuery)) {
          score += 10;
        }

        return { ...cmd, score };
      })
      .filter((cmd) => cmd.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [commands, query]);

  /**
   * Group commands by category
   */
  const groupedCommands = useMemo(() => {
    const groups: Record<'action' | 'navigation' | 'search', typeof filteredCommands> = {
      action: [],
      navigation: [],
      search: [],
    };

    filteredCommands.forEach((cmd) => {
      if (groups[cmd.category]) {
        groups[cmd.category].push(cmd);
      }
    });

    return groups;
  }, [filteredCommands]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  /**
   * Reset state when opening
   */
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after dialog animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  /**
   * Scroll selected item into view
   */
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-command-item]');
      const selectedItem = items[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  /**
   * Render command item
   */
  const renderCommand = (
    cmd: Command & { score?: number },
    _index: number,
    globalIndex: number
  ) => (
    <ListItem key={cmd.id} disablePadding data-command-item>
      <ListItemButton
        selected={globalIndex === selectedIndex}
        onClick={() => {
          cmd.action();
          onClose();
        }}
        sx={{
          borderRadius: 1,
          mx: 1,
          '&.Mui-selected': {
            bgcolor: 'action.selected',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>{cmd.icon}</ListItemIcon>
        <ListItemText
          primary={cmd.label}
          secondary={cmd.description}
          primaryTypographyProps={{ variant: 'body2' }}
          secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
        />
        {cmd.shortcut && (
          <Chip
            label={cmd.shortcut}
            size="small"
            variant="outlined"
            sx={{ ml: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}
          />
        )}
      </ListItemButton>
    </ListItem>
  );

  let globalIndex = -1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          top: '15%',
          m: 0,
          borderRadius: 2,
          maxHeight: '70vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            ref={inputRef}
            fullWidth
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Chip
                    label="ESC"
                    size="small"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                  />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'divider',
                },
              },
            }}
          />
        </Box>

        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          <List ref={listRef} dense>
            {/* Quick Actions */}
            {groupedCommands.action.length > 0 && (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 2, py: 1, display: 'block' }}
                >
                  Quick Actions
                </Typography>
                {groupedCommands.action.map((cmd, index) => {
                  globalIndex++;
                  return renderCommand(cmd, index, globalIndex);
                })}
                <Divider sx={{ my: 1 }} />
              </>
            )}

            {/* Navigation */}
            {groupedCommands.navigation.length > 0 && (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ px: 2, py: 1, display: 'block' }}
                >
                  Navigation
                </Typography>
                {groupedCommands.navigation.map((cmd, index) => {
                  globalIndex++;
                  return renderCommand(cmd, index, globalIndex);
                })}
              </>
            )}

            {/* No results */}
            {filteredCommands.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No commands found for &quot;{query}&quot;
                </Typography>
              </Box>
            )}
          </List>
        </Box>

        {/* Footer with keyboard hints */}
        <Divider />
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            p: 1.5,
            bgcolor: 'action.hover',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label="↑↓" size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
            <Typography variant="caption" color="text.secondary">
              Navigate
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label="↵" size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
            <Typography variant="caption" color="text.secondary">
              Select
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label="ESC" size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
            <Typography variant="caption" color="text.secondary">
              Close
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook for keyboard shortcuts to open command palette
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    open,
    setOpen,
    toggle: () => setOpen((prev) => !prev),
    close: () => setOpen(false),
  };
}
