'use client';

/**
 * Email Management Page
 *
 * Unified admin page for all email notification configuration:
 *  - SMTP / delivery settings
 *  - Send schedule (daily / weekly / monthly)
 *  - Default recipients (global fallback)
 *  - Per-event configuration: enabled toggle, custom recipients, test email
 *  - Delivery log (recent sends from emailLogs collection)
 *
 * Replaces the legacy /admin/settings and /admin/notifications pages.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  Divider,
  CircularProgress,
  Snackbar,
  Checkbox,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  Email as EmailIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationsIcon,
  History as HistoryIcon,
  PlayArrow as TestIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailConfig {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  recipientUserIds: string[];
  eventRecipients: Record<string, string[]>;
  schedule: ScheduleConfig;
}

interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0–6, Sunday=0
  dayOfMonth?: number; // 1–31
}

interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  department?: string;
}

interface EmailLog {
  id: string;
  eventId: string;
  subject: string;
  recipientCount: number;
  sentAt: { toDate: () => Date } | Date | string;
  status: 'sent' | 'failed';
  error?: string;
}

type NotificationSettings = Record<string, boolean>;

// ---------------------------------------------------------------------------
// Static event/section definitions (mirrors admin/notifications/page.tsx)
// ---------------------------------------------------------------------------

interface NotificationEvent {
  id: string;
  label: string;
  description: string;
}

interface NotificationSection {
  id: string;
  title: string;
  events: NotificationEvent[];
}

const NOTIFICATION_SECTIONS: NotificationSection[] = [
  {
    id: 'procurement',
    title: 'Procurement',
    events: [
      {
        id: 'pr_submitted',
        label: 'PR Submitted',
        description: 'When a purchase request is submitted for approval',
      },
      {
        id: 'pr_approved',
        label: 'PR Approved',
        description: 'When a purchase request is approved — notifies procurement team',
      },
      { id: 'po_approved', label: 'PO Approved', description: 'When a purchase order is approved' },
      {
        id: 'po_issued',
        label: 'PO Issued',
        description: 'When a purchase order is issued to vendor',
      },
      {
        id: 'po_rejected',
        label: 'PO Rejected',
        description: 'When a purchase order is rejected — notifies creator for revision',
      },
      {
        id: 'rfq_completed',
        label: 'RFQ Completed',
        description: 'When RFQ evaluation is complete and an offer is selected — ready for PO',
      },
      {
        id: 'delivery_overdue',
        label: 'Delivery Overdue',
        description: 'When a purchase order delivery is past due date',
      },
      {
        id: 'gr_completed',
        label: 'Goods Receipt Completed',
        description: 'When a goods receipt inspection is completed',
      },
      {
        id: 'service_order_results',
        label: 'Service Results Received',
        description: 'When service order results are received and ready for review',
      },
      {
        id: 'service_order_completed',
        label: 'Service Order Completed',
        description: 'When a service order is completed',
      },
    ],
  },
  {
    id: 'accounting',
    title: 'Accounting',
    events: [
      {
        id: 'invoice_created',
        label: 'Invoice Created',
        description: 'When a new customer invoice is created',
      },
      {
        id: 'bill_created',
        label: 'Bill Created',
        description: 'When a new vendor bill is created',
      },
      {
        id: 'payment_approved',
        label: 'Payment Approved',
        description: 'When a payment is approved for processing',
      },
      {
        id: 'journal_entry_submitted',
        label: 'Journal Entry Submitted',
        description: 'When a journal entry is submitted for approval',
      },
      {
        id: 'bill_overdue',
        label: 'Bill Overdue',
        description: 'When a vendor bill is past its due date',
      },
      {
        id: 'payment_batch_submitted',
        label: 'Payment Batch Submitted',
        description: 'When a payment batch is submitted for approval',
      },
      {
        id: 'payment_batch_approved',
        label: 'Payment Batch Approved',
        description: 'When a payment batch is approved for execution',
      },
      {
        id: 'payment_batch_completed',
        label: 'Payment Batch Completed',
        description: 'When all payments in a batch are processed',
      },
    ],
  },
  {
    id: 'hr',
    title: 'HR & Leave',
    events: [
      {
        id: 'leave_submitted',
        label: 'Leave Request Submitted',
        description: 'When an employee submits a leave request',
      },
      {
        id: 'leave_approved',
        label: 'Leave Approved/Rejected',
        description: 'When a leave request is approved or rejected',
      },
      {
        id: 'on_duty_submitted',
        label: 'On-Duty Request Submitted',
        description: 'When an on-duty request is submitted for approval',
      },
      {
        id: 'on_duty_decided',
        label: 'On-Duty Approved/Rejected',
        description: 'When an on-duty request is approved or rejected',
      },
      {
        id: 'travel_expense_submitted',
        label: 'Travel Expense Submitted',
        description: 'When a travel expense report is submitted for review',
      },
      {
        id: 'travel_expense_decided',
        label: 'Travel Expense Approved/Rejected',
        description: 'When a travel expense is approved or rejected',
      },
      {
        id: 'travel_expense_reimbursed',
        label: 'Travel Expense Reimbursed',
        description: 'When a travel expense reimbursement is completed',
      },
    ],
  },
  {
    id: 'proposals',
    title: 'Proposals & Business',
    events: [
      {
        id: 'enquiry_assigned',
        label: 'Enquiry Assigned',
        description: 'When an enquiry is assigned for review',
      },
      {
        id: 'enquiry_won_lost',
        label: 'Enquiry Won/Lost',
        description: 'When an enquiry outcome is decided',
      },
      {
        id: 'proposal_submitted_for_approval',
        label: 'Proposal Submitted',
        description: 'When a proposal is submitted for internal approval',
      },
      {
        id: 'proposal_approved',
        label: 'Proposal Approved',
        description: 'When a proposal is internally approved',
      },
      {
        id: 'proposal_sent_to_client',
        label: 'Proposal Sent to Client',
        description: 'When a proposal is submitted to the client',
      },
      {
        id: 'proposal_outcome',
        label: 'Proposal Accepted/Rejected',
        description: 'When a client accepts or rejects a proposal',
      },
    ],
  },
  {
    id: 'feedback',
    title: 'Feedback',
    events: [
      {
        id: 'feedback_submitted',
        label: 'New Feedback Submitted',
        description: 'When a user submits a bug report, feature request, or general feedback',
      },
    ],
  },
  {
    id: 'system',
    title: 'System',
    events: [
      {
        id: 'new_user',
        label: 'New User Registered',
        description: 'When a new user signs up and needs approval',
      },
      {
        id: 'backup_completed',
        label: 'Backup Completed',
        description: 'When a scheduled data backup completes',
      },
    ],
  },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: { toDate: () => Date } | Date | string | undefined): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && 'toDate' in value) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value as string);
}

// ---------------------------------------------------------------------------
// Sub-component: Recipients Dialog
// ---------------------------------------------------------------------------

interface RecipientsDialogProps {
  open: boolean;
  eventLabel: string;
  allUsers: UserRecord[];
  globalRecipientIds: string[];
  currentIds: string[]; // empty = use global
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

function RecipientsDialog({
  open,
  eventLabel,
  allUsers,
  globalRecipientIds,
  currentIds,
  onSave,
  onClose,
}: RecipientsDialogProps) {
  const [selected, setSelected] = useState<string[]>(currentIds);

  useEffect(() => {
    if (open) setSelected(currentIds);
  }, [open, currentIds]);

  const toggle = (uid: string) => {
    setSelected((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">Recipients — {eventLabel}</Typography>
          <Typography variant="body2" color="text.secondary">
            Select users to receive this notification. Leave empty to use the default list.
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Default list: {globalRecipientIds.length} user
            {globalRecipientIds.length !== 1 ? 's' : ''}.
            {selected.length === 0
              ? ' Currently using default.'
              : ` Custom list overrides the default for this event.`}
          </Typography>
        </Alert>
        {allUsers.map((u) => (
          <Box
            key={u.uid}
            sx={{
              display: 'flex',
              alignItems: 'center',
              py: 0.5,
              px: 1,
              borderRadius: 1,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={selected.includes(u.uid)}
                  onChange={() => toggle(u.uid)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">{u.displayName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {u.email}
                    {u.department ? ` — ${u.department}` : ''}
                  </Typography>
                </Box>
              }
              sx={{ flex: 1, m: 0 }}
            />
          </Box>
        ))}
        {allUsers.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No active users found
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Button
          size="small"
          color="inherit"
          onClick={() => setSelected([])}
          disabled={selected.length === 0}
        >
          Clear (use default)
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={() => onSave(selected)}>
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: EmailConfig = {
  enabled: false,
  fromEmail: '',
  fromName: 'Vapour Toolbox',
  recipientUserIds: [],
  eventRecipients: {},
  schedule: { frequency: 'daily' },
};

export default function EmailManagementPage() {
  const { user } = useAuth();

  // ---- State ---------------------------------------------------------------
  const [config, setConfig] = useState<EmailConfig>(DEFAULT_CONFIG);
  const [eventSettings, setEventSettings] = useState<NotificationSettings>({});
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testingEventId, setTestingEventId] = useState<string | null>(null);
  const [recipientsDialog, setRecipientsDialog] = useState<{
    open: boolean;
    eventId: string;
    eventLabel: string;
  }>({ open: false, eventId: '', eventLabel: '' });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'success' });

  // ---- Load ----------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const { db } = getFirebase();

        const [configDoc, eventsDoc, usersSnap, logsSnap] = await Promise.all([
          getDoc(doc(db, 'notificationSettings', 'emailConfig')),
          getDoc(doc(db, 'notificationSettings', 'config')),
          getDocs(query(collection(db, COLLECTIONS.USERS), where('isActive', '==', true))),
          getDocs(query(collection(db, 'emailLogs'), orderBy('sentAt', 'desc'), limit(50))),
        ]);

        if (configDoc.exists()) {
          const d = configDoc.data();
          setConfig({
            enabled: d.enabled ?? false,
            fromEmail: d.fromEmail ?? '',
            fromName: d.fromName ?? 'Vapour Toolbox',
            recipientUserIds: d.recipientUserIds ?? [],
            eventRecipients: d.eventRecipients ?? {},
            schedule: d.schedule ?? { frequency: 'daily' },
          });
        }

        if (eventsDoc.exists()) {
          setEventSettings(eventsDoc.data() as NotificationSettings);
        }

        const userList: UserRecord[] = [];
        usersSnap.forEach((d) => {
          const data = d.data();
          userList.push({
            uid: d.id,
            email: data.email || '',
            displayName: data.displayName || data.email || d.id,
            department: data.department || '',
          });
        });
        userList.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(userList);

        const logList: EmailLog[] = [];
        logsSnap.forEach((d) => {
          const data = d.data();
          logList.push({
            id: d.id,
            eventId: data.eventId || '',
            subject: data.subject || '',
            recipientCount: data.recipientCount ?? 0,
            sentAt: data.sentAt,
            status: data.status || 'sent',
            error: data.error,
          });
        });
        setLogs(logList);
      } catch (error) {
        console.error('Error loading email config:', error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // ---- Save ----------------------------------------------------------------
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { db } = getFirebase();

      await Promise.all([
        setDoc(doc(db, 'notificationSettings', 'emailConfig'), {
          ...config,
          updatedAt: new Date(),
          updatedBy: user?.uid || '',
        }),
        setDoc(doc(db, 'notificationSettings', 'config'), {
          ...eventSettings,
          updatedAt: new Date(),
        }),
      ]);

      setSnackbar({ open: true, message: 'Settings saved', severity: 'success' });
    } catch (error) {
      console.error('Error saving email settings:', error);
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [config, eventSettings, user]);

  // ---- Global test email ---------------------------------------------------
  const handleSendTest = useCallback(async () => {
    if (!config.fromEmail || !user?.email) {
      setSnackbar({ open: true, message: 'Set a from email address first', severity: 'error' });
      return;
    }
    setSendingTest(true);
    try {
      const { functions } = getFirebase();
      const sendTest = httpsCallable(functions, 'sendTestEmail');
      await sendTest({
        recipientEmail: user.email,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
      });
      setSnackbar({ open: true, message: `Test email sent to ${user.email}`, severity: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test email';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSendingTest(false);
    }
  }, [config, user]);

  // ---- Per-event test email ------------------------------------------------
  const handleTestEvent = useCallback(
    async (eventId: string) => {
      if (!config.fromEmail || !user?.email) {
        setSnackbar({ open: true, message: 'Set a from email address first', severity: 'error' });
        return;
      }
      setTestingEventId(eventId);
      try {
        const { functions } = getFirebase();
        const sendTest = httpsCallable(functions, 'sendTestEmail');
        await sendTest({
          recipientEmail: user.email,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          eventId,
        });
        setSnackbar({
          open: true,
          message: `Test email for "${eventId}" sent to ${user.email}`,
          severity: 'success',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send test email';
        setSnackbar({ open: true, message, severity: 'error' });
      } finally {
        setTestingEventId(null);
      }
    },
    [config, user]
  );

  // ---- Helpers -------------------------------------------------------------
  const toggleRecipient = (uid: string) => {
    setConfig((prev) => {
      const ids = new Set(prev.recipientUserIds);
      if (ids.has(uid)) ids.delete(uid);
      else ids.add(uid);
      return { ...prev, recipientUserIds: Array.from(ids) };
    });
  };

  const toggleEvent = (eventId: string) => {
    setEventSettings((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const saveEventRecipients = (eventId: string, ids: string[]) => {
    setConfig((prev) => ({
      ...prev,
      eventRecipients: { ...prev.eventRecipients, [eventId]: ids },
    }));
    setRecipientsDialog({ open: false, eventId: '', eventLabel: '' });
  };

  // ---- Loading state -------------------------------------------------------
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalEvents = NOTIFICATION_SECTIONS.reduce((sum, s) => sum + s.events.length, 0);
  const enabledCount = Object.values(eventSettings).filter(Boolean).length;

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Email Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure delivery, recipients, schedule, and per-event notification settings
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </Box>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Email Configuration                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <EmailIcon color="primary" />
            <Typography variant="h6">Email Configuration</Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
            }
            label="Enable email notifications"
            sx={{ mb: 2, display: 'block' }}
          />

          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              label="From Email"
              value={config.fromEmail}
              onChange={(e) => setConfig((prev) => ({ ...prev, fromEmail: e.target.value }))}
              placeholder="notifications@vapourdesal.com"
              helperText="Google Workspace email with App Password enabled"
              sx={{ flex: 1, minWidth: 280 }}
              size="small"
            />
            <TextField
              label="Sender Name"
              value={config.fromName}
              onChange={(e) => setConfig((prev) => ({ ...prev, fromName: e.target.value }))}
              placeholder="Vapour Toolbox"
              sx={{ flex: 1, minWidth: 200 }}
              size="small"
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={handleSendTest}
              disabled={sendingTest || !config.fromEmail}
              size="small"
            >
              {sendingTest ? 'Sending...' : 'Send Test Email'}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Sends a test email to {user?.email || 'your email'}
            </Typography>
          </Box>

          <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
            <Typography variant="body2">
              A Gmail App Password must be set on the server via:{' '}
              <code>firebase functions:secrets:set GMAIL_APP_PASSWORD</code>
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Schedule                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ScheduleIcon color="primary" />
            <Typography variant="h6">Send Schedule</Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Controls how often overdue-item digest emails are sent. Applies to{' '}
            <strong>Bill Overdue</strong> and <strong>Delivery Overdue</strong> notifications.
            Event-triggered notifications (PR submitted, etc.) always send immediately.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>
              Frequency
            </Typography>
            <ToggleButtonGroup
              value={config.schedule.frequency}
              exclusive
              size="small"
              onChange={(_e, val) => {
                if (val) {
                  setConfig((prev) => ({
                    ...prev,
                    schedule: { frequency: val },
                  }));
                }
              }}
            >
              <ToggleButton value="daily">Daily</ToggleButton>
              <ToggleButton value="weekly">Weekly</ToggleButton>
              <ToggleButton value="monthly">Monthly</ToggleButton>
            </ToggleButtonGroup>

            {config.schedule.frequency === 'weekly' && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Day of week</InputLabel>
                <Select
                  value={config.schedule.dayOfWeek ?? 1}
                  label="Day of week"
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      schedule: { ...prev.schedule, dayOfWeek: Number(e.target.value) },
                    }))
                  }
                >
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <MenuItem key={day} value={idx}>
                      {day}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {config.schedule.frequency === 'monthly' && (
              <TextField
                label="Day of month"
                type="number"
                size="small"
                value={config.schedule.dayOfMonth ?? 1}
                onChange={(e) => {
                  const val = Math.min(31, Math.max(1, Number(e.target.value)));
                  setConfig((prev) => ({
                    ...prev,
                    schedule: { ...prev.schedule, dayOfMonth: val },
                  }));
                }}
                inputProps={{ min: 1, max: 31 }}
                sx={{ width: 140 }}
              />
            )}
          </Box>

          <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Send time is fixed at <strong>9:00 AM IST</strong>. Changing the send time requires
              redeploying the Cloud Function.
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Default Recipients                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon color="primary" />
              <Typography variant="h6">Default Recipients</Typography>
              <Chip
                label={`${config.recipientUserIds.length}/${users.length} selected`}
                size="small"
                color={config.recipientUserIds.length > 0 ? 'primary' : 'default'}
              />
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, recipientUserIds: users.map((u) => u.uid) }))
                }
              >
                Select All
              </Button>
              <Button
                size="small"
                onClick={() => setConfig((prev) => ({ ...prev, recipientUserIds: [] }))}
              >
                Deselect All
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These users receive all notifications that don&apos;t have a custom recipient list set
            below.
          </Typography>

          <Divider sx={{ mb: 1 }} />

          {users.map((u) => (
            <Box
              key={u.uid}
              sx={{
                display: 'flex',
                alignItems: 'center',
                py: 0.5,
                px: 1,
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={config.recipientUserIds.includes(u.uid)}
                    onChange={() => toggleRecipient(u.uid)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">{u.displayName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {u.email}
                      {u.department ? ` — ${u.department}` : ''}
                    </Typography>
                  </Box>
                }
                sx={{ flex: 1 }}
              />
            </Box>
          ))}

          {users.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No active users found
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Event Configuration                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <NotificationsIcon color="primary" />
            <Typography variant="h6">Event Configuration</Typography>
            <Chip
              label={`${enabledCount}/${totalEvents} enabled`}
              size="small"
              color={enabledCount > 0 ? 'primary' : 'default'}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enable or disable each notification. Optionally set custom recipients per event — leave
            blank to use the Default Recipients list above.
          </Typography>

          {NOTIFICATION_SECTIONS.map((section, sIdx) => (
            <Box key={section.id}>
              {sIdx > 0 && <Divider sx={{ my: 2 }} />}
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: 'block', mb: 1, fontWeight: 600 }}
              >
                {section.title}
              </Typography>

              {section.events.map((event, eIdx) => {
                const eventRecipIds = config.eventRecipients[event.id] ?? [];
                const hasCustom = eventRecipIds.length > 0;
                const isEnabled = eventSettings[event.id] ?? false;
                const isTesting = testingEventId === event.id;

                return (
                  <Box key={event.id}>
                    {eIdx > 0 && <Divider sx={{ my: 0.5 }} />}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 1,
                        px: 1,
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      {/* Toggle */}
                      <Switch
                        size="small"
                        checked={isEnabled}
                        onChange={() => toggleEvent(event.id)}
                        sx={{ flexShrink: 0 }}
                      />

                      {/* Label + description */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: isEnabled ? 500 : 400 }}>
                          {event.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {event.description}
                        </Typography>
                      </Box>

                      {/* Recipients chip */}
                      <Tooltip
                        title={
                          hasCustom
                            ? `Custom: ${eventRecipIds.length} user${eventRecipIds.length !== 1 ? 's' : ''}`
                            : `Using default list (${config.recipientUserIds.length} users)`
                        }
                      >
                        <Chip
                          size="small"
                          label={
                            hasCustom
                              ? `Custom (${eventRecipIds.length})`
                              : `Default (${config.recipientUserIds.length})`
                          }
                          color={hasCustom ? 'primary' : 'default'}
                          variant={hasCustom ? 'filled' : 'outlined'}
                          onClick={() =>
                            setRecipientsDialog({
                              open: true,
                              eventId: event.id,
                              eventLabel: event.label,
                            })
                          }
                          sx={{ cursor: 'pointer', flexShrink: 0 }}
                        />
                      </Tooltip>

                      {/* Per-event test button */}
                      <Tooltip title={`Send test email for "${event.label}" to ${user?.email}`}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleTestEvent(event.id)}
                            disabled={isTesting || !config.fromEmail || !isEnabled}
                            sx={{ flexShrink: 0 }}
                          >
                            {isTesting ? (
                              <CircularProgress size={16} />
                            ) : (
                              <TestIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Delivery Log                                             */}
      {/* ------------------------------------------------------------------ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">Delivery Log</Typography>
            <Chip label={`Last ${logs.length}`} size="small" />
          </Box>

          {logs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No delivery records yet. Emails sent will appear here.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Date / Time</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Event</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Recipients</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => {
                  const date = toDate(log.sentAt);
                  return (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2">
                          {date.toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {date.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata',
                          })}{' '}
                          IST
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {log.eventId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {log.subject}
                        </Typography>
                        {log.error && (
                          <Typography variant="caption" color="error">
                            {log.error}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Typography variant="body2">{log.recipientCount}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.status}
                          size="small"
                          color={log.status === 'sent' ? 'success' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recipients Dialog */}
      <RecipientsDialog
        open={recipientsDialog.open}
        eventLabel={recipientsDialog.eventLabel}
        allUsers={users}
        globalRecipientIds={config.recipientUserIds}
        currentIds={config.eventRecipients[recipientsDialog.eventId] ?? []}
        onSave={(ids) => saveEventRecipients(recipientsDialog.eventId, ids)}
        onClose={() => setRecipientsDialog({ open: false, eventId: '', eventLabel: '' })}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}
