'use client';

/**
 * Data Backup Page
 *
 * Admin page for exporting and backing up organization data.
 * Supports browser-based JSON download of selected collections.
 */

import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  LinearProgress,
  Alert,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Cloud as CloudIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { collection, getDocs } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { format } from 'date-fns';

interface CollectionGroup {
  label: string;
  collections: { key: string; name: string; firestoreName: string }[];
}

const EXPORTABLE_COLLECTIONS: CollectionGroup[] = [
  {
    label: 'Core Data',
    collections: [
      { key: 'users', name: 'Users', firestoreName: COLLECTIONS.USERS },
      { key: 'companies', name: 'Companies', firestoreName: COLLECTIONS.COMPANIES },
      { key: 'entities', name: 'Entities', firestoreName: COLLECTIONS.ENTITIES },
      {
        key: 'entityContacts',
        name: 'Entity Contacts',
        firestoreName: COLLECTIONS.ENTITY_CONTACTS,
      },
      { key: 'projects', name: 'Projects', firestoreName: COLLECTIONS.PROJECTS },
    ],
  },
  {
    label: 'Procurement',
    collections: [
      {
        key: 'purchaseRequests',
        name: 'Purchase Requests',
        firestoreName: COLLECTIONS.PURCHASE_REQUESTS,
      },
      {
        key: 'purchaseRequestItems',
        name: 'PR Items',
        firestoreName: COLLECTIONS.PURCHASE_REQUEST_ITEMS,
      },
      { key: 'rfqs', name: 'RFQs', firestoreName: COLLECTIONS.RFQS },
      { key: 'rfqItems', name: 'RFQ Items', firestoreName: COLLECTIONS.RFQ_ITEMS },
      { key: 'offers', name: 'Offers', firestoreName: COLLECTIONS.OFFERS },
      { key: 'offerItems', name: 'Offer Items', firestoreName: COLLECTIONS.OFFER_ITEMS },
      {
        key: 'purchaseOrders',
        name: 'Purchase Orders',
        firestoreName: COLLECTIONS.PURCHASE_ORDERS,
      },
      {
        key: 'purchaseOrderItems',
        name: 'PO Items',
        firestoreName: COLLECTIONS.PURCHASE_ORDER_ITEMS,
      },
      { key: 'goodsReceipts', name: 'Goods Receipts', firestoreName: COLLECTIONS.GOODS_RECEIPTS },
      { key: 'packingLists', name: 'Packing Lists', firestoreName: COLLECTIONS.PACKING_LISTS },
    ],
  },
  {
    label: 'Accounting',
    collections: [
      { key: 'accounts', name: 'Chart of Accounts', firestoreName: COLLECTIONS.ACCOUNTS },
      { key: 'transactions', name: 'Transactions', firestoreName: COLLECTIONS.TRANSACTIONS },
      {
        key: 'journalEntries',
        name: 'Journal Entries',
        firestoreName: COLLECTIONS.JOURNAL_ENTRIES,
      },
      { key: 'ledgerEntries', name: 'Ledger Entries', firestoreName: COLLECTIONS.LEDGER_ENTRIES },
      { key: 'costCentres', name: 'Cost Centres', firestoreName: COLLECTIONS.COST_CENTRES },
    ],
  },
  {
    label: 'HR & Leave',
    collections: [
      {
        key: 'hrLeaveRequests',
        name: 'Leave Requests',
        firestoreName: COLLECTIONS.HR_LEAVE_REQUESTS,
      },
      {
        key: 'hrLeaveBalances',
        name: 'Leave Balances',
        firestoreName: COLLECTIONS.HR_LEAVE_BALANCES,
      },
      { key: 'hrLeaveTypes', name: 'Leave Types', firestoreName: COLLECTIONS.HR_LEAVE_TYPES },
      { key: 'hrHolidays', name: 'Holidays', firestoreName: COLLECTIONS.HR_HOLIDAYS },
    ],
  },
  {
    label: 'Materials & Estimation',
    collections: [
      { key: 'materials', name: 'Materials', firestoreName: COLLECTIONS.MATERIALS },
      { key: 'proposals', name: 'Proposals', firestoreName: COLLECTIONS.PROPOSALS },
      { key: 'estimates', name: 'Estimates', firestoreName: COLLECTIONS.ESTIMATES },
    ],
  },
  {
    label: 'System',
    collections: [
      { key: 'auditLogs', name: 'Audit Logs', firestoreName: COLLECTIONS.AUDIT_LOGS },
      { key: 'feedback', name: 'Feedback', firestoreName: COLLECTIONS.FEEDBACK },
    ],
  },
];

