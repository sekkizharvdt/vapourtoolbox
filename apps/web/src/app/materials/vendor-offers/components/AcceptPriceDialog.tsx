'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import type { VendorOfferItem, VendorOffer } from '@vapour/types';

interface AcceptPriceDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  item: VendorOfferItem | null;
  offer: VendorOffer | null;
  accepting: boolean;
}

export function AcceptPriceDialog({
  open,
  onClose,
  onConfirm,
  item,
  offer,
  accepting,
}: AcceptPriceDialogProps) {
  if (!item || !offer) return null;

  const isLinked = item.materialId || item.serviceId || item.boughtOutItemId;
  const isMaterial = item.itemType === 'MATERIAL' && item.materialId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Accept Price</DialogTitle>
      <DialogContent>
        {!isLinked ? (
          <Typography color="error">
            This item is not linked to any material, service, or bought-out item. Please link it
            first before accepting the price.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {isMaterial
                ? 'This will record the price in the material price history.'
                : 'This will mark the price as accepted on this offer item.'}
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Row label="Item" value={item.linkedItemName ?? item.description} />
              <Row label="Code" value={item.linkedItemCode ?? '-'} />
              <Row label="Vendor" value={offer.vendorName} />
              <Row
                label="Unit Price"
                value={`${offer.currency} ${item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              />
              <Row label="Quantity" value={`${item.quantity} ${item.unit}`} />
              <Row
                label="Amount"
                value={`${offer.currency} ${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              />
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={accepting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={!isLinked || accepting}
          color="success"
        >
          {accepting ? 'Accepting...' : 'Accept Price'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Box>
  );
}
