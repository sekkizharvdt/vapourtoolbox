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
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  Business as BusinessIcon,
  Store as StoreIcon,
  Handshake as PartnerIcon,
  AccountBalance as BankIcon,
  Person as PersonIcon,
  Star as StarIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { BusinessEntity, EntityRole } from '@vapour/types';

interface ViewEntityDialogProps {
  open: boolean;
  entity: BusinessEntity | null;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  canEdit: boolean; // Can edit entity
  canArchive: boolean; // Can archive entity
}

export function ViewEntityDialog({
  open,
  entity,
  onClose,
  onEdit,
  onArchive,
  canEdit,
  canArchive,
}: ViewEntityDialogProps) {
  if (!entity) return null;

  // Format date for display
  const formatDate = (date: Date | undefined | null) => {
    if (!date) return 'Unknown';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

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
            <Box sx={{ color: 'primary.main' }}>{getRoleIcon(entity.roles)}</Box>
            <Box>
              <Typography variant="h6">{entity.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Code: {entity.code}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={entity.isArchived ? 'Archived' : 'Active'}
              color={entity.isArchived ? 'warning' : 'success'}
              size="small"
            />
            {canEdit && !entity.isArchived && (
              <IconButton size="small" onClick={onEdit} title="Edit Entity">
                <EditIcon />
              </IconButton>
            )}
            {canArchive && !entity.isArchived && (
              <IconButton size="small" color="warning" onClick={onArchive} title="Archive Entity">
                <ArchiveIcon />
              </IconButton>
            )}
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Archive Warning */}
        {entity.isArchived && (
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              This entity is archived
            </Typography>
            {entity.archiveReason && (
              <Typography variant="body2">
                <strong>Reason:</strong> {entity.archiveReason}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Archived by {entity.archivedByName || 'Unknown'} on {formatDate(entity.archivedAt)}
            </Typography>
          </Alert>
        )}

        {/* Roles */}
        <Box sx={{ mb: 3 }}>
          {entity.roles.map((role) => (
            <Chip key={role} label={role} color={getRoleColor(role)} sx={{ mr: 1 }} />
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
                    <Typography variant="body2">{entity.legalName || entity.name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <Typography variant="body2">
                      {entity.isActive !== false ? 'Active' : 'Inactive'}
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
                  Contacts{' '}
                  {entity.contacts && entity.contacts.length > 0
                    ? `(${entity.contacts.length})`
                    : ''}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {/* Show multiple contacts if available */}
                {entity.contacts && entity.contacts.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {entity.contacts.map((contact, index) => (
                      <Box
                        key={contact.id || index}
                        sx={{
                          p: 1.5,
                          bgcolor: contact.isPrimary ? 'primary.50' : 'action.hover',
                          borderRadius: 1,
                          border: contact.isPrimary ? '1px solid' : 'none',
                          borderColor: 'primary.main',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <PersonIcon
                            fontSize="small"
                            color={contact.isPrimary ? 'primary' : 'action'}
                          />
                          <Typography variant="subtitle2">{contact.name}</Typography>
                          {contact.isPrimary && (
                            <Chip
                              icon={<StarIcon sx={{ fontSize: 14 }} />}
                              label="Primary"
                              size="small"
                              color="primary"
                              sx={{ height: 20, '& .MuiChip-label': { px: 0.5 } }}
                            />
                          )}
                        </Box>
                        {contact.designation && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {contact.designation}
                          </Typography>
                        )}
                        <Typography variant="body2">{contact.email}</Typography>
                        <Typography variant="body2">{contact.phone}</Typography>
                        {contact.mobile && (
                          <Typography variant="body2" color="text.secondary">
                            Mobile: {contact.mobile}
                          </Typography>
                        )}
                        {contact.notes && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}
                          >
                            {contact.notes}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                ) : (
                  /* Fallback to legacy single contact fields */
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Contact Person
                      </Typography>
                      <Typography variant="body2">{entity.contactPerson || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body2">{entity.email || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Phone
                      </Typography>
                      <Typography variant="body2">{entity.phone || '-'}</Typography>
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
                )}
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
                    <Typography variant="body2">{entity.billingAddress.line1}</Typography>
                    {entity.billingAddress.line2 && (
                      <Typography variant="body2">{entity.billingAddress.line2}</Typography>
                    )}
                    <Typography variant="body2">
                      {entity.billingAddress.city}, {entity.billingAddress.state}{' '}
                      {entity.billingAddress.postalCode}
                    </Typography>
                    <Typography variant="body2">{entity.billingAddress.country}</Typography>
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
                        <Typography variant="body2">{entity.taxIdentifiers.gstin}</Typography>
                      </Box>
                    )}
                    {entity.taxIdentifiers.pan && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          PAN
                        </Typography>
                        <Typography variant="body2">{entity.taxIdentifiers.pan}</Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Shipping Address */}
          {entity.shippingAddress && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Shipping Address
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box>
                    {entity.shippingAddress.line1 && (
                      <Typography variant="body2">{entity.shippingAddress.line1}</Typography>
                    )}
                    {entity.shippingAddress.line2 && (
                      <Typography variant="body2">{entity.shippingAddress.line2}</Typography>
                    )}
                    <Typography variant="body2">
                      {[
                        entity.shippingAddress.city,
                        entity.shippingAddress.state,
                        entity.shippingAddress.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Typography>
                    {entity.shippingAddress.country && (
                      <Typography variant="body2">{entity.shippingAddress.country}</Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Bank Details */}
          {entity.bankDetails && entity.bankDetails.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Bank Details ({entity.bankDetails.length})
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {entity.bankDetails.map((bank, index) => (
                      <Box
                        key={index}
                        sx={{
                          p: 2,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <BankIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2">{bank.bankName}</Typography>
                        </Box>
                        <Grid container spacing={1}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              Account Name
                            </Typography>
                            <Typography variant="body2">{bank.accountName}</Typography>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              Account Number
                            </Typography>
                            <Typography variant="body2">{bank.accountNumber}</Typography>
                          </Grid>
                          {bank.ifscCode && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                IFSC Code
                              </Typography>
                              <Typography variant="body2">{bank.ifscCode}</Typography>
                            </Grid>
                          )}
                          {bank.swiftCode && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                SWIFT Code
                              </Typography>
                              <Typography variant="body2">{bank.swiftCode}</Typography>
                            </Grid>
                          )}
                          {bank.iban && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                IBAN
                              </Typography>
                              <Typography variant="body2">{bank.iban}</Typography>
                            </Grid>
                          )}
                          {bank.branchName && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                Branch
                              </Typography>
                              <Typography variant="body2">{bank.branchName}</Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Credit Terms */}
          {entity.creditTerms &&
            (entity.creditTerms.creditDays || entity.creditTerms.creditLimit) && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      Credit Terms
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {entity.creditTerms.creditDays !== undefined && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Credit Days
                          </Typography>
                          <Typography variant="body2">
                            {entity.creditTerms.creditDays} days
                          </Typography>
                        </Box>
                      )}
                      {entity.creditTerms.creditLimit !== undefined && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Credit Limit
                          </Typography>
                          <Typography variant="body2">
                            {new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: entity.creditTerms.currency || 'INR',
                            }).format(entity.creditTerms.creditLimit)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

          {/* Notes */}
          {entity.notes && (
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Notes
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {entity.notes}
                  </Typography>
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
