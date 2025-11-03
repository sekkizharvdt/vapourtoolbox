'use client';

/**
 * Procurement Module - Main Dashboard
 *
 * Overview of procurement workflow status and quick actions
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Card,
  CardContent,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  RequestQuote as RequestQuoteIcon,
  ShoppingCart as ShoppingCartIcon,
  CheckCircle as CheckCircleIcon,
  Inventory as InventoryIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface ProcurementStats {
  pendingPRs: number;
  activeRFQs: number;
  pendingPOs: number;
  awaitingReceipt: number;
  completedThisMonth: number;
}

export default function ProcurementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProcurementStats>({
    pendingPRs: 0,
    activeRFQs: 0,
    pendingPOs: 0,
    awaitingReceipt: 0,
    completedThisMonth: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // TODO: Load actual stats from Firestore
      // For now, showing 0s (no mock data)
      setStats({
        pendingPRs: 0,
        activeRFQs: 0,
        pendingPOs: 0,
        awaitingReceipt: 0,
        completedThisMonth: 0,
      });
    } catch (error) {
      console.error('[ProcurementPage] Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Pending PRs',
      value: stats.pendingPRs,
      icon: <DescriptionIcon />,
      color: '#f57c00',
      link: '/procurement/purchase-requests?status=pending',
    },
    {
      title: 'Active RFQs',
      value: stats.activeRFQs,
      icon: <RequestQuoteIcon />,
      color: '#1976d2',
      link: '/procurement/rfqs',
    },
    {
      title: 'Pending POs',
      value: stats.pendingPOs,
      icon: <ShoppingCartIcon />,
      color: '#9c27b0',
      link: '/procurement/purchase-orders?status=pending',
    },
    {
      title: 'Awaiting Receipt',
      value: stats.awaitingReceipt,
      icon: <InventoryIcon />,
      color: '#d32f2f',
      link: '/procurement/purchase-orders?status=awaiting_receipt',
    },
    {
      title: 'Completed This Month',
      value: stats.completedThisMonth,
      icon: <CheckCircleIcon />,
      color: '#388e3c',
      link: '/procurement/purchase-orders?status=completed',
    },
  ];

  const quickActions: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  }> = [
    {
      label: 'New Purchase Request',
      icon: <AddIcon />,
      onClick: () => router.push('/procurement/purchase-requests/new'),
      color: 'primary',
    },
    {
      label: 'View All PRs',
      icon: <DescriptionIcon />,
      onClick: () => router.push('/procurement/purchase-requests'),
      color: 'secondary',
    },
    {
      label: 'Engineering Approvals',
      icon: <CheckCircleIcon />,
      onClick: () => router.push('/procurement/engineering-approval'),
      color: 'info',
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" gutterBottom>
              Procurement Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage purchase requests, RFQs, purchase orders, and receipts
            </Typography>
          </Box>
        </Stack>

        {/* Quick Actions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="contained"
                color={action.color}
                startIcon={action.icon}
                onClick={action.onClick}
                sx={{ mb: 1 }}
              >
                {action.label}
              </Button>
            ))}
          </Stack>
        </Paper>

        {/* Stats Cards */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          flexWrap="wrap"
          sx={{
            '& > *': {
              flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(20% - 8px)' },
            },
          }}
        >
          {statCards.map((card, index) => (
            <Card
              key={index}
              sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => router.push(card.link)}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4" sx={{ color: card.color }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: card.color, opacity: 0.8 }}>{card.icon}</Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {/* Empty State */}
        {stats.pendingPRs === 0 &&
          stats.activeRFQs === 0 &&
          stats.pendingPOs === 0 &&
          stats.awaitingReceipt === 0 && (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <ShoppingCartIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Active Procurement Items
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Get started by creating a new purchase request
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push('/procurement/purchase-requests/new')}
              >
                Create Purchase Request
              </Button>
            </Paper>
          )}

        {/* Recent Activity (Placeholder) */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No recent activity to display
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}
