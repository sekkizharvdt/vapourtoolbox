'use client';

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
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import type { UserRole } from '@vapour/types';
import { MODULES } from '@vapour/constants';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  userRoles?: UserRole[];
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
  'procurement': <ShoppingCartIcon />,
  'accounting': <AccountBalanceIcon />,
  'estimation': <CalculateIcon />,
};

// Category definitions for sidebar organization
interface CategoryConfig {
  id: string;
  label: string;
  moduleIds: string[];
}

const SIDEBAR_CATEGORIES: CategoryConfig[] = [
  {
    id: 'priority',
    label: 'PRIORITY APPS',
    moduleIds: ['time-tracking', 'document-management', 'procurement'],
  },
  {
    id: 'operations',
    label: 'OPERATIONS',
    moduleIds: ['accounting', 'estimation'],
  },
  {
    id: 'management',
    label: 'MANAGEMENT',
    moduleIds: ['project-management', 'entity-management', 'user-management'],
  },
  {
    id: 'admin',
    label: 'ADMIN',
    moduleIds: ['company-settings'],
  },
];

export function Sidebar({
  mobileOpen,
  onMobileClose,
  userRoles = [],
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Filter modules based on user roles and active status
  const accessibleModules = Object.values(MODULES).filter((module) => {
    if (module.status !== 'active') return false;
    if (module.roles === 'ALL') return true;
    return module.roles.some((role) => userRoles.includes(role as UserRole));
  });

  // Group modules by category
  const modulesByCategory = SIDEBAR_CATEGORIES.map((category) => ({
    ...category,
    modules: accessibleModules.filter((module) => category.moduleIds.includes(module.id)),
  })).filter((category) => category.modules.length > 0); // Only show categories with accessible modules

  const handleNavigation = (path: string) => {
    router.push(path);
    if (isMobile) {
      onMobileClose();
    }
  };

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
            <Image src="/logo.png" alt="VDT Logo" width={32} height={32} style={{ objectFit: 'contain' }} />
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
          <Box key={category.id}>
            <List>
              {/* Category Header */}
              {!collapsed && (
                <ListItem>
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
                  <Tooltip title={collapsed ? module.name : ''} placement="right">
                    <ListItemButton
                      selected={pathname.startsWith(module.path)}
                      onClick={() => handleNavigation(module.path)}
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
                        }}
                      >
                        {moduleIcons[module.id]}
                      </ListItemIcon>
                      {!collapsed && (
                        <ListItemText
                          primary={module.name}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                          }}
                        />
                      )}
                      {/* Lock icon for company settings (to be shown after setup complete) */}
                      {/* TODO: Enable after setup complete feature is implemented */}
                      {/* {!collapsed && module.id === 'company-settings' && (
                        <Tooltip title="Setup complete - Admin access only">
                          <LockIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 1 }} />
                        </Tooltip>
                      )} */}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              ))}
            </List>

            {/* Add divider between categories except after the last one */}
            {index < modulesByCategory.length - 1 && <Divider />}
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
