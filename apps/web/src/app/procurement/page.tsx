'use client';

/**
 * Procurement Module - Main Dashboard
 *
 * Card-based navigation to procurement workflows
 */

import { Typography, Box, Card, CardContent, CardActions, Button, Grid } from '@mui/material';
import {
  Description as DescriptionIcon,
  RequestQuote as RequestQuoteIcon,
  ShoppingCart as ShoppingCartIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  LocalShipping as LocalShippingIcon,
  Receipt as ReceiptIcon,
  CompareArrows as CompareArrowsIcon,
  Edit as EditIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProcurement } from '@vapour/constants';

interface ProcurementModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  comingSoon?: boolean;
}

export default function ProcurementPage() {
  const router = useRouter();
  const { claims } = useAuth();

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewProcurement(claims.permissions) : false;

  const modules: ProcurementModule[] = [
    {
      title: 'Purchase Requests',
      description: 'Create and manage purchase requests with approval workflow',
      icon: <DescriptionIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/purchase-requests',
    },
    {
      title: 'Engineering Approval',
      description: 'Review and approve purchase requests from engineering perspective',
      icon: <CheckCircleIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/engineering-approval',
    },
    {
      title: 'RFQs (Requests for Quotation)',
      description: 'Issue RFQs to vendors, receive and compare quotations',
      icon: <RequestQuoteIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/rfqs',
    },
    {
      title: 'Purchase Orders',
      description: 'Create, approve, and track purchase orders with vendors',
      icon: <ShoppingCartIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/pos',
    },
    {
      title: 'Packing Lists',
      description: 'Manage packing lists for shipments and deliveries',
      icon: <ReceiptIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/packing-lists',
    },
    {
      title: 'Goods Receipts',
      description: 'Record received goods, verify quality, and inspect items',
      icon: <LocalShippingIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/goods-receipts',
    },
    {
      title: 'Work Completion',
      description: 'Issue work completion certificates for service POs',
      icon: <AssignmentIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/work-completion',
    },
    {
      title: 'Three-Way Match',
      description: 'Match POs, goods receipts, and vendor bills for payment approval',
      icon: <CompareArrowsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/three-way-match',
    },
    {
      title: 'PO Amendments',
      description: 'Create and manage amendments to approved purchase orders',
      icon: <EditIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/amendments',
    },
    {
      title: 'Files',
      description: 'Browse and manage procurement-related documents',
      icon: <FolderIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/procurement/files',
    },
  ];

  if (!hasViewAccess) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Procurement
        </Typography>
        <Typography variant="body1" color="error">
          You do not have permission to access the Procurement module.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Procurement
        </Typography>
        <Typography variant="body1" color="text.secondary">
          End-to-end procurement workflow: from purchase requests to goods receipt
        </Typography>
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
    </>
  );
}
