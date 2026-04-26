'use client';

/**
 * Parse Existing PDF
 *
 * Lets the user re-run the AI parser against a PDF that's already attached
 * to an enquiry. Useful when the enquiry was created before the parser
 * existed, or when conditions/fields were missed and need to be re-extracted.
 *
 * Conservative merge:
 *   - Scalar fields (title, description, location, …) only filled if blank
 *   - workComponents / requirements only filled if currently empty
 *   - conditions are always appended; duplicates by summary text are skipped
 */

import { useState } from 'react';
import { Alert, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { AutoAwesome as AiIcon, Description as PdfIcon } from '@mui/icons-material';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { ref as storageRef, getBlob } from 'firebase/storage';
import { useFirestore, useStorage } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { firebaseApp } from '@/lib/firebase/clientApp';
import { updateEnquiry } from '@/lib/enquiry/enquiryService';
import { Timestamp } from 'firebase/firestore';
import type { Enquiry, EnquiryCondition, WorkComponent } from '@vapour/types';
import { mergeParsedScopeIntoMatrix, type ParsedScopeCategory } from '@/lib/enquiry/parsedScope';

interface Props {
  enquiry: Enquiry;
  onUpdate: (updated: Enquiry) => void;
}

interface ParsedFields {
  title?: string;
  description?: string;
  clientContactPerson?: string;
  clientEmail?: string;
  clientPhone?: string;
  location?: string;
  industry?: string;
  workComponents?: WorkComponent[];
  requiredDeliveryDate?: string;
  requirements?: string[];
  urgency?: 'STANDARD' | 'URGENT';
}

interface ParsedCondition {
  category: EnquiryCondition['category'];
  summary: string;
  verbatim?: string;
}

interface ParseResponse {
  success: boolean;
  fields: ParsedFields;
  conditions: ParsedCondition[];
  scope: ParsedScopeCategory[];
  warnings?: string[];
}

const newId = (): string => Math.random().toString(36).slice(2, 11);

const isBlank = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0);

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function ParseExistingPdf({ enquiry, onUpdate }: Props) {
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useAuth();
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    severity: 'success' | 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);

  const pdfDocs = (enquiry.attachedDocuments ?? []).filter(
    (d) => d.fileType === 'application/pdf' || d.fileName.toLowerCase().endsWith('.pdf')
  );

  if (pdfDocs.length === 0) {
    return null;
  }

  const handleParse = async (docId: string, fileName: string, fileSize: number) => {
    if (!db || !storage || !user?.uid) {
      setStatus({ severity: 'error', message: 'Sign in first.' });
      return;
    }

    const target = enquiry.attachedDocuments?.find((d) => d.id === docId);
    if (!target) return;

    setParsingDocId(docId);
    setStatus({ severity: 'info', message: 'Reading the document — this takes ~30 seconds.' });

    try {
      // Pull the file from storage. fileUrl from Firebase Storage usually
      // looks like https://firebasestorage.googleapis.com/.../o/<encodedPath>?...
      // Use the path-based ref API by extracting from the URL.
      const path = extractStoragePath(target.fileUrl);
      if (!path) {
        throw new Error('Could not resolve storage path for this file.');
      }
      const ref = storageRef(storage, path);
      const blob = await getBlob(ref);
      const base64 = await blobToBase64(blob);

      const fn = getFunctions(firebaseApp, 'asia-south1');
      const callable = httpsCallable<
        { fileName: string; mimeType: string; fileBase64: string; fileSize: number },
        ParseResponse
      >(fn, 'parseEnquiryDocument');
      const res = await callable({
        fileName,
        mimeType: 'application/pdf',
        fileBase64: base64,
        fileSize,
      });

      const result = res.data;
      const merged = mergeParsedIntoEnquiry(enquiry, result);
      const fieldsTouched = countFieldsTouched(enquiry, merged);
      const conditionsAdded = (merged.conditions?.length ?? 0) - (enquiry.conditions?.length ?? 0);

      // Scope merge — preserves manual additions and any user-set exclusion reasons.
      const scopeMerge = mergeParsedScopeIntoMatrix(enquiry.requestedScope, result.scope ?? []);
      const scopeItemsAdded = scopeMerge.addedItems;
      const scopeChanged = scopeItemsAdded > 0 || scopeMerge.addedCategories > 0;

      if (fieldsTouched === 0 && conditionsAdded === 0 && !scopeChanged) {
        setStatus({
          severity: 'warning',
          message: 'Nothing new to add — the enquiry already covers everything the parser found.',
        });
        return;
      }

      // Persist — only send fields that actually changed.
      const updates: Parameters<typeof updateEnquiry>[2] = {};
      if (merged.title !== enquiry.title) updates.title = merged.title;
      if (merged.description !== enquiry.description) updates.description = merged.description;
      if (merged.clientContactPerson !== enquiry.clientContactPerson) {
        updates.clientContactPerson = merged.clientContactPerson;
      }
      if (merged.clientEmail !== enquiry.clientEmail) updates.clientEmail = merged.clientEmail;
      if (merged.clientPhone !== enquiry.clientPhone) updates.clientPhone = merged.clientPhone;
      if (merged.location !== enquiry.location) updates.location = merged.location;
      if (merged.industry !== enquiry.industry) updates.industry = merged.industry;
      if (merged.workComponents !== enquiry.workComponents) {
        updates.workComponents = merged.workComponents;
      }
      if (merged.urgency !== enquiry.urgency) updates.urgency = merged.urgency;
      if (merged.requiredDeliveryDate !== enquiry.requiredDeliveryDate) {
        updates.requiredDeliveryDate = merged.requiredDeliveryDate;
      }
      if (merged.conditions !== enquiry.conditions) updates.conditions = merged.conditions;
      if (scopeChanged) updates.requestedScope = scopeMerge.matrix;

      await updateEnquiry(db, enquiry.id, updates, user.uid);

      const finalEnquiry: Enquiry = scopeChanged
        ? { ...merged, requestedScope: scopeMerge.matrix }
        : merged;
      onUpdate(finalEnquiry);

      const warnings = result.warnings?.join(' ') ?? '';
      const parts: string[] = [];
      if (fieldsTouched > 0) parts.push(`${fieldsTouched} field${fieldsTouched === 1 ? '' : 's'}`);
      if (conditionsAdded > 0)
        parts.push(`${conditionsAdded} condition${conditionsAdded === 1 ? '' : 's'}`);
      if (scopeItemsAdded > 0)
        parts.push(`${scopeItemsAdded} scope item${scopeItemsAdded === 1 ? '' : 's'}`);
      setStatus({
        severity: 'success',
        message: `Added ${parts.join(', ')}.${warnings ? ' ' + warnings : ''}`,
      });
    } catch (err) {
      console.error('parseEnquiryDocument failed', err);
      setStatus({
        severity: 'error',
        message:
          err instanceof Error
            ? `Couldn't read the document: ${err.message}`
            : "Couldn't read the document.",
      });
    } finally {
      setParsingDocId(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'action.hover' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <AiIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2">Read an attached PDF</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Run the SOW reader against a file that&apos;s already attached. Existing values stay put;
        empty fields are filled and new conditions are appended.
      </Typography>
      <Stack spacing={1}>
        {pdfDocs.map((d) => (
          <Stack
            key={d.id}
            direction="row"
            spacing={1.5}
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 1, bgcolor: 'background.paper', borderRadius: 1 }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <PdfIcon color="action" fontSize="small" />
              <Typography variant="body2" noWrap>
                {d.fileName}
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                parsingDocId === d.id ? <CircularProgress size={14} /> : <AiIcon fontSize="small" />
              }
              onClick={() => handleParse(d.id, d.fileName, d.fileSize)}
              disabled={parsingDocId !== null}
            >
              {parsingDocId === d.id ? 'Reading…' : 'Read with AI'}
            </Button>
          </Stack>
        ))}
      </Stack>
      {status && (
        <Alert severity={status.severity} sx={{ mt: 1.5 }} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}
    </Paper>
  );
}

