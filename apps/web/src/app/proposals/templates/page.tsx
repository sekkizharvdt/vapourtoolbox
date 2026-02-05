'use client';

/**
 * Proposal Templates Page
 *
 * Lists all saved proposal templates with options to view, delete, or create new proposals from them.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  BookmarkAdd as TemplateIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  GridView as ScopeIcon,
  PriceChange as PricingIcon,
  Description as TermsIcon,
  LocalShipping as DeliveryIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { listProposalTemplates, deleteProposalTemplate } from '@/lib/proposals/proposalService';
import { useToast } from '@/components/common/Toast';
import type { ProposalTemplate } from '@vapour/types';

export default function ProposalTemplatesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { claims } = useAuth();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProposalTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const entityId = claims?.entityId || 'default-entity';

  useEffect(() => {
    if (!db) return;

    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await listProposalTemplates(db, {
          entityId,
          isActive: true,
        });

        setTemplates(data);
      } catch (err) {
        console.error('Error loading templates:', err);
        setError('Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [db, entityId]);

  const handleDelete = async (template: ProposalTemplate) => {
    if (!db) return;

    try {
      setDeleting(true);
      await deleteProposalTemplate(db, template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      toast.success('Template deleted');
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting template:', err);
      toast.error('Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (timestamp: { toDate: () => Date }) => {
    return timestamp.toDate().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/proposals"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/proposals');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Proposals
        </Link>
        <Typography color="text.primary">Templates</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Proposal Templates
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Reusable templates for quickly creating new proposals
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {templates.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <TemplateIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Templates Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Save proposals as templates to reuse their scope, pricing, and terms.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Open any proposal and select &ldquo;Save as Template&rdquo; from the menu.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {templates.map((template) => {
            const scopeCount =
              (template.scopeMatrix?.services?.length || 0) +
              (template.scopeMatrix?.supply?.length || 0) +
              (template.scopeMatrix?.exclusions?.length || 0);

            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={template.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                        {template.name}
                      </Typography>
                      {template.category && (
                        <Chip label={template.category} size="small" variant="outlined" />
                      )}
                    </Box>

                    {template.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {template.description}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                      {scopeCount > 0 && (
                        <Chip
                          icon={<ScopeIcon />}
                          label={`${scopeCount} items`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {template.pricingDefaults && (
                        <Chip
                          icon={<PricingIcon />}
                          label="Pricing"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                      {template.terms && Object.keys(template.terms).length > 0 && (
                        <Chip
                          icon={<TermsIcon />}
                          label="Terms"
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      )}
                      {template.deliveryPeriod && (
                        <Chip
                          icon={<DeliveryIcon />}
                          label={`${template.deliveryPeriod.durationInWeeks}w`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    <Typography variant="caption" color="text.secondary" display="block">
                      Created {formatDate(template.createdAt)} by {template.createdByName}
                    </Typography>
                    {template.sourceProposalNumber && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        From: {template.sourceProposalNumber}
                      </Typography>
                    )}
                    {template.usageCount > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Used {template.usageCount} time{template.usageCount !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteConfirm(template)}
                      title="Delete template"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Template?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &ldquo;{deleteConfirm?.name}&rdquo;? This action cannot
            be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
