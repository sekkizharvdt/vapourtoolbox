'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader, LoadingState } from '@vapour/ui';
import {
  Home as HomeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  CheckCircle as AcceptedIcon,
  PriceCheck as AcceptPriceIcon,
} from '@mui/icons-material';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { PdfViewer } from '@/components/common/PdfViewer';
import type { VendorOffer, VendorOfferItem, VendorOfferStatus, OfferItemType } from '@vapour/types';
import { canManageEstimation } from '@vapour/constants';
import {
  getVendorOfferById,
  getOfferItems,
  addOfferItem,
  updateOfferItem,
  removeOfferItem,
  acceptPrice,
  updateVendorOffer,
} from '@/lib/vendorOffers/vendorOfferService';
import { ItemLinkDialog, type LinkedItem } from '../components/ItemLinkDialog';
import { AcceptPriceDialog } from '../components/AcceptPriceDialog';

const STATUS_COLORS: Record<VendorOfferStatus, 'default' | 'info' | 'success'> = {
  DRAFT: 'default',
  REVIEWED: 'info',
  ARCHIVED: 'success',
};

function formatDate(ts: unknown): string {
  if (!ts) return '-';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-IN');
  }
  if (ts instanceof Date) return ts.toLocaleDateString('en-IN');
  return '-';
}

