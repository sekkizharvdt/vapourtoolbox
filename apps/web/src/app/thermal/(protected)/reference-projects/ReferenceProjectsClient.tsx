'use client';

import { useState } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Breadcrumbs,
  Link as MuiLink,
  Divider,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  Factory as FactoryIcon,
  CompareArrows as CompareIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import {
  REFERENCE_PROJECTS,
  crossProjectComparison,
  type ReferenceProject,
  type EquipmentSection,
  type KeyValueRow,
} from '@/lib/thermal/referenceProjects';

// ─── Sub-components ─────────────────────────────────────────────────────────

function KeyValueTable({ rows }: { rows: KeyValueRow[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
      <Table size="small">
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} sx={{ '&:last-child td': { borderBottom: 0 } }}>
              <TableCell
                sx={{
                  fontWeight: 500,
                  width: '40%',
                  color: 'text.secondary',
                  fontSize: '0.8125rem',
                }}
              >
                {row.parameter}
              </TableCell>
              <TableCell sx={{ fontSize: '0.8125rem' }}>{row.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MultiColumnTable({
  columns,
  columnRows,
}: {
  columns: string[];
  columnRows: Record<string, string[]>;
}) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col, i) => (
              <TableCell
                key={i}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  backgroundColor: 'grey.50',
                  whiteSpace: 'nowrap',
                }}
              >
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(columnRows).map(([param, values], i) => (
            <TableRow key={i} sx={{ '&:last-child td': { borderBottom: 0 } }}>
              <TableCell sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.8125rem' }}>
                {param}
              </TableCell>
              {values.map((val, j) => (
                <TableCell key={j} sx={{ fontSize: '0.8125rem' }}>
                  {val}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EquipmentAccordion({ section }: { section: EquipmentSection }) {
  return (
    <Accordion
      disableGutters
      sx={{
        '&:before': { display: 'none' },
        border: '1px solid',
        borderColor: 'divider',
        '&:not(:last-child)': { borderBottom: 0 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">{section.title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {section.note && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontStyle: 'italic' }}>
            {section.note}
          </Typography>
        )}
        {section.rows && <KeyValueTable rows={section.rows} />}
        {section.columns && section.columnRows && (
          <MultiColumnTable columns={section.columns} columnRows={section.columnRows} />
        )}
      </AccordionDetails>
    </Accordion>
  );
}

function ProjectCard({ project }: { project: ReferenceProject }) {
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <FactoryIcon color="primary" />
          <Typography variant="h6">{project.name}</Typography>
          <Chip label={project.location} size="small" variant="outlined" />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {project.configuration}
        </Typography>
      </Box>

      {/* Highlight chips */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {project.highlights.map((h) => (
          <Chip
            key={h.label}
            label={`${h.label}: ${h.value}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        ))}
      </Box>

      {/* Overview */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Project Overview
      </Typography>
      <KeyValueTable rows={project.overview} />

      {/* Equipment sections */}
      {project.equipment.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Equipment Data
          </Typography>
          {project.equipment.map((section) => (
            <EquipmentAccordion key={section.id} section={section} />
          ))}
        </>
      )}

      {/* Derived performance */}
      {project.derivedPerformance.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Derived Performance Data
          </Typography>
          <KeyValueTable rows={project.derivedPerformance} />
        </>
      )}

      {/* Derived engineering data */}
      {project.derivedEngineering && project.derivedEngineering.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Derived Engineering Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
            Heat transfer coefficients, wetting rates, heat fluxes, and system ratios calculated
            from the as-built datasheet values.
          </Typography>
          <KeyValueTable rows={project.derivedEngineering} />
        </>
      )}
    </Box>
  );
}

function ComparisonTable() {
  const { columns, rows } = crossProjectComparison;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CompareIcon color="primary" />
        <Typography variant="h6">Cross-Project Comparison</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Key design parameters compared across all reference projects. Values marked TBD are pending
        data extraction from construction drawings.
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col, i) => (
                <TableCell
                  key={i}
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    backgroundColor: i === 0 ? 'grey.50' : 'primary.main',
                    color: i === 0 ? 'text.primary' : 'primary.contrastText',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                {row.map((cell, j) => (
                  <TableCell
                    key={j}
                    sx={{
                      fontSize: '0.8125rem',
                      fontWeight: j === 0 ? 500 : 400,
                      color:
                        j === 0
                          ? 'text.secondary'
                          : cell === 'TBD'
                            ? 'text.disabled'
                            : 'text.primary',
                      ...(j === 0 && { backgroundColor: 'grey.50' }),
                    }}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ReferenceProjectsClient() {
  const [activeTab, setActiveTab] = useState(0);

  // Tab 0 = comparison, then one tab per project
  const tabs = [
    { label: 'Comparison', id: 'comparison' },
    ...REFERENCE_PROJECTS.map((p) => ({ label: `${p.name} (${p.location})`, id: p.id })),
  ];

  return (
    <>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <MuiLink
          component={Link}
          href="/thermal"
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Thermal
        </MuiLink>
        <Typography color="text.primary" variant="body2">
          Reference Projects
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Reference Projects
        </Typography>
        <Typography variant="body1" color="text.secondary">
          As-built design data from real MED-TVC desalination projects. Use this data for
          engineering reference and to validate calculator results.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        All data extracted from original project datasheets by SWS (Saline Water Specialists).
        Values are as-built unless noted otherwise.
      </Alert>

      {/* Project summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {REFERENCE_PROJECTS.map((project, idx) => (
          <Grid key={project.id} size={{ xs: 12, sm: 4 }}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: activeTab === idx + 1 ? 2 : 1,
                borderColor: activeTab === idx + 1 ? 'primary.main' : 'divider',
                '&:hover': { boxShadow: 3 },
              }}
              onClick={() => setActiveTab(idx + 1)}
            >
              <CardContent sx={{ pb: '12px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <FactoryIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {project.name}
                  </Typography>
                  <Chip label={project.location} size="small" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {project.subtitle}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {project.highlights.map((h) => (
                    <Chip
                      key={h.label}
                      label={`${h.label}: ${h.value}`}
                      size="small"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
            <Tab key={tab.id} label={tab.label} />
          ))}
        </Tabs>
        <Divider />
        <Box sx={{ p: 3 }}>
          {activeTab === 0 && <ComparisonTable />}
          {activeTab > 0 &&
            (() => {
              const project = REFERENCE_PROJECTS[activeTab - 1];
              return project ? <ProjectCard project={project} /> : null;
            })()}
        </Box>
      </Paper>
    </>
  );
}
