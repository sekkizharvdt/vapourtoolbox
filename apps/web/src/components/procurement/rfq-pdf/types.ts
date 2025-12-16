/**
 * Types for RFQ PDF Generation Components
 */

import type { Timestamp } from 'firebase/firestore';
import type { RFQ } from '@vapour/types';
import type { RFQPDFGenerationResult, RFQPDFMode } from '@vapour/types';

export interface ExistingPDF {
  id: string;
  title: string;
  vendorId?: string;
  vendorName?: string;
  version: number;
  fileUrl: string;
  uploadedAt: Timestamp;
  uploadedByName: string;
  isLatest: boolean;
}

export interface ExistingPDFsTabProps {
  rfq: RFQ;
  existingPdfs: ExistingPDF[];
  loadingExisting: boolean;
  onRefresh: () => void;
  onSwitchToGenerate: () => void;
}

export interface GenerateNewTabProps {
  rfq: RFQ;
  mode: RFQPDFMode;
  setMode: (mode: RFQPDFMode) => void;
  selectedVendorIds: string[];
  onVendorToggle: (vendorId: string) => void;
  onSelectAllVendors: () => void;
  onDeselectAllVendors: () => void;
  // Company info
  companyName: string;
  setCompanyName: (value: string) => void;
  companyAddress: string;
  setCompanyAddress: (value: string) => void;
  companyPhone: string;
  setCompanyPhone: (value: string) => void;
  companyEmail: string;
  setCompanyEmail: (value: string) => void;
  companyGSTIN: string;
  setCompanyGSTIN: (value: string) => void;
  // Contact person
  contactPersonName: string;
  setContactPersonName: (value: string) => void;
  contactPersonEmail: string;
  setContactPersonEmail: (value: string) => void;
  contactPersonPhone: string;
  setContactPersonPhone: (value: string) => void;
  // Terms
  useDefaultTerms: boolean;
  setUseDefaultTerms: (value: boolean) => void;
  generalTerms: string[];
  setGeneralTerms: React.Dispatch<React.SetStateAction<string[]>>;
  paymentTerms: string[];
  setPaymentTerms: React.Dispatch<React.SetStateAction<string[]>>;
  deliveryTerms: string[];
  setDeliveryTerms: React.Dispatch<React.SetStateAction<string[]>>;
  warrantyTerms: string[];
  setWarrantyTerms: React.Dispatch<React.SetStateAction<string[]>>;
  // Display options
  showItemSpecifications: boolean;
  setShowItemSpecifications: (value: boolean) => void;
  showDeliveryDates: boolean;
  setShowDeliveryDates: (value: boolean) => void;
  showEquipmentCodes: boolean;
  setShowEquipmentCodes: (value: boolean) => void;
  watermark: string;
  setWatermark: (value: string) => void;
  customNotes: string;
  setCustomNotes: (value: string) => void;
}

export interface PDFGenerationResultProps {
  result: RFQPDFGenerationResult;
  onDownload: (url: string) => void;
}
