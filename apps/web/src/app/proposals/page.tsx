'use client';

/**
 * Proposals Module - Hub Dashboard
 *
 * Card-based navigation to proposal sub-modules
 */

import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
} from '@mui/material';
import {
  Inbox as InboxIcon,
  GridView as GridViewIcon,
  Calculate as CalculateIcon,
  PriceChange as PriceChangeIcon,
  PictureAsPdf as PdfIcon,
  List as ListIcon,
  Folder as FolderIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProposals } from '@vapour/constants';

interface ProposalModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  comingSoon?: boolean;
}

export default function ProposalsPage() {
  const router = useRouter();
  const { claims } = useAuth();

  // Check permissions - user needs proposal view access
  const hasViewAccess = claims?.permissions ? canViewProposals(claims.permissions) : false;

  const modules: ProposalModule[] = [
    {
      title: 'Enquiries',
      description: 'Manage incoming client enquiries and RFQs',
      icon: <InboxIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/enquiries',
    },
    {
      title: 'Scope Matrix',
      description: 'Define scope of services, supply, and exclusions',
      icon: <GridViewIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/scope-matrix',
    },
    {
      title: 'Estimation (BOMs)',
      description: 'Cost estimation via Bill of Materials',
      icon: <CalculateIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/estimation',
    },
    {
      title: 'Pricing',
      description: 'Configure margins and final pricing',
      icon: <PriceChangeIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/pricing',
    },
    {
      title: 'Proposal Generation',
      description: 'Preview and submit proposal documents',
      icon: <PdfIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/generation',
    },
    {
      title: 'All Proposals',
      description: 'View all proposals across all stages',
      icon: <ListIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/list',
    },
    {
      title: 'Files',
      description: 'Browse proposal-related documents',
      icon: <FolderIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/files',
    },
  ];

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Proposals
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access the Proposals module.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Proposals
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage proposals from enquiry to final document generation
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/proposals/new')}
        >
          New Proposal
        </Button>
      </Box>

      <Grid container spacing={3}>
        {modules.map((module) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={module.path}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                ...(module.comingSoon && {
                  opacity: 0.7,
                  backgroundColor: 'action.hover',
                }),
              }}
            >
              {module.comingSoon && (
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

              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ mb: 2 }}>{module.icon}</Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {module.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {module.description}
                </Typography>
              </CardContent>

              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => router.push(module.path)}
                  disabled={module.comingSoon}
                >
                  {module.comingSoon ? 'Coming Soon' : 'Open Module'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
