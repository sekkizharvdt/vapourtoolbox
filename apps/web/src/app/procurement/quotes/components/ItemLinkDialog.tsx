'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { Firestore } from 'firebase/firestore';
import type { QuoteItemType } from '@vapour/types';

export interface LinkedItem {
  itemType: QuoteItemType;
  id: string;
  name: string;
  code: string;
}

interface ItemLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: LinkedItem) => void;
  db: Firestore;
  initialTab?: QuoteItemType;
}

interface SearchResult {
  id: string;
  name: string;
  code: string;
  category?: string;
}

const TAB_MAP: QuoteItemType[] = ['MATERIAL', 'SERVICE', 'BOUGHT_OUT'];

export function ItemLinkDialog({
  open,
  onClose,
  onSelect,
  db,
  initialTab = 'MATERIAL',
}: ItemLinkDialogProps) {
  const [tab, setTab] = useState<number>(TAB_MAP.indexOf(initialTab));
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setResults([]);
      setTab(TAB_MAP.indexOf(initialTab));
    }
  }, [open, initialTab]);

  const search = useCallback(async () => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const term = searchTerm.toLowerCase();
      const itemType = TAB_MAP[tab];
      let items: SearchResult[] = [];

      if (itemType === 'MATERIAL') {
        // Search materials by name (client-side filter)
        const q = query(
          collection(db, COLLECTIONS.MATERIALS),
          where('isActive', '==', true),
          orderBy('name'),
          limit(50)
        );
        const snap = await getDocs(q);
        items = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name as string,
              code: (data.materialCode as string) ?? '',
              category: data.category as string,
            };
          })
          .filter(
            (item) =>
              item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term)
          );
      } else if (itemType === 'SERVICE') {
        const q = query(
          collection(db, COLLECTIONS.SERVICES),
          where('isActive', '==', true),
          orderBy('name'),
          limit(50)
        );
        const snap = await getDocs(q);
        items = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name as string,
              code: (data.serviceCode as string) ?? '',
              category: data.category as string,
            };
          })
          .filter(
            (item) =>
              item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term)
          );
      } else {
        // BOUGHT_OUT
        const q = query(
          collection(db, 'bought_out_items'),
          where('isActive', '==', true),
          orderBy('name'),
          limit(50)
        );
        const snap = await getDocs(q);
        items = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name as string,
              code: (data.itemCode as string) ?? '',
              category: data.category as string,
            };
          })
          .filter(
            (item) =>
              item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term)
          );
      }

      setResults(items.slice(0, 20));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [db, searchTerm, tab]);

  useEffect(() => {
    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleSelect = (item: SearchResult) => {
    onSelect({
      itemType: TAB_MAP[tab]!,
      id: item.id,
      name: item.name,
      code: item.code,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Link to Database Item</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Material" />
          <Tab label="Service" />
          <Tab label="Bought Out" />
        </Tabs>

        <TextField
          fullWidth
          size="small"
          placeholder="Search by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : results.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {searchTerm ? 'No results found.' : 'Type to search...'}
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleSelect(item)}
                  >
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {item.code}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.category ?? '-'}</TableCell>
                    <TableCell>
                      <Button size="small" variant="text">
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
