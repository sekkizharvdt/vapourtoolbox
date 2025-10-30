'use client';

import { Container, Typography, Box, Paper, Avatar, Chip } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePage() {
  const { user, claims } = useAuth();

  return (
    <Container maxWidth="md">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View your account information
        </Typography>
      </Box>

      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <Avatar
            src={user?.photoURL || undefined}
            alt={user?.displayName || ''}
            sx={{ width: 80, height: 80, mr: 3 }}
          />
          <Box>
            <Typography variant="h5">{user?.displayName || 'User'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Roles
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {claims?.roles && claims.roles.length > 0 ? (
              claims.roles.map((role) => (
                <Chip key={role} label={role} size="small" />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No roles assigned
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Department
          </Typography>
          <Typography variant="body1">
            {claims?.department || 'Not assigned'}
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Account Type
          </Typography>
          <Chip
            label={claims?.domain === 'internal' ? 'Internal User' : 'External User'}
            color={claims?.domain === 'internal' ? 'primary' : 'default'}
            size="small"
          />
        </Box>
      </Paper>
    </Container>
  );
}
