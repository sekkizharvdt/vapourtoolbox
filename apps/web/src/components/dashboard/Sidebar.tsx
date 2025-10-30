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
  Folder as FolderIcon,
  Settings as SettingsIcon,
  AccessTime as AccessTimeIcon,
  AccountBalance as AccountBalanceIcon,
  ShoppingCart as ShoppingCartIcon,
  Calculate as CalculateIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
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
  'project-management': <FolderIcon />,
  'company-settings': <SettingsIcon />,
  'time-tracking': <AccessTimeIcon />,
  'accounting': <AccountBalanceIcon />,
  'procurement': <ShoppingCartIcon />,
  'estimation': <CalculateIcon />,
};

export function Sidebar({ mobileOpen, onMobileClose, userRoles = [], collapsed, onToggleCollapse }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Filter modules based on user roles
  const accessibleModules = Object.values(MODULES).filter((module) => {
    if (module.status !== 'active') return false;
    if (module.roles === 'ALL') return true;
    return module.roles.some((role) => userRoles.includes(role as UserRole));
  });

  // Separate core and application modules
  const coreModules = accessibleModules.filter((m) =>
    ['user-management', 'entity-management', 'project-management', 'company-settings'].includes(
      m.id
    )
  );
  const appModules = accessibleModules.filter(
    (m) =>
      !['user-management', 'entity-management', 'project-management', 'company-settings'].includes(
        m.id
      )
  );

  const handleNavigation = (path: string) => {
    router.push(path);
    if (isMobile) {
      onMobileClose();
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        {!collapsed && (
          <Typography variant="h6" noWrap component="div">
            Vapour Toolbox
          </Typography>
        )}
      </Toolbar>
      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {/* Core Modules */}
        {coreModules.length > 0 && (
          <>
            <List>
              {!collapsed && (
                <ListItem>
                  <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
                    CORE MODULES
                  </Typography>
                </ListItem>
              )}
              {coreModules.map((module) => (
                <ListItem key={module.id} disablePadding>
                  <Tooltip title={collapsed ? module.name : ''} placement="right">
                    <ListItemButton
                      selected={pathname === module.path}
                      onClick={() => handleNavigation(module.path)}
                      sx={{
                        justifyContent: collapsed ? 'center' : 'initial',
                        px: collapsed ? 0 : 2,
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
                      {!collapsed && <ListItemText primary={module.name} />}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              ))}
            </List>
            <Divider />
          </>
        )}

        {/* Application Modules */}
        {appModules.length > 0 && (
          <List>
            {!collapsed && (
              <ListItem>
                <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
                  APPLICATIONS
                </Typography>
              </ListItem>
            )}
            {appModules.map((module) => (
              <ListItem key={module.id} disablePadding>
                <Tooltip title={collapsed ? module.name : ''} placement="right">
                  <ListItemButton
                    selected={pathname === module.path}
                    onClick={() => handleNavigation(module.path)}
                    sx={{
                      justifyContent: collapsed ? 'center' : 'initial',
                      px: collapsed ? 0 : 2,
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
                    {!collapsed && <ListItemText primary={module.name} />}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        )}
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
            transition: (theme) => theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  );
}
