'use client';

/**
 * Notification Settings Page
 *
 * Admin page to configure email notification preferences per event type.
 * Settings are stored in Firestore. Actual email sending requires
 * configuring a mail service (Firebase Extension or SendGrid).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Divider,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import NextLink from 'next/link';

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
        id: 'po_approved',
        label: 'PO Approved',
        description: 'When a purchase order is approved',
      },
      {
        id: 'po_issued',
        label: 'PO Issued',
        description: 'When a purchase order is issued to vendor',
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

type NotificationSettings = Record<string, boolean>;

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load settings from Firestore
  useEffect(() => {
    async function loadSettings() {
      try {
        const { db } = getFirebase();
        const docRef = doc(db, 'notificationSettings', 'config');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSettings(docSnap.data() as NotificationSettings);
        } else {
          // Initialize with all notifications disabled
          const defaults: NotificationSettings = {};
          NOTIFICATION_SECTIONS.forEach((section) => {
            section.events.forEach((event) => {
              defaults[event.id] = false;
            });
          });
          setSettings(defaults);
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const toggleSetting = (eventId: string) => {
    setSettings((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const { db } = getFirebase();
      const docRef = doc(db, 'notificationSettings', 'config');
      await setDoc(docRef, {
        ...settings,
        updatedAt: new Date(),
      });
      setSnackbar({ open: true, message: 'Settings saved', severity: 'success' });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const enabledCount = Object.values(settings).filter(Boolean).length;
  const totalCount = NOTIFICATION_SECTIONS.reduce((sum, s) => sum + s.events.length, 0);

  return (
    <Box>
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
            Notification Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure which events trigger email notifications ({enabledCount}/{totalCount} enabled)
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Email delivery is configured in Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          These settings control which events should trigger notifications. To configure email
          delivery, sender details, and recipients, go to{' '}
          <NextLink href="/admin/settings" style={{ color: 'inherit' }}>
            Settings
          </NextLink>
          .
        </Typography>
      </Alert>

      {NOTIFICATION_SECTIONS.map((section) => (
        <Card key={section.id} sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              {section.title}
            </Typography>

            {section.events.map((event, eventIdx) => (
              <Box key={event.id}>
                {eventIdx > 0 && <Divider sx={{ my: 1 }} />}
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Box>
                    <Typography variant="body1">{event.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {event.description}
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings[event.id] || false}
                        onChange={() => toggleSetting(event.id)}
                      />
                    }
                    label=""
                  />
                </Box>
              </Box>
            ))}
          </CardContent>
        </Card>
      ))}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}
