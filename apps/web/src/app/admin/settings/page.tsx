'use client';

/**
 * Admin Settings Page
 *
 * Configure email delivery (Gmail SMTP) and manage notification recipients.
 * Settings stored in Firestore notificationSettings/emailConfig.
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
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  Email as EmailIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface EmailConfig {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  recipientUserIds: string[];
  updatedAt?: Date;
  updatedBy?: string;
}

interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  department?: string;
  isActive: boolean;
  status: string;
}

const DEFAULT_CONFIG: EmailConfig = {
  enabled: false,
  fromEmail: '',
  fromName: 'Vapour Toolbox',
  recipientUserIds: [],
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<EmailConfig>(DEFAULT_CONFIG);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'success' });

  // Load config and users
  useEffect(() => {
    async function load() {
      try {
        const { db } = getFirebase();

        // Load email config
        const configDoc = await getDoc(doc(db, 'notificationSettings', 'emailConfig'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          setConfig({
            enabled: data.enabled ?? false,
            fromEmail: data.fromEmail ?? '',
            fromName: data.fromName ?? 'Vapour Toolbox',
            recipientUserIds: data.recipientUserIds ?? [],
          });
        }

        // Load active users
        const usersSnap = await getDocs(
          query(collection(db, COLLECTIONS.USERS), where('isActive', '==', true))
        );
        const userList: UserRecord[] = [];
        usersSnap.forEach((d) => {
          const data = d.data();
          userList.push({
            uid: d.id,
            email: data.email || '',
            displayName: data.displayName || data.email || d.id,
            department: data.department || '',
            isActive: data.isActive,
            status: data.status,
          });
        });
        userList.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(userList);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { db } = getFirebase();
      await setDoc(doc(db, 'notificationSettings', 'emailConfig'), {
        ...config,
        updatedAt: new Date(),
        updatedBy: user?.uid || '',
      });
      setSnackbar({ open: true, message: 'Settings saved', severity: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [config, user]);

  const handleSendTest = useCallback(async () => {
    if (!config.fromEmail || !user?.email) {
      setSnackbar({
        open: true,
        message: 'Please set a from email address and save first',
        severity: 'error',
      });
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
      setSnackbar({
        open: true,
        message: `Test email sent to ${user.email}`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Test email failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to send test email';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSendingTest(false);
    }
  }, [config, user]);

  const toggleRecipient = (uid: string) => {
    setConfig((prev) => {
      const ids = new Set(prev.recipientUserIds);
      if (ids.has(uid)) {
        ids.delete(uid);
      } else {
        ids.add(uid);
      }
      return { ...prev, recipientUserIds: Array.from(ids) };
    });
  };

  const selectAllUsers = () => {
    setConfig((prev) => ({
      ...prev,
      recipientUserIds: users.map((u) => u.uid),
    }));
  };

  const deselectAllUsers = () => {
    setConfig((prev) => ({
      ...prev,
      recipientUserIds: [],
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedCount = config.recipientUserIds.length;

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
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Email delivery configuration and notification recipients
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {/* Email Configuration */}
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

      {/* Notification Recipients */}
      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon color="primary" />
              <Typography variant="h6">Notification Recipients</Typography>
              <Chip
                label={`${selectedCount}/${users.length} selected`}
                size="small"
                color={selectedCount > 0 ? 'primary' : 'default'}
              />
            </Box>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={selectAllUsers}>
                Select All
              </Button>
              <Button size="small" onClick={deselectAllUsers}>
                Deselect All
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select which users should receive email notifications. Users can also opt out
            individually from their profile preferences.
          </Typography>

          <Divider sx={{ mb: 1 }} />

          {users.map((u) => (
            <Box
              key={u.uid}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 0.5,
                '&:hover': { bgcolor: 'action.hover' },
                borderRadius: 1,
                px: 1,
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}
