'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  CircularProgress,
  TextField,
  Box,
  Chip,
} from '@mui/material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { listBOMs } from '@/lib/bom/bomService';
import type { BOM } from '@vapour/types';

interface ImportBOMDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (bomId: string) => void;
}

export function ImportBOMDialog({ open, onClose, onSelect }: ImportBOMDialogProps) {
  const db = useFirestore();
  const { claims } = useAuth();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open && db && claims?.entityId) {
      const fetchBOMs = async () => {
        setLoading(true);
        try {
          const data = await listBOMs(db, {
            entityId: claims.entityId || '',
            limit: 50,
          });
          setBoms(data);
        } catch (error) {
          console.error('Error fetching BOMs:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchBOMs();
    }
  }, [open, db, claims]);

  const filteredBoms = boms.filter(
    (bom) =>
      bom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bom.bomCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import from Bill of Materials</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, mt: 1 }}>
          <TextField
            fullWidth
            placeholder="Search BOMs by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
          />
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : filteredBoms.length === 0 ? (
          <Typography color="text.secondary" align="center" py={4}>
            No BOMs found.
          </Typography>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredBoms.map((bom) => (
              <ListItem key={bom.id} disablePadding divider>
                <ListItemButton onClick={() => onSelect(bom.id)}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1">{bom.name}</Typography>
                        <Chip label={bom.bomCode} size="small" variant="outlined" />
                        <Chip
                          label={bom.status}
                          size="small"
                          color={bom.status === 'APPROVED' ? 'success' : 'default'}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="span">
                          Project: {bom.projectName || 'N/A'}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          Items: {bom.summary?.itemCount || 0} | Total Cost:{' '}
                          {bom.summary?.totalCost?.amount?.toLocaleString()} {bom.summary?.currency}
                        </Typography>
                      </>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
