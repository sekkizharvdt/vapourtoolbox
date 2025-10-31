import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Box,
  Grid,
} from '@mui/material';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Account, AccountType, AccountCategory } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';

interface CreateAccountDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
}

const ACCOUNT_CATEGORIES: Record<AccountType, AccountCategory[]> = {
  ASSET: ['CURRENT_ASSETS', 'FIXED_ASSETS', 'INVESTMENTS', 'OTHER_ASSETS'],
  LIABILITY: ['CURRENT_LIABILITIES', 'LONG_TERM_LIABILITIES', 'OTHER_LIABILITIES'],
  EQUITY: ['SHARE_CAPITAL', 'RESERVES_SURPLUS', 'RETAINED_EARNINGS'],
  INCOME: ['OPERATING_REVENUE', 'OTHER_INCOME'],
  EXPENSE: ['COST_OF_GOODS_SOLD', 'OPERATING_EXPENSES', 'FINANCIAL_EXPENSES', 'OTHER_EXPENSES'],
};

export function CreateAccountDialog({ open, onClose, accounts }: CreateAccountDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('ASSET');
  const [accountCategory, setAccountCategory] = useState<AccountCategory>('CURRENT_ASSETS');
  const [isGroup, setIsGroup] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [currency, setCurrency] = useState('INR');

  // Special account types
  const [isGSTAccount, setIsGSTAccount] = useState(false);
  const [gstType, setGstType] = useState<'CGST' | 'SGST' | 'IGST' | 'CESS'>('CGST');
  const [gstDirection, setGstDirection] = useState<'INPUT' | 'OUTPUT'>('INPUT');
  const [isTDSAccount, setIsTDSAccount] = useState(false);
  const [tdsSection, setTdsSection] = useState('');
  const [isBankAccount, setIsBankAccount] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  const resetForm = () => {
    setCode('');
    setName('');
    setDescription('');
    setAccountType('ASSET');
    setAccountCategory('CURRENT_ASSETS');
    setIsGroup(false);
    setOpeningBalance('0');
    setCurrency('INR');
    setIsGSTAccount(false);
    setGstType('CGST');
    setGstDirection('INPUT');
    setIsTDSAccount(false);
    setTdsSection('');
    setIsBankAccount(false);
    setBankName('');
    setAccountNumber('');
    setIfscCode('');
    setError('');
  };

  const validate = (): boolean => {
    if (!code.trim()) {
      setError('Account code is required');
      return false;
    }

    if (!/^[0-9]{4}$/.test(code)) {
      setError('Account code must be a 4-digit number (e.g., 1101)');
      return false;
    }

    if (accounts.some((acc) => acc.code === code)) {
      setError('An account with this code already exists');
      return false;
    }

    if (!name.trim()) {
      setError('Account name is required');
      return false;
    }

    if (isNaN(Number(openingBalance))) {
      setError('Opening balance must be a valid number');
      return false;
    }

    if (isTDSAccount && !tdsSection.trim()) {
      setError('TDS section is required for TDS accounts');
      return false;
    }

    if (isBankAccount && !bankName.trim()) {
      setError('Bank name is required for bank accounts');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('You must be logged in to create accounts');
      return;
    }

    if (!validate()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
      const accountId = `acc-${code}`;

      await setDoc(doc(accountsRef, accountId), {
        code,
        name: name.trim(),
        description: description.trim() || null,
        accountType,
        accountCategory,
        accountGroup: null,
        parentAccountId: null,
        level: 4, // Default to leaf level
        isGroup,
        isActive: true,
        isSystemAccount: false,
        openingBalance: Number(openingBalance),
        currentBalance: Number(openingBalance),
        currency,
        isGSTAccount,
        gstType: isGSTAccount ? gstType : null,
        gstDirection: isGSTAccount ? gstDirection : null,
        isTDSAccount,
        tdsSection: isTDSAccount ? tdsSection.trim() : null,
        isBankAccount,
        bankName: isBankAccount ? bankName.trim() : null,
        accountNumber: isBankAccount && accountNumber.trim() ? accountNumber.trim() : null,
        ifscCode: isBankAccount && ifscCode.trim() ? ifscCode.trim() : null,
        branch: null,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      resetForm();
      onClose();
    } catch (err) {
      console.error('Error creating account:', err);
      setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Account</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            {/* Account Code */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Account Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="1101"
                fullWidth
                required
                helperText="4-digit code"
              />
            </Grid>

            {/* Account Name */}
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                label="Account Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Cash in Hand"
                fullWidth
                required
              />
            </Grid>

            {/* Description */}
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                fullWidth
                multiline
                rows={2}
              />
            </Grid>

            {/* Account Type */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Account Type</InputLabel>
                <Select
                  value={accountType}
                  label="Account Type"
                  onChange={(e) => {
                    const newType = e.target.value as AccountType;
                    setAccountType(newType);
                    setAccountCategory(ACCOUNT_CATEGORIES[newType][0]!);
                  }}
                >
                  <MenuItem value="ASSET">Asset</MenuItem>
                  <MenuItem value="LIABILITY">Liability</MenuItem>
                  <MenuItem value="EQUITY">Equity</MenuItem>
                  <MenuItem value="INCOME">Income</MenuItem>
                  <MenuItem value="EXPENSE">Expense</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Account Category */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Account Category</InputLabel>
                <Select
                  value={accountCategory}
                  label="Account Category"
                  onChange={(e) => setAccountCategory(e.target.value as AccountCategory)}
                >
                  {ACCOUNT_CATEGORIES[accountType].map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Opening Balance & Currency */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Opening Balance"
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                fullWidth
                disabled={isGroup}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select value={currency} label="Currency" onChange={(e) => setCurrency(e.target.value)}>
                  <MenuItem value="INR">INR - Indian Rupee</MenuItem>
                  <MenuItem value="USD">USD - US Dollar</MenuItem>
                  <MenuItem value="EUR">EUR - Euro</MenuItem>
                  <MenuItem value="AED">AED - Dirham</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Checkboxes */}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Checkbox checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)} />}
                label="Group Account (has sub-accounts)"
              />
            </Grid>

            {/* GST Account */}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Checkbox checked={isGSTAccount} onChange={(e) => setIsGSTAccount(e.target.checked)} />}
                label="GST Account"
              />
            </Grid>

            {isGSTAccount && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>GST Type</InputLabel>
                    <Select value={gstType} label="GST Type" onChange={(e) => setGstType(e.target.value as 'CGST' | 'SGST' | 'IGST' | 'CESS')}>
                      <MenuItem value="CGST">CGST</MenuItem>
                      <MenuItem value="SGST">SGST</MenuItem>
                      <MenuItem value="IGST">IGST</MenuItem>
                      <MenuItem value="CESS">CESS</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>GST Direction</InputLabel>
                    <Select
                      value={gstDirection}
                      label="GST Direction"
                      onChange={(e) => setGstDirection(e.target.value as 'INPUT' | 'OUTPUT')}
                    >
                      <MenuItem value="INPUT">Input (Paid)</MenuItem>
                      <MenuItem value="OUTPUT">Output (Collected)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}

            {/* TDS Account */}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Checkbox checked={isTDSAccount} onChange={(e) => setIsTDSAccount(e.target.checked)} />}
                label="TDS Account"
              />
            </Grid>

            {isTDSAccount && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="TDS Section"
                  value={tdsSection}
                  onChange={(e) => setTdsSection(e.target.value)}
                  placeholder="e.g., 194C, 194J"
                  fullWidth
                  required
                />
              </Grid>
            )}

            {/* Bank Account */}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Checkbox checked={isBankAccount} onChange={(e) => setIsBankAccount(e.target.checked)} />}
                label="Bank Account"
              />
            </Grid>

            {isBankAccount && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Bank Name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g., State Bank of India"
                    fullWidth
                    required
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Account Number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Optional"
                    fullWidth
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="IFSC Code"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    placeholder="e.g., SBIN0001234"
                    fullWidth
                  />
                </Grid>
              </>
            )}
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
