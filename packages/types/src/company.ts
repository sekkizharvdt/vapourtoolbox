// Company & Department Management Types

import { Department } from './core';
import { TimestampFields, Address, ContactInfo } from './common';

/**
 * Company information
 */
export interface Company extends TimestampFields {
  id: string;
  name: string;
  legalName: string;
  logo?: string;

  // Contact
  contactInfo: ContactInfo;
  website?: string;

  // Address
  registeredAddress: Address;
  operatingAddresses?: Address[];

  // Tax & Legal
  taxIdentifiers: {
    gstin?: string;
    pan?: string;
    cin?: string;
    [key: string]: string | undefined;
  };

  // Settings
  fiscalYearStart: string; // MM-DD format
  defaultCurrency: string;
  timezone: string;

  // Branding
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Department information
 */
export interface DepartmentInfo extends TimestampFields {
  id: string;
  name: Department;
  displayName: string;
  description?: string;
  headUserId?: string;
  headUserName?: string;
  memberCount: number;
  isActive: boolean;
}

/**
 * Company settings
 */
export interface CompanySettings {
  // General
  companyName: string;
  fiscalYearStart: string;
  defaultCurrency: string;
  timezone: string;

  // Features enabled
  features: {
    accounting: boolean;
    procurement: boolean;
    timeTracking: boolean;
    estimation: boolean;
  };

  // Modules configuration
  accounting?: {
    enableMultiCurrency: boolean;
    enableGST: boolean;
    enableTDS: boolean;
  };

  procurement?: {
    approvalLevels: number;
    autoGeneratePO: boolean;
  };

  timeTracking?: {
    dailyHours: number;
    weeklyHours: number;
    overtimeEnabled: boolean;
  };

  estimation?: {
    defaultMargin: number;
    enableRevisionControl: boolean;
  };
}