export default function VendorOfferDetailClient() {
  const params = useParams();
  const offerId = params.id as string;
  const { user, claims } = useAuth();
  const { db } = getFirebase();

  const [offer, setOffer] = useState<VendorOffer | null>(null);
  const [items, setItems] = useState<VendorOfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemType, setNewItemType] = useState<OfferItemType>('MATERIAL');
  const [newDescription, setNewDescription] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [newGstRate, setNewGstRate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [linkingItemType, setLinkingItemType] = useState<OfferItemType>('MATERIAL');

  // Accept price dialog
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptingItem, setAcceptingItem] = useState<VendorOfferItem | null>(null);
  const [accepting, setAccepting] = useState(false);

  const canManage = claims?.permissions ? canManageEstimation(claims.permissions) : false;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch offer and items independently so a failure in one doesn't block the other
      const fetchedOffer = await getVendorOfferById(db, offerId);
      setOffer(fetchedOffer);

      if (fetchedOffer) {
        try {
          const fetchedItems = await getOfferItems(db, offerId);
          setItems(fetchedItems);
        } catch (itemErr) {
          console.error('Error loading offer items:', itemErr);
          // Offer still shows even if items fail to load
        }
      }
    } catch (err) {
      console.error('Error loading offer:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offer');
    } finally {
      setLoading(false);
    }
  }, [db, offerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddItem = async () => {
    const qty = parseFloat(newQuantity);
    const price = parseFloat(newUnitPrice);
    if (
      !newDescription.trim() ||
      isNaN(qty) ||
      qty <= 0 ||
      isNaN(price) ||
      price < 0 ||
      !newUnit.trim()
    ) {
      return;
    }

    try {
      setAddingItem(true);
      await addOfferItem(
        db,
        offerId,
        {
          itemType: newItemType,
          description: newDescription.trim(),
          quantity: qty,
          unit: newUnit.trim(),
          unitPrice: price,
          ...(newGstRate ? { gstRate: parseFloat(newGstRate) } : {}),
          ...(newNotes.trim() ? { notes: newNotes.trim() } : {}),
        },
        user!.uid,
        claims?.permissions ?? 0
      );
      // Reset form
      setNewDescription('');
      setNewQuantity('');
      setNewUnit('');
      setNewUnitPrice('');
      setNewGstRate('');
      setNewNotes('');
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      console.error('Error adding item:', err);
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeOfferItem(db, itemId, user!.uid, claims?.permissions ?? 0);
      await loadData();
    } catch (err) {
      console.error('Error removing item:', err);
    }
  };

  const handleLinkItem = (itemId: string, itemType: OfferItemType) => {
    setLinkingItemId(itemId);
    setLinkingItemType(itemType);
    setLinkDialogOpen(true);
  };

  const handleLinked = async (linked: LinkedItem) => {
    if (!linkingItemId) return;
    try {
      await updateOfferItem(
        db,
        linkingItemId,
        {
          itemType: linked.itemType,
          ...(linked.itemType === 'MATERIAL' ? { materialId: linked.id } : {}),
          ...(linked.itemType === 'SERVICE' ? { serviceId: linked.id } : {}),
          ...(linked.itemType === 'BOUGHT_OUT' ? { boughtOutItemId: linked.id } : {}),
          linkedItemName: linked.name,
          linkedItemCode: linked.code,
        },
        user!.uid,
        claims?.permissions ?? 0
      );
      await loadData();
    } catch (err) {
      console.error('Error linking item:', err);
    }
  };

  const handleAcceptPrice = (item: VendorOfferItem) => {
    setAcceptingItem(item);
    setAcceptDialogOpen(true);
  };

  const handleConfirmAccept = async () => {
    if (!acceptingItem) return;
    try {
      setAccepting(true);
      await acceptPrice(db, acceptingItem.id, user!.uid, claims?.permissions ?? 0);
      setAcceptDialogOpen(false);
      setAcceptingItem(null);
      await loadData();
    } catch (err) {
      console.error('Error accepting price:', err);
    } finally {
      setAccepting(false);
    }
  };

  const handleStatusChange = async (status: VendorOfferStatus) => {
    try {
      await updateVendorOffer(db, offerId, { status }, user!.uid, claims?.permissions ?? 0);
      await loadData();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  if (loading) return <LoadingState message="Loading vendor offer..." />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!offer) return <Typography color="error">Offer not found</Typography>;

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Materials', href: '/materials', icon: <HomeIcon fontSize="small" /> },
            { label: 'Vendor Offers', href: '/materials/vendor-offers' },
            { label: offer.offerNumber },
          ]}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PageHeader title={offer.offerNumber} subtitle={`From ${offer.vendorName}`} />
          <Chip label={offer.status} color={STATUS_COLORS[offer.status]} size="small" />
        </Box>
      </Box>

      {/* Offer Metadata */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Vendor
              </Typography>
              <Typography variant="body2">{offer.vendorName}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Offer Date
              </Typography>
              <Typography variant="body2">{formatDate(offer.offerDate)}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Validity
              </Typography>
              <Typography variant="body2">{formatDate(offer.validityDate)}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Currency
              </Typography>
              <Typography variant="body2">{offer.currency}</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Total
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {offer.currency}{' '}
                {offer.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </Grid>
            {offer.remarks && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  Remarks
                </Typography>
                <Typography variant="body2">{offer.remarks}</Typography>
              </Grid>
            )}
          </Grid>

          {canManage && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              {offer.status === 'DRAFT' && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleStatusChange('REVIEWED')}
                >
                  Mark as Reviewed
                </Button>
              )}
              {offer.status === 'REVIEWED' && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleStatusChange('ARCHIVED')}
                >
                  Archive
                </Button>
              )}
              {offer.status !== 'DRAFT' && (
                <Button size="small" variant="outlined" onClick={() => handleStatusChange('DRAFT')}>
                  Reopen as Draft
                </Button>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* PDF Viewer */}
      {offer.fileUrl && (
        <Box sx={{ mb: 3 }}>
          <PdfViewer url={offer.fileUrl} fileName={offer.fileName} />
        </Box>
      )}

      {/* Line Items */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          Line Items ({items.length})
          {offer.acceptedCount > 0 && (
            <Chip
              label={`${offer.acceptedCount} accepted`}
              size="small"
              color="success"
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        {canManage && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setShowAddForm(true)}
          >
            Add Item
          </Button>
        )}
      </Box>

      {/* Add Item Form */}
      {showAddForm && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              New Line Item
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={newItemType}
                    label="Type"
                    onChange={(e) => setNewItemType(e.target.value as OfferItemType)}
                  >
                    <MenuItem value="MATERIAL">Material</MenuItem>
                    <MenuItem value="SERVICE">Service</MenuItem>
                    <MenuItem value="BOUGHT_OUT">Bought Out</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Qty"
                  type="number"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Unit"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="kg, nos, m"
                  required
                />
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Unit Price"
                  type="number"
                  value={newUnitPrice}
                  onChange={(e) => setNewUnitPrice(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="GST %"
                  type="number"
                  value={newGstRate}
                  onChange={(e) => setNewGstRate(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleAddItem}
                disabled={addingItem}
              >
                {addingItem ? 'Adding...' : 'Add'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      {items.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No line items yet. Click &ldquo;Add Item&rdquo; to add items from the vendor offer.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={40}>#</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Linked Item</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.lineNumber}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.itemType === 'BOUGHT_OUT' ? 'B/O' : item.itemType.charAt(0)}
                        size="small"
                        variant="outlined"
                        sx={{ minWidth: 32 }}
                      />
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>
                      {item.linkedItemName ? (
                        <Box>
                          <Typography variant="body2" fontSize="0.8rem">
                            {item.linkedItemName}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontFamily="monospace"
                          >
                            {item.linkedItemCode}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
                          Not linked
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell align="right">
                      {item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="right">
                      {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        {canManage && (
                          <>
                            <Tooltip title={item.linkedItemName ? 'Re-link' : 'Link to item'}>
                              <IconButton
                                size="small"
                                onClick={() => handleLinkItem(item.id, item.itemType)}
                              >
                                {item.linkedItemName ? (
                                  <LinkIcon fontSize="small" />
                                ) : (
                                  <LinkOffIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            {item.priceAccepted ? (
                              <Tooltip title="Price accepted">
                                <AcceptedIcon fontSize="small" color="success" sx={{ ml: 0.5 }} />
                              </Tooltip>
                            ) : (
                              <Tooltip title="Accept price">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleAcceptPrice(item)}
                                  disabled={!item.linkedItemName}
                                >
                                  <AcceptPriceIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Remove">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow>
                  <TableCell colSpan={7} align="right" sx={{ fontWeight: 600 }}>
                    Total
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {offer.currency}{' '}
                    {offer.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Dialogs */}
      <ItemLinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onSelect={handleLinked}
        db={db}
        initialTab={linkingItemType}
      />

      <AcceptPriceDialog
        open={acceptDialogOpen}
        onClose={() => {
          setAcceptDialogOpen(false);
          setAcceptingItem(null);
        }}
        onConfirm={handleConfirmAccept}
        item={acceptingItem}
        offer={offer}
        accepting={accepting}
      />
    </>
  );
}
