'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  Button,
  Typography,
  Alert,
  CircularProgress,
  TextField,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Email Link Callback Page
 *
 * This page handles the callback when a user clicks a sign-in link from their email.
 * It completes the passwordless authentication flow.
 */
export default function EmailLinkPage() {
  const router = useRouter();
  const {
    user,
    claims,
    loading: authLoading,
    isEmailLinkSignIn,
    completeEmailLinkSignIn,
  } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [needsEmail, setNeedsEmail] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    if (!authLoading && user && claims) {
      router.push('/dashboard');
    }
  }, [authLoading, user, claims, router]);

  // Handle the email link sign-in
  useEffect(() => {
    const handleSignIn = async () => {
      // Get the full URL including query parameters
      const link = window.location.href;

      // Check if this is a valid sign-in link
      if (!isEmailLinkSignIn(link)) {
        setError('Invalid sign-in link. Please request a new one from the login page.');
        setLoading(false);
        return;
      }

      // Get email from localStorage (stored when link was sent)
      const storedEmail = window.localStorage.getItem('emailForSignIn');

      if (!storedEmail) {
        // User opened the link on a different device/browser
        // Need to ask for their email
        setNeedsEmail(true);
        setLoading(false);
        return;
      }

      // Complete the sign-in
      try {
        await completeEmailLinkSignIn(storedEmail, link);
        router.push('/dashboard');
      } catch (err: unknown) {
        const isFirebaseError = (error: unknown): error is { code?: string; message?: string } => {
          return typeof error === 'object' && error !== null;
        };

        const firebaseError = isFirebaseError(err)
          ? err
          : { code: undefined, message: String(err) };

        if (firebaseError.message === 'UNAUTHORIZED_DOMAIN') {
          setError(
            'Your email domain is not authorized to access this application. ' +
              'Please contact the administrator to request access.'
          );
        } else if (firebaseError.code === 'auth/invalid-action-code') {
          setError(
            'This sign-in link has expired or already been used. ' +
              'Please request a new one from the login page.'
          );
        } else if (firebaseError.code === 'auth/invalid-email') {
          setError('The email address is invalid.');
        } else {
          setError(
            `Failed to sign in: ${firebaseError.code || firebaseError.message || 'Unknown error'}`
          );
        }
        setLoading(false);
      }
    };

    if (!authLoading) {
      handleSignIn();
    }
  }, [authLoading, isEmailLinkSignIn, completeEmailLinkSignIn, router]);

  // Handle manual email submission (when link opened on different device)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const link = window.location.href;
      await completeEmailLinkSignIn(email, link);
      router.push('/dashboard');
    } catch (err: unknown) {
      const isFirebaseError = (error: unknown): error is { code?: string; message?: string } => {
        return typeof error === 'object' && error !== null;
      };

      const firebaseError = isFirebaseError(err) ? err : { code: undefined, message: String(err) };

      if (firebaseError.message === 'UNAUTHORIZED_DOMAIN') {
        setError(
          'Your email domain is not authorized to access this application. ' +
            'Please contact the administrator to request access.'
        );
      } else if (firebaseError.code === 'auth/invalid-action-code') {
        setError(
          'This sign-in link has expired or already been used. ' +
            'Please request a new one from the login page.'
        );
      } else if (firebaseError.code === 'auth/invalid-email') {
        setError('Please enter the exact email address you used to request the sign-in link.');
      } else {
        setError(
          `Failed to sign in: ${firebaseError.code || firebaseError.message || 'Unknown error'}`
        );
      }
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 450,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Email Sign-In
          </Typography>

          {loading && !needsEmail && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress />
              <Typography color="text.secondary">Completing sign-in...</Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {needsEmail && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                It looks like you opened this link on a different device or browser. Please enter
                the email address you used to request the sign-in link.
              </Typography>

              <Box component="form" onSubmit={handleEmailSubmit}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  sx={{ mb: 2 }}
                />
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={loading || !email}
                  sx={{ textTransform: 'none' }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Complete sign-in'}
                </Button>
              </Box>
            </>
          )}

          {(error || (!loading && !needsEmail)) && (
            <Button
              fullWidth
              variant="outlined"
              onClick={() => router.push('/login')}
              sx={{ mt: 2, textTransform: 'none' }}
            >
              Back to login
            </Button>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
