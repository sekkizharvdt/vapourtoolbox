/**
 * Indian States and Union Territories
 * Used for GST calculations, address selection, and state-based operations
 */

// State name to code mapping (matches GST state codes)
export const INDIAN_STATES = {
  'Andaman and Nicobar Islands': 'AN',
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  Assam: 'AS',
  Bihar: 'BR',
  Chandigarh: 'CH',
  Chhattisgarh: 'CT',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  Delhi: 'DL',
  Goa: 'GA',
  Gujarat: 'GJ',
  Haryana: 'HR',
  'Himachal Pradesh': 'HP',
  'Jammu and Kashmir': 'JK',
  Jharkhand: 'JH',
  Karnataka: 'KA',
  Kerala: 'KL',
  Ladakh: 'LA',
  Lakshadweep: 'LD',
  'Madhya Pradesh': 'MP',
  Maharashtra: 'MH',
  Manipur: 'MN',
  Meghalaya: 'ML',
  Mizoram: 'MZ',
  Nagaland: 'NL',
  Odisha: 'OR',
  Puducherry: 'PY',
  Punjab: 'PB',
  Rajasthan: 'RJ',
  Sikkim: 'SK',
  'Tamil Nadu': 'TN',
  Telangana: 'TG',
  Tripura: 'TR',
  'Uttar Pradesh': 'UP',
  Uttarakhand: 'UT',
  'West Bengal': 'WB',
} as const;

export type IndianStateName = keyof typeof INDIAN_STATES;
export type IndianStateCode = (typeof INDIAN_STATES)[IndianStateName];

// Array format for dropdown/autocomplete components
export interface StateOption {
  name: string;
  code: string;
}

// Sorted alphabetically for display
export const INDIAN_STATES_LIST: StateOption[] = Object.entries(INDIAN_STATES)
  .map(([name, code]) => ({ name, code }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Special option for international entities (no GST)
export const INTERNATIONAL_STATE_OPTION: StateOption = {
  name: 'International',
  code: '',
};

// Combined list with International option at the end
export const STATE_OPTIONS: StateOption[] = [...INDIAN_STATES_LIST, INTERNATIONAL_STATE_OPTION];

// Helper to get state name from code
export function getStateName(code: string): string | undefined {
  if (!code) return 'International';
  const entry = Object.entries(INDIAN_STATES).find(([, c]) => c === code);
  return entry?.[0];
}

// Helper to get state code from name
export function getStateCode(name: string): string {
  if (name === 'International' || !name) return '';
  return INDIAN_STATES[name as IndianStateName] || '';
}
