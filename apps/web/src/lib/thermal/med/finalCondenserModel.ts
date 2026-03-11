/**
 * Final Condenser Model for MED Plant
 *
 * The final condenser condenses the last-effect vapor using incoming seawater.
 * It determines:
 * - Additional distillate produced
 * - Total seawater intake required
 * - Seawater temperature after the condenser (before preheaters/effects)
 *
 * Reference: El-Dessouky & Ettouney (2002), Chapter 6
 */

import {
  getEnthalpyVapor,
  getEnthalpyLiquid,
  getSeawaterSpecificHeat,
  getSeawaterEnthalpy,
} from '@vapour/constants';
import { VENT_FRACTION } from '@vapour/constants';
import type { MEDFinalCondenserResult } from '@vapour/types';
import { makeStream } from './effectModel';

export interface FinalCondenserInput {
  /** Vapor flow from the last effect in kg/hr */
  vaporInFlow: number;
  /** Vapor temperature from last effect in °C */
  vaporInTemp: number;

  /** Distillate cascade from effects in kg/hr */
  distillateInFlow: number;
  /** Distillate temperature in °C */
  distillateInTemp: number;

  /** Condensate flow from first effect (if extraction = FIRST_EFFECT) in kg/hr */
  condensateInFlow: number;
  /** Condensate temperature in °C */
  condensateInTemp: number;

  /** Seawater inlet temperature in °C (ambient) */
  seawaterInletTemp: number;
  /** Seawater outlet temperature in °C (after condenser, before distribution) */
  seawaterOutletTemp: number;
  /** Seawater salinity in ppm */
  seawaterSalinity: number;

  /** Distillate output temperature in °C */
  distillateOutTemp: number;
}

/**
 * Calculate the final condenser heat and mass balance.
 *
 * Energy balance:
 *   Vapor condensing heat + distillate cooling = seawater heating
 *
 * Seawater flow is determined from the energy balance:
 *   Q_total = m_sw × Cp × (T_sw_out - T_sw_in)
 *   m_sw = Q_total / (Cp × ΔT_sw)
 */
export function calculateFinalCondenser(
  input: FinalCondenserInput
): MEDFinalCondenserResult {
  const {
    vaporInFlow,
    vaporInTemp,
    distillateInFlow,
    distillateInTemp,
    condensateInFlow,
    condensateInTemp,
    seawaterInletTemp,
    seawaterOutletTemp,
    seawaterSalinity,
    distillateOutTemp,
  } = input;

  // Vent loss — a small fraction of vapor is NCG + water vapor that goes to vacuum
  const ventFlow = vaporInFlow * VENT_FRACTION;
  const condensingVaporFlow = vaporInFlow - ventFlow;

  // Heat released by condensing the last-effect vapor
  const h_vaporIn = getEnthalpyVapor(vaporInTemp);
  const h_condensateFromVapor = getEnthalpyLiquid(distillateOutTemp);
  const Q_condensing =
    (condensingVaporFlow * (h_vaporIn - h_condensateFromVapor)) / 3600; // kW

  // Heat released by cooling the distillate cascade to output temperature
  const h_distillateIn =
    distillateInFlow > 0 ? getEnthalpyLiquid(distillateInTemp) : 0;
  const h_distillateOut = getEnthalpyLiquid(distillateOutTemp);
  const Q_distillateCooling =
    distillateInFlow > 0
      ? (distillateInFlow * (h_distillateIn - h_distillateOut)) / 3600
      : 0;

  // Heat released by cooling condensate (if extracted from 1st effect)
  const h_condensateIn =
    condensateInFlow > 0 ? getEnthalpyLiquid(condensateInTemp) : 0;
  const h_condensateOut =
    condensateInFlow > 0 ? getEnthalpyLiquid(distillateOutTemp) : 0;
  const Q_condensateCooling =
    condensateInFlow > 0
      ? (condensateInFlow * (h_condensateIn - h_condensateOut)) / 3600
      : 0;

  // Total heat to be absorbed by seawater
  const Q_total = Q_condensing + Q_distillateCooling + Q_condensateCooling;

  // Seawater flow required
  const cp_sw = getSeawaterSpecificHeat(
    seawaterSalinity,
    (seawaterInletTemp + seawaterOutletTemp) / 2
  );
  const deltaT_sw = seawaterOutletTemp - seawaterInletTemp;
  const seawaterFlow =
    deltaT_sw > 0 ? (Q_total * 3600) / (cp_sw * deltaT_sw) : 0; // kg/hr

  // Total distillate out = distillate cascade + condensed vapor + condensate
  const totalDistillateOut = distillateInFlow + condensingVaporFlow + condensateInFlow;

  // Vent enthalpy — treat as saturated vapor at condenser conditions
  const h_vent = getEnthalpyVapor(distillateOutTemp);

  // Mass balance
  const totalIn = vaporInFlow + distillateInFlow + condensateInFlow + seawaterFlow;
  const totalOut = seawaterFlow + totalDistillateOut + ventFlow;
  const massBalance = totalIn - totalOut;

  return {
    seawaterIn: makeStream(
      'Sea Water In',
      'SEAWATER',
      seawaterFlow,
      seawaterInletTemp,
      getSeawaterEnthalpy(seawaterSalinity, seawaterInletTemp),
      seawaterSalinity
    ),
    vaporIn: makeStream(
      'Vapor to Final Condenser',
      'VAPOR',
      vaporInFlow,
      vaporInTemp,
      h_vaporIn,
      0
    ),
    distillateIn:
      distillateInFlow > 0
        ? makeStream(
            'Distillate In',
            'DISTILLATE',
            distillateInFlow,
            distillateInTemp,
            h_distillateIn,
            0
          )
        : null,
    condensateIn:
      condensateInFlow > 0
        ? makeStream(
            'Condensate In',
            'CONDENSATE',
            condensateInFlow,
            condensateInTemp,
            h_condensateIn,
            0
          )
        : null,
    seawaterOut: makeStream(
      'Sea Water Out',
      'SEAWATER',
      seawaterFlow,
      seawaterOutletTemp,
      getSeawaterEnthalpy(seawaterSalinity, seawaterOutletTemp),
      seawaterSalinity
    ),
    distillateOut: makeStream(
      'Distillate Out',
      'DISTILLATE',
      totalDistillateOut,
      distillateOutTemp,
      h_distillateOut,
      0
    ),
    condensateOut: null, // condensate merges into distillate
    ventOut: makeStream(
      'Vent to Vacuum',
      'VENT',
      ventFlow,
      distillateOutTemp,
      h_vent,
      0
    ),
    heatTransferred: Q_total,
    massBalance,
  };
}
