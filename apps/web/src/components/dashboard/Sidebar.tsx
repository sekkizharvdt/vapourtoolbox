'use client';

/**
 * Sidebar Navigation Component
 *
 * Categorized navigation with collapsible state.
 * Categories:
 * - Daily Operations (Flow, Documents, Projects)
 * - Sales & Estimation (Proposals, Estimation, Thermal Calcs)
 * - Procurement & Finance (Procurement, Accounting)
 * - Engineering Data (Thermal Desal, Process Data, Material/Shape/Bought Out DBs)
 * - Setup (Entity Management)
 * - Administration (visible to admins only)
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
  Badge,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
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
  Storage as StorageIcon,
  AdminPanelSettings as AdminIcon,
  Settings as SettingsIcon,
  Feedback as FeedbackIcon,
  History as AuditIcon,
  RequestQuote as RequestQuoteIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { MODULES, PERMISSION_FLAGS, hasPermission, hasPermission2 } from '@vapour/constants';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  userPermissions?: number;
  userPermissions2?: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  feedbackCount?: number; // Optional: for showing pending feedback badge
}

const SIDEBAR_WIDTH = 240;
const SIDEBAR_WIDTH_COLLAPSED = 80; // Widened from 64 to accommodate labels

// Map module IDs to icons
const moduleIcons: Record<string, React.ReactNode> = {
  'time-tracking': <ScheduleIcon />,
  'document-management': <DescriptionIcon />,
  'project-management': <AssignmentIcon />,
  'proposal-management': <RequestQuoteIcon />,
  estimation: <CalculateIcon />,
  'thermal-calcs': <CalculateIcon />,
  procurement: <ShoppingCartIcon />,
  accounting: <AccountBalanceIcon />,
  'thermal-desal': <ThermostatIcon />,
  'process-data': <StorageIcon />,
  'material-database': <InventoryIcon />,
  'shape-database': <CalculateIcon />,
  'bought-out-database': <LocalShippingIcon />,
  'entity-management': <BusinessIcon />,
  // Admin section
  admin: <AdminIcon />,
  'admin-users': <PeopleIcon />,
  'admin-company': <SettingsIcon />,
  'admin-feedback': <FeedbackIcon />,
  'admin-audit': <AuditIcon />,
};

// Category definitions for sidebar organization
interface CategoryConfig {
  id: string;
  label: string;
  moduleIds: string[];
  /** If set, requires this permission to see the category */
  requiredPermission?: number;
  /** If true, category is visually distinct (for Admin) */
  isAdmin?: boolean;
}

const SIDEBAR_CATEGORIES: CategoryConfig[] = [
  {
    id: 'daily-ops',
    label: 'DAILY OPERATIONS',
    moduleIds: [
      'time-tracking', // Flow - open to all
      'document-management', // Documents - open to all
      'project-management', // Projects - requires VIEW_PROJECTS
    ],
  },
  {
    id: 'sales',
    label: 'SALES & ESTIMATION',
    moduleIds: [
      'proposal-management', // Proposals - requires VIEW_PROPOSALS
      'estimation', // Estimation - open to all
      'thermal-calcs', // Thermal Calculators - open to all
    ],
  },
  {
    id: 'finance',
    label: 'PROCUREMENT & FINANCE',
    moduleIds: [
      'procurement', // Procurement - requires VIEW_PROCUREMENT
      'accounting', // Accounting - requires VIEW_ACCOUNTING
    ],
  },
  {
    id: 'engineering',
    label: 'ENGINEERING DATA',
    moduleIds: [
      'thermal-desal', // Thermal Desal Design - requires VIEW_THERMAL_DESAL (permissions2)
      'process-data', // Process Data - shares VIEW_THERMAL_DESAL
      'material-database', // Material DB - open to all
      'shape-database', // Shape DB - open to all
      'bought-out-database', // Bought Out DB - open to all
    ],
  },
  {
    id: 'setup',
    label: 'SETUP',
    moduleIds: [
      'entity-management', // Entities - requires VIEW_ENTITIES
    ],
  },
  {
    id: 'admin',
    label: 'ADMINISTRATION',
    moduleIds: ['admin'], // Admin module (links to /admin)
    requiredPermission: PERMISSION_FLAGS.MANAGE_USERS,
    isAdmin: true,
  },
];

