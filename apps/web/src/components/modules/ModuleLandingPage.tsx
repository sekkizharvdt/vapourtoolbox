'use client';

/**
 * Standardized Module Landing Page Component
 *
 * Provides consistent UX patterns across all module landing pages:
 * - Consistent card layout (centered vertical with clickable cards)
 * - Consistent button text ("Open")
 * - Optional sections with dividers
 * - Count badges
 * - Coming soon badges
 * - Optional "New" action button in header
 */

import { ReactNode } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Divider,
  Button,
  Chip,
  Skeleton,
} from '@mui/material';
import { Add as AddIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export interface ModuleItem {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
  count?: number;
  countLabel?: string; // e.g., "materials", "items"
  countLoading?: boolean;
  comingSoon?: boolean;
}

export interface ModuleSection {
  id: string;
  title: string;
  description: string;
  items: ModuleItem[];
}

interface ModuleLandingPageProps {
  /** Module title displayed in header */
  title: string;
  /** Module description displayed below title */
  description: string;
  /** Flat list of module items (use this OR sections, not both) */
  items?: ModuleItem[];
  /** Grouped sections of module items (use this OR items, not both) */
  sections?: ModuleSection[];
  /** Optional "New" button configuration */
  newAction?: {
    label: string;
    path: string;
  };
  /** Optional highlighted card at top (like Thermal's calculator card) */
  highlightCard?: {
    title: string;
    description: string;
    icon: ReactNode;
    path: string;
    buttonLabel: string;
  };
  /** Show permission denied message instead of content */
  permissionDenied?: boolean;
  /** Custom permission denied message */
  permissionDeniedMessage?: string;
}

function ModuleCard({ item, onClick }: { item: ModuleItem; onClick: () => void }) {
  const isDisabled = item.comingSoon;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: isDisabled ? 'default' : 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': isDisabled
          ? {}
          : {
              transform: 'translateY(-4px)',
              boxShadow: 4,
            },
        ...(isDisabled && {
          opacity: 0.7,
          backgroundColor: 'action.hover',
        }),
      }}
      onClick={isDisabled ? undefined : onClick}
    >
      {/* Coming Soon Badge */}
      {item.comingSoon && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 'bold',
          }}
        >
          Coming Soon
        </Box>
      )}

      {/* Count Badge */}
      {!item.comingSoon && item.count !== undefined && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 'bold',
          }}
        >
          {item.countLoading ? (
            <Skeleton width={30} height={16} sx={{ bgcolor: 'primary.light' }} />
          ) : (
            <>
              {item.count}
              {item.countLabel && ` ${item.countLabel}`}
            </>
          )}
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
        <Box sx={{ mb: 2 }}>{item.icon}</Box>
        <Typography variant="h6" component="h2" gutterBottom>
          {item.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {item.description}
        </Typography>
      </CardContent>

      <Box sx={{ p: 2, pt: 0, display: 'flex', justifyContent: 'center' }}>
        <Chip
          label={item.comingSoon ? 'Coming Soon' : 'Open'}
          size="small"
          color={item.comingSoon ? 'default' : 'primary'}
          icon={item.comingSoon ? undefined : <ArrowForwardIcon sx={{ fontSize: 16 }} />}
          sx={{
            cursor: isDisabled ? 'default' : 'pointer',
            '& .MuiChip-icon': { order: 1, ml: 0.5, mr: -0.5 },
          }}
        />
      </Box>
    </Card>
  );
}

export function ModuleLandingPage({
  title,
  description,
  items,
  sections,
  newAction,
  highlightCard,
  permissionDenied,
  permissionDeniedMessage,
}: ModuleLandingPageProps) {
  const router = useRouter();

  if (permissionDenied) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="error">
          {permissionDeniedMessage || `You do not have permission to access the ${title} module.`}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Header */}
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {description}
          </Typography>
        </Box>
        {newAction && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push(newAction.path)}
          >
            {newAction.label}
          </Button>
        )}
      </Box>

      {/* Highlight Card */}
      {highlightCard && (
        <Card sx={{ mb: 4, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {highlightCard.icon}
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="h6">{highlightCard.title}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {highlightCard.description}
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="inherit"
                sx={{ color: 'primary.main', bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push(highlightCard.path)}
              >
                {highlightCard.buttonLabel}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Flat Items (no sections) */}
      {items && items.length > 0 && (
        <Grid container spacing={3}>
          {items.map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
              <ModuleCard item={item} onClick={() => router.push(item.path)} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Sectioned Items */}
      {sections &&
        sections.map((section, sectionIndex) => (
          <Box key={section.id} sx={{ mb: 4 }}>
            {sectionIndex > 0 && <Divider sx={{ mb: 3 }} />}
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" component="h2" color="text.primary">
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {section.description}
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {section.items.map((item) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
                  <ModuleCard item={item} onClick={() => router.push(item.path)} />
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
    </>
  );
}
