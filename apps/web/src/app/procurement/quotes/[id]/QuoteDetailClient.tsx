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
  Edit as EditIcon,
  InsertDriveFile as FileIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { PdfViewer } from '@/components/common/PdfViewer';
import type {
  VendorQuote,
  VendorQuoteItem,
  QuoteStatus,
  QuoteItemType,
  Material,
  MaterialVariant,
  Service,
  BoughtOutItem,
} from '@vapour/types';
import { canManageEstimation, QUOTE_LINE_LABELS } from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';
import {
  getVendorQuoteById,
  getVendorQuoteItems,
  addVendorQuoteItem,
  updateVendorQuoteItem,
  removeVendorQuoteItem,
  acceptQuoteItemPrice,
  updateVendorQuote,
} from '@/lib/vendorQuotes/vendorQuoteService';
import MaterialPickerDialog from '@/components/materials/MaterialPickerDialog';
import ServicePickerDialog from '@/components/services/ServicePickerDialog';
import BoughtOutPickerDialog from '@/components/boughtOut/BoughtOutPickerDialog';
import { AcceptPriceDialog } from '../components/AcceptPriceDialog';
import {
  EditQuoteHeaderDialog,
  type EditQuoteHeaderInput,
} from '../components/EditQuoteHeaderDialog';
import { offerStateMachine } from '@/lib/workflow/stateMachines';

/** Normalized shape passed to the shared link writer, regardless of source picker. */
interface LinkedItem {
  itemType: QuoteItemType;
  id: string;
  name: string;
  code: string;
}

/**
 * Plain-text labels for the button face. Status names like UNDER_REVIEW
 * are not friendly. Keep this in lockstep with `offerStateMachine`.
 */
const STATUS_TRANSITION_LABEL: Partial<Record<QuoteStatus, string>> = {
  UPLOADED: 'Mark as Uploaded',
  UNDER_REVIEW: 'Mark Under Review',
  EVALUATED: 'Mark as Evaluated',
  ARCHIVED: 'Archive',
  // SELECTED / REJECTED / WITHDRAWN need a reason dialog and the
  // sibling-rejection workflow — they're handled by their own UI in
  // the comparison view, not by a plain status button here.
};

const STATUS_COLORS: Partial<Record<QuoteStatus, 'default' | 'info' | 'success' | 'warning'>> = {
  DRAFT: 'default',
  UPLOADED: 'info',
  UNDER_REVIEW: 'info',
  EVALUATED: 'success',
  ARCHIVED: 'success',
};

/**
 * Derive a readable label for a supporting-document URL. `additionalDocuments`
 * stores Firebase Storage download URLs only (no filename), so we recover the
 * original name from the encoded storage path, falling back to a generic label.
 */
function attachmentLabel(url: string, index: number): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const last = path.split('/').pop() ?? '';
    // Staging paths are `<timestamp>_<originalName>` — strip the timestamp prefix.
    const name = last.replace(/^\d+_/, '');
    if (name) return name;
  } catch {
    // Malformed URL — fall through to the generic label.
  }
  return `Attachment ${index + 1}`;
}

