'use client';

/**
 * Log Vendor Quote — Procurement
 *
 * Records a vendor quote obtained outside the in-app RFQ flow (phone, email,
 * WhatsApp, trade show, etc.). Optionally ties it back to an RFQ that was
 * sent offline.
 *
 * Creates a VendorQuote with:
 * - sourceType = 'OFFLINE_RFQ' for any reply to a phone/email/WhatsApp
 *   conversation (whether or not an in-app RFQ exists). Default for
 *   anything not explicitly marked unsolicited.
 * - sourceType = 'UNSOLICITED' only when the user opts in via the
 *   "Unsolicited" toggle (rare cold-quote case).
 * - rfqMode = 'OFFLINE' when rfqId is set
 *
 * Line items get added on the detail page after the quote is created.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  LinearProgress,
  Alert,
  Autocomplete,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader } from '@vapour/ui';
import {
  Home as HomeIcon,
  Save as SaveIcon,
  CloudUpload as UploadIcon,
  AutoAwesome as AutoAwesomeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type {
  BoughtOutItem,
  CurrencyCode,
  Material,
  MaterialVariant,
  RFQ,
  Service,
} from '@vapour/types';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { createVendorQuote, computeQuoteLineAmounts } from '@/lib/vendorQuotes';
import type { CreateVendorQuoteItemInput } from '@/lib/vendorQuotes';
import { QUOTE_LINE_LABELS } from '@vapour/constants';
import { listRFQs } from '@/lib/procurement/rfq';
import MaterialPickerDialog from '@/components/materials/MaterialPickerDialog';
import ServicePickerDialog from '@/components/services/ServicePickerDialog';
import BoughtOutPickerDialog from '@/components/boughtOut/BoughtOutPickerDialog';

interface RFQOption {
  id: string;
  number: string;
  title?: string;
  /** Carried through onto the quote so project-scoped views can filter without joining. */
  projectIds?: string[];
  projectNames?: string[];
}

