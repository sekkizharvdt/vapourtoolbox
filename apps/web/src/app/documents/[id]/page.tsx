'use client';

/**
 * Document Detail Page
 *
 * Shows full details of a master document with tabs for:
 * - Overview
 * - Submissions
 * - Comments
 * - Supply List
 * - Work List
 * - Document Links
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Tabs,
  Tab,
  CircularProgress,
  Breadcrumbs,
  Link as MuiLink,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import type { MasterDocumentEntry } from '@vapour/types';
import { getMasterDocumentById } from '@/lib/documents/masterDocumentService';
import DocumentOverview from '../components/DocumentOverview';
import DocumentSubmissions from '../components/DocumentSubmissions';
import DocumentComments from '../components/DocumentComments';
import DocumentSupplyList from '../components/DocumentSupplyList';
import DocumentWorkList from '../components/DocumentWorkList';
import DocumentLinks from '../components/DocumentLinks';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`document-tabpanel-${index}`}
      aria-labelledby={`document-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function DocumentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const documentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<MasterDocumentEntry | null>(null);
  const [currentTab, setCurrentTab] = useState(0);

  useEffect(() => {
    loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    // Set tab from URL parameter
    const tab = searchParams.get('tab');
    if (tab === 'submit') setCurrentTab(1);
    else if (tab === 'comments') setCurrentTab(2);
    else if (tab === 'supply') setCurrentTab(3);
    else if (tab === 'work') setCurrentTab(4);
    else if (tab === 'links') setCurrentTab(5);
    else setCurrentTab(0);
  }, [searchParams]);

  const loadDocument = async () => {
    if (!documentId) return;

    setLoading(true);
    try {
      const data = await getMasterDocumentById(
        document?.projectId || searchParams.get('projectId') || '',
        documentId
      );
      setDocument(data);
    } catch (error) {
      console.error('[DocumentDetailPage] Error loading document:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
      DRAFT: 'default',
      NOT_STARTED: 'info',
      IN_PROGRESS: 'warning',
      SUBMITTED: 'info',
      UNDER_CLIENT_REVIEW: 'warning',
      COMMENTS_RECEIVED: 'warning',
      COMMENTS_RESOLVED: 'info',
      ACCEPTED: 'success',
      REJECTED: 'error',
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!document) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Document not found
          </Typography>
          <Button
            component={Link}
            href="/documents"
            startIcon={<ArrowBackIcon />}
            sx={{ mt: 2 }}
          >
            Back to Documents
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <Breadcrumbs>
          <MuiLink component={Link} href="/documents" underline="hover" color="inherit">
            Master Documents
          </MuiLink>
          <Typography color="text.primary">{document.documentNumber}</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack spacing={1} flex={1}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h4">{document.documentNumber}</Typography>
                <Chip label={document.status} color={getStatusColor(document.status)} />
                <Chip
                  label={document.visibility === 'CLIENT_VISIBLE' ? 'Client Visible' : 'Internal'}
                  variant="outlined"
                  size="small"
                  color={document.visibility === 'CLIENT_VISIBLE' ? 'primary' : 'default'}
                />
              </Stack>

              <Typography variant="h6" color="text.secondary">
                {document.title}
              </Typography>

              {document.description && (
                <Typography variant="body2" color="text.secondary">
                  {document.description}
                </Typography>
              )}

              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Chip label={`Discipline: ${document.disciplineCode}`} size="small" />
                {document.subCode && (
                  <Chip label={`Sub-code: ${document.subCode}`} size="small" variant="outlined" />
                )}
                <Chip label={`Revision: ${document.currentRevision}`} size="small" />
                <Chip label={`Submissions: ${document.submissionCount}`} size="small" />
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button startIcon={<EditIcon />} variant="outlined">
                Edit
              </Button>
              <Button
                startIcon={<SendIcon />}
                variant="contained"
                onClick={() => setCurrentTab(1)}
              >
                Submit
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Tabs */}
        <Paper>
          <Tabs value={currentTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab label="Overview" />
            <Tab label="Submissions" />
            <Tab label="Comments" />
            <Tab label="Supply List" />
            <Tab label="Work List" />
            <Tab label="Document Links" />
          </Tabs>
          <Divider />

          <TabPanel value={currentTab} index={0}>
            <DocumentOverview document={document} onUpdate={loadDocument} />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <DocumentSubmissions document={document} onUpdate={loadDocument} />
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <DocumentComments document={document} onUpdate={loadDocument} />
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            <DocumentSupplyList document={document} onUpdate={loadDocument} />
          </TabPanel>

          <TabPanel value={currentTab} index={4}>
            <DocumentWorkList document={document} onUpdate={loadDocument} />
          </TabPanel>

          <TabPanel value={currentTab} index={5}>
            <DocumentLinks document={document} onUpdate={loadDocument} />
          </TabPanel>
        </Paper>
      </Stack>
    </Box>
  );
}
