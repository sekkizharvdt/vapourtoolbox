import type { OutsourcingVendor } from '@vapour/types';

export interface VendorFormData {
  vendorEntityId: string;
  vendorName: string;
  scopeOfWork: string;
  contractValue: string;
  contractStartDate: string;
  contractEndDate: string;
  contractStatus: OutsourcingVendor['contractStatus'];
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  deliverables: string;
  performanceRating: number;
  notes: string;
}

export const EMPTY_FORM: VendorFormData = {
  vendorEntityId: '',
  vendorName: '',
  scopeOfWork: '',
  contractValue: '',
  contractStartDate: '',
  contractEndDate: '',
  contractStatus: 'DRAFT',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  deliverables: '',
  performanceRating: 0,
  notes: '',
};