function SidebarComponent({
  mobileOpen,
  onMobileClose,
  userPermissions = 0,
  userPermissions2 = 0,
  collapsed,
  onToggleCollapse,
  feedbackCount = 0,
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

      // Check requiredPermissions (from permissions field)
      if (module.requiredPermissions !== undefined) {
        if (!hasPermission(userPermissions, module.requiredPermissions)) {
          return false;
        }
      }

      // Check requiredPermissions2 (from permissions2 field)
      if (module.requiredPermissions2 !== undefined) {
        if (!hasPermission2(userPermissions2, module.requiredPermissions2)) {
          return false;
        }
      }

      return true;
    });
  }, [userPermissions, userPermissions2]);

  // Memoize modules grouped by category
  const modulesByCategory = useMemo(() => {
    return SIDEBAR_CATEGORIES.map((category) => {
      // Check category-level permission
      if (category.requiredPermission) {
        if (!hasPermission(userPermissions, category.requiredPermission)) {
          return { ...category, modules: [] };
        }
      }

      const modules = accessibleModules.filter((module) => category.moduleIds.includes(module.id));
      return {
        ...category,
        modules,
      };
    }).filter((category) => category.modules.length > 0);
  }, [accessibleModules, userPermissions]);

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
            <Image
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
            <Image
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
          <Box
            key={category.id}
            sx={
              category.isAdmin
                ? {
                    bgcolor: 'action.hover',
                    borderTop: '2px solid',
                    borderColor: 'primary.main',
                  }
                : {}
            }
          >
            <List disablePadding sx={{ py: 1 }}>
              {/* Category Header */}
              {!collapsed && (
                <ListItem disablePadding>
                  <Typography
                    variant="caption"
                    color={category.isAdmin ? 'primary.main' : 'text.secondary'}
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
              {category.modules.map((module) => {
                const isSelected = pathname.startsWith(module.path);
                const showBadge = module.id === 'admin' && feedbackCount > 0 && !collapsed;

                return (
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
                        selected={isSelected}
                        onClick={() =>
                          module.status === 'active' ? handleNavigation(module.path) : undefined
                        }
                        disabled={module.status === 'coming_soon'}
                        sx={{
                          justifyContent: collapsed ? 'center' : 'initial',
                          px: collapsed ? 0 : 2,
                          py: collapsed ? 0.5 : 0,
                          minHeight: collapsed ? 56 : 48, // Taller when collapsed to fit label
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: collapsed ? 'auto' : 0,
                            mr: collapsed ? 0 : 3,
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 0,
                              justifyContent: 'center',
                              opacity: module.status === 'coming_soon' ? 0.5 : 1,
                              color: category.isAdmin ? 'primary.main' : undefined,
                            }}
                          >
                            {collapsed && feedbackCount > 0 && module.id === 'admin' ? (
                              <Badge badgeContent={feedbackCount} color="error" max={99}>
                                {moduleIcons[module.id]}
                              </Badge>
                            ) : (
                              moduleIcons[module.id]
                            )}
                          </ListItemIcon>
                          {/* Show small label below icon when collapsed */}
                          {collapsed && (
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.6rem',
                                textAlign: 'center',
                                lineHeight: 1.1,
                                mt: 0.25,
                                maxWidth: 70,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                opacity: module.status === 'coming_soon' ? 0.5 : 0.85,
                                color: category.isAdmin ? 'primary.main' : 'text.secondary',
                              }}
                            >
                              {/* Use first word or short name */}
                              {module.name.split(' ')[0]}
                            </Typography>
                          )}
                        </Box>
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
                            {showBadge && (
                              <Chip
                                label={feedbackCount}
                                size="small"
                                color="error"
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  '& .MuiChip-label': {
                                    px: 0.5,
                                  },
                                }}
                              />
                            )}
                          </Box>
                        )}
                      </ListItemButton>
                    </Tooltip>
                  </ListItem>
                );
              })}
            </List>

            {/* Add divider between categories except after the last one and before admin */}
            {index < modulesByCategory.length - 1 && !modulesByCategory[index + 1]?.isAdmin && (
              <Divider sx={{ my: 0 }} />
            )}
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
