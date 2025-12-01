'use client';

/**
 * Feedback List Component
 *
 * Admin interface to view and manage user feedback submissions
 * - Bug reports
 * - Feature requests
 * - General feedback
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Paper,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ImageList,
  ImageListItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  ChatBubble as ChatBubbleIcon,
  FilterList as FilterIcon,
  OpenInNew as OpenInNewIcon,
  Visibility as VisibilityIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';

type FeedbackType = 'bug' | 'feature' | 'general';
type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  consoleErrors?: string;
  screenshotUrls: string[];
  userId: string;
  userEmail: string;
  userName: string;
  pageUrl?: string;
  browserInfo?: string;
  status: FeedbackStatus;
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

const typeConfig: Record<
  FeedbackType,
  { label: string; icon: React.ReactNode; color: 'error' | 'info' | 'default' }
> = {
  bug: { label: 'Bug Report', icon: <BugReportIcon />, color: 'error' },
  feature: { label: 'Feature Request', icon: <LightbulbIcon />, color: 'info' },
  general: { label: 'General Feedback', icon: <ChatBubbleIcon />, color: 'default' },
};

const statusConfig: Record<
  FeedbackStatus,
  { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }
> = {
  new: { label: 'New', color: 'primary' },
  in_progress: { label: 'In Progress', color: 'warning' },
  resolved: { label: 'Resolved', color: 'success' },
  closed: { label: 'Closed', color: 'default' },
  wont_fix: { label: "Won't Fix", color: 'error' },
};

export function FeedbackList() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Subscribe to feedback collection
  useEffect(() => {
    const { db } = getFirebase();
    const feedbackRef = collection(db, 'feedback');
    const q = query(feedbackRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FeedbackItem[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as FeedbackItem);
        });
        setFeedback(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching feedback:', err);
        setError('Failed to load feedback. Make sure you have admin permissions.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter feedback
  const filteredFeedback = feedback.filter((item) => {
    // Type filter
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;

    // Status filter
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.userEmail.toLowerCase().includes(query) ||
        item.userName.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const handleStatusChange = useCallback(
    async (feedbackId: string, newStatus: FeedbackStatus) => {
      setUpdating(true);
      try {
        const { db } = getFirebase();
        const feedbackRef = doc(db, 'feedback', feedbackId);
        await updateDoc(feedbackRef, {
          status: newStatus,
          updatedAt: Timestamp.now(),
        });

        // Update selected feedback if it's the one being modified
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      } catch (err) {
        console.error('Error updating status:', err);
        setError('Failed to update status');
      } finally {
        setUpdating(false);
      }
    },
    [selectedFeedback]
  );

  const handleAdminNotesChange = useCallback(async (feedbackId: string, notes: string) => {
    try {
      const { db } = getFirebase();
      const feedbackRef = doc(db, 'feedback', feedbackId);
      await updateDoc(feedbackRef, {
        adminNotes: notes,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Error updating notes:', err);
    }
  }, []);

  const openDetailDialog = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setDetailDialogOpen(true);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginated feedback
  const paginatedFeedback = filteredFeedback.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search feedback..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          <ToggleButtonGroup
            value={typeFilter}
            exclusive
            onChange={(_, value) => value && setTypeFilter(value)}
            size="small"
          >
            <ToggleButton value="all">
              <FilterIcon sx={{ mr: 0.5 }} /> All Types
            </ToggleButton>
            <ToggleButton value="bug">
              <BugReportIcon sx={{ mr: 0.5 }} /> Bugs
            </ToggleButton>
            <ToggleButton value="feature">
              <LightbulbIcon sx={{ mr: 0.5 }} /> Features
            </ToggleButton>
            <ToggleButton value="general">
              <ChatBubbleIcon sx={{ mr: 0.5 }} /> General
            </ToggleButton>
          </ToggleButtonGroup>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | 'all')}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  {config.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" color="text.secondary">
            {filteredFeedback.length} of {feedback.length} items
          </Typography>
        </Stack>
      </Paper>

      {/* Feedback Table */}
      {filteredFeedback.length === 0 ? (
        <Alert severity="info">
          {feedback.length === 0
            ? 'No feedback submissions yet.'
            : 'No feedback matches your filters.'}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 120 }}>Type</TableCell>
                <TableCell>Title</TableCell>
                <TableCell sx={{ width: 180 }}>Submitted By</TableCell>
                <TableCell sx={{ width: 130 }}>Status</TableCell>
                <TableCell sx={{ width: 140 }}>Submitted</TableCell>
                <TableCell sx={{ width: 60 }} align="center">
                  📎
                </TableCell>
                <TableCell sx={{ width: 100 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedFeedback.map((item) => (
                <TableRow key={item.id} hover>
                  {/* Type */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          color: `${typeConfig[item.type].color}.main`,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {typeConfig[item.type].icon}
                      </Box>
                      <Typography variant="body2">
                        {typeConfig[item.type].label.split(' ')[0]}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Title */}
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </Typography>
                  </TableCell>

                  {/* Submitted By */}
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {item.userName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {item.userEmail}
                    </Typography>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Chip
                      label={statusConfig[item.status].label}
                      size="small"
                      color={statusConfig[item.status].color}
                    />
                  </TableCell>

                  {/* Submitted */}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}
                    </Typography>
                  </TableCell>

                  {/* Screenshots */}
                  <TableCell align="center">
                    {item.screenshotUrls?.length > 0 && (
                      <Badge badgeContent={item.screenshotUrls.length} color="primary">
                        <AttachFileIcon fontSize="small" color="action" />
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => openDetailDialog(item)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {item.pageUrl && (
                        <Tooltip title="Open Page URL">
                          <IconButton
                            size="small"
                            component="a"
                            href={item.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredFeedback.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedFeedback && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} alignItems="center">
                {typeConfig[selectedFeedback.type].icon}
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">{selectedFeedback.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {typeConfig[selectedFeedback.type].label} • Submitted{' '}
                    {formatDistanceToNow(selectedFeedback.createdAt.toDate(), { addSuffix: true })}
                  </Typography>
                </Box>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <Select
                    value={selectedFeedback.status}
                    onChange={(e) =>
                      handleStatusChange(selectedFeedback.id, e.target.value as FeedbackStatus)
                    }
                    disabled={updating}
                  >
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <MenuItem key={key} value={key}>
                        {config.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </DialogTitle>

            <DialogContent dividers>
              <Stack spacing={3}>
                {/* User Info */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Submitted By
                  </Typography>
                  <Typography>
                    {selectedFeedback.userName} ({selectedFeedback.userEmail})
                  </Typography>
                </Box>

                {/* Description */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Description
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedFeedback.description}
                  </Typography>
                </Box>

                {/* Bug-specific fields */}
                {selectedFeedback.type === 'bug' && (
                  <>
                    {selectedFeedback.stepsToReproduce && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Steps to Reproduce
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                          {selectedFeedback.stepsToReproduce}
                        </Typography>
                      </Box>
                    )}

                    {selectedFeedback.expectedBehavior && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Expected Behavior
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                          {selectedFeedback.expectedBehavior}
                        </Typography>
                      </Box>
                    )}

                    {selectedFeedback.actualBehavior && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Actual Behavior
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                          {selectedFeedback.actualBehavior}
                        </Typography>
                      </Box>
                    )}

                    {selectedFeedback.consoleErrors && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Console Errors
                        </Typography>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            bgcolor: 'grey.900',
                            color: 'error.light',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            whiteSpace: 'pre-wrap',
                            overflow: 'auto',
                            maxHeight: 200,
                          }}
                        >
                          {selectedFeedback.consoleErrors}
                        </Paper>
                      </Box>
                    )}
                  </>
                )}

                {/* Feature-specific fields */}
                {selectedFeedback.type === 'feature' && selectedFeedback.stepsToReproduce && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Use Case
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedFeedback.stepsToReproduce}
                    </Typography>
                  </Box>
                )}

                {/* Screenshots */}
                {selectedFeedback.screenshotUrls?.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Screenshots ({selectedFeedback.screenshotUrls.length})
                    </Typography>
                    <ImageList cols={2} gap={8}>
                      {selectedFeedback.screenshotUrls.map((url, index) => (
                        <ImageListItem key={index}>
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Screenshot ${index + 1}`}
                              loading="lazy"
                              style={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: 4,
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            />
                          </a>
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Box>
                )}

                {/* Technical Info */}
                {(selectedFeedback.pageUrl || selectedFeedback.browserInfo) && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Technical Information
                    </Typography>
                    {selectedFeedback.pageUrl && (
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        <strong>Page URL:</strong>{' '}
                        <a
                          href={selectedFeedback.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {selectedFeedback.pageUrl}
                        </a>
                      </Typography>
                    )}
                    {selectedFeedback.browserInfo && (
                      <Typography variant="body2">
                        <strong>Browser:</strong> {selectedFeedback.browserInfo}
                      </Typography>
                    )}
                  </Box>
                )}

                <Divider />

                {/* Admin Notes */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Admin Notes
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Add internal notes about this feedback..."
                    value={selectedFeedback.adminNotes || ''}
                    onChange={(e) => {
                      setSelectedFeedback((prev) =>
                        prev ? { ...prev, adminNotes: e.target.value } : null
                      );
                    }}
                    onBlur={(e) => handleAdminNotesChange(selectedFeedback.id, e.target.value)}
                  />
                </Box>
              </Stack>
            </DialogContent>

            <DialogActions>
              <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
