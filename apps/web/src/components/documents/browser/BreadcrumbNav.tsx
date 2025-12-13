'use client';

/**
 * BreadcrumbNav Component
 *
 * Displays the current folder path as clickable breadcrumbs
 */

import { memo, useCallback } from 'react';
import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import {
  Home as HomeIcon,
  Folder as FolderIcon,
  Description as DocumentIcon,
  Business as BusinessIcon,
  AccountTree as ProjectIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import type { BreadcrumbSegment } from '@vapour/types';

interface BreadcrumbNavProps {
  breadcrumbs: BreadcrumbSegment[];
  onNavigate: (path: string) => void;
}

const getIcon = (type: BreadcrumbSegment['type']) => {
  switch (type) {
    case 'module':
      return <HomeIcon sx={{ fontSize: 18, mr: 0.5 }} />;
    case 'project':
      return <ProjectIcon sx={{ fontSize: 18, mr: 0.5 }} />;
    case 'entityType':
      return <FolderIcon sx={{ fontSize: 18, mr: 0.5 }} />;
    case 'entity':
      return <BusinessIcon sx={{ fontSize: 18, mr: 0.5 }} />;
    case 'folder':
      return <FolderIcon sx={{ fontSize: 18, mr: 0.5 }} />;
    default:
      return <DocumentIcon sx={{ fontSize: 18, mr: 0.5 }} />;
  }
};

function BreadcrumbNavComponent({ breadcrumbs, onNavigate }: BreadcrumbNavProps) {
  const handleClick = useCallback(
    (path: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      onNavigate(path);
    },
    [onNavigate]
  );

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{ py: 1, px: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="folder navigation"
        sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' } }}
      >
        {breadcrumbs.map((segment, index) => {
          const isLast = index === breadcrumbs.length - 1;

          if (isLast) {
            return (
              <Typography
                key={segment.path}
                color="text.primary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                {getIcon(segment.type)}
                {segment.label}
              </Typography>
            );
          }

          return (
            <Link
              key={segment.path}
              href="#"
              onClick={handleClick(segment.path)}
              underline="hover"
              color="inherit"
              sx={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
            >
              {getIcon(segment.type)}
              {segment.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}

export const BreadcrumbNav = memo(BreadcrumbNavComponent);
