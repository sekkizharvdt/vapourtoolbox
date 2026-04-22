'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { Add as AddIcon, Search as SearchIcon, Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import type { VendorOffer, VendorOfferStatus } from '@vapour/types';
import { listVendorOffers } from '@/lib/vendorOffers/vendorOfferService';
import { canManageEstimation } from '@vapour/constants';

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

export default function VendorOffersPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const { db } = getFirebase();

  const [offers, setOffers] = useState<VendorOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const canManage = claims?.permissions ? canManageEstimation(claims.permissions) : false;

  const loadOffers = useCallback(async () => {
    try {
      setLoading(true);
      const fetched = await listVendorOffers(db);
      setOffers(fetched);
    } catch (error) {
      console.error('Error loading vendor offers:', error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const filtered = offers.filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return o.offerNumber.toLowerCase().includes(term) || o.vendorName.toLowerCase().includes(term);
  });

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Materials', href: '/materials', icon: <HomeIcon fontSize="small" /> },
            { label: 'Vendor Offers' },
          ]}
        />

        <PageHeader
          title="Vendor Offers"
          subtitle="Upload and manage vendor quotations, map prices to materials"
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search by offer number or vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 300 }}
        />

        <Box sx={{ flexGrow: 1 }} />

        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/materials/vendor-offers/new')}
          >
            New Offer
          </Button>
        )}
      </Box>

      {loading ? (
        <LoadingState message="Loading vendor offers..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No vendor offers found"
          message={
            searchTerm
              ? 'Try adjusting your search.'
              : 'Upload your first vendor offer to start tracking prices.'
          }
        />
      ) : (
        <Card>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Offer Number</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Offer Date</TableCell>
                  <TableCell align="center">Items</TableCell>
                  <TableCell align="center">Accepted</TableCell>
                  <TableCell align="right">Total ({offers[0]?.currency ?? 'INR'})</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((offer) => (
                  <TableRow
                    key={offer.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/materials/vendor-offers/${offer.id}`)}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{offer.offerNumber}</TableCell>
                    <TableCell>{offer.vendorName}</TableCell>
                    <TableCell>{formatDate(offer.offerDate)}</TableCell>
                    <TableCell align="center">{offer.itemCount}</TableCell>
                    <TableCell align="center">{offer.acceptedCount}</TableCell>
                    <TableCell align="right">
                      {offer.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Chip label={offer.status} size="small" color={STATUS_COLORS[offer.status]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </>
  );
}
