/**
 * Purchase Order PDF Generation Service
 *
 * Fetches the supporting data (company profile, vendor entity, logo) and
 * hands it to the POPDFDocument component so the PDF renders with the correct
 * VDT legal name, logo, and full vendor / billing / delivery addresses
 * (procurement review items #32–#35).
 */

import { doc, getDoc } from 'firebase/firestore';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import {
  POPDFDocument,
  type POPDFCompanyProfile,
  type POPDFVendorProfile,
} from '@/components/pdf/POPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';
import { fetchLogoAsDataUri } from '@/lib/pdf/logoUtils';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

function formatAddress(addr?: {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string {
  if (!addr) return '';
  const lines: string[] = [];
  if (addr.street) lines.push(addr.street);
  const cityLine = [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  return lines.join('\n');
}

async function loadCompanyProfile(): Promise<POPDFCompanyProfile | undefined> {
  try {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'company', 'settings'));
    if (!snap.exists()) return undefined;
    const data = snap.data() as {
      companyName?: string;
      legalName?: string;
      address?: Parameters<typeof formatAddress>[0];
      taxIds?: { gstin?: string; pan?: string };
      email?: string;
      phone?: string;
      website?: string;
    };
    const address = formatAddress(data.address);
    return {
      name: data.companyName || 'Vapour Desal Technologies Private Limited',
      legalName: data.legalName,
      ...(address && { address }),
      gstin: data.taxIds?.gstin,
      pan: data.taxIds?.pan,
      email: data.email,
      phone: data.phone,
      website: data.website,
    };
  } catch (err) {
    console.warn('[poPDF] Failed to load company profile', err);
    return undefined;
  }
}

async function loadVendorProfile(
  vendorId: string,
  fallbackName: string
): Promise<POPDFVendorProfile> {
  try {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, COLLECTIONS.ENTITIES, vendorId));
    if (!snap.exists()) return { name: fallbackName };
    const data = snap.data() as {
      name?: string;
      billingAddress?: Parameters<typeof formatAddress>[0];
      contactPerson?: string;
      email?: string;
      phone?: string;
      mobile?: string;
      taxIds?: { gstin?: string };
    };
    const address = formatAddress(data.billingAddress);
    return {
      name: data.name || fallbackName,
      ...(address && { address }),
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone || data.mobile,
      gstin: data.taxIds?.gstin,
    };
  } catch (err) {
    console.warn('[poPDF] Failed to load vendor profile', err);
    return { name: fallbackName };
  }
}

export async function generatePOPDF(po: PurchaseOrder, items: PurchaseOrderItem[]): Promise<Blob> {
  const [company, vendor, logoDataUri] = await Promise.all([
    loadCompanyProfile(),
    loadVendorProfile(po.vendorId, po.vendorName),
    fetchLogoAsDataUri().catch(() => undefined),
  ]);

  return generatePDFBlob(
    POPDFDocument({
      po,
      items,
      company,
      vendor,
      logoDataUri,
    })
  );
}

export async function downloadPOPDF(po: PurchaseOrder, items: PurchaseOrderItem[]): Promise<void> {
  const blob = await generatePOPDF(po, items);
  downloadBlob(blob, `${po.number.replace(/\//g, '-')}.pdf`);
}
