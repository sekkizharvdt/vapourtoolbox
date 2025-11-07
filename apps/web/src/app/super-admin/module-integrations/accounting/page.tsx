'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Grid } from '@mui/material';
import { ArrowForward as ArrowForwardIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface ModuleIntegration {
  id?: string;
  sourceModule: string;
  targetModule: string;
  integrationType: 'incoming' | 'outgoing' | 'dependency' | 'reporting';
  dataType: string;
  description: string;
  status: 'active' | 'planned' | 'in-development';
  fieldMappings?: Array<{ source: string; target: string }>;
  triggerCondition?: string;
  implementationDate?: string;
  notes?: string;
}

export default function AccountingIntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<ModuleIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<ModuleIntegration | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load integrations from Firestore
  useEffect(() => {
    const { db } = getFirebase();
    const integrationsRef = collection(db, 'moduleIntegrations');
    const q = query(integrationsRef, where('sourceModule', '==', 'accounting'));
    const q2 = query(integrationsRef, where('targetModule', '==', 'accounting'));

    // Listen to both queries (source and target)
    const unsubscribe1 = onSnapshot(q, (snapshot) => {
      const data: ModuleIntegration[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as ModuleIntegration);
      });
      setIntegrations((prev) => {
        const filtered = prev.filter((i) => i.targetModule !== 'accounting');
        return [...filtered, ...data];
      });
      setLoading(false);
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const data: ModuleIntegration[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as ModuleIntegration);
      });
      setIntegrations((prev) => {
        const filtered = prev.filter((i) => i.sourceModule !== 'accounting');
        return [...filtered, ...data];
      });
      setLoading(false);
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'in-development':
        return 'warning';
      case 'planned':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'in-development':
        return 'In Development';
      case 'planned':
        return 'Planned';
      default:
        return status;
    }
  };

  const handleViewDetails = (integration: ModuleIntegration) => {
    setSelectedIntegration(integration);
    setDialogOpen(true);
  };

  const filterIntegrations = (type: 'incoming' | 'outgoing' | 'dependency' | 'reporting') => {
    return integrations.filter((i) => {
      const matchesType = i.integrationType === type;
      const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
      return matchesType && matchesStatus;
    });
  };

  const getModuleName = (moduleKey: string) => {
    const names: Record<string, string> = {
      accounting: 'Accounting',
      procurement: 'Procurement',
      projects: 'Projects',
      hr: 'HR',
      inventory: 'Inventory',
      entities: 'Entities',
      management: 'Management',
      engineering: 'Engineering',
      documents: 'Document Management',
    };
    return names[moduleKey] || moduleKey;
  };

  const IntegrationCard = ({ integration }: { integration: ModuleIntegration }) => {
    const isIncoming = integration.integrationType === 'incoming';
    const isDependency = integration.integrationType === 'dependency';
    const sourceModule = isIncoming || isDependency ? integration.sourceModule : 'accounting';
    const targetModule = isIncoming || isDependency ? 'accounting' : integration.targetModule;

    return (
      <Card
        sx={{
          '&:hover': { boxShadow: 3, cursor: 'pointer' },
          opacity: integration.status === 'planned' ? 0.85 : 1,
        }}
        onClick={() => handleViewDetails(integration)}
      >
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              {getModuleName(sourceModule).charAt(0)}
            </Avatar>
          }
          action={
            <Chip
              label={getStatusLabel(integration.status)}
              size="small"
              color={getStatusColor(integration.status)}
            />
          }
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" fontWeight="medium">
                {getModuleName(sourceModule)}
              </Typography>
              <ArrowForwardIcon fontSize="small" color="action" />
              <Typography variant="body2" fontWeight="medium">
                {getModuleName(targetModule)}
              </Typography>
            </Stack>
          }
          subheader={integration.dataType}
        />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {integration.description}
          </Typography>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading integrations...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <IconButton onClick={() => router.push('/super-admin')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">Accounting Module Integrations</Typography>
          <Typography variant="body2" color="text.secondary">
            Data flows and dependencies for the Accounting module
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          value={statusFilter}
          exclusive
          onChange={(_, value) => value && setStatusFilter(value)}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="active">Active</ToggleButton>
          <ToggleButton value="planned">Planned</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {integrations.filter((i) => i.status === 'active').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {integrations.filter((i) => i.status === 'in-development').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              In Development
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="text.secondary">
              {integrations.filter((i) => i.status === 'planned').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Planned
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary.main">
              {integrations.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Four Quadrants */}
      <Grid container spacing={3}>
        {/* Top Left: Incoming Data */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Incoming Data
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Data that Accounting receives from other modules
            </Typography>
            <Stack spacing={2}>
              {filterIntegrations('incoming').map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
              {filterIntegrations('incoming').length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No incoming integrations found
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Top Right: Outgoing Data */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Outgoing Data
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Data that Accounting sends to other modules
            </Typography>
            <Stack spacing={2}>
              {filterIntegrations('outgoing').map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
              {filterIntegrations('outgoing').length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No outgoing integrations found
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Bottom Left: Data Dependencies */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Data Dependencies
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Master data that Accounting relies on from other modules
            </Typography>
            <Stack spacing={2}>
              {filterIntegrations('dependency').map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
              {filterIntegrations('dependency').length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No data dependencies found
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Bottom Right: Reporting Data */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Reporting Data
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Data that Accounting provides to other modules for reporting
            </Typography>
            <Stack spacing={2}>
              {filterIntegrations('reporting').map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
              {filterIntegrations('reporting').length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No reporting integrations found
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Integration Detail Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">Integration Details</Typography>
            {selectedIntegration && (
              <Chip
                label={getStatusLabel(selectedIntegration.status)}
                size="small"
                color={getStatusColor(selectedIntegration.status)}
              />
            )}
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedIntegration && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Data Flow
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={getModuleName(selectedIntegration.sourceModule)} />
                  <ArrowForwardIcon />
                  <Chip label={getModuleName(selectedIntegration.targetModule)} />
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Data Type
                </Typography>
                <Typography variant="body2">{selectedIntegration.dataType}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body2">{selectedIntegration.description}</Typography>
              </Box>

              {selectedIntegration.triggerCondition && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Trigger Condition
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}
                  >
                    {selectedIntegration.triggerCondition}
                  </Typography>
                </Box>
              )}

              {selectedIntegration.fieldMappings &&
                selectedIntegration.fieldMappings.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Field Mappings
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Source Field</TableCell>
                            <TableCell>Target Field</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedIntegration.fieldMappings.map((mapping, index) => (
                            <TableRow key={index}>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                {mapping.source}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                {mapping.target}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

              {selectedIntegration.implementationDate && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Implementation Date
                  </Typography>
                  <Typography variant="body2">{selectedIntegration.implementationDate}</Typography>
                </Box>
              )}

              {selectedIntegration.notes && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Notes
                  </Typography>
                  <Typography variant="body2">{selectedIntegration.notes}</Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