export default function BackupPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [results, setResults] = useState<{ name: string; count: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const allCollectionKeys = EXPORTABLE_COLLECTIONS.flatMap((g) => g.collections.map((c) => c.key));

  const toggleCollection = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleGroup = (group: CollectionGroup) => {
    const groupKeys = group.collections.map((c) => c.key);
    const allSelected = groupKeys.every((k) => selected.has(k));

    setSelected((prev) => {
      const next = new Set(prev);
      groupKeys.forEach((k) => {
        if (allSelected) {
          next.delete(k);
        } else {
          next.add(k);
        }
      });
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === allCollectionKeys.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allCollectionKeys));
    }
  };

  const exportSelected = useCallback(async () => {
    if (selected.size === 0) return;

    setExporting(true);
    setError(null);
    setResults([]);

    const { db } = getFirebase();
    const exportData: Record<string, unknown[]> = {};
    const exportResults: { name: string; count: number }[] = [];

    const collectionsToExport = EXPORTABLE_COLLECTIONS.flatMap((g) =>
      g.collections.filter((c) => selected.has(c.key))
    );

    setProgress({ current: 0, total: collectionsToExport.length, currentName: '' });

    let i = 0;
    for (const col of collectionsToExport) {
      i++;
      setProgress({ current: i, total: collectionsToExport.length, currentName: col.name });

      try {
        const snapshot = await getDocs(collection(db, col.firestoreName));
        const docs = snapshot.docs.map((d) => ({
          _id: d.id,
          ...d.data(),
        }));
        exportData[col.key] = docs;
        exportResults.push({ name: col.name, count: docs.length });
      } catch (err) {
        console.error(`Error exporting ${col.name}:`, err);
        exportData[col.key] = [];
        exportResults.push({ name: col.name, count: -1 });
      }
    }

    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setResults(exportResults);
    setExporting(false);
  }, [selected]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Data Backup
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Export your organization data as JSON for backup and recovery
        </Typography>
      </Box>

      {/* Browser Download Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6">Export Collections</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={selectAll}>
                {selected.size === allCollectionKeys.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={exportSelected}
                disabled={selected.size === 0 || exporting}
              >
                Export Selected ({selected.size})
              </Button>
            </Stack>
          </Box>

          {exporting && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Exporting {progress.currentName}... ({progress.current}/{progress.total})
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(progress.current / progress.total) * 100}
              />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {results.length > 0 && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Export complete. Downloaded {results.length} collections:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {results.map((r) => (
                  <Chip
                    key={r.name}
                    label={`${r.name}: ${r.count === -1 ? 'error' : r.count}`}
                    size="small"
                    color={r.count === -1 ? 'error' : 'default'}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Alert>
          )}

          {EXPORTABLE_COLLECTIONS.map((group, idx) => (
            <Box key={group.label}>
              {idx > 0 && <Divider sx={{ my: 1.5 }} />}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={group.collections.every((c) => selected.has(c.key))}
                    indeterminate={
                      group.collections.some((c) => selected.has(c.key)) &&
                      !group.collections.every((c) => selected.has(c.key))
                    }
                    onChange={() => toggleGroup(group)}
                  />
                }
                label={
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {group.label}
                  </Typography>
                }
              />
              <FormGroup sx={{ pl: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                  {group.collections.map((col) => (
                    <FormControlLabel
                      key={col.key}
                      control={
                        <Checkbox
                          size="small"
                          checked={selected.has(col.key)}
                          onChange={() => toggleCollection(col.key)}
                        />
                      }
                      label={<Typography variant="body2">{col.name}</Typography>}
                      sx={{ width: { xs: '100%', sm: '50%', md: '33%' } }}
                    />
                  ))}
                </Box>
              </FormGroup>
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* Cloud Backup Section */}
      <Card variant="outlined" sx={{ opacity: 0.85 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <CloudIcon color="primary" />
            <Typography variant="h6">Cloud Backup</Typography>
            <Chip label="Requires Setup" size="small" color="warning" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Automated cloud backups to Google Cloud Storage with scheduled exports and retention
            policies.
          </Typography>
          <Alert severity="info" variant="outlined">
            <Typography variant="body2">To enable cloud backups, you need to:</Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
              <li>Create a Google Cloud Storage bucket for backups</li>
              <li>Deploy the backup Cloud Function with appropriate IAM permissions</li>
              <li>Configure a Cloud Scheduler job for automated backups</li>
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
}
