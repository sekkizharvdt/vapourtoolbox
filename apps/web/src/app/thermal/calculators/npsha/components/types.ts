export type {
  SuctionFluidType,
  ValveType,
  StrainerType,
  CalculationMode,
} from '@/lib/thermal/suctionSystemCalculator';

export const FLUID_TYPE_LABELS: Record<string, string> = {
  brine: 'Brine',
  distillate: 'Distillate',
};

export const VALVE_TYPE_LABELS: Record<string, string> = {
  gate: 'Gate Valve',
  ball: 'Ball Valve',
};

export const STRAINER_TYPE_LABELS: Record<string, string> = {
  y_type: 'Y-Type Strainer',
  bucket_type: 'Bucket Strainer',
};

export const MODE_LABELS: Record<string, string> = {
  find_elevation: 'Calculate Required Elevation',
  verify_elevation: 'Verify Provided Elevation',
};
