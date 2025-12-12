/**
 * Pressure Unit Conversion Utilities
 */

import {
  mbarAbsToBar,
  barToMbarAbs,
  kgCm2GaugeToBar,
  barToKgCm2Gauge,
  waterHeadToBar,
  barToWaterHead,
} from '@vapour/constants';
import type { PressureUnit } from './types';

export function convertPressureToBar(value: number, unit: PressureUnit): number {
  switch (unit) {
    case 'bar':
      return value;
    case 'mbar':
      return mbarAbsToBar(value);
    case 'kgcm2g':
      return kgCm2GaugeToBar(value);
    case 'mH2O':
      return waterHeadToBar(value);
    default:
      return value;
  }
}

export function convertBarToPressureUnit(bar: number, unit: PressureUnit): number {
  switch (unit) {
    case 'bar':
      return bar;
    case 'mbar':
      return barToMbarAbs(bar);
    case 'kgcm2g':
      return barToKgCm2Gauge(bar);
    case 'mH2O':
      return barToWaterHead(bar);
    default:
      return bar;
  }
}

export function getPressureUnitLabel(unit: PressureUnit): string {
  switch (unit) {
    case 'bar':
      return 'bar abs';
    case 'mbar':
      return 'mbar abs';
    case 'kgcm2g':
      return 'kg/cm²(g)';
    case 'mH2O':
      return 'm H₂O';
    default:
      return unit;
  }
}
