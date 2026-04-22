'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  RestoreFromTrash as RestoreIcon,
  Search as SearchIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState, TableActionCell, FilterBar } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS, canViewProcurement } from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';

import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { restoreProcurementDocument } from '@/lib/procurement/procurementDeleteService';

type ProcurementDocType =
  | 'PURCHASE_REQUEST'
  | 'RFQ'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'PACKING_LIST'
  | 'AMENDMENT';

interface DeletedProcurementDoc {
  id: string;
  docType: ProcurementDocType;
  collectionName: string;
  number?: string;
  description?: string;
  status?: string;
  vendorName?: string;
  deletedAt?: unknown;
  deletedBy?: string;
}

const DOC_TYPE_LABELS: Record<ProcurementDocType, string> = {
  PURCHASE_REQUEST: 'Purchase Request',
  RFQ: 'RFQ',
  PURCHASE_ORDER: 'Purchase Order',
  GOODS_RECEIPT: 'Goods Receipt',
  PACKING_LIST: 'Packing List',
  AMENDMENT: 'PO Amendment',
};

const PROCUREMENT_COLLECTIONS: { type: ProcurementDocType; collection: string }[] = [
  { type: 'PURCHASE_REQUEST', collection: COLLECTIONS.PURCHASE_REQUESTS },
  { type: 'RFQ', collection: COLLECTIONS.RFQS },
  { type: 'PURCHASE_ORDER', collection: COLLECTIONS.PURCHASE_ORDERS },
  { type: 'GOODS_RECEIPT', collection: COLLECTIONS.GOODS_RECEIPTS },
  { type: 'PACKING_LIST', collection: COLLECTIONS.PACKING_LISTS },
  { type: 'AMENDMENT', collection: COLLECTIONS.PURCHASE_ORDER_AMENDMENTS },
];

export default function ProcurementTrashPage() {
  const { claims, user } = useAuth();
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ProcurementDocType | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [deletedDocs, setDeletedDocs] = useState<DeletedProcurementDoc[]>([]);

  const hasViewAccess = claims?.permissions ? canViewProcurement(claims.permissions) : false;
  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_PROCUREMENT);

  const fetchDeletedDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { db } = getFirebase();
      const results: DeletedProcurementDoc[] = [];

      // Query all procurement collections in parallel for soft-deleted documents
      // Use Promise.allSettled so one collection failure doesn't block the rest
      const settled = await Promise.allSettled(
        PROCUREMENT_COLLECTIONS.map(async ({ type, collection: collName }) => {
          const q = query(collection(db, collName), where('isDeleted', '==', true));
          const snapshot = await getDocs(q);
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            results.push({
              id: docSnap.id,
              docType: type,
              collectionName: collName,
              number: data.number || data.purchaseOrderNumber || data.transactionNumber,
              description: data.description || data.title || data.subject,
              status: data.status,
              vendorName: data.vendorName,
              deletedAt: data.deletedAt,
              deletedBy: data.deletedBy,
            });
          });
        })
      );

      // Log any collection failures without blocking results from other collections
      settled.forEach((result, idx) => {
        if (result.status === 'rejected') {
          console.warn(
            `[ProcurementTrash] Failed to query ${PROCUREMENT_COLLECTIONS[idx]?.type}:`,
            result.reason
          );
        }
      });

      // Sort by deletedAt descending
      results.sort((a, b) => {
        const dateA = toDate(a.deletedAt)?.getTime() ?? 0;
        const dateB = toDate(b.deletedAt)?.getTime() ?? 0;
        return dateB - dateA;
      });

      setDeletedDocs(results);
    } catch (error) {
      console.error('[ProcurementTrash] Error fetching deleted docs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasViewAccess) {
      fetchDeletedDocs();
    } else {
      setLoading(false);
    }
  }, [hasViewAccess, fetchDeletedDocs]);

  const filteredDocs = useMemo(() => {
    return deletedDocs.filter((doc) => {
      const matchesSearch =
        searchTerm === '' ||
        doc.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === 'ALL' || doc.docType === filterType;

      return matchesSearch && matchesType;
    });
  }, [deletedDocs, searchTerm, filterType]);

  const handleRestore = async (doc: DeletedProcurementDoc) => {
    const confirmed = await confirm({
      title: 'Restore Document',
      message: `Restore "${doc.number || doc.id}" (${DOC_TYPE_LABELS[doc.docType]})? It will reappear on its original list page.`,
      confirmText: 'Restore',
      confirmColor: 'success',
    });
    if (!confirmed) return;

    try {
      const { db } = getFirebase();
      const result = await restoreProcurementDocument(db, doc.collectionName, {
        id: doc.id,
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Unknown',
        userPermissions: claims?.permissions || 0,
      });
      if (result.success) {
        // Remove from local state
        setDeletedDocs((prev) => prev.filter((d) => d.id !== doc.id));
      } else {
        toast.error(result.error || 'Failed to restore document');
      }
    } catch (error) {
      console.error('[ProcurementTrash] Error restoring document:', error);
      toast.error('Failed to restore document');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterType('ALL');
  };

  const paginatedDocs = filteredDocs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (!hasViewAccess) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Procurement Trash
        </Typography>
        <Typography color="error">You do not have permission to access procurement.</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 4 }}>
        <LoadingState message="Loading trash..." variant="page" />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
          { label: 'Trash' },
        ]}
      />

      <PageHeader title="Trash" subtitle="Deleted procurement documents can be restored here" />

      {/* Filters */}
      <FilterBar onClear={handleClearFilters}>
        <TextField
          label="Search"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by number, description, or vendor..."
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ProcurementDocType | 'ALL')}
            label="Type"
          >
            <MenuItem value="ALL">All Types</MenuItem>
            <MenuItem value="PURCHASE_REQUEST">Purchase Requests</MenuItem>
            <MenuItem value="RFQ">RFQs</MenuItem>
            <MenuItem value="PURCHASE_ORDER">Purchase Orders</MenuItem>
            <MenuItem value="GOODS_RECEIPT">Goods Receipts</MenuItem>
            <MenuItem value="PACKING_LIST">Packing Lists</MenuItem>
            <MenuItem value="AMENDMENT">PO Amendments</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Document #</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Original Status</TableCell>
              <TableCell>Deleted At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedDocs.length === 0 ? (
              <EmptyState
                message={
                  searchTerm || filterType !== 'ALL'
                    ? 'No deleted documents match the selected filters.'
                    : 'Trash is empty. Deleted procurement documents will appear here.'
                }
                variant="table"
                colSpan={6}
              />
            ) : (
              paginatedDocs.map((doc) => (
                <TableRow key={`${doc.collectionName}-${doc.id}`} hover>
                  <TableCell>
                    <Chip label={DOC_TYPE_LABELS[doc.docType]} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{doc.number || doc.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                      {doc.description || doc.vendorName || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={doc.status || '-'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{formatDeletedAt(doc.deletedAt)}</TableCell>
                  <TableCell align="right">
                    <TableActionCell
                      actions={[
                        {
                          icon: <RestoreIcon />,
                          label: 'Restore',
                          onClick: () => handleRestore(doc),
                          color: 'success',
                          show: canManage,
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredDocs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>
    </Box>
  );
}

/** Safely convert Firestore Timestamp or Date to Date */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/** Format deletedAt timestamp for display */
function formatDeletedAt(deletedAt: unknown): string {
  const date = toDate(deletedAt);
  if (!date) return '-';
  return formatDate(date);
}
