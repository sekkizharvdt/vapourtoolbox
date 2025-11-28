'use client';

/**
 * Sidebar Navigation Component
 *
 * Categorized navigation with collapsible state
 * Optimized with useMemo for filtered modules
 */

import { useMemo, useCallback, memo } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  BusinessCenter as BusinessCenterIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  ShoppingCart as ShoppingCartIcon,
  AccountBalance as AccountBalanceIcon,
  Calculate as CalculateIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Inventory as InventoryIcon,
  LocalShipping as LocalShippingIcon,
  Thermostat as ThermostatIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { MODULES } from '@vapour/constants';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  userPermissions?: number;
  allowedModules?: string[]; // Module IDs user can access (empty = all modules)
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const SIDEBAR_WIDTH = 240;
const SIDEBAR_WIDTH_COLLAPSED = 64;

// Map module IDs to icons
const moduleIcons: Record<string, React.ReactNode> = {
  'user-management': <PeopleIcon />,
  'entity-management': <BusinessIcon />,
  'project-management': <AssignmentIcon />,
  'company-settings': <BusinessCenterIcon />,
  'time-tracking': <ScheduleIcon />,
  'document-management': <DescriptionIcon />,
  procurement: <ShoppingCartIcon />,
  accounting: <AccountBalanceIcon />,
  estimation: <CalculateIcon />,
  'material-database': <InventoryIcon />,
  'shape-database': <CalculateIcon />,
  'bought-out-database': <LocalShippingIcon />,
  'thermal-desal': <ThermostatIcon />,
  'proposal-management': <AssignmentIcon />,
};

// Category definitions for sidebar organization
interface CategoryConfig {
  id: string;
  label: string;
  moduleIds: string[];
}

const SIDEBAR_CATEGORIES: CategoryConfig[] = [
  {
    // 1. Execution Cycle - Daily, most frequent operations
    id: 'execution-cycle',
    label: 'EXECUTION CYCLE',
    moduleIds: [
      'project-management', // Project Charter
      'procurement', // PR → RFQ → PO → GR
      'accounting', // Financial tracking
      'document-management', // Supporting documents
      'time-tracking', // Daily time entries
    ],
  },
  {
    // 2. Sales Cycle - Weekly/as-needed
    id: 'sales-cycle',
    label: 'SALES CYCLE',
    moduleIds: [
      'proposal-management', // Enquiry → Proposal
      'estimation', // Cost estimation for proposals
      'thermal-desal', // Specialized estimations
    ],
  },
  {
    // 3. Setup Phase - One-time/infrequent, bottom of sidebar
    id: 'setup',
    label: 'SETUP',
    moduleIds: [
      'user-management',
      'entity-management',
      'material-database',
      'shape-database',
      'bought-out-database',
      'company-settings',
    ],
  },
];

function SidebarComponent({
  mobileOpen,
  onMobileClose,
  userPermissions = 0,
  allowedModules,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Memoize accessible modules to avoid recalculation on every render
  const accessibleModules = useMemo(() => {
    return Object.values(MODULES).filter((module) => {
      // Include both active and coming_soon modules
      if (module.status !== 'active' && module.status !== 'coming_soon') return false;

      // Check module visibility (if allowedModules is set, must include this module)
      // Empty array or undefined means all modules are accessible
      if (allowedModules && allowedModules.length > 0) {
        if (!allowedModules.includes(module.id)) return false;
      }

      // If no permission required, accessible by all (visibility check already passed)
      if (module.requiredPermissions === undefined) return true;

      // Check if user has required permissions using bitwise AND
      return (userPermissions & module.requiredPermissions) === module.requiredPermissions;
    });
  }, [userPermissions, allowedModules]);

  // Memoize modules grouped by category
  const modulesByCategory = useMemo(() => {
    return SIDEBAR_CATEGORIES.map((category) => ({
      ...category,
      modules: accessibleModules.filter((module) => category.moduleIds.includes(module.id)),
    })).filter((category) => category.modules.length > 0);
  }, [accessibleModules]);

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
      if (isMobile) {
        onMobileClose();
      }
    },
    [router, isMobile, onMobileClose]
  );

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo Header */}
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 0 : 2,
        }}
      >
        {collapsed ? (
          <Box
            sx={{
              width: 40,
              height: 40,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="VDT Logo"
              width={32}
              height={32}
              style={{ objectFit: 'contain' }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              height: 48,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Vapour Toolbox Logo"
              width={150}
              height={40}
              style={{ objectFit: 'contain' }}
            />
          </Box>
        )}
      </Toolbar>
      <Divider />

      {/* Categorized Module List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {modulesByCategory.map((category, index) => (
          <Box key={category.id}>
            <List disablePadding sx={{ py: 1 }}>
              {/* Category Header */}
              {!collapsed && (
                <ListItem disablePadding>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      px: 2,
                      py: 1,
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                    }}
                  >
                    {category.label}
                  </Typography>
                </ListItem>
              )}

              {/* Module Items */}
              {category.modules.map((module) => (
                <ListItem key={module.id} disablePadding>
                  <Tooltip
                    title={
                      collapsed
                        ? module.status === 'coming_soon'
                          ? `${module.name} (${module.estimatedRelease})`
                          : module.name
                        : ''
                    }
                    placement="right"
                  >
                    <ListItemButton
                      selected={pathname.startsWith(module.path)}
                      onClick={() =>
                        module.status === 'active' ? handleNavigation(module.path) : undefined
                      }
                      disabled={module.status === 'coming_soon'}
                      sx={{
                        justifyContent: collapsed ? 'center' : 'initial',
                        px: collapsed ? 0 : 2,
                        minHeight: 48,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: collapsed ? 0 : 3,
                          justifyContent: 'center',
                          opacity: module.status === 'coming_soon' ? 0.5 : 1,
                        }}
                      >
                        {moduleIcons[module.id]}
                      </ListItemIcon>
                      {!collapsed && (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ListItemText
                            primary={module.name}
                            primaryTypographyProps={{
                              fontSize: '0.875rem',
                            }}
                          />
                          {module.status === 'coming_soon' && (
                            <Chip
                              label={module.estimatedRelease}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                color: 'primary.main',
                                borderColor: 'primary.main',
                                '& .MuiChip-label': {
                                  px: 0.75,
                                },
                              }}
                            />
                          )}
                        </Box>
                      )}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              ))}
            </List>

            {/* Add divider between categories except after the last one */}
            {index < modulesByCategory.length - 1 && <Divider sx={{ my: 0 }} />}
          </Box>
        ))}
      </Box>

      {/* Toggle Button */}
      <Divider />
      <Box sx={{ p: 1, display: { xs: 'none', md: 'block' } }}>
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <IconButton
            onClick={onToggleCollapse}
            sx={{
              width: '100%',
              borderRadius: 1,
            }}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  const drawerWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: SIDEBAR_WIDTH,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            transition: (theme) =>
              theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            overflowX: 'hidden',
            willChange: 'width',
            backfaceVisibility: 'hidden',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  );
}

// Memoize the Sidebar component
export const Sidebar = memo(SidebarComponent);
