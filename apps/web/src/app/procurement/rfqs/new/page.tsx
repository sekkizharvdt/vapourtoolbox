'use client';

/**
 * Create New RFQ Page
 *
 * Create RFQ from approved Purchase Requests
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  Stepper,
  Step,
  StepLabel,
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
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
  Search as SearchIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseRequest } from '@vapour/types';
import { listPurchaseRequests, getPurchaseRequestItems } from '@/lib/procurement/purchaseRequest';
import { createRFQFromPRs, type VendorSuggestion } from '@/lib/procurement/rfq';
import { suggestVendorsForRFQ } from '@/lib/procurement/rfq/suggestions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { formatDate } from '@/lib/utils/formatters';

const steps = ['Select Purchase Requests', 'Select Vendors', 'RFQ Details', 'Review & Create'];

interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  isDeleted?: boolean;
  vendorCategories?: string[];
  servicesOffered?: string[];
}

export default function NewRFQPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // Step 1: Select PRs
  const [availablePRs, setAvailablePRs] = useState<PurchaseRequest[]>([]);
  const [selectedPRs, setSelectedPRs] = useState<string[]>([]);

  // Step 2: Select Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [vendorSuggestions, setVendorSuggestions] = useState<VendorSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState('');

  // Step 3: RFQ Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [warrantyTerms, setWarrantyTerms] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [validityPeriod, setValidityPeriod] = useState(30);

  useEffect(() => {
    loadApprovedPRs();
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadApprovedPRs = async () => {
    setLoading(true);
    try {
      const { db } = getFirebase();

      // Fetch approved PRs
      const result = await listPurchaseRequests({ status: 'APPROVED' });

      if (result.items.length === 0) {
        setAvailablePRs([]);
        return;
      }

      // Get all existing RFQs to check which PRs are already converted
      // This is more reliable than relying on PR status updates
      const rfqQuery = query(collection(db, COLLECTIONS.RFQS));
      const rfqSnapshot = await getDocs(rfqQuery);

      // Collect all PR IDs that are already linked to RFQs
      const prIdsInRFQs = new Set<string>();
      rfqSnapshot.forEach((rfqDoc) => {
        const rfqData = rfqDoc.data();
        if (rfqData.purchaseRequestIds && Array.isArray(rfqData.purchaseRequestIds)) {
          rfqData.purchaseRequestIds.forEach((prId: string) => prIdsInRFQs.add(prId));
        }
      });

      // Filter out PRs that are already linked to RFQs
      const filteredPRs = result.items.filter((pr) => !prIdsInRFQs.has(pr.id));
      setAvailablePRs(filteredPRs);
    } catch (err) {
      console.error('[NewRFQPage] Error loading PRs:', err);
      setError('Failed to load purchase requests');
    } finally {
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
      // Filter out deleted entities client-side (consistent with entities page)
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
            vendorCategories: data.vendorCategories,
            servicesOffered: data.servicesOffered,
          };
          return vendor;
        })
        .filter((vendor) => vendor.isDeleted !== true)
        .sort((a, b) => a.name.localeCompare(b.name));
      setVendors(vendorList);
    } catch (err) {
      console.error('[NewRFQPage] Error loading vendors:', err);
    }
  };

  const loadVendorSuggestions = async () => {
    const { db } = getFirebase();
    setSuggestionsLoading(true);
    try {
      // Get all PR items to extract materialIds
      const allItems = await Promise.all(selectedPRs.map((prId) => getPurchaseRequestItems(prId)));
      const materialIds = allItems.flat().map((item) => item.materialId);

      const suggestions = await suggestVendorsForRFQ(db, materialIds);
      setVendorSuggestions(suggestions);

      // Auto-select suggested vendors
      if (suggestions.length > 0 && selectedVendors.length === 0) {
        setSelectedVendors(suggestions.map((s) => s.vendorId));
      }
    } catch (err) {
      console.error('[NewRFQPage] Error loading vendor suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleNext = () => {
    // Validation
    if (activeStep === 0 && selectedPRs.length === 0) {
      setError('Please select at least one Purchase Request');
      return;
    }

    // Load vendor suggestions when moving from Step 1 (PRs) to Step 2 (Vendors)
    if (activeStep === 0) {
      loadVendorSuggestions();
    }

    // Vendors are optional in DRAFT — user can add them later before issuing

    // Auto-populate description when moving from step 1 to step 2
    if (activeStep === 1) {
      const selectedPRDetails = availablePRs.filter((pr) => selectedPRs.includes(pr.id));
      if (!description.trim()) {
        // Auto-generate description from selected PRs
        const prNumbers = selectedPRDetails.map((pr) => pr.number).join(', ');
        const prTitles = selectedPRDetails.map((pr) => pr.title).join('; ');
        const autoDescription = `Request for Quotation for items from ${prNumbers}.\n\nScope: ${prTitles}`;
        setDescription(autoDescription);
      }
      // Auto-generate title if empty
      if (!title.trim()) {
        const projectNames = [
          ...new Set(selectedPRDetails.map((pr) => pr.projectName).filter(Boolean)),
        ];
        const autoTitle =
          projectNames.length > 0
            ? `RFQ - ${projectNames.join(', ')}`
            : `RFQ - ${selectedPRDetails.map((pr) => pr.number).join(', ')}`;
        setTitle(autoTitle);
      }
    }

    if (activeStep === 2) {
      if (!title.trim()) {
        setError('Title is required');
        return;
      }
      // Description is now optional - auto-generated if not provided
      if (!dueDate) {
        setError('Due date is required');
        return;
      }
      const dueDateObj = new Date(dueDate);
      if (dueDateObj <= new Date()) {
        setError('Due date must be in the future');
        return;
      }
    }

    setError('');
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setActiveStep((prev) => prev - 1);
  };

  const handleCreateRFQ = async () => {
    if (!user) return;

    setCreating(true);
    setError('');

    try {
      const selectedVendorEntities = vendors.filter((v) => selectedVendors.includes(v.id));

      const rfqId = await createRFQFromPRs(
        selectedPRs,
        selectedVendors,
        selectedVendorEntities.map((v) => v.name),
        {
          title,
          description,
          paymentTerms: paymentTerms || undefined,
          deliveryTerms: deliveryTerms || undefined,
          warrantyTerms: warrantyTerms || undefined,
          otherTerms: remarks.trim() ? [`Remarks: ${remarks.trim()}`] : undefined,
          dueDate: new Date(dueDate),
          validityPeriod,
        },
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/rfqs/${rfqId}`);
    } catch (err) {
      console.error('[NewRFQPage] Error creating RFQ:', err);
      setError('Failed to create RFQ. Please try again.');
      setCreating(false);
    }
  };

  const togglePRSelection = (prId: string) => {
    setSelectedPRs((prev) =>
      prev.includes(prId) ? prev.filter((id) => id !== prId) : [...prev, prId]
    );
  };

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendors((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]
    );
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Approved Purchase Requests
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose one or more approved PRs to include in this RFQ
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : availablePRs.length === 0 ? (
              <Alert severity="info">
                No approved purchase requests available. Please create and approve PRs first.
              </Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">Select</TableCell>
                      <TableCell>PR Number</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Project</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availablePRs.map((pr) => (
                      <TableRow
                        key={pr.id}
                        hover
                        onClick={() => togglePRSelection(pr.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedPRs.includes(pr.id)} />
                        </TableCell>
                        <TableCell>{pr.number}</TableCell>
                        <TableCell>{pr.title}</TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={pr.description}
                        >
                          {pr.description || '-'}
                        </TableCell>
                        <TableCell>{pr.projectName || 'N/A'}</TableCell>
                        <TableCell>{pr.itemCount}</TableCell>
                        <TableCell>{formatDate(pr.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Typography variant="body2" sx={{ mt: 2 }}>
              Selected: {selectedPRs.length} PR(s)
            </Typography>
          </Box>
        );

      case 1: {
        // Build a set of suggested vendor IDs for quick lookup
        const suggestedIds = new Set(vendorSuggestions.map((s) => s.vendorId));
        const suggestionMap = new Map(vendorSuggestions.map((s) => [s.vendorId, s]));

        // Collect unique vendor categories for the filter dropdown
        const allCategories = new Set<string>();
        vendors.forEach((v) => v.vendorCategories?.forEach((c) => allCategories.add(c)));

        // Apply search and category filters
        const filteredVendors = vendors.filter((vendor) => {
          if (vendorSearch.trim()) {
            const term = vendorSearch.toLowerCase();
            const matchesSearch =
              vendor.name.toLowerCase().includes(term) ||
              (vendor.contactPerson ?? '').toLowerCase().includes(term) ||
              (vendor.email ?? '').toLowerCase().includes(term);
            if (!matchesSearch) return false;
          }
          if (vendorCategoryFilter) {
            if (!vendor.vendorCategories?.includes(vendorCategoryFilter)) return false;
          }
          return true;
        });

        // Sort: suggested vendors first, then alphabetical
        const sortedVendors = [...filteredVendors].sort((a, b) => {
          const aIsSuggested = suggestedIds.has(a.id) ? 0 : 1;
          const bIsSuggested = suggestedIds.has(b.id) ? 0 : 1;
          if (aIsSuggested !== bIsSuggested) return aIsSuggested - bIsSuggested;
          return a.name.localeCompare(b.name);
        });

        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Vendors
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose vendors to invite for quotations. You can skip this step and add vendors later
              before issuing the RFQ.
            </Typography>

            {/* Vendor Suggestions Banner */}
            {suggestionsLoading && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Loading vendor suggestions based on materials in selected PRs...
              </Alert>
            )}
            {!suggestionsLoading && vendorSuggestions.length > 0 && (
              <Alert severity="success" icon={<StarIcon />} sx={{ mb: 2 }}>
                {vendorSuggestions.length} vendor(s) suggested based on preferred vendors for
                materials in the selected PRs. They have been pre-selected.
              </Alert>
            )}

            {/* Search and Category Filter */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                placeholder="Search vendors..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 250 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              {allCategories.size > 0 && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={vendorCategoryFilter}
                    label="Category"
                    onChange={(e) => setVendorCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {Array.from(allCategories)
                      .sort()
                      .map((cat) => (
                        <MenuItem key={cat} value={cat}>
                          {cat}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              )}
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">Select</TableCell>
                    <TableCell>Vendor Name</TableCell>
                    <TableCell>Contact Person</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    {allCategories.size > 0 && <TableCell>Categories</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedVendors.map((vendor) => {
                    const suggestion = suggestionMap.get(vendor.id);
                    return (
                      <TableRow
                        key={vendor.id}
                        hover
                        onClick={() => toggleVendorSelection(vendor.id)}
                        sx={{
                          cursor: 'pointer',
                          ...(suggestion && {
                            backgroundColor: 'action.hover',
                          }),
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedVendors.includes(vendor.id)} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {vendor.name}
                            {suggestion && (
                              <Tooltip
                                title={`Preferred vendor for ${suggestion.materialCodes.join(', ')} (${suggestion.materialCount} item${suggestion.materialCount > 1 ? 's' : ''})`}
                              >
                                <Chip
                                  icon={<StarIcon />}
                                  label="Suggested"
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{vendor.contactPerson || '-'}</TableCell>
                        <TableCell>{vendor.email || '-'}</TableCell>
                        <TableCell>{vendor.phone || '-'}</TableCell>
                        {allCategories.size > 0 && (
                          <TableCell>
                            {vendor.vendorCategories?.map((cat) => (
                              <Chip
                                key={cat}
                                label={cat}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            )) || '-'}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="body2" sx={{ mt: 2 }}>
              Selected: {selectedVendors.length} vendor(s)
              {selectedVendors.length === 0 && ' (you can add vendors later before issuing)'}
            </Typography>
          </Box>
        );
      }

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              RFQ Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Provide details for the RFQ document
            </Typography>

            <Stack spacing={3}>
              <TextField
                label="RFQ Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                fullWidth
                placeholder="e.g., RFQ for Heat Exchangers - Project ABC"
              />

              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Auto-generated from selected PRs. You can edit if needed."
                helperText="Auto-populated from selected Purchase Requests"
              />

              <TextField
                label="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Any specific requirements or notes for vendors (optional)"
                helperText="Optional - Add any special instructions or requirements"
              />

              <TextField
                label="Due Date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="Validity Period (days)"
                type="number"
                value={validityPeriod}
                onChange={(e) => setValidityPeriod(Number(e.target.value))}
                fullWidth
                helperText="Number of days the quotation should remain valid"
              />

              <TextField
                label="Payment Terms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="e.g., 30% advance, 60% on delivery, 10% after commissioning"
              />

              <TextField
                label="Delivery Terms"
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="e.g., CIF Mumbai Port, FOB Dubai"
              />

              <TextField
                label="Warranty Terms"
                value={warrantyTerms}
                onChange={(e) => setWarrantyTerms(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="e.g., 12 months from date of commissioning"
              />
            </Stack>
          </Box>
        );

      case 3:
        const selectedPRDetails = availablePRs.filter((pr) => selectedPRs.includes(pr.id));
        const selectedVendorDetails = vendors.filter((v) => selectedVendors.includes(v.id));

        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Create
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Review the RFQ details before creating
            </Typography>

            <Stack spacing={3}>
              <Paper sx={{ p: 2 }} variant="outlined">
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Selected Purchase Requests ({selectedPRDetails.length})
                </Typography>
                {selectedPRDetails.map((pr) => (
                  <Chip key={pr.id} label={pr.number} sx={{ mr: 1, mb: 1 }} />
                ))}
              </Paper>

              <Paper sx={{ p: 2 }} variant="outlined">
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Selected Vendors ({selectedVendorDetails.length})
                </Typography>
                {selectedVendorDetails.length > 0 ? (
                  selectedVendorDetails.map((vendor) => (
                    <Chip key={vendor.id} label={vendor.name} sx={{ mr: 1, mb: 1 }} />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No vendors selected. You can add vendors later before issuing the RFQ.
                  </Typography>
                )}
              </Paper>

              <Paper sx={{ p: 2 }} variant="outlined">
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  RFQ Details
                </Typography>
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      Title:
                    </Typography>
                    <Typography variant="body2">{title}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      Description:
                    </Typography>
                    <Typography variant="body2">{description}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      Due Date:
                    </Typography>
                    <Typography variant="body2">{formatDate(new Date(dueDate))}</Typography>
                  </Box>
                  {paymentTerms && (
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        Payment Terms:
                      </Typography>
                      <Typography variant="body2">{paymentTerms}</Typography>
                    </Box>
                  )}
                  {deliveryTerms && (
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        Delivery Terms:
                      </Typography>
                      <Typography variant="body2">{deliveryTerms}</Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 0 }}>
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
          <Typography color="text.primary">New</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/procurement/rfqs')}
            sx={{ mb: 1 }}
          >
            Back to RFQs
          </Button>
          <Typography variant="h4" gutterBottom>
            Create New RFQ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a Request for Quotation from approved purchase requests
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Stepper */}
        <Paper sx={{ p: 3 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Step Content */}
          {renderStepContent()}

          {/* Navigation */}
          <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
            <Button disabled={activeStep === 0 || creating} onClick={handleBack}>
              Back
            </Button>
            <Box sx={{ flex: 1 }} />
            {activeStep < steps.length - 1 ? (
              <Button variant="contained" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleCreateRFQ}
                disabled={creating}
                startIcon={creating ? <CircularProgress size={20} /> : <SaveIcon />}
              >
                {creating ? 'Creating...' : 'Create RFQ'}
              </Button>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
