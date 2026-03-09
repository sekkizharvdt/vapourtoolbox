export type {
  SiphonFluidType,
  PressureUnit,
  ElbowConfig,
  PipeMaterial,
} from '@/lib/thermal/siphonSizingCalculator';

export const PRESSURE_UNIT_LABELS: Record<string, string> = {
  mbar_abs: 'mbar(a)',
  bar_abs: 'bar(a)',
  kpa_abs: 'kPa(a)',
};

export const FLUID_TYPE_LABELS: Record<string, string> = {
  seawater: 'Seawater',
  brine: 'Brine',
  distillate: 'Distillate',
};

export const ELBOW_CONFIG_LABELS: Record<string, string> = {
  '2_elbows': '2 Elbows (Same Plane)',
  '3_elbows': '3 Elbows (Different Plane)',
  '4_elbows': '4 Elbows (Routing Around)',
};

export const PIPE_MATERIAL_LABELS: Record<string, string> = {
  carbon_steel: 'Carbon Steel',
  ss_304l: 'SS 304L',
  ss_316l: 'SS 316L',
  duplex_2205: 'Duplex 2205',
  super_duplex_2507: 'Super Duplex 2507',
  titanium_gr2: 'Titanium Gr 2',
  cu_ni_90_10: 'Cu-Ni 90/10',
};

export const PIPE_SCHEDULE_OPTIONS = [
  { value: '10', label: 'Sch 10' },
  { value: '40', label: 'Sch 40 (Std)' },
  { value: '80', label: 'Sch 80 (XS)' },
];
