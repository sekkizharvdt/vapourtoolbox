import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { INDIAN_COA_TEMPLATE } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';

interface ImportCOADialogProps {
  open: boolean;
  onClose: () => void;
}

export function ImportCOADialog({ open, onClose }: ImportCOADialogProps) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleImport = async () => {
    if (!user) {
      setError('You must be logged in to import accounts');
      return;
    }

    setImporting(true);
    setProgress(0);
    setError('');

    try {
      const { db } = getFirebase();
      const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

      const total = INDIAN_COA_TEMPLATE.length;
      let imported = 0;

      // Import each account from the template
      for (const templateAccount of INDIAN_COA_TEMPLATE) {
        const accountId = `acc-${templateAccount.code}`;

        await setDoc(doc(accountsRef, accountId), {
          code: templateAccount.code,
          name: templateAccount.name,
          description: templateAccount.description || '',
          accountType: templateAccount.accountType,
          accountCategory: templateAccount.accountCategory,
          accountGroup: templateAccount.accountGroup || null,
          level: templateAccount.level,
          isGroup: templateAccount.isGroup,
          isActive: true,
          isSystemAccount: templateAccount.isSystemAccount,
          openingBalance: 0,
          currentBalance: 0,
          currency: 'INR',
          isGSTAccount: templateAccount.isGSTAccount,
          gstType: templateAccount.gstType || null,
          gstDirection: templateAccount.gstDirection || null,
          isTDSAccount: templateAccount.isTDSAccount,
          tdsSection: templateAccount.tdsSection || null,
          isBankAccount: templateAccount.isBankAccount,
          bankName: templateAccount.bankName || null,
          accountNumber: null,
          ifscCode: null,
          branch: null,
          parentAccountId: null, // Will be set based on accountGroup in post-processing if needed
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          updatedAt: serverTimestamp(),
        });

        imported++;
        setProgress((imported / total) * 100);

        // Small delay to avoid overwhelming Firestore
        if (imported % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setProgress(0);
      }, 2000);
    } catch (err) {
      console.error('Error importing COA:', err);
      setError('Failed to import Chart of Accounts. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      onClose();
      setError('');
      setSuccess(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Indian Chart of Accounts</DialogTitle>
      <DialogContent>
        {!importing && !success && (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              This will import the standard Indian Chart of Accounts template with{' '}
              <strong>{INDIAN_COA_TEMPLATE.length} accounts</strong>. The template includes:
            </Alert>

            <List dense>
              <ListItem>
                <ListItemText
                  primary="Assets"
                  secondary="Cash & Bank, Trade Receivables, GST Input, TDS Receivable, Fixed Assets"
                />
              </ListItem>
              <Divider component="li" />
              <ListItem>
                <ListItemText
                  primary="Liabilities"
                  secondary="Trade Payables, GST Output, TDS Payable, Loans & Borrowings"
                />
              </ListItem>
              <Divider component="li" />
              <ListItem>
                <ListItemText
                  primary="Equity"
                  secondary="Share Capital, Retained Earnings, Reserves & Surplus"
                />
              </ListItem>
              <Divider component="li" />
              <ListItem>
                <ListItemText
                  primary="Income"
                  secondary="Sales Revenue (Domestic & Export), Other Income, Interest Income"
                />
              </ListItem>
              <Divider component="li" />
              <ListItem>
                <ListItemText
                  primary="Expenses"
                  secondary="Cost of Goods Sold, Operating Expenses, Financial Expenses"
                />
              </ListItem>
            </List>

            <Alert severity="warning" sx={{ mt: 3 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Important Notes:
              </Typography>
              <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2 }}>
                <li>This action will create {INDIAN_COA_TEMPLATE.length} new accounts</li>
                <li>Existing accounts with the same code will NOT be overwritten</li>
                <li>You can customize accounts after import</li>
                <li>System accounts cannot be deleted</li>
              </Typography>
            </Alert>
          </>
        )}

        {importing && (
          <Box sx={{ py: 4 }}>
            <Typography variant="body1" gutterBottom align="center">
              Importing Chart of Accounts...
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
              {Math.round(progress)}% complete
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ mt: 2 }} />
          </Box>
        )}

        {success && (
          <Alert severity="success" sx={{ py: 4 }}>
            <Typography variant="h6" gutterBottom>
              Import Successful!
            </Typography>
            <Typography variant="body2">
              Successfully imported {INDIAN_COA_TEMPLATE.length} accounts to your Chart of Accounts.
            </Typography>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={importing}>
          {success ? 'Close' : 'Cancel'}
        </Button>
        {!success && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import Now'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