export default function QuoteDetailClient() {
  const pathname = usePathname();
  const { user, claims } = useAuth();
  const { db } = getFirebase();

  // Static export: useParams() returns the placeholder; parse the real id
  // from the path (CLAUDE.md rule #30).
  const [offerId, setOfferId] = useState<string | null>(null);
  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/procurement\/quotes\/([^/]+)(?:\/|$)/);
    const extracted = match?.[1];
    if (extracted && extracted !== 'placeholder') {
      setOfferId(extracted);
    }
  }, [pathname]);

  const [offer, setOffer] = useState<VendorQuote | null>(null);
  const [items, setItems] = useState<VendorQuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add item form
  const [showAddForm, setShowAddForm] = useState(false);
  // Non-null when the form is editing an existing row rather than adding a new one.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<QuoteItemType>('MATERIAL');
  const [newDescription, setNewDescription] = useState('');
  const [newSpecification, setNewSpecification] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [newGstRate, setNewGstRate] = useState('');
  const [newDiscountValue, setNewDiscountValue] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'PERCENT' | 'ABSOLUTE'>('PERCENT');
  const [newNotes, setNewNotes] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Link dialog
  // The row being (re)linked and which per-type picker is open. `linkingItemType`
  // doubles as the open-signal: non-null means a picker is showing.
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [linkingItemType, setLinkingItemType] = useState<QuoteItemType | null>(null);

  // Accept price dialog
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptingItem, setAcceptingItem] = useState<VendorQuoteItem | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Edit-header dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const canManage = claims?.permissions ? canManageEstimation(claims.permissions) : false;

  const loadData = useCallback(async () => {
    if (!offerId) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch offer and items independently so a failure in one doesn't block the other
      const fetchedOffer = await getVendorQuoteById(db, offerId);
      setOffer(fetchedOffer);

      if (fetchedOffer) {
        try {
          const fetchedItems = await getVendorQuoteItems(db, offerId);
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
    if (offerId) loadData();
  }, [offerId, loadData]);

  // Clear the line-item form fields and exit edit mode. Does not toggle the
  // form's visibility — callers decide whether to show or hide it.
  const resetItemForm = () => {
    setEditingItemId(null);
    setNewItemType('MATERIAL');
    setNewDescription('');
    setNewSpecification('');
    setNewQuantity('');
    setNewUnit('');
    setNewUnitPrice('');
    setNewGstRate('');
    setNewDiscountValue('');
    setNewDiscountType('PERCENT');
    setNewNotes('');
  };

  const handleStartAdd = () => {
    resetItemForm();
    setShowAddForm(true);
  };

  const handleStartEdit = (item: VendorQuoteItem) => {
    setEditingItemId(item.id);
    setNewItemType(item.itemType);
    setNewDescription(item.description ?? '');
    setNewSpecification(item.specification ?? '');
    setNewQuantity(String(item.quantity ?? ''));
    setNewUnit(item.unit ?? '');
    setNewUnitPrice(String(item.unitPrice ?? ''));
    setNewGstRate(item.gstRate != null ? String(item.gstRate) : '');
    setNewDiscountValue(item.discountValue != null ? String(item.discountValue) : '');
    setNewDiscountType(item.discountType ?? 'PERCENT');
    setNewNotes(item.notes ?? '');
    setShowAddForm(true);
  };

  const handleSaveItem = async () => {
    if (!offerId) return;
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
      if (editingItemId) {
        // Edit: pass explicit values so clearing GST/discount actually clears
        // them (0). updateVendorQuoteItem recomputes amount/gst/discount.
        await updateVendorQuoteItem(
          db,
          editingItemId,
          {
            itemType: newItemType,
            description: newDescription.trim(),
            specification: newSpecification.trim(),
            quantity: qty,
            unit: newUnit.trim(),
            unitPrice: price,
            gstRate: newGstRate.trim() === '' ? 0 : parseFloat(newGstRate) || 0,
            discountValue: newDiscountValue.trim() === '' ? 0 : parseFloat(newDiscountValue) || 0,
            discountType: newDiscountType,
            notes: newNotes.trim(),
          },
          user!.uid,
          claims?.permissions ?? 0
        );
      } else {
        await addVendorQuoteItem(
          db,
          offerId,
          {
            itemType: newItemType,
            description: newDescription.trim(),
            ...(newSpecification.trim() ? { specification: newSpecification.trim() } : {}),
            quantity: qty,
            unit: newUnit.trim(),
            unitPrice: price,
            ...(newGstRate ? { gstRate: parseFloat(newGstRate) } : {}),
            ...(newDiscountValue
              ? { discountValue: parseFloat(newDiscountValue), discountType: newDiscountType }
              : {}),
            ...(newNotes.trim() ? { notes: newNotes.trim() } : {}),
          },
          user!.uid,
          claims?.permissions ?? 0
        );
      }
      resetItemForm();
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      console.error('Error saving item:', err);
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeVendorQuoteItem(db, itemId, user!.uid, claims?.permissions ?? 0);
      await loadData();
    } catch (err) {
      console.error('Error removing item:', err);
    }
  };

  // NOTE rows have no master link; the others open their per-type picker.
  const handleLinkItem = (itemId: string, itemType: QuoteItemType) => {
    if (itemType === 'NOTE') return;
    setLinkingItemId(itemId);
    setLinkingItemType(itemType);
  };

  const closeLinkPicker = () => {
    setLinkingItemId(null);
    setLinkingItemType(null);
  };

  const handleLinked = async (linked: LinkedItem) => {
    const itemId = linkingItemId;
    closeLinkPicker();
    if (!itemId) return;
    try {
      await updateVendorQuoteItem(
        db,
        itemId,
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

  const handleAcceptPrice = (item: VendorQuoteItem) => {
    setAcceptingItem(item);
    setAcceptDialogOpen(true);
  };

  const handleConfirmAccept = async () => {
    if (!acceptingItem) return;
    try {
      setAccepting(true);
      await acceptQuoteItemPrice(db, acceptingItem.id, user!.uid, claims?.permissions ?? 0);
      setAcceptDialogOpen(false);
      setAcceptingItem(null);
      await loadData();
    } catch (err) {
      console.error('Error accepting price:', err);
    } finally {
      setAccepting(false);
    }
  };

  const handleStatusChange = async (status: QuoteStatus) => {
    if (!offerId) return;
    try {
      await updateVendorQuote(db, offerId, { status }, user!.uid, claims?.permissions ?? 0);
      await loadData();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleEditSave = async (updates: EditQuoteHeaderInput) => {
    if (!offerId || !user) return;
    try {
      setEditSaving(true);
      await updateVendorQuote(db, offerId, updates, user.uid, claims?.permissions ?? 0);
      setEditOpen(false);
      await loadData();
    } finally {
      setEditSaving(false);
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
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Quotes', href: '/procurement/quotes' },
            { label: offer.number },
          ]}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PageHeader title={offer.number} subtitle={`From ${offer.vendorName}`} />
          <Chip
            label={offer.status}
            color={STATUS_COLORS[offer.status] ?? 'default'}
            size="small"
          />
          {canManage && !offerStateMachine.isTerminal(offer.status) && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditOpen(true)}
            >
              Edit Details
            </Button>
          )}
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
              <Typography variant="body2">{formatDate(offer.vendorOfferDate)}</Typography>
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
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {/* Render only state-machine-valid transitions. Excludes
                  SELECTED / REJECTED / WITHDRAWN — those need a reason
                  dialog and trigger sibling rejection / RFQ status sync,
                  so they live in the comparison view. */}
              {offerStateMachine
                .getAvailableTransitions(offer.status)
                .filter((target) => STATUS_TRANSITION_LABEL[target])
                .map((target) => (
                  <Button
                    key={target}
                    size="small"
                    variant="outlined"
                    onClick={() => handleStatusChange(target)}
                  >
                    {STATUS_TRANSITION_LABEL[target]}
                  </Button>
                ))}
              {offerStateMachine.isTerminal(offer.status) && (
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  Terminal status — no further transitions.
                </Typography>
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

      {/* Supporting documents — extra attachments captured on the quote form,
          separate from the primary (parsed) document above. */}
      {offer.additionalDocuments && offer.additionalDocuments.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              {QUOTE_LINE_LABELS.supportingDocuments} ({offer.additionalDocuments.length})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {offer.additionalDocuments.map((url, i) => (
                <Button
                  key={url}
                  variant="outlined"
                  size="small"
                  startIcon={<FileIcon fontSize="small" />}
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ textTransform: 'none' }}
                >
                  {attachmentLabel(url, i)}
                </Button>
              ))}
            </Box>
          </CardContent>
        </Card>
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
        {canManage && !offerStateMachine.isTerminal(offer.status) && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleStartAdd}>
            Add Item
          </Button>
        )}
      </Box>

      {/* Add / Edit Item Form */}
      {showAddForm && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              {editingItemId ? 'Edit Line Item' : 'New Line Item'}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={newItemType}
                    label="Type"
                    onChange={(e) => setNewItemType(e.target.value as QuoteItemType)}
                  >
                    <MenuItem value="MATERIAL">Material</MenuItem>
                    <MenuItem value="SERVICE">Service</MenuItem>
                    <MenuItem value="BOUGHT_OUT">Bought Out</MenuItem>
                    <MenuItem value="NOTE">Note / Charge</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={QUOTE_LINE_LABELS.description}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                  helperText="General item name"
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
              <Grid size={{ xs: 6, md: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={QUOTE_LINE_LABELS.discount}
                  type="number"
                  value={newDiscountValue}
                  onChange={(e) => setNewDiscountValue(e.target.value)}
                  inputProps={{ min: 0, step: '0.01' }}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{QUOTE_LINE_LABELS.discountType}</InputLabel>
                  <Select
                    value={newDiscountType}
                    label={QUOTE_LINE_LABELS.discountType}
                    onChange={(e) => setNewDiscountType(e.target.value as 'PERCENT' | 'ABSOLUTE')}
                  >
                    <MenuItem value="PERCENT">%</MenuItem>
                    <MenuItem value="ABSOLUTE">{offer?.currency ?? 'INR'}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {newItemType !== 'NOTE' && (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={QUOTE_LINE_LABELS.specification}
                    value={newSpecification}
                    onChange={(e) => setNewSpecification(e.target.value)}
                    multiline
                    maxRows={4}
                    helperText="Technical detail — size, rating, material, model, tag, etc."
                  />
                </Grid>
              )}
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
              <Button
                size="small"
                onClick={() => {
                  resetItemForm();
                  setShowAddForm(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveItem}
                disabled={addingItem}
              >
                {addingItem
                  ? editingItemId
                    ? 'Saving...'
                    : 'Adding...'
                  : editingItemId
                    ? 'Save'
                    : 'Add'}
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
                  <TableCell align="right">{QUOTE_LINE_LABELS.discount}</TableCell>
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
                    <TableCell>
                      <Typography variant="body2">{item.description}</Typography>
                      {item.specification && (
                        <Typography variant="caption" color="text.secondary">
                          {item.specification}
                        </Typography>
                      )}
                    </TableCell>
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
                      {item.discountValue ? (
                        <Typography variant="body2" fontSize="0.8rem">
                          {item.discountType === 'ABSOLUTE'
                            ? item.discountValue.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                              })
                            : `${item.discountValue}%`}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        {canManage && (
                          <>
                            {!offerStateMachine.isTerminal(offer.status) && (
                              <Tooltip title="Edit line item">
                                <IconButton size="small" onClick={() => handleStartEdit(item)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {item.itemType !== 'NOTE' && (
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
                            )}
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

      {/* Dialogs — per-type pickers (same components the new-quote page uses).
          Routed by the row's itemType; each adapts its result to handleLinked. */}
      <MaterialPickerDialog
        open={linkingItemType === 'MATERIAL'}
        onClose={closeLinkPicker}
        onSelect={(material: Material, _variant?: MaterialVariant, fullCode?: string) =>
          handleLinked({
            itemType: 'MATERIAL',
            id: material.id,
            name: material.name,
            code: fullCode || material.materialCode,
          })
        }
        title="Link line item to material"
        requireVariantSelection={false}
      />
      <ServicePickerDialog
        open={linkingItemType === 'SERVICE'}
        onClose={closeLinkPicker}
        onSelect={(service: Service) =>
          handleLinked({
            itemType: 'SERVICE',
            id: service.id,
            name: service.name,
            code: service.serviceCode,
          })
        }
      />
      <BoughtOutPickerDialog
        open={linkingItemType === 'BOUGHT_OUT'}
        onClose={closeLinkPicker}
        onSelect={(item: BoughtOutItem) =>
          handleLinked({
            itemType: 'BOUGHT_OUT',
            id: item.id,
            name: item.name,
            code: item.itemCode,
          })
        }
        tenantId={claims?.tenantId || 'default-entity'}
        title="Link line item to bought-out master"
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

      <EditQuoteHeaderDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
        offer={offer}
        saving={editSaving}
      />
    </>
  );
}
