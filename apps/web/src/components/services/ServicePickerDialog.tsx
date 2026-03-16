'use client';

/**
 * Service Picker Dialog
 *
 * Allows users to search and select a service from the catalog
 * when adding service line items to a purchase request.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  type QueryConstraint,
} from 'firebase/firestore';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { Service } from '@vapour/types';
import { ServiceCategory, SERVICE_CATEGORY_LABELS } from '@vapour/types';

interface ServicePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (service: Service) => void;
  /** Optional: pre-filter to a specific category */
  categoryFilter?: ServiceCategory;
}

export default function ServicePickerDialog({
  open,
  onClose,
  onSelect,
  categoryFilter,
}: ServicePickerDialogProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(categoryFilter ?? '');

  const { db } = getFirebase();

  useEffect(() => {
    if (!open || !db) return;

    async function load() {
      setLoading(true);
      try {
        const constraints: QueryConstraint[] = [where('isActive', '==', true)];

        if (category) {
          constraints.push(where('category', '==', category));
        }

        constraints.push(orderBy('name', 'asc'));

        const q = query(collection(db, COLLECTIONS.SERVICES), ...constraints);
        const snap = await getDocs(q);
        setServices(snap.docs.map((d) => docToTyped<Service>(d.id, d.data())));
      } catch (error) {
        console.error('Error loading services:', error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, db, category]);

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
      if (categoryFilter) setCategory(categoryFilter);
    }
  }, [open, categoryFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const term = search.toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.serviceCode.toLowerCase().includes(term) ||
        (s.description ?? '').toLowerCase().includes(term)
    );
  }, [services, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Select Service
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            autoFocus
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Category</InputLabel>
            <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
              <MenuItem value="">All Categories</MenuItem>
              {Object.entries(SERVICE_CATEGORY_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Results */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {search ? 'No services match your search' : 'No services in this category'}
          </Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Turnaround</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((service) => (
                  <TableRow
                    key={service.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      onSelect(service);
                      onClose();
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
                        {service.serviceCode}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {service.name}
                      </Typography>
                      {service.description && (
                        <Typography variant="caption" color="text.secondary">
                          {service.description.length > 60
                            ? service.description.substring(0, 60) + '...'
                            : service.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={SERVICE_CATEGORY_LABELS[service.category]}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{service.unit ?? '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {service.estimatedTurnaroundDays
                          ? `${service.estimatedTurnaroundDays}d`
                          : '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}
