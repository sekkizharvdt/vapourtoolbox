/**
 * Types for Edit Entity Form Components
 */

import type { EntityRole } from '@vapour/types';

export interface BasicInfoSectionProps {
  name: string;
  setName: (value: string) => void;
  legalName: string;
  setLegalName: (value: string) => void;
  roles: EntityRole[];
  onRolesChange: (roles: EntityRole[]) => void;
}

export interface AddressTaxSectionProps {
  addressLine1: string;
  setAddressLine1: (value: string) => void;
  addressLine2: string;
  setAddressLine2: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  state: string;
  setState: (value: string) => void;
  postalCode: string;
  setPostalCode: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  pan: string;
  setPan: (value: string) => void;
  gstin: string;
  setGstin: (value: string) => void;
  panValidation: { valid: boolean; error: string };
  gstinValidation: { valid: boolean; error: string };
  disabled: boolean;
}

export interface ShippingAddressSectionProps {
  sameAsBilling: boolean;
  setSameAsBilling: (value: boolean) => void;
  shippingLine1: string;
  setShippingLine1: (value: string) => void;
  shippingLine2: string;
  setShippingLine2: (value: string) => void;
  shippingCity: string;
  setShippingCity: (value: string) => void;
  shippingState: string;
  setShippingState: (value: string) => void;
  shippingPostalCode: string;
  setShippingPostalCode: (value: string) => void;
  shippingCountry: string;
  setShippingCountry: (value: string) => void;
  disabled: boolean;
}

export interface CreditTermsSectionProps {
  creditDays: string;
  setCreditDays: (value: string) => void;
  creditLimit: string;
  setCreditLimit: (value: string) => void;
  disabled: boolean;
}

export const ENTITY_ROLES: EntityRole[] = ['VENDOR', 'CUSTOMER', 'PARTNER'];
