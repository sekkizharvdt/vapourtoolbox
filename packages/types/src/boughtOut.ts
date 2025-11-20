import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money, CurrencyCode } from './common';

/**
 * Bought-Out Item Categories
 */
export type BoughtOutCategory =
  | 'VALVE' // Gate, globe, ball, butterfly, check valves
  | 'PUMP' // Centrifugal, positive displacement
  | 'INSTRUMENT' // Pressure gauge, temperature sensor, flow meter
  | 'STRAINER' // Y-strainer, basket strainer
  | 'SEPARATOR' // Oil-water, gas-liquid separator
  | 'FITTING' // Flanges, elbows, tees
  | 'FASTENER' // Bolts, nuts, washers
  | 'GASKET' // Spiral wound, ring joint
  | 'INSULATION' // Thermal insulation materials
  | 'ELECTRICAL' // Motors, cables, switches
  | 'OTHER';

/**
 * Category Labels for UI
 */
export const BOUGHT_OUT_CATEGORY_LABELS: Record<BoughtOutCategory, string> = {
  VALVE: 'Valves',
  PUMP: 'Pumps',
  INSTRUMENT: 'Instruments',
  STRAINER: 'Strainers',
  SEPARATOR: 'Separators',
  FITTING: 'Fittings',
  FASTENER: 'Fasteners',
  GASKET: 'Gaskets',
  INSULATION: 'Insulation',
  ELECTRICAL: 'Electrical',
  OTHER: 'Other',
};

/**
 * Bought-Out Item Interface
 * Represents a procurement-ready component
 */
export interface BoughtOutItem extends TimestampFields {
  id: string;
  entityId: string;

  // Basic Info
  itemCode: string; // Auto-generated: BO-YYYY-NNNN
  name: string; // e.g., "Gate Valve 2\" Class 150"
  description?: string;
  category: BoughtOutCategory;

  // Specifications
  specifications: {
    manufacturer?: string;
    model?: string;
    size?: string; // e.g., "2 inch", "DN50"
    rating?: string; // e.g., "Class 150", "PN16"
    material?: string; // e.g., "CF8M (SS316)"
    standard?: string; // e.g., "ASME B16.34", "API 600"
    endConnection?: string; // e.g., "Flanged RF", "Butt Weld"
    customSpecs?: Record<string, string>; // Additional specs by category
  };

  // Pricing
  pricing: {
    listPrice: Money;
    currency: CurrencyCode;
    leadTime?: number; // Days
    moq?: number; // Minimum order quantity
    vendorId?: string; // Link to entity
    lastUpdated: Timestamp;
  };

  // Documentation
  attachments?: {
    datasheetUrl?: string;
    catalogUrl?: string;
    drawingUrl?: string;
    certificationUrl?: string;
  };

  // Metadata
  tags?: string[];
  isActive: boolean;

  // Audit
  createdBy: string;
  updatedBy: string;
}

/**
 * Input for creating a new Bought-Out Item
 */
export interface CreateBoughtOutItemInput {
  entityId: string;
  name: string;
  description?: string;
  category: BoughtOutCategory;
  specifications: BoughtOutItem['specifications'];
  pricing: Omit<BoughtOutItem['pricing'], 'lastUpdated'>;
  attachments?: BoughtOutItem['attachments'];
  tags?: string[];
}

/**
 * Input for updating a Bought-Out Item
 */
export interface UpdateBoughtOutItemInput {
  name?: string;
  description?: string;
  category?: BoughtOutCategory;
  specifications?: Partial<BoughtOutItem['specifications']>;
  pricing?: Partial<Omit<BoughtOutItem['pricing'], 'lastUpdated'>>;
  attachments?: Partial<BoughtOutItem['attachments']>;
  tags?: string[];
  isActive?: boolean;
}

/**
 * Options for listing Bought-Out Items
 */
export interface ListBoughtOutItemsOptions {
  entityId: string;
  category?: BoughtOutCategory;
  isActive?: boolean;
  limit?: number;
  startAfter?: string; // For pagination
}
