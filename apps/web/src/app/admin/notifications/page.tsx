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
        id: 'payment_approved',
        label: 'Payment Approved',
        description: 'When a payment is approved for processing',
      },
      {
        id: 'bill_overdue',
        label: 'Bill Overdue',
        description: 'When a vendor bill is past its due date',
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
          Email delivery requires additional setup
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          These settings control which events should trigger notifications. To actually send emails,
          you need to configure one of: Firebase &quot;Trigger Email&quot; Extension, SendGrid, or
          another SMTP provider. Toggle the settings now and configure email delivery when ready.
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
