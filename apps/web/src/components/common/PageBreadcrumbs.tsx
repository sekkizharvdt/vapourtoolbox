'use client';

import { Breadcrumbs, Link, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

export interface BreadcrumbItem {
  /** Text shown in the breadcrumb */
  label: string;
  /** If omitted, the item renders as plain text (used for the current page) */
  href?: string;
  /** Optional leading icon (e.g. HomeIcon on the first crumb) */
  icon?: ReactNode;
}

export interface PageBreadcrumbsProps {
  items: BreadcrumbItem[];
  sx?: SxProps<Theme>;
}

/**
 * Shared breadcrumb component.
 *
 * Breadcrumbs are layout-owned: a page inside a route tree whose layout already
 * renders breadcrumbs (e.g. `/admin/*` via admin/layout.tsx, or a project
 * sub-page via ProjectSubPageWrapper) MUST NOT render its own. See
 * UI-STANDARDS rule 5.4.
 *
 * The last item in `items` is rendered as plain Typography (non-clickable,
 * emphasised) regardless of whether `href` is set.
 */
export function PageBreadcrumbs({ items, sx }: PageBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2, ...sx }}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const key = `${item.label}-${index}`;

        if (isLast || !item.href) {
          return (
            <Typography
              key={key}
              color="text.primary"
              fontWeight="medium"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              {item.icon}
              {item.label}
            </Typography>
          );
        }

        return (
          <Link
            key={key}
            component={NextLink}
            href={item.href}
            underline="hover"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
