'use client';

import {
  AppBar as MuiAppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Home as HomeIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { ThemeToggle } from '@vapour/ui';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardAppBarProps {
  onMenuClick: () => void;
  sidebarWidth: number;
  onCommandPaletteOpen?: () => void;
}

export function DashboardAppBar({
  onMenuClick,
  sidebarWidth,
  onCommandPaletteOpen,
}: DashboardAppBarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    handleClose();
    router.push('/dashboard/profile');
  };

  const handleSettings = () => {
    handleClose();
    router.push('/dashboard/settings');
  };

  const handleLogout = async () => {
    handleClose();
    await signOut();
    router.push('/login');
  };

  const handleHome = () => {
    router.push('/dashboard');
  };

  return (
    <MuiAppBar
      position="fixed"
      sx={{
        width: { xs: '100%', md: `calc(100% - ${sidebarWidth}px)` },
        ml: { xs: 0, md: `${sidebarWidth}px` },
        zIndex: (theme) => theme.zIndex.drawer + 1,
        transition: (theme) =>
          theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          Vapour Toolbox
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Command Palette Trigger */}
          {onCommandPaletteOpen && (
            <Box
              onClick={onCommandPaletteOpen}
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                bgcolor: 'rgba(255,255,255,0.1)',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <SearchIcon fontSize="small" />
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Search...
              </Typography>
              <Box
                component="span"
                sx={{
                  ml: 1,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                }}
              >
                ⌘K
              </Box>
            </Box>
          )}

          {/* Mobile search button */}
          {onCommandPaletteOpen && (
            <IconButton
              color="inherit"
              onClick={onCommandPaletteOpen}
              sx={{ display: { xs: 'flex', sm: 'none' } }}
              title="Search (Cmd+K)"
            >
              <SearchIcon />
            </IconButton>
          )}

          <IconButton color="inherit" onClick={handleHome} title="Home / Dashboard">
            <HomeIcon />
          </IconButton>

          <ThemeToggle />

          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>

          <IconButton onClick={handleMenu} color="inherit">
            {user?.photoURL ? (
              <Avatar
                src={user.photoURL}
                alt={user.displayName || ''}
                sx={{ width: 32, height: 32 }}
              />
            ) : (
              <AccountCircleIcon />
            )}
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleProfile}>Profile</MenuItem>
            <MenuItem onClick={handleSettings}>Settings</MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </MuiAppBar>
  );
}
