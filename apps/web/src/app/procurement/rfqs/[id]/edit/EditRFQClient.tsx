'use client';

/**
 * Edit RFQ Page
 *
 * Edit an existing RFQ (only allowed when status is DRAFT)
 * Allows updating: title, description, due date, validity period, vendors, and terms
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  Divider,
  CircularProgress,
  Alert,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { Home as HomeIcon, Save as SaveIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { RFQ, RFQItem } from '@vapour/types';
import { getRFQById, getRFQItems, updateRFQ } from '@/lib/procurement/rfq';
import { canEditRFQ } from '@/lib/procurement/rfqHelpers';
import { formatDate } from '@/lib/utils/formatters';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  isDeleted?: boolean;
}

export default function EditRFQClient() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [items, setItems] = useState<RFQItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rfqId, setRfqId] = useState<string | null>(null);

  // Available vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    validityPeriod: 30,
    paymentTerms: '',
    deliveryTerms: '',
    warrantyTerms: '',
  });

  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/rfqs\/([^/]+)\/edit/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setRfqId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (rfqId) {
      loadRFQ();
      loadVendors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  const loadRFQ = async () => {
    if (!rfqId) return;
    setLoading(true);
    setError(null);
    try {
      const [rfqData, itemsData] = await Promise.all([getRFQById(rfqId), getRFQItems(rfqId)]);

      if (!rfqData) {
        setError('RFQ not found');
        setLoading(false);
        return;
      }

      // Check if RFQ can be edited
      if (!canEditRFQ(rfqData)) {
        setError('This RFQ cannot be edited in its current status. Only DRAFT RFQs can be edited.');
        setLoading(false);
        return;
      }

      setRfq(rfqData);
      setItems(itemsData);

      // Populate form data
      const dueDateStr = rfqData.dueDate?.toDate?.()?.toISOString().split('T')[0] || '';

      setFormData({
        title: rfqData.title,
        description: rfqData.description || '',
        dueDate: dueDateStr,
        validityPeriod: rfqData.validityPeriod || 30,
        paymentTerms: rfqData.paymentTerms || '',
        deliveryTerms: rfqData.deliveryTerms || '',
        warrantyTerms: rfqData.warrantyTerms || '',
      });

      setSelectedVendors(rfqData.vendorIds || []);
      setLoading(false);
    } catch (err) {
      console.error('[EditRFQClient] Error loading RFQ:', err);
      setError('Failed to load RFQ');
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    const { db } = getFirebase();
    try {
      // Query entities with VENDOR role
      const q = query(
        collection(db, COLLECTIONS.ENTITIES),
        where('roles', 'array-contains', 'VENDOR')
      );
      const snapshot = await getDocs(q);
      // Filter out deleted entities client-side
      const vendorList: Vendor[] = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const vendor: Vendor = {
            id: doc.id,
            name: data.name,
            contactPerson: data.contactPerson,
            email: data.email,
            phone: data.phone,
            isDeleted: data.isDeleted,
          };
          return vendor;
        })
        .filter((vendor) => vendor.isDeleted !== true)
        .sort((a, b) => a.name.localeCompare(b.name));
      setVendors(vendorList);
    } catch (err) {
      console.error('[EditRFQClient] Error loading vendors:', err);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendors((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]
    );
  };

  const handleSave = async () => {
    if (!user || !rfq || !rfqId) return;

    // Validation
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }
    if (!formData.dueDate) {
      setError('Due date is required');
      return;
    }

    // Allow past due dates to be updated - don't block edit because date is overdue
    // Users should be able to fix an overdue date

    if (selectedVendors.length === 0) {
      setError('At least one vendor must be selected');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const selectedVendorEntities = vendors.filter((v) => selectedVendors.includes(v.id));

      await updateRFQ(
        rfqId,
        {
          title: formData.title,
          description: formData.description,
          dueDate: new Date(formData.dueDate),
          validityPeriod: formData.validityPeriod,
          vendorIds: selectedVendors,
          vendorNames: selectedVendorEntities.map((v) => v.name),
          paymentTerms: formData.paymentTerms || undefined,
          deliveryTerms: formData.deliveryTerms || undefined,
          warrantyTerms: formData.warrantyTerms || undefined,
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      setSuccess('RFQ updated successfully');
      setTimeout(() => {
        router.push(`/procurement/rfqs/${rfqId}`);
      }, 1500);
    } catch (err) {
      console.error('[EditRFQClient] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !rfq) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => router.push('/procurement/rfqs')} sx={{ mt: 2 }}>
          Back to RFQs
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Breadcrumbs sx={{ mb: 2 }}>
              <Link
                color="inherit"
                href="/procurement"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  router.push('/procurement');
                }}
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                Procurement
              </Link>
              <Link
                color="inherit"
                href="/procurement/rfqs"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  router.push('/procurement/rfqs');
                }}
                sx={{ cursor: 'pointer' }}
              >
                RFQs
              </Link>
              <Link
                color="inherit"
                href={`/procurement/rfqs/${rfqId}`}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  router.push(`/procurement/rfqs/${rfqId}`);
                }}
                sx={{ cursor: 'pointer' }}
              >
                {rfq?.number || rfqId}
              </Link>
              <Typography color="text.primary">Edit</Typography>
            </Breadcrumbs>
            <Typography variant="h4" gutterBottom>
              Edit {rfq?.number}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Make changes to your RFQ
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => router.push(`/procurement/rfqs/${rfqId}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </Stack>

        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* RFQ Details */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            RFQ Details
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Stack spacing={3}>
            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              fullWidth
              required
            />

            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              multiline
              rows={4}
              fullWidth
              required
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Due Date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
                helperText="Date by which vendors should submit their quotations"
              />

              <TextField
                label="Validity Period (days)"
                type="number"
                value={formData.validityPeriod}
                onChange={(e) => handleInputChange('validityPeriod', Number(e.target.value))}
                fullWidth
                helperText="Number of days the quotation should remain valid"
                inputProps={{ min: 1 }}
              />
            </Stack>
          </Stack>
        </Paper>

        {/* Terms and Conditions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Terms and Conditions
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Stack spacing={3}>
            <TextField
              label="Payment Terms"
              value={formData.paymentTerms}
              onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="e.g., 30% advance, 60% on delivery, 10% after commissioning"
            />

            <TextField
              label="Delivery Terms"
              value={formData.deliveryTerms}
              onChange={(e) => handleInputChange('deliveryTerms', e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="e.g., CIF Mumbai Port, FOB Dubai"
            />

            <TextField
              label="Warranty Terms"
              value={formData.warrantyTerms}
              onChange={(e) => handleInputChange('warrantyTerms', e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="e.g., 12 months from date of commissioning"
            />
          </Stack>
        </Paper>

        {/* Vendors */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Vendors ({selectedVendors.length} selected)
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select vendors to invite for quotations
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">Select</TableCell>
                  <TableCell>Vendor Name</TableCell>
                  <TableCell>Contact Person</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow
                    key={vendor.id}
                    hover
                    onClick={() => toggleVendorSelection(vendor.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={selectedVendors.includes(vendor.id)} />
                    </TableCell>
                    <TableCell>{vendor.name}</TableCell>
                    <TableCell>{vendor.contactPerson || '-'}</TableCell>
                    <TableCell>{vendor.email || '-'}</TableCell>
                    <TableCell>{vendor.phone || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Line Items (Read-only) */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Line Items ({items.length})
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Alert severity="info" sx={{ mb: 2 }}>
            Line items are sourced from Purchase Requests and cannot be modified here. To change
            line items, create a new RFQ from different Purchase Requests.
          </Alert>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Line #</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Equipment</TableCell>
                  <TableCell>Required By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.lineNumber}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.description}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.specification || '-'}</Typography>
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.equipmentCode || '-'}</TableCell>
                    <TableCell>{formatDate(item.requiredBy)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Source Purchase Requests */}
        {rfq && rfq.purchaseRequestIds.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Source Purchase Requests
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {rfq.purchaseRequestIds.map((prId) => (
                <Chip
                  key={prId}
                  label={prId}
                  variant="outlined"
                  onClick={() => router.push(`/procurement/purchase-requests/${prId}`)}
                  sx={{ mb: 1, cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
