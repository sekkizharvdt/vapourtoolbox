import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money, CurrencyCode } from './common';

/**
 * Bought-Out Item Categories
 */
export type BoughtOutCategory = 'PUMP' | 'VALVE' | 'INSTRUMENT' | 'ELECTRICAL' | 'OTHER';

/**
 * Category Labels for UI
 */
export const BOUGHT_OUT_CATEGORY_LABELS: Record<BoughtOutCategory, string> = {
  PUMP: 'Pumps',
  VALVE: 'Valves',
  INSTRUMENT: 'Instruments',
  ELECTRICAL: 'Electrical',
  OTHER: 'Others',
};

/**
 * Base Specifications shared by all categories
 */
export interface BaseSpecs {
  manufacturer?: string;
  model?: string;
  notes?: string;
}

/**
 * Pump Specifications
 */
export interface PumpSpecs extends BaseSpecs {
  type?: string; // Centrifugal, Reciprocating, etc.
  flowRate?: number; // m3/hr
  head?: number; // m
  npshr?: number; // m
  power?: number; // kW
  efficiency?: number; // %
  rpm?: number;
  casingMaterial?: string;
  impellerMaterial?: string;
  sealType?: string;
}

/**
 * Valve Specifications
 */
export interface ValveSpecs extends BaseSpecs {
  type?: string; // Gate, Globe, Ball, etc.
  size?: string; // DN or Inch
  pressureRating?: string; // Class or PN
  bodyMaterial?: string;
  trimMaterial?: string;
  endConnection?: string; // Flanged, BW, SW, etc.
  operation?: string; // Manual, Gear, Actuated
  designStandard?: string; // API 600, ASME B16.34
}

/**
 * Instrument Specifications
 */
export interface InstrumentSpecs extends BaseSpecs {
  type?: string; // Gauge, Transmitter, Switch
  variable?: string; // Pressure, Temperature, Flow, Level
  rangeMin?: number;
  rangeMax?: number;
  unit?: string;
  accuracy?: string;
  outputSignal?: string; // 4-20mA, HART, Fieldbus
  processConnection?: string;
  enclosureRating?: string; // IP65, NEMA 4X
}

/**
 * Electrical Specifications
 */
export interface ElectricalSpecs extends BaseSpecs {
  type?: string; // Motor, Switchgear, Cable
  voltage?: string;
  powerRating?: string; // kW or HP
  frequency?: string; // Hz
  phase?: string; // 1-phase, 3-phase
  ipRating?: string;
}

/**
 * Other/General Specifications
 */
export interface OtherSpecs extends BaseSpecs {
  specification?: string;
}

/**
 * Union of all specification types
 */
export type BoughtOutSpecifications =
  | PumpSpecs
  | ValveSpecs
  | InstrumentSpecs
  | ElectricalSpecs
  | OtherSpecs;

/**
 * Bought-Out Item Interface
 */
export interface BoughtOutItem extends TimestampFields {
  id: string;
  entityId: string;

  // Basic Info
  itemCode: string; // Auto-generated: BO-YYYY-NNNN
  name: string;
  description?: string;
  category: BoughtOutCategory;

  // Specifications - Dynamic based on category
  specifications: BoughtOutSpecifications;

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
  specifications: BoughtOutSpecifications;
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
  specifications?: Partial<BoughtOutSpecifications>;
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
