'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Chip,
  Grid,
  Typography,
  Divider,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Store as StoreIcon,
  Handshake as PartnerIcon,
} from '@mui/icons-material';
import type { BusinessEntity, EntityRole } from '@vapour/types';

interface ViewEntityDialogProps {
  open: boolean;
  entity: BusinessEntity | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean; // Can edit entity
  canDelete: boolean; // Can delete entity
}

export function ViewEntityDialog({ open, entity, onClose, onEdit, onDelete, canEdit, canDelete }: ViewEntityDialogProps) {
  if (!entity) return null;

  // Get role icon
  const getRoleIcon = (roles: EntityRole[]) => {
    if (roles.includes('CUSTOMER')) return <BusinessIcon fontSize="large" />;
    if (roles.includes('VENDOR')) return <StoreIcon fontSize="large" />;
    if (roles.includes('PARTNER')) return <PartnerIcon fontSize="large" />;
    return <BusinessIcon fontSize="large" />;
  };

  // Get role color
  const getRoleColor = (role: EntityRole): 'primary' | 'success' | 'info' => {
    switch (role) {
      case 'CUSTOMER':
        return 'primary';
      case 'VENDOR':
        return 'success';
      case 'PARTNER':
        return 'info';
      default:
        return 'primary';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ color: 'primary.main' }}>
              {getRoleIcon(entity.roles)}
            </Box>
            <Box>
              <Typography variant="h6">{entity.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Code: {entity.code}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={entity.isActive ? 'Active' : 'Inactive'}
              color={entity.isActive ? 'success' : 'default'}
              size="small"
            />
            {canEdit && (
              <IconButton size="small" onClick={onEdit} title="Edit Entity">
                <EditIcon />
              </IconButton>
            )}
            {canDelete && (
              <IconButton size="small" color="error" onClick={onDelete} title="Delete Entity">
                <DeleteIcon />
              </IconButton>
            )}
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Roles */}
        <Box sx={{ mb: 3 }}>
          {entity.roles.map((role) => (
            <Chip
              key={role}
              label={role}
              color={getRoleColor(role)}
              sx={{ mr: 1 }}
            />
          ))}
        </Box>

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Legal Name
                    </Typography>
                    <Typography variant="body2">
                      {entity.legalName || entity.name}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <Typography variant="body2">
                      {entity.status.charAt(0).toUpperCase() + entity.status.slice(1)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Contact Details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Contact Details
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Contact Person
                    </Typography>
                    <Typography variant="body2">{entity.contactPerson}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Email
                    </Typography>
                    <Typography variant="body2">{entity.email}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Phone
                    </Typography>
                    <Typography variant="body2">{entity.phone}</Typography>
                  </Box>
                  {entity.mobile && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Mobile
                      </Typography>
                      <Typography variant="body2">{entity.mobile}</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Billing Address */}
          {entity.billingAddress && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Billing Address
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box>
                    <Typography variant="body2">
                      {entity.billingAddress.line1}
                    </Typography>
                    {entity.billingAddress.line2 && (
                      <Typography variant="body2">
                        {entity.billingAddress.line2}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      {entity.billingAddress.city}, {entity.billingAddress.state} {entity.billingAddress.postalCode}
                    </Typography>
                    <Typography variant="body2">
                      {entity.billingAddress.country}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Tax Information */}
          {entity.taxIdentifiers && (entity.taxIdentifiers.gstin || entity.taxIdentifiers.pan) && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Tax Information
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {entity.taxIdentifiers.gstin && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          GSTIN
                        </Typography>
                        <Typography variant="body2">
                          {entity.taxIdentifiers.gstin}
                        </Typography>
                      </Box>
                    )}
                    {entity.taxIdentifiers.pan && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          PAN
                        </Typography>
                        <Typography variant="body2">
                          {entity.taxIdentifiers.pan}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