/** Serializable shape of the autosaved quote draft (localStorage). */
interface QuoteDraftSnapshot {
  useEntitySelector?: boolean;
  vendorId?: string | null;
  vendorName?: string;
  selectedRfq?: RFQOption | null;
  vendorOfferNumber?: string;
  offerDate?: string;
  validityDate?: string;
  currency?: CurrencyCode;
  remarks?: string;
  isUnsolicited?: boolean;
  /** Cast back to LineItemRow on restore (LineItemRow is component-local). */
  lineItems?: unknown[];
  stagedFile?: {
    storagePath: string;
    downloadUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null;
  additionalDocs?: { downloadUrl: string; fileName: string }[];
  savedAt?: number;
}

/**
 * localStorage key for the in-progress quote. Autosaved on every edit and
 * cleared on successful create — protects against refresh / tab-close / a
 * failed AI parse forcing a reload (the data-loss complaint in the feedback).
 */
const QUOTE_DRAFT_KEY = 'vapour:new-quote-draft:v1';

/**
 * Convert Claude's "DD/MM/YYYY" output into a YYYY-MM-DD string suitable for
 * a `<input type="date">`. Returns empty string if the input doesn't match.
 */
function toDateInputValue(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
}

export default function NewProcurementQuotePage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db, storage } = getFirebase();

  // Vendor
  const [vendorName, setVendorName] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [useEntitySelector, setUseEntitySelector] = useState(true);

  // RFQ linkage (optional)
  const [selectedRfq, setSelectedRfq] = useState<RFQOption | null>(null);
  const [rfqOptions, setRfqOptions] = useState<RFQOption[]>([]);
  const [rfqOptionsLoading, setRfqOptionsLoading] = useState(true);

  // Quote metadata
  const [vendorOfferNumber, setVendorOfferNumber] = useState('');
  const [offerDate, setOfferDate] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [remarks, setRemarks] = useState('');

  // Most logged quotes are replies to an offline conversation (email, phone,
  // WhatsApp) — solicited, just no in-app RFQ doc. Truly unsolicited cold
  // quotes are rare. Default to offline; let the user opt in for unsolicited.
  const [isUnsolicited, setIsUnsolicited] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [parseHint, setParseHint] = useState('');

  // File upload state — file is uploaded to Storage as soon as the user picks
  // it, so the parse-with-AI cloud function can read it without re-upload.
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [stagedFile, setStagedFile] = useState<{
    storagePath: string;
    downloadUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  // Supporting documents — separate from the parse-source file above. These
  // are stored as URLs in the quote's `additionalDocuments` field and are not
  // sent to the AI parser. The user can attach several (datasheets, T&Cs, etc.).
  const [additionalDocs, setAdditionalDocs] = useState<{ downloadUrl: string; fileName: string }[]>(
    []
  );
  const [attachingDocs, setAttachingDocs] = useState(false);

  // AI parser state
  const [parsing, setParsing] = useState(false);

  // Line items — populated by AI parser, editable, eventually persisted
  // alongside the quote header. NOTE-type rows are free-text (no master link).
  type LineItemRow = CreateVendorQuoteItemInput & {
    tempKey: string;
    /** Set by the AI parser for equipment lines so the UI can badge the row
     *  (Linked / Auto-created / Manual). User-added rows stay undefined. */
    linkStatus?: 'linked' | 'auto-created' | 'manual-needed';
    /** Why the parser couldn't auto-resolve (when linkStatus = manual-needed). */
    linkReason?: string;
  };
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);

  // Picker state
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [boughtOutPickerOpen, setBoughtOutPickerOpen] = useState(false);
  const [pickerRowIndex, setPickerRowIndex] = useState<number>(-1);

  // --- Autosave / restore (data-loss protection) ---------------------------
  // Form state is plain React state; a refresh, tab close, or a reload after a
  // failed AI parse used to wipe everything. We mirror it to localStorage and
  // restore on mount. `hydratedRef` gates the save effect so the initial
  // restore isn't immediately overwritten by an empty snapshot.
  const hydratedRef = useRef(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' && window.localStorage.getItem(QUOTE_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as QuoteDraftSnapshot;
        if (typeof d.useEntitySelector === 'boolean') setUseEntitySelector(d.useEntitySelector);
        if (d.vendorId !== undefined) setVendorId(d.vendorId);
        if (typeof d.vendorName === 'string') setVendorName(d.vendorName);
        if (d.selectedRfq !== undefined) setSelectedRfq(d.selectedRfq);
        if (typeof d.vendorOfferNumber === 'string') setVendorOfferNumber(d.vendorOfferNumber);
        if (typeof d.offerDate === 'string') setOfferDate(d.offerDate);
        if (typeof d.validityDate === 'string') setValidityDate(d.validityDate);
        if (typeof d.currency === 'string') setCurrency(d.currency);
        if (typeof d.remarks === 'string') setRemarks(d.remarks);
        if (typeof d.isUnsolicited === 'boolean') setIsUnsolicited(d.isUnsolicited);
        if (Array.isArray(d.lineItems)) setLineItems(d.lineItems as LineItemRow[]);
        if (d.stagedFile !== undefined) setStagedFile(d.stagedFile);
        if (Array.isArray(d.additionalDocs)) setAdditionalDocs(d.additionalDocs);
        setDraftRestored(true);
      }
    } catch (err) {
      console.warn('[NewQuotePage] failed to restore draft', err);
    } finally {
      hydratedRef.current = true;
    }
    // Mount-only — restore once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      const snapshot: QuoteDraftSnapshot = {
        useEntitySelector,
        vendorId,
        vendorName,
        selectedRfq,
        vendorOfferNumber,
        offerDate,
        validityDate,
        currency,
        remarks,
        isUnsolicited,
        lineItems,
        stagedFile,
        additionalDocs,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(snapshot));
    } catch (err) {
      // Quota / serialization failure — non-fatal; autosave just won't persist.
      console.warn('[NewQuotePage] failed to autosave draft', err);
    }
  }, [
    useEntitySelector,
    vendorId,
    vendorName,
    selectedRfq,
    vendorOfferNumber,
    offerDate,
    validityDate,
    currency,
    remarks,
    isUnsolicited,
    lineItems,
    stagedFile,
    additionalDocs,
  ]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(QUOTE_DRAFT_KEY);
    } catch {
      // Best-effort — ignore storage errors on cleanup.
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraftRestored(false);
    setUseEntitySelector(true);
    setVendorId(null);
    setVendorName('');
    setSelectedRfq(null);
    setVendorOfferNumber('');
    setOfferDate('');
    setValidityDate('');
    setCurrency('INR');
    setRemarks('');
    setIsUnsolicited(false);
    setLineItems([]);
    setStagedFile(null);
    setFile(null);
    setAdditionalDocs([]);
    setParseHint('');
    setError('');
  };

  // Load RFQ options for the optional picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listRFQs({ limit: 100 });
        if (cancelled) return;
        setRfqOptions(
          result.items.map((r: RFQ) => ({
            id: r.id,
            number: r.number,
            title: r.title,
            projectIds: r.projectIds,
            projectNames: r.projectNames,
          }))
        );
      } catch (err) {
        console.warn('[NewQuotePage] Failed to load RFQs for picker', err);
      } finally {
        if (!cancelled) setRfqOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10 MB');
      return;
    }
    setFile(selected);
    setError('');
    setStagedFile(null);
    setUploadProgress(0);
    if (storage) {
      uploadFileToStorage(selected);
    }
  };

  const uploadFileToStorage = async (target: File) => {
    if (!storage) return;
    setUploading(true);
    const storagePath = `vendor-quotes/staging/${Date.now()}_${target.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, target);

    return new Promise<void>((resolve) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        },
        (err) => {
          console.error('[NewQuotePage] Upload failed', err);
          setError(`Upload failed: ${err.message}`);
          setUploading(false);
          resolve();
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setStagedFile({
              storagePath,
              downloadUrl: url,
              fileName: target.name,
              mimeType: target.type || 'application/pdf',
              fileSize: target.size,
            });
          } catch (err) {
            console.error('[NewQuotePage] downloadURL failed', err);
            setError('Could not finalize the upload — please try a different file.');
          } finally {
            setUploading(false);
            resolve();
          }
        }
      );
    });
  };

  const handleAdditionalFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    // Allow re-picking the same file later.
    e.target.value = '';
    if (selected.length === 0 || !storage) return;

    const oversize = selected.find((f) => f.size > 10 * 1024 * 1024);
    if (oversize) {
      setError(`"${oversize.name}" exceeds the 10 MB limit`);
      return;
    }

    setAttachingDocs(true);
    setError('');
    try {
      for (const f of selected) {
        const storagePath = `vendor-quotes/staging/${Date.now()}_${f.name}`;
        const storageRef = ref(storage, storagePath);
        const task = uploadBytesResumable(storageRef, f);
        // eslint-disable-next-line no-await-in-loop
        await task;
        // eslint-disable-next-line no-await-in-loop
        const url = await getDownloadURL(task.snapshot.ref);
        setAdditionalDocs((prev) => [...prev, { downloadUrl: url, fileName: f.name }]);
      }
    } catch (err) {
      console.error('[NewQuotePage] additional document upload failed', err);
      setError('Could not upload one of the attachments — please try again.');
    } finally {
      setAttachingDocs(false);
    }
  };

  const handleRemoveAdditionalDoc = (url: string) =>
    setAdditionalDocs((prev) => prev.filter((d) => d.downloadUrl !== url));

  const newRow = (overrides: Partial<CreateVendorQuoteItemInput> = {}): LineItemRow => ({
    tempKey: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemType: 'MATERIAL',
    description: '',
    quantity: 1,
    unit: 'NOS',
    unitPrice: 0,
    ...overrides,
  });

  const handleParseWithAI = async () => {
    if (!stagedFile) {
      setError('Upload the quote document first.');
      return;
    }
    setParsing(true);
    setError('');
    setParseHint('');
    try {
      const fns = getFunctions(undefined, 'asia-south1');
      const callable = httpsCallable<
        {
          storagePath: string;
          fileName: string;
          mimeType: string;
          fileSize: number;
          tenantId?: string;
        },
        {
          success: boolean;
          header: {
            vendorOfferNumber?: string;
            vendorOfferDate?: string;
            validityDate?: string;
            currency?: string;
            paymentTerms?: string;
            deliveryTerms?: string;
            warrantyTerms?: string;
            remarks?: string;
          };
          items: Array<{
            description: string;
            specification?: string;
            itemType: 'MATERIAL' | 'SERVICE' | 'BOUGHT_OUT' | 'NOTE';
            quantity: number;
            unit: string;
            unitPrice: number;
            gstRate?: number;
            discountType?: 'PERCENT' | 'ABSOLUTE';
            discountValue?: number;
            deliveryPeriod?: string;
            makeModel?: string;
            vendorNotes?: string;
            // Bought-out auto-resolution metadata. Only present for valves /
            // pumps / instruments where Claude could extract a full spec —
            // the parser writes these to the bought_out_items collection.
            boughtOutCategory?: 'VALVE' | 'PUMP' | 'INSTRUMENT';
            linkStatus?: 'linked' | 'auto-created' | 'manual-needed';
            boughtOutItemId?: string;
            boughtOutCode?: string;
            linkReason?: string;
          }>;
          warnings: string[];
          error?: string;
        }
      >(fns, 'parseQuote');

      const tenantIdForParse = claims?.tenantId || 'default-entity';
      const res = await callable({
        storagePath: stagedFile.storagePath,
        fileName: stagedFile.fileName,
        mimeType: stagedFile.mimeType,
        fileSize: stagedFile.fileSize,
        tenantId: tenantIdForParse,
      });

      const data = res.data;
      if (!data.success) {
        setError(data.error || 'Parsing failed.');
        return;
      }

      // Header — only fill empty fields so the user's typed input is preserved.
      const h = data.header;
      if (h.vendorOfferNumber && !vendorOfferNumber) setVendorOfferNumber(h.vendorOfferNumber);
      if (h.vendorOfferDate && !offerDate) setOfferDate(toDateInputValue(h.vendorOfferDate));
      if (h.validityDate && !validityDate) setValidityDate(toDateInputValue(h.validityDate));
      if (h.currency && !currency) setCurrency(h.currency as CurrencyCode);
      const remarkBits = [
        remarks,
        h.paymentTerms ? `Payment: ${h.paymentTerms}` : '',
        h.deliveryTerms ? `Delivery: ${h.deliveryTerms}` : '',
        h.warrantyTerms ? `Warranty: ${h.warrantyTerms}` : '',
        h.remarks || '',
      ]
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set(remarkBits)).join('\n');
      if (merged) setRemarks(merged);

      // Items — replace any existing rows with the parsed set. NOTE rows
      // skip the master picker; everything else needs a manual link before save.
      // Bought-out lines (valves/pumps/instruments) may already carry a
      // boughtOutItemId from the server-side resolver — propagate it through.
      const parsedRows: LineItemRow[] = data.items.map((item) => {
        const row = newRow({
          itemType: item.itemType,
          description: item.description,
          ...(item.specification && { specification: item.specification }),
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          ...(item.gstRate != null && { gstRate: item.gstRate }),
          ...(item.discountValue != null &&
            item.discountValue > 0 && {
              discountType: item.discountType ?? 'PERCENT',
              discountValue: item.discountValue,
            }),
          ...(item.deliveryPeriod && { deliveryPeriod: item.deliveryPeriod }),
          ...(item.makeModel && { makeModel: item.makeModel }),
          ...(item.vendorNotes && { vendorNotes: item.vendorNotes }),
          // Auto-link bought-out lines the parser resolved. The picker is
          // bypassed for these — bought-out code chip shows on the row.
          ...(item.boughtOutItemId && {
            boughtOutItemId: item.boughtOutItemId,
            linkedItemCode: item.boughtOutCode,
            linkedItemName: item.description,
          }),
        });
        if (item.linkStatus) row.linkStatus = item.linkStatus;
        if (item.linkReason) row.linkReason = item.linkReason;
        return row;
      });
      setLineItems(parsedRows);

      // Build hint summarizing auto-resolution counts.
      const autoCreated = parsedRows.filter((r) => r.linkStatus === 'auto-created').length;
      const linked = parsedRows.filter((r) => r.linkStatus === 'linked').length;
      const manual = parsedRows.filter(
        (r) => r.itemType !== 'NOTE' && !r.materialId && !r.serviceId && !r.boughtOutItemId
      ).length;
      const parts = [`AI extracted ${parsedRows.length} item${parsedRows.length === 1 ? '' : 's'}`];
      if (linked > 0) parts.push(`${linked} linked to existing bought-out item`);
      if (autoCreated > 0) parts.push(`${autoCreated} auto-created (review in Bought-Out)`);
      if (manual > 0) parts.push(`${manual} need manual pick`);
      const warningText = data.warnings.length > 0 ? ` · ${data.warnings.join(' ')}` : '';
      setParseHint(parts.join(' · ') + warningText);
    } catch (err) {
      console.error('[NewQuotePage] parseQuote failed', err);
      setError(err instanceof Error ? err.message : 'AI parser unavailable. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleAddRow = () => setLineItems((prev) => [...prev, newRow()]);
  const handleRemoveRow = (index: number) =>
    setLineItems((prev) => prev.filter((_, i) => i !== index));

  const handleRowChange = <K extends keyof CreateVendorQuoteItemInput>(
    index: number,
    field: K,
    value: CreateVendorQuoteItemInput[K]
  ) => {
    setLineItems((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      const updated: LineItemRow = { ...row, [field]: value };
      // Switching a row TO note clears the master link; switching FROM note
      // to a real type leaves it unlinked so the user picks deliberately.
      if (field === 'itemType' && value === 'NOTE') {
        updated.materialId = undefined;
        updated.materialCode = undefined;
        updated.materialName = undefined;
        updated.serviceId = undefined;
        updated.serviceCode = undefined;
        updated.boughtOutItemId = undefined;
        updated.linkedItemName = undefined;
        updated.linkedItemCode = undefined;
        updated.gstRate = undefined;
        updated.discountType = undefined;
        updated.discountValue = undefined;
        updated.specification = undefined;
      }
      next[index] = updated;
      return next;
    });
  };

  const openPickerFor = (index: number) => {
    const row = lineItems[index];
    if (!row) return;
    setPickerRowIndex(index);
    if (row.itemType === 'SERVICE') setServicePickerOpen(true);
    else if (row.itemType === 'BOUGHT_OUT') setBoughtOutPickerOpen(true);
    else if (row.itemType === 'MATERIAL') setMaterialPickerOpen(true);
  };

  const handleMaterialPicked = (
    material: Material,
    _variant?: MaterialVariant,
    fullCode?: string
  ) => {
    if (pickerRowIndex < 0) return;
    setLineItems((prev) => {
      const next = [...prev];
      const row = next[pickerRowIndex];
      if (!row) return prev;
      next[pickerRowIndex] = {
        ...row,
        materialId: material.id,
        materialCode: fullCode || material.materialCode,
        materialName: material.name,
        // Keep the AI-extracted description (the vendor's wording) so the
        // user can still verify against the original document.
      };
      return next;
    });
    setMaterialPickerOpen(false);
  };

  const handleServicePicked = (service: Service) => {
    if (pickerRowIndex < 0) return;
    setLineItems((prev) => {
      const next = [...prev];
      const row = next[pickerRowIndex];
      if (!row) return prev;
      next[pickerRowIndex] = {
        ...row,
        serviceId: service.id,
        serviceCode: service.serviceCode,
      };
      return next;
    });
    setServicePickerOpen(false);
  };

  const handleBoughtOutPicked = (item: BoughtOutItem) => {
    if (pickerRowIndex < 0) return;
    setLineItems((prev) => {
      const next = [...prev];
      const row = next[pickerRowIndex];
      if (!row) return prev;
      next[pickerRowIndex] = {
        ...row,
        boughtOutItemId: item.id,
        linkedItemCode: item.specCode || item.itemCode,
        linkedItemName: item.name,
        // Clear AI-resolution flags; user has manually linked.
        linkStatus: 'linked',
        linkReason: undefined,
      };
      return next;
    });
    setBoughtOutPickerOpen(false);
  };

  const isRowLinked = (row: LineItemRow): boolean => {
    if (row.itemType === 'NOTE') return true;
    if (row.itemType === 'SERVICE') return !!row.serviceId;
    if (row.itemType === 'MATERIAL') return !!row.materialId;
    if (row.itemType === 'BOUGHT_OUT') return !!row.boughtOutItemId;
    return false;
  };

  const grandTotal = lineItems.reduce(
    (sum, r) =>
      sum +
      computeQuoteLineAmounts({
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        gstRate: r.gstRate,
        discountType: r.discountType,
        discountValue: r.discountValue,
      }).total,
    0
  );

  // `asDraft` saves partial work as DRAFT, skipping the master-link
  // requirement so the user never gets stuck mid-entry (the original
  // complaint). A normal save enforces full linking and promotes to UPLOADED.
  const handleSubmit = async (asDraft = false) => {
    const name = useEntitySelector ? vendorName : vendorName.trim();
    if (!useEntitySelector && !name) {
      setError('Vendor name is required');
      return;
    }
    if (useEntitySelector && !vendorId) {
      setError('Please select a vendor');
      return;
    }
    if (!user) {
      setError('Not authenticated');
      return;
    }

    // Validate line items. Empty items array is allowed (user may save the
    // header now and add lines later from the detail page) — but if there
    // ARE rows, every non-NOTE row must be linked to a master record. Draft
    // saves skip the link check so unfinished rows can be parked.
    for (let i = 0; i < lineItems.length; i++) {
      const r = lineItems[i]!;
      if (!(r.description ?? '').trim()) {
        setError(`Line ${i + 1}: description is required.`);
        return;
      }
      if (!asDraft && !isRowLinked(r)) {
        setError(`Line ${i + 1}: pick a ${r.itemType.toLowerCase()} from the master.`);
        return;
      }
    }

    try {
      setSaving(true);
      setError('');

      const quoteId = await createVendorQuote(
        db,
        {
          ...(asDraft && { status: 'DRAFT' as const }),
          // Classification: an RFQ link upgrades to OFFLINE_RFQ (linked).
          // Otherwise default to OFFLINE_RFQ (vendor replied to an offline
          // conversation we initiated) unless the user explicitly opts into
          // UNSOLICITED via the checkbox below.
          sourceType: isUnsolicited && !selectedRfq ? 'UNSOLICITED' : 'OFFLINE_RFQ',
          ...(selectedRfq && {
            rfqId: selectedRfq.id,
            rfqNumber: selectedRfq.number,
            rfqMode: 'OFFLINE',
            ...(selectedRfq.projectIds &&
              selectedRfq.projectIds.length > 0 && { projectIds: selectedRfq.projectIds }),
            ...(selectedRfq.projectNames &&
              selectedRfq.projectNames.length > 0 && { projectNames: selectedRfq.projectNames }),
          }),
          tenantId: claims?.tenantId || 'default-entity',
          vendorName: useEntitySelector ? vendorName || 'Unknown Vendor' : name,
          ...(vendorId ? { vendorId } : {}),
          ...(vendorOfferNumber ? { vendorOfferNumber } : {}),
          ...(offerDate ? { vendorOfferDate: new Date(offerDate) } : {}),
          ...(validityDate ? { validityDate: new Date(validityDate) } : {}),
          currency,
          ...(remarks ? { remarks } : {}),
          ...(stagedFile ? { fileUrl: stagedFile.downloadUrl, fileName: stagedFile.fileName } : {}),
          ...(additionalDocs.length > 0 && {
            additionalDocuments: additionalDocs.map((d) => d.downloadUrl),
          }),
        },
        // Strip the UI-only `tempKey` before persisting.
        lineItems.map(({ tempKey: _t, ...rest }) => rest),
        user.uid,
        user.displayName ?? user.email ?? 'Unknown',
        claims?.permissions ?? 0
      );

      clearDraft();
      router.push(`/procurement/quotes/${quoteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quote');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Quotes', href: '/procurement/quotes' },
            { label: 'New Quote' },
          ]}
        />

        <PageHeader
          title="Log Vendor Quote"
          subtitle="Record a quote received by phone, email, or WhatsApp — with or without a linked RFQ"
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {draftRestored && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={handleDiscardDraft}>
              Discard
            </Button>
          }
        >
          Restored your unsaved quote from this device. Continue editing, or discard to start fresh.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {/* Vendor selection */}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useEntitySelector}
                    onChange={(e) => {
                      setUseEntitySelector(e.target.checked);
                      if (e.target.checked) setVendorName('');
                      else setVendorId(null);
                    }}
                  />
                }
                label="Select from existing vendors"
              />
            </Grid>

            {useEntitySelector ? (
              <Grid size={{ xs: 12, md: 6 }}>
                <EntitySelector
                  value={vendorId}
                  onChange={(id) => setVendorId(id)}
                  onEntitySelect={(entity) => setVendorName(entity?.name ?? '')}
                  label="Vendor"
                  filterByRole="VENDOR"
                  required
                />
              </Grid>
            ) : (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Vendor Name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  required
                  size="small"
                  helperText="Use this when the vendor isn't in your entity list yet"
                />
              </Grid>
            )}

            {/* Optional RFQ link */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                value={selectedRfq}
                onChange={(_e, val) => setSelectedRfq(val)}
                options={rfqOptions}
                loading={rfqOptionsLoading}
                getOptionLabel={(o) => (o.title ? `${o.number} — ${o.title}` : o.number)}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Link to RFQ (optional)"
                    size="small"
                    helperText={
                      selectedRfq
                        ? 'Linked to this RFQ'
                        : 'Leave blank if there’s no in-app RFQ for this quote'
                    }
                  />
                )}
              />
            </Grid>

            {/* Unsolicited opt-in — only meaningful when there's no RFQ link.
                Default behaviour treats unlinked quotes as offline replies,
                which matches reality most of the time. */}
            {!selectedRfq && (
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={isUnsolicited}
                      onChange={(e) => setIsUnsolicited(e.target.checked)}
                    />
                  }
                  label="Unsolicited — vendor sent this without us asking"
                />
              </Grid>
            )}

            {/* Vendor's own ref */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Vendor's Quote No."
                value={vendorOfferNumber}
                onChange={(e) => setVendorOfferNumber(e.target.value)}
                size="small"
                helperText="Reference number from the vendor's quote"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="date"
                label="Quote Date"
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="date"
                label="Valid Until"
                value={validityDate}
                onChange={(e) => setValidityDate(e.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Currency</InputLabel>
                <Select
                  value={currency}
                  label="Currency"
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                >
                  <MenuItem value="INR">INR</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                  <MenuItem value="SGD">SGD</MenuItem>
                  <MenuItem value="AED">AED</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 9 }}>
              <TextField
                fullWidth
                label="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                size="small"
                multiline
                rows={2}
                helperText="Context: how you obtained this quote, scope covered, etc."
              />
            </Grid>

            {/* Optional file attachment + AI parser entry */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Quote Document (optional)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                  disabled={uploading || parsing}
                >
                  {file ? file.name : 'Choose File'}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                  />
                </Button>
                {file && (
                  <Typography variant="body2" color="text.secondary">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                    {stagedFile && ' · uploaded'}
                  </Typography>
                )}
                <Tooltip
                  title={
                    !stagedFile
                      ? 'Upload a quote document first'
                      : 'Extract header fields and line items using Claude AI'
                  }
                >
                  <span>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={parsing ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                      onClick={handleParseWithAI}
                      disabled={!stagedFile || parsing || uploading}
                    >
                      {parsing ? 'Parsing…' : 'Parse with AI'}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
              {uploading && (
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />
              )}
              {parseHint && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  {parseHint}
                </Alert>
              )}
            </Grid>

            {/* Supporting documents — extra attachments stored on the quote,
                independent of the parse-source file above. */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {QUOTE_LINE_LABELS.supportingDocuments} (optional)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={attachingDocs ? <CircularProgress size={16} /> : <UploadIcon />}
                  disabled={attachingDocs}
                >
                  {attachingDocs ? 'Uploading…' : QUOTE_LINE_LABELS.addAttachments}
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    onChange={handleAdditionalFilesSelect}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Datasheets, terms, drawings — not sent to the AI parser.
                </Typography>
              </Box>
              {additionalDocs.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  {additionalDocs.map((doc) => (
                    <Chip
                      key={doc.downloadUrl}
                      label={doc.fileName}
                      variant="outlined"
                      size="small"
                      onDelete={() => handleRemoveAdditionalDoc(doc.downloadUrl)}
                    />
                  ))}
                </Stack>
              )}
            </Grid>
          </Grid>

          {/* Line items section */}
          <Box sx={{ mt: 4 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
              <Typography variant="h6">Line Items</Typography>
              <Chip
                label={`${lineItems.length} row${lineItems.length === 1 ? '' : 's'}`}
                size="small"
                color={lineItems.length > 0 ? 'primary' : 'default'}
              />
              <Box sx={{ flex: 1 }} />
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddRow}>
                Add Row
              </Button>
            </Stack>

            {/* Auto-created summary — surfaces new master records the parser
                wrote, so users can spot-check before the data spreads. */}
            {(() => {
              const autoCreated = lineItems.filter((r) => r.linkStatus === 'auto-created');
              if (autoCreated.length === 0) return null;
              return (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <strong>
                    {autoCreated.length} new bought-out item
                    {autoCreated.length === 1 ? '' : 's'} auto-created from this quote.
                  </strong>{' '}
                  The AI parser couldn&apos;t find a matching record by spec, so it generated one
                  for each. Open Bought-Out Items and verify the spec — these are flagged for
                  review.
                </Alert>
              );
            })()}

            {lineItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Use <strong>Parse with AI</strong> to extract items from the uploaded document, or
                add rows manually. You can also save the header now and add lines later from the
                quote detail page.
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 540 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>#</TableCell>
                      <TableCell width={140}>Type</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell width={100}>Qty</TableCell>
                      <TableCell width={90}>Unit</TableCell>
                      <TableCell width={130} align="right">
                        Unit Price
                      </TableCell>
                      <TableCell width={150} align="right">
                        {QUOTE_LINE_LABELS.discount}
                      </TableCell>
                      <TableCell width={80} align="right">
                        GST %
                      </TableCell>
                      <TableCell width={140} align="right">
                        Line Total
                      </TableCell>
                      <TableCell width={56}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineItems.map((row, index) => {
                      const linked = isRowLinked(row);
                      const isNote = row.itemType === 'NOTE';
                      const math = computeQuoteLineAmounts({
                        quantity: row.quantity,
                        unitPrice: row.unitPrice,
                        gstRate: row.gstRate,
                        discountType: row.discountType,
                        discountValue: row.discountValue,
                      });
                      const lineWithGst = math.total;
                      return (
                        <TableRow key={row.tempKey} hover>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              fullWidth
                              value={row.itemType}
                              onChange={(e) =>
                                handleRowChange(
                                  index,
                                  'itemType',
                                  e.target.value as CreateVendorQuoteItemInput['itemType']
                                )
                              }
                            >
                              <MenuItem value="MATERIAL">Material</MenuItem>
                              <MenuItem value="BOUGHT_OUT">Bought Out</MenuItem>
                              <MenuItem value="SERVICE">Service</MenuItem>
                              <MenuItem value="NOTE">Note / Charge</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} alignItems="flex-start">
                              <Stack spacing={0.5} sx={{ flex: 1 }}>
                                <TextField
                                  value={row.description}
                                  onChange={(e) =>
                                    handleRowChange(index, 'description', e.target.value)
                                  }
                                  size="small"
                                  fullWidth
                                  multiline
                                  maxRows={3}
                                  placeholder="Item name"
                                />
                                {!isNote && (
                                  <TextField
                                    value={row.specification ?? ''}
                                    onChange={(e) =>
                                      handleRowChange(
                                        index,
                                        'specification',
                                        e.target.value || undefined
                                      )
                                    }
                                    size="small"
                                    fullWidth
                                    multiline
                                    maxRows={4}
                                    placeholder="Specification (size, rating, material, model…)"
                                  />
                                )}
                              </Stack>
                              {!isNote && (
                                <Tooltip
                                  title={
                                    row.itemType === 'SERVICE'
                                      ? 'Pick from Services Catalog'
                                      : 'Pick from Materials Database'
                                  }
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => openPickerFor(index)}
                                    sx={{ mt: 0.25 }}
                                  >
                                    <SearchIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                            {row.materialCode && (
                              <Chip
                                label={row.materialCode}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ mt: 0.5, mr: 0.5 }}
                              />
                            )}
                            {row.serviceCode && (
                              <Chip
                                label={row.serviceCode}
                                size="small"
                                color="secondary"
                                variant="outlined"
                                sx={{ mt: 0.5, mr: 0.5 }}
                              />
                            )}
                            {row.linkedItemCode && (
                              <Chip
                                label={row.linkedItemCode}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ mt: 0.5, mr: 0.5 }}
                              />
                            )}
                            {/* AI auto-resolution status — only on rows the
                                parser tried to resolve. User-added rows are
                                untouched. */}
                            {row.linkStatus === 'linked' && (
                              <Chip
                                label="Linked"
                                size="small"
                                color="success"
                                sx={{ mt: 0.5, mr: 0.5 }}
                              />
                            )}
                            {row.linkStatus === 'auto-created' && (
                              <Tooltip title="New material created. Open Materials → Review to verify the spec.">
                                <Chip
                                  label="Auto-created · review"
                                  size="small"
                                  color="info"
                                  sx={{ mt: 0.5, mr: 0.5 }}
                                />
                              </Tooltip>
                            )}
                            {row.linkStatus === 'manual-needed' && row.linkReason && (
                              <Tooltip title={row.linkReason}>
                                <Chip
                                  label="AI couldn't resolve"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ mt: 0.5, mr: 0.5 }}
                                />
                              </Tooltip>
                            )}
                            {!isNote && !linked && row.linkStatus !== 'manual-needed' && (
                              <Chip
                                label="Pick from master"
                                size="small"
                                color="warning"
                                variant="outlined"
                                sx={{ mt: 0.5, mr: 0.5 }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={row.quantity}
                              onChange={(e) =>
                                handleRowChange(index, 'quantity', parseFloat(e.target.value) || 0)
                              }
                              size="small"
                              fullWidth
                              inputProps={{ step: '0.01' }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              value={row.unit}
                              onChange={(e) =>
                                handleRowChange(index, 'unit', e.target.value.toUpperCase())
                              }
                              size="small"
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={row.unitPrice}
                              onChange={(e) =>
                                handleRowChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                              }
                              size="small"
                              fullWidth
                              inputProps={{ step: '0.01' }}
                              sx={{
                                '& input': {
                                  color: row.unitPrice < 0 ? 'error.main' : undefined,
                                  textAlign: 'right',
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {isNote ? (
                              <Typography variant="caption" color="text.disabled">
                                —
                              </Typography>
                            ) : (
                              <Stack direction="row" spacing={0.5}>
                                <TextField
                                  type="number"
                                  value={row.discountValue ?? ''}
                                  onChange={(e) =>
                                    handleRowChange(
                                      index,
                                      'discountValue',
                                      e.target.value === ''
                                        ? undefined
                                        : parseFloat(e.target.value) || 0
                                    )
                                  }
                                  size="small"
                                  placeholder="0"
                                  inputProps={{ step: '0.01', min: 0 }}
                                  sx={{ '& input': { textAlign: 'right' }, width: 80 }}
                                />
                                <Select
                                  size="small"
                                  value={row.discountType ?? 'PERCENT'}
                                  onChange={(e) =>
                                    handleRowChange(
                                      index,
                                      'discountType',
                                      e.target.value as 'PERCENT' | 'ABSOLUTE'
                                    )
                                  }
                                  sx={{ minWidth: 56 }}
                                >
                                  <MenuItem value="PERCENT">%</MenuItem>
                                  <MenuItem value="ABSOLUTE">{currency}</MenuItem>
                                </Select>
                              </Stack>
                            )}
                          </TableCell>
                          <TableCell>
                            {isNote ? (
                              <Typography variant="caption" color="text.disabled">
                                —
                              </Typography>
                            ) : (
                              <TextField
                                type="number"
                                value={row.gstRate ?? ''}
                                onChange={(e) =>
                                  handleRowChange(
                                    index,
                                    'gstRate',
                                    e.target.value === ''
                                      ? undefined
                                      : parseFloat(e.target.value) || 0
                                  )
                                }
                                size="small"
                                fullWidth
                                inputProps={{ step: '0.01' }}
                                sx={{ '& input': { textAlign: 'right' } }}
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              color={lineWithGst < 0 ? 'error.main' : 'text.primary'}
                            >
                              {currency}{' '}
                              {lineWithGst.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveRow(index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {lineItems.length > 0 && (
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Box sx={{ minWidth: 280, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="subtitle2" color="text.secondary">
                      Grand Total (incl. GST)
                    </Typography>
                    <Typography variant="h6">
                      {currency}{' '}
                      {grandTotal.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            )}
          </Box>

          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/procurement')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={() => handleSubmit(true)}
              disabled={saving || uploading || attachingDocs}
            >
              {QUOTE_LINE_LABELS.saveAsDraft}
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => handleSubmit(false)}
              disabled={saving || uploading || attachingDocs}
            >
              {saving ? 'Creating...' : 'Create Quote'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Master-record pickers — same components used by the PR creation flow */}
      <MaterialPickerDialog
        open={materialPickerOpen}
        onClose={() => setMaterialPickerOpen(false)}
        onSelect={handleMaterialPicked}
        title="Link line item to material"
        requireVariantSelection={false}
      />
      <ServicePickerDialog
        open={servicePickerOpen}
        onClose={() => setServicePickerOpen(false)}
        onSelect={handleServicePicked}
        createDefaults={(() => {
          const row = lineItems[pickerRowIndex];
          if (!row) return undefined;
          return {
            ...(row.description && { name: row.description }),
            ...(row.unit && { unit: row.unit }),
            ...(row.unitPrice && { defaultRateValue: row.unitPrice }),
          };
        })()}
      />
      <BoughtOutPickerDialog
        open={boughtOutPickerOpen}
        onClose={() => setBoughtOutPickerOpen(false)}
        onSelect={handleBoughtOutPicked}
        tenantId={claims?.tenantId || 'default-entity'}
        title="Link line item to bought-out master"
      />
    </>
  );
}