/* ─── Merge logic ──────────────────────────────────────────────────────── */

function mergeParsedIntoEnquiry(enquiry: Enquiry, parsed: ParseResponse): Enquiry {
  const f = parsed.fields;
  const merged: Enquiry = { ...enquiry };

  if (f.title && isBlank(merged.title)) merged.title = f.title;
  if (f.description && isBlank(merged.description)) merged.description = f.description;
  if (f.clientContactPerson && isBlank(merged.clientContactPerson))
    merged.clientContactPerson = f.clientContactPerson;
  if (f.clientEmail && isBlank(merged.clientEmail)) merged.clientEmail = f.clientEmail;
  if (f.clientPhone && isBlank(merged.clientPhone)) merged.clientPhone = f.clientPhone;
  if (f.location && isBlank(merged.location)) merged.location = f.location;
  if (f.industry && isBlank(merged.industry)) merged.industry = f.industry;

  if (f.workComponents && f.workComponents.length > 0 && isBlank(merged.workComponents)) {
    merged.workComponents = f.workComponents;
  }

  if (f.urgency && merged.urgency === 'STANDARD' && f.urgency === 'URGENT') {
    // Only upgrade STANDARD → URGENT, never downgrade.
    merged.urgency = 'URGENT';
  }

  if (f.requiredDeliveryDate && isBlank(merged.requiredDeliveryDate)) {
    const d = new Date(f.requiredDeliveryDate);
    if (!Number.isNaN(d.getTime())) {
      merged.requiredDeliveryDate = Timestamp.fromDate(d);
    }
  }

  if (f.requirements && f.requirements.length > 0 && isBlank(merged.requirements)) {
    merged.requirements = f.requirements;
  }

  // Conditions — append, dedupe by summary text (case-insensitive trim)
  const existing = enquiry.conditions ?? [];
  const seen = new Set(existing.map((c) => c.summary.trim().toLowerCase()));
  const toAdd: EnquiryCondition[] = [];
  for (const c of parsed.conditions) {
    const key = c.summary.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    toAdd.push({
      id: newId(),
      category: c.category,
      summary: c.summary,
      verbatim: c.verbatim,
      source: 'AI_PARSED',
    });
  }
  if (toAdd.length > 0) {
    merged.conditions = [...existing, ...toAdd];
  }

  return merged;
}

function countFieldsTouched(before: Enquiry, after: Enquiry): number {
  const keys: (keyof Enquiry)[] = [
    'title',
    'description',
    'clientContactPerson',
    'clientEmail',
    'clientPhone',
    'location',
    'industry',
    'workComponents',
    'urgency',
    'requiredDeliveryDate',
    'requirements',
  ];
  let n = 0;
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) n += 1;
  }
  return n;
}

function extractStoragePath(downloadUrl: string): string | null {
  // Firebase Storage download URLs look like:
  //   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<urlEncodedPath>?alt=media&token=...
  try {
    const url = new URL(downloadUrl);
    const match = url.pathname.match(/\/o\/(.+)$/);
    if (!match || !match[1]) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
