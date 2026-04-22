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

import { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
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
  Collapse,
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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Timeline as TimelineIcon,
  EventNote as EventNoteIcon,
  MiscellaneousServices as ServicesIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
// NOTE: Using <img> instead of next/image because app uses output: 'export'
// for static Firebase Hosting. next/image requires /_next/image endpoint
// which is not available in static exports. DO NOT change to Image component.
import { MODULES, PERMISSION_FLAGS, hasPermission, hasPermission2 } from '@vapour/constants';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  userPermissions?: number;
  userPermissions2?: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Per-module pending-count map keyed by module id. Zero or missing = no badge. */
  moduleBadges?: Record<string, number>;
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
  'service-catalog': <ServicesIcon />,
  'material-database': <InventoryIcon />,
  'shape-database': <CalculateIcon />,
  'bought-out-database': <LocalShippingIcon />,
  'entity-management': <BusinessIcon />,
  'hr-management': <PeopleIcon />,
  // Admin section
  admin: <AdminIcon />,
  'admin-users': <PeopleIcon />,
  'admin-company': <SettingsIcon />,
  'admin-feedback': <FeedbackIcon />,
  'admin-audit': <AuditIcon />,
};

// Admin sub-navigation items (shown when sidebar is expanded)
interface AdminSubItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const ADMIN_SUB_ITEMS: AdminSubItem[] = [
  { id: 'users', label: 'Users', path: '/admin/users', icon: <PeopleIcon /> },
  { id: 'feedback', label: 'Feedback', path: '/admin/feedback', icon: <FeedbackIcon /> },
  { id: 'activity', label: 'Activity', path: '/admin/activity', icon: <TimelineIcon /> },
  { id: 'audit-logs', label: 'Audit Logs', path: '/admin/audit-logs', icon: <AuditIcon /> },
  { id: 'hr-setup', label: 'HR Setup', path: '/admin/hr-setup', icon: <EventNoteIcon /> },
  { id: 'settings', label: 'Settings', path: '/admin/settings', icon: <SettingsIcon /> },
];

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
      'service-catalog', // Service Catalog - open to all
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
      'hr-management', // HR & Leave - open to all users
      'document-management', // Company Documents - SOPs, policies, templates
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
  moduleBadges = {},
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAdminPath = pathname.startsWith('/admin');
  const [adminExpanded, setAdminExpanded] = useState(isAdminPath);

  // Per-category collapse state, persisted to localStorage. A category id in
  // the set means that category is collapsed. Users with narrow module access
  // can tuck away categories they don't use.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = window.localStorage.getItem('sidebar-collapsed-categories');
      return new Set(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const toggleCategory = useCallback((id: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem('sidebar-collapsed-categories', JSON.stringify([...next]));
      } catch {
        // localStorage unavailable (private mode etc) — persistence is best-effort
      }
      return next;
    });
  }, []);

  // Auto-expand admin sub-menu when navigating to admin paths
  useEffect(() => {
    if (pathname.startsWith('/admin') && !collapsed) {
      setAdminExpanded(true);
    }
  }, [pathname, collapsed]);

  // Arrow-key navigation among focusable items (ListItemButton elements).
  // Home/End jump to first/last. Leaves Tab/Enter/Space/Escape to MUI defaults.
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { key } = event;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('button.MuiListItemButton-root:not(.Mui-disabled)')
    );
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? items.indexOf(active) : -1;
    let nextIndex = currentIndex;
    if (key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    else if (key === 'ArrowUp')
      nextIndex =
        currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    else if (key === 'Home') nextIndex = 0;
    else if (key === 'End') nextIndex = items.length - 1;
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  }, []);

  // Persist sidebar scroll position across navigation
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Restore scroll position on mount
    const savedPosition = sessionStorage.getItem('sidebar-scroll');
    if (savedPosition) {
      container.scrollTop = parseInt(savedPosition, 10);
    }

    // Save scroll position on scroll
    const handleScroll = () => {
      sessionStorage.setItem('sidebar-scroll', String(container.scrollTop));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
          justifyContent: collapsed ? 'center' : 'space-between',
          px: collapsed ? 0 : 2,
          gap: 1,
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
              flex: 1,
              minWidth: 0,
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
        {/* Mobile-only close button — on desktop the drawer doesn't close */}
        {!collapsed && isMobile && (
          <IconButton
            aria-label="Close navigation menu"
            onClick={onMobileClose}
            size="small"
            sx={{ flexShrink: 0 }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />

      {/* Categorized Module List */}
      <Box
        ref={scrollContainerRef}
        onKeyDown={handleKeyDown}
        role="navigation"
        aria-label="Primary"
        sx={{ flexGrow: 1, overflowY: 'auto' }}
      >
        {modulesByCategory.map((category, index) => {
          const isCategoryCollapsed = collapsedCategories.has(category.id);
          return (
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
                {/* Category Header — clickable to collapse/expand the group */}
                {!collapsed && (
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => toggleCategory(category.id)}
                      sx={{ py: 0.5, px: 2 }}
                      aria-expanded={!isCategoryCollapsed}
                      aria-label={`${isCategoryCollapsed ? 'Expand' : 'Collapse'} ${category.label} group`}
                    >
                      <Typography
                        variant="caption"
                        color={category.isAdmin ? 'primary.main' : 'text.secondary'}
                        sx={{
                          flex: 1,
                          py: 0.5,
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                        }}
                      >
                        {category.label}
                      </Typography>
                      {isCategoryCollapsed ? (
                        <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      ) : (
                        <ExpandLessIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      )}
                    </ListItemButton>
                  </ListItem>
                )}

                {/* Module Items — wrapped in Collapse. When the sidebar is in
                  icon-only collapsed mode, ignore category collapse (icons are
                  always shown so users can still find modules). */}
                <Collapse in={collapsed || !isCategoryCollapsed} timeout="auto" unmountOnExit>
                  {category.modules.map((module) => {
                    const isSelected = pathname.startsWith(module.path);
                    const badgeCount = moduleBadges[module.id] ?? 0;
                    const showBadge = badgeCount > 0 && !collapsed;

                    return (
                      <ListItem
                        key={module.id}
                        disablePadding
                        sx={module.status === 'coming_soon' ? { cursor: 'not-allowed' } : undefined}
                      >
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
                            onClick={() => {
                              if (module.id === 'admin' && !collapsed) {
                                setAdminExpanded((prev) => !prev);
                                handleNavigation(module.path);
                              } else if (module.status === 'active') {
                                handleNavigation(module.path);
                              }
                            }}
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
                                {collapsed && badgeCount > 0 ? (
                                  <Badge badgeContent={badgeCount} color="error" max={99}>
                                    {moduleIcons[module.id]}
                                  </Badge>
                                ) : collapsed && module.status === 'coming_soon' ? (
                                  <Badge
                                    variant="dot"
                                    color="primary"
                                    overlap="circular"
                                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                                  >
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
                                  {/* Prefer explicit collapsedLabel; fall back to first word of name */}
                                  {module.collapsedLabel || module.name.split(' ')[0]}
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
                                    label={badgeCount}
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
                                {module.id === 'admin' &&
                                  (adminExpanded ? (
                                    <ExpandLessIcon
                                      fontSize="small"
                                      sx={{ color: 'text.secondary' }}
                                    />
                                  ) : (
                                    <ExpandMoreIcon
                                      fontSize="small"
                                      sx={{ color: 'text.secondary' }}
                                    />
                                  ))}
                              </Box>
                            )}
                          </ListItemButton>
                        </Tooltip>
                      </ListItem>
                    );
                  })}

                  {/* Admin sub-navigation */}
                  {category.isAdmin && !collapsed && (
                    <Collapse in={adminExpanded} timeout="auto" unmountOnExit>
                      {ADMIN_SUB_ITEMS.map((subItem) => (
                        <ListItem key={subItem.id} disablePadding>
                          <ListItemButton
                            selected={
                              pathname === subItem.path || pathname.startsWith(subItem.path + '/')
                            }
                            onClick={() => handleNavigation(subItem.path)}
                            sx={{ pl: 4, py: 0.5, minHeight: 36 }}
                          >
                            <ListItemIcon sx={{ minWidth: 28, color: 'primary.main' }}>
                              {subItem.id === 'feedback' && (moduleBadges.admin ?? 0) > 0 ? (
                                <Badge badgeContent={moduleBadges.admin} color="error" max={99}>
                                  {subItem.icon}
                                </Badge>
                              ) : (
                                subItem.icon
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={subItem.label}
                              primaryTypographyProps={{ fontSize: '0.8rem' }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </Collapse>
                  )}
                </Collapse>
              </List>

              {/* Add divider between categories except after the last one and before admin */}
              {index < modulesByCategory.length - 1 && !modulesByCategory[index + 1]?.isAdmin && (
                <Divider sx={{ my: 0 }} />
              )}
            </Box>
          );
        })}
      </Box>

      {/* ⌘K discovery hint — only when expanded (desktop only; mobile users don't have a keyboard) */}
      {!collapsed && (
        <Box sx={{ px: 2, py: 1, display: { xs: 'none', md: 'block' } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              fontSize: '0.7rem',
            }}
          >
            Press
            <Box
              component="kbd"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                px: 0.75,
                py: 0.1,
                borderRadius: 0.5,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              ⌘K
            </Box>
            to search
          </Typography>
        </Box>
      )}

      {/* Toggle Button */}
      <Divider />
      <Box sx={{ p: 1, display: { xs: 'none', md: 'block' } }}>
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <IconButton
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
