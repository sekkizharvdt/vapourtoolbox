'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  Security as SecurityIcon,
  Update as UpdateIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  Inventory as PackageIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getSystemStatus } from '@/lib/admin';
import type {
  SystemStatusResponse,
  VulnerabilitySeverity,
  OutdatedPackage,
  VulnerabilityDetail,
} from '@vapour/types';

const SEVERITY_COLORS: Record<VulnerabilitySeverity, 'error' | 'warning' | 'info' | 'success'> = {
  critical: 'error',
  high: 'error',
  moderate: 'warning',
  low: 'info',
  info: 'info',
};

const UPDATE_TYPE_COLORS: Record<string, 'error' | 'warning' | 'success'> = {
  major: 'error',
  minor: 'warning',
  patch: 'success',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: 'success' | 'warning' | 'error' | 'info';
  subtitle?: string;
}

function StatCard({ title, value, icon, color = 'info', subtitle }: StatCardProps) {
  const colorMap = {
    success: 'success.main',
    warning: 'warning.main',
    error: 'error.main',
    info: 'primary.main',
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h4" sx={{ color: colorMap[color] }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ color: colorMap[color], opacity: 0.7 }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function SystemStatusPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSystemStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load system status:', err);
      setError('Failed to load system status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Determine overall security status
  const getOverallStatus = () => {
    if (!status) return { text: 'Unknown', color: 'info' as const };
    const { vulnerabilities } = status;
    if (vulnerabilities.critical > 0) return { text: 'Critical', color: 'error' as const };
    if (vulnerabilities.high > 0) return { text: 'High Risk', color: 'error' as const };
    if (vulnerabilities.moderate > 0) return { text: 'Moderate Risk', color: 'warning' as const };
    if (vulnerabilities.low > 0) return { text: 'Low Risk', color: 'info' as const };
    return { text: 'Secure', color: 'success' as const };
  };

  const overallStatus = getOverallStatus();

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Skeleton variant="text" width={300} height={40} />
          <Skeleton variant="text" width={200} />
        </Stack>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 3 }}>
          <Skeleton variant="rectangular" height={300} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.back()}>
          Go Back
        </Button>
      </Box>
    );
  }

  if (!status) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No system status data available. Run the update script to generate data:
          <Box component="code" sx={{ display: 'block', mt: 1, p: 1, bgcolor: 'grey.100' }}>
            node scripts/update-system-status.js
          </Box>
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.back()} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Button startIcon={<BackIcon />} onClick={() => router.back()} size="small">
              Back
            </Button>
            <Typography variant="h4">System Status</Typography>
            <Chip
              label={overallStatus.text}
              color={overallStatus.color}
              icon={
                overallStatus.color === 'success' ? (
                  <CheckIcon />
                ) : overallStatus.color === 'error' ? (
                  <ErrorIcon />
                ) : (
                  <WarningIcon />
                )
              }
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Last updated: {formatDate(status.generatedAt)}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadStatus}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Critical Vulnerabilities"
            value={status.vulnerabilities.critical}
            icon={<ErrorIcon sx={{ fontSize: 40 }} />}
            color={status.vulnerabilities.critical > 0 ? 'error' : 'success'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="High Vulnerabilities"
            value={status.vulnerabilities.high}
            icon={<WarningIcon sx={{ fontSize: 40 }} />}
            color={status.vulnerabilities.high > 0 ? 'error' : 'success'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Outdated Packages"
            value={status.outdatedPackages.length}
            icon={<UpdateIcon sx={{ fontSize: 40 }} />}
            color={status.outdatedPackages.length > 0 ? 'warning' : 'success'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Dependencies"
            value={status.totalDependencies}
            icon={<PackageIcon sx={{ fontSize: 40 }} />}
            subtitle={`${status.workspaces.length} workspaces`}
          />
        </Grid>
      </Grid>

      {/* Runtime Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Runtime Environment
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Node.js
              </Typography>
              <Typography variant="body1">
                {status.runtime.node.current}
                {status.runtime.node.recommended && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    (Recommended: {status.runtime.node.recommended})
                  </Typography>
                )}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                pnpm
              </Typography>
              <Typography variant="body1">
                {status.runtime.pnpm.current}
                {status.runtime.pnpm.recommended && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    (Recommended: {status.runtime.pnpm.recommended})
                  </Typography>
                )}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Vulnerabilities Section */}
      <Accordion defaultExpanded={status.vulnerabilities.total > 0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SecurityIcon color={status.vulnerabilities.total > 0 ? 'error' : 'success'} />
            <Typography variant="h6">
              Security Vulnerabilities ({status.vulnerabilities.total})
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {status.vulnerabilities.total === 0 ? (
            <Alert severity="success">No security vulnerabilities found!</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Severity</TableCell>
                    <TableCell>Package</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Vulnerable Versions</TableCell>
                    <TableCell>Patched Versions</TableCell>
                    <TableCell>Advisory</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {status.vulnerabilities.details.map((vuln: VulnerabilityDetail) => (
                    <TableRow key={vuln.id}>
                      <TableCell>
                        <Chip
                          label={vuln.severity}
                          size="small"
                          color={SEVERITY_COLORS[vuln.severity]}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {vuln.package}
                        </Typography>
                      </TableCell>
                      <TableCell>{vuln.title}</TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {vuln.vulnerableVersions}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {vuln.patchedVersions}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {vuln.url ? (
                          <Link href={vuln.url} target="_blank" rel="noopener">
                            View
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Outdated Packages Section */}
      <Accordion defaultExpanded={status.outdatedPackages.length > 0} sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <UpdateIcon color={status.outdatedPackages.length > 0 ? 'warning' : 'success'} />
            <Typography variant="h6">
              Outdated Packages ({status.outdatedPackages.length})
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {status.outdatedPackages.length === 0 ? (
            <Alert severity="success">All packages are up to date!</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Package</TableCell>
                    <TableCell>Current</TableCell>
                    <TableCell>Wanted</TableCell>
                    <TableCell>Latest</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Workspace</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {status.outdatedPackages.map((pkg: OutdatedPackage) => (
                    <TableRow key={`${pkg.name}-${pkg.workspace}`}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {pkg.name}
                        </Typography>
                        {pkg.isSecurityUpdate && (
                          <Chip label="Security" size="small" color="error" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {pkg.current}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {pkg.wanted}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          fontFamily="monospace"
                          color="success.main"
                          fontWeight="bold"
                        >
                          {pkg.latest}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={pkg.updateType}
                          size="small"
                          color={UPDATE_TYPE_COLORS[pkg.updateType]}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {pkg.workspace}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Workspaces Section */}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PackageIcon />
            <Typography variant="h6">Workspaces ({status.workspaces.length})</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell align="right">Dependencies</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {status.workspaces.map((workspace) => (
                  <TableRow key={workspace.name}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {workspace.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                        {workspace.path}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace">
                        {workspace.version}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{workspace.dependencyCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Instructions */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          How to Update
        </Typography>
        <Typography variant="body2">
          Run the following command to refresh the system status data:
        </Typography>
        <Box component="code" sx={{ display: 'block', mt: 1, p: 1, bgcolor: 'grey.100' }}>
          node scripts/update-system-status.js
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          This script runs pnpm audit and pnpm outdated and uploads the results to Firestore.
        </Typography>
      </Alert>
    </Box>
  );
}
