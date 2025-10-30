'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err: unknown) {
      // Type guard for Firebase Auth errors
      const isFirebaseError = (error: unknown): error is { code?: string; message?: string } => {
        return typeof error === 'object' && error !== null;
      };

      const firebaseError = isFirebaseError(err) ? err : { code: undefined, message: String(err) };

      // Log full error details for debugging
      console.error('Google Sign-In error details:', firebaseError);

      if (firebaseError.message === 'UNAUTHORIZED_DOMAIN') {
        setError(
          'Your email domain is not authorized to access this application. ' +
          'Only @vapourdesal.com and invited client domains are allowed.'
        );
      } else if (firebaseError.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else if (firebaseError.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups for this site and try again.');
      } else if (firebaseError.code === 'auth/internal-error') {
        setError(
          `Internal authentication error: ${firebaseError.message || 'Unknown error'}. ` +
          'This may be caused by network issues, browser extensions, or firewall settings. ' +
          'Please check the browser console (F12) for details.'
        );
      } else if (firebaseError.code === 'auth/network-request-failed') {
        setError(
          'Network request failed. Please check your internet connection and firewall settings.'
        );
      } else {
        setError(
          `Failed to sign in with Google: ${firebaseError.code || firebaseError.message || 'Unknown error'}. ` +
          'Please check the browser console (F12) for details.'
        );
      }
    } finally {
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
            Vapour Toolbox
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mb: 3 }}
          >
            Sign in to continue
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={handleGoogleSignIn}
            disabled={loading}
            sx={{
              py: 1.5,
              borderColor: '#4285F4',
              color: '#4285F4',
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#357AE8',
                backgroundColor: 'rgba(66, 133, 244, 0.04)',
              },
              '&:disabled': {
                borderColor: 'rgba(0, 0, 0, 0.12)',
                color: 'rgba(0, 0, 0, 0.26)',
              },
            }}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  component="svg"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
                    fill="#EA4335"
                  />
                </Box>
                <Typography component="span">Sign in with Google</Typography>
              </Box>
            )}
          </Button>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Internal users: @vapourdesal.com
            </Typography>
            <Typography variant="caption" color="text.secondary">
              External clients: Use invited email address
            </Typography>
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mt: 3 }}
          >
            Vapour Desal Technologies Private Limited
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
