'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Alert,
  Divider,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  Visibility as PreviewIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type { Project } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface ReportsTabProps {
  project: Project;
}

interface ReportConfig {
  reportType: 'internal' | 'external';
  includeSections: {
    overview: boolean;
    milestones: boolean;
    budget: boolean;
    procurement: boolean;
    documents: boolean;
    vendors: boolean;
    risks: boolean;
    team: boolean;
  };
}

export function ReportsTab({ project }: ReportsTabProps) {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    reportType: 'internal',
    includeSections: {
      overview: true,
      milestones: true,
      budget: true,
      procurement: true,
      documents: true,
      vendors: true,
      risks: true,
      team: true,
    },
  });
  const [showPreview, setShowPreview] = useState(false);
  const [generatedDate] = useState(new Date());

  const handleSectionChange =
    (section: keyof ReportConfig['includeSections']) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setReportConfig((prev) => ({
        ...prev,
        includeSections: {
          ...prev.includeSections,
          [section]: event.target.checked,
        },
      }));
    };

  const handleReportTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as 'internal' | 'external';
    setReportConfig((prev) => ({
      ...prev,
      reportType: newType,
      // Auto-disable budget for external reports
      includeSections: {
        ...prev.includeSections,
        budget: newType === 'internal',
      },
    }));
  };

  const handleGenerateReport = () => {
    setShowPreview(true);
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    } else {
      return `₹${amount.toLocaleString('en-IN')}`;
    }
  };

  // Calculate project progress
  const projectStartDate = project.dates?.startDate
    ? (() => {
        const date = project.dates.startDate;
        if (date instanceof Date) {
          return date;
        } else if (typeof date === 'object' && 'toDate' in date && date.toDate) {
          return date.toDate();
        } else if (typeof date === 'string') {
          return new Date(date);
        }
        return null;
      })()
    : null;

  const projectEndDate = project.dates?.endDate
    ? (() => {
        const date = project.dates.endDate;
        if (date instanceof Date) {
          return date;
        } else if (typeof date === 'object' && 'toDate' in date && date.toDate) {
          return date.toDate();
        } else if (typeof date === 'string') {
          return new Date(date);
        }
        return null;
      })()
    : null;

  const today = new Date();

  const totalDuration =
    projectStartDate && projectEndDate
      ? Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
  const elapsedDays =
    projectStartDate && projectStartDate < today
      ? Math.ceil((today.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
  const timeProgress = totalDuration > 0 ? ((elapsedDays / totalDuration) * 100).toFixed(1) : '0';

  // Budget stats
  const estimated = project.budget?.estimated?.amount || 0;
  const actual = project.budget?.actual?.amount || 0;
  const procurementCommitted =
    project.procurementItems?.reduce(
      (sum, item) =>
        sum + (item.status !== 'CANCELLED' ? item.estimatedTotalPrice?.amount || 0 : 0),
      0
    ) || 0;
  const vendorCommitted =
    project.vendors?.reduce(
      (sum, vendor) =>
        sum +
        (vendor.contractStatus === 'ACTIVE' || vendor.contractStatus === 'NEGOTIATION'
          ? vendor.contractValue?.amount || 0
          : 0),
      0
    ) || 0;
  const budgetUtilization =
    estimated > 0
      ? (((actual + procurementCommitted + vendorCommitted) / estimated) * 100).toFixed(1)
      : '0';

  return (
    <Box>
      {/* Report Configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <ReportIcon />
          <Typography variant="h6">Generate Progress Report</Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          {/* Report Type */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Report Type</FormLabel>
              <RadioGroup value={reportConfig.reportType} onChange={handleReportTypeChange}>
                <FormControlLabel
                  value="internal"
                  control={<Radio />}
                  label="Internal Report (All Sections)"
                />
                <FormControlLabel
                  value="external"
                  control={<Radio />}
                  label="External Report (Excludes Budget)"
                />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Section Selector */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Include Sections</FormLabel>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reportConfig.includeSections.overview}
                      onChange={handleSectionChange('overview')}
                    />
                  }
                  label="Project Overview"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reportConfig.includeSections.milestones}
                      onChange={handleSectionChange('milestones')}
                    />
                  }
                  label="Milestones & Timeline"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reportConfig.includeSections.budget}
                      onChange={handleSectionChange('budget')}
                      disabled={reportConfig.reportType === 'external'}
                    />
                  }
                  label="Budget & Cost Tracking"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reportConfig.includeSections.procurement}
                      onChange={handleSectionChange('procurement')}
                    />
                  }
                  label="Procurement Status"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reportConfig.includeSections.documents}
                      onChange={handleSectionChange('documents')}
                    />
                  }
                  label="Document Submissions"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reportConfig.includeSections.vendors}
                      onChange={handleSectionChange('vendors')}
                    />
                  }
                  label="Vendor Contracts"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reportConfig.includeSections.risks}
                      onChange={handleSectionChange('risks')}
                    />
                  }
                  label="Risk Assessment"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={reportConfig.includeSections.team}
                      onChange={handleSectionChange('team')}
                    />
                  }
                  label="Team Members"
                />
              </FormGroup>
            </FormControl>
          </Grid>

          {/* Actions */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<PreviewIcon />}
                onClick={handleGenerateReport}
              >
                Generate & Preview
              </Button>
              <Button variant="outlined" startIcon={<DownloadIcon />} disabled={!showPreview}>
                Export to PDF
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Report Preview */}
      {showPreview && (
        <Paper sx={{ p: 4, mb: 3 }}>
          {/* Report Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" gutterBottom>
              Project Progress Report
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {project.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Report Generated: {formatDate(generatedDate, 'long')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Report Type: {reportConfig.reportType.toUpperCase()}
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Project Overview */}
          {reportConfig.includeSections.overview && (
            <>
              <Typography variant="h6" gutterBottom>
                1. Project Overview
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Project Code
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {project.code}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Chip label={project.status} size="small" color="primary" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1">{formatDate(project.dates?.startDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Target End Date
                  </Typography>
                  <Typography variant="body1">{formatDate(project.dates?.endDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Project Manager
                  </Typography>
                  <Typography variant="body1">{project.projectManager?.userName}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Time Progress
                  </Typography>
                  <Typography variant="body1">{timeProgress}%</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body1">{project.description || 'No description'}</Typography>
                </Grid>
              </Grid>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          {/* Milestones & Timeline */}
          {reportConfig.includeSections.milestones && (
            <>
              <Typography variant="h6" gutterBottom>
                2. Milestones & Timeline Status
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Project Duration: {totalDuration} days ({elapsedDays} elapsed,{' '}
                {totalDuration - elapsedDays} remaining)
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Charter Deliverables: {project.charter?.deliverables?.length || 0} defined,{' '}
                {project.charter?.deliverables?.filter((d) => d.status === 'ACCEPTED').length || 0}{' '}
                accepted
              </Typography>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          {/* Budget & Cost Tracking */}
          {reportConfig.includeSections.budget && reportConfig.reportType === 'internal' && (
            <>
              <Typography variant="h6" gutterBottom>
                3. Budget & Cost Tracking
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Estimated Budget
                      </Typography>
                      <Typography variant="h6">{formatCurrency(estimated)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Actual Spent
                      </Typography>
                      <Typography variant="h6">{formatCurrency(actual)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Committed
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(procurementCommitted + vendorCommitted)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Utilization
                      </Typography>
                      <Typography variant="h6">{budgetUtilization}%</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          {/* Procurement Status */}
          {reportConfig.includeSections.procurement && (
            <>
              <Typography variant="h6" gutterBottom>
                {reportConfig.reportType === 'internal' ? '4' : '3'}. Procurement Status
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Total Procurement Items: {project.procurementItems?.length || 0}
              </Typography>
              {project.procurementItems && project.procurementItems.length > 0 && (
                <TableContainer sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {project.procurementItems.slice(0, 5).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>
                            <Chip label={item.status} size="small" />
                          </TableCell>
                          <TableCell align="right">
                            {item.quantity} {item.unit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {(project.procurementItems?.length || 0) > 5 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {(project.procurementItems?.length || 0) - 5} more items
                </Typography>
              )}
              <Divider sx={{ my: 3 }} />
            </>
          )}

          {/* Document Submissions */}
          {reportConfig.includeSections.documents && (
            <>
              <Typography variant="h6" gutterBottom>
                {reportConfig.reportType === 'internal' ? '5' : '4'}. Document Submissions
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Required Documents: {project.documentRequirements?.length || 0}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Submitted:{' '}
                {project.documentRequirements?.filter((d) => d.status !== 'NOT_SUBMITTED').length ||
                  0}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Approved:{' '}
                {project.documentRequirements?.filter((d) => d.status === 'APPROVED').length || 0}
              </Typography>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          {/* Vendor Contracts */}
          {reportConfig.includeSections.vendors && (
            <>
              <Typography variant="h6" gutterBottom>
                {reportConfig.reportType === 'internal' ? '6' : '5'}. Vendor Contracts
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Active Vendors:{' '}
                {project.vendors?.filter((v) => v.contractStatus === 'ACTIVE').length || 0}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Total Vendors: {project.vendors?.length || 0}
              </Typography>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          {/* Risk Assessment */}
          {reportConfig.includeSections.risks && (
            <>
              <Typography variant="h6" gutterBottom>
                {reportConfig.reportType === 'internal' ? '7' : '6'}. Risk Assessment
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Identified Risks: {project.charter?.risks?.length || 0}
              </Typography>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          {/* Team Members */}
          {reportConfig.includeSections.team && (
            <>
              <Typography variant="h6" gutterBottom>
                {reportConfig.reportType === 'internal' ? '8' : '7'}. Team Members
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Project Manager: {project.projectManager?.userName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Team Size: {(project.team?.length || 0) + 1} members
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Active Members: {(project.team?.filter((m) => m.isActive).length || 0) + 1}
              </Typography>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          {/* Report Footer */}
          <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              This report was automatically generated by the VDT-Unified Project Management System.
              <br />
              Report ID: {project.id}-{generatedDate.getTime()}
              <br />
              Generated with Claude Code
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Future Enhancements Note */}
      <Alert severity="info">
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Report Enhancements
        </Typography>
        <Typography variant="body2">
          Future enhancements will include: Scheduled automatic reports, PDF export with custom
          branding, save reports to Document Management System, email delivery to stakeholders,
          period-over-period comparison, trend analysis with charts, and earned value analysis.
        </Typography>
      </Alert>
    </Box>
  );
}
