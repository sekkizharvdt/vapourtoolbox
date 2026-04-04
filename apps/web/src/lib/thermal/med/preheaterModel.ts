/**
 * Preheater Integration Model for MED Plant
 *
 * Preheaters divert a portion of vapor from an evaporator effect to
 * heat incoming seawater before it enters the spray system. This
 * improves thermal efficiency by recovering low-grade heat.
 *
 * Reference: El-Dessouky & Ettouney (2002), Chapter 6
 */

import { getEnthalpyVapor, getEnthalpyLiquid, getSeawaterSpecificHeat } from '@vapour/constants';
import type { MEDPreheaterResult, PreheaterConfig } from '@vapour/types';

/**
 * Input for preheater calculation
 */
export interface PreheaterInput {
  /** Preheater config (effect number + vapor flow) */
  config: PreheaterConfig;
  /** Temperature of vapor from the associated effect in °C */
  vaporTemperature: number;
  /** Seawater flow through this preheater in kg/hr */
  seawaterFlow: number;
  /** Seawater inlet temperature to this preheater in °C */
  seawaterInletTemp: number;
  /** Seawater salinity in ppm */
  seawaterSalinity: number;
}

/**
 * Calculate the heat exchange in a single preheater.
 *
 * The preheater condenses vapor from an effect to heat seawater.
 * Energy balance: vapor_flow × latent_heat = seawater_flow × Cp × ΔT_seawater
 *
 * We solve for seawater outlet temperature given the vapor flow.
 */
export function calculatePreheater(input: PreheaterInput): MEDPreheaterResult {
  const { config, vaporTemperature, seawaterFlow, seawaterInletTemp, seawaterSalinity } = input;

  const vaporFlow = config.vaporFlow; // kg/hr

  // Latent heat released by condensing vapor
  const h_vapor = getEnthalpyVapor(vaporTemperature); // kJ/kg
  const h_condensate = getEnthalpyLiquid(vaporTemperature); // kJ/kg
  const Q_condensing = (vaporFlow * (h_vapor - h_condensate)) / 3600; // kW

  // Seawater specific heat at average temperature (estimate with inlet temp first)
  const cp_sw = getSeawaterSpecificHeat(seawaterSalinity, seawaterInletTemp); // kJ/(kg·K)

  // Seawater outlet temperature: Q = m × Cp × ΔT → ΔT = Q / (m × Cp)
  const deltaT_sw = seawaterFlow > 0 ? (Q_condensing * 3600) / (seawaterFlow * cp_sw) : 0;
  const seawaterOutletTemp = seawaterInletTemp + deltaT_sw;

  // Limit: seawater cannot be heated above the condensing vapor temperature
  // Minimum approach = 2°C (practical limit for shell & tube heat exchanger)
  const actualOutletTemp = Math.min(seawaterOutletTemp, vaporTemperature - 2.0);
  const actualQ = (seawaterFlow * cp_sw * (actualOutletTemp - seawaterInletTemp)) / 3600; // kW

  // LMTD for the preheater (counter-current assumption)
  const dt1 = vaporTemperature - actualOutletTemp; // hot end
  const dt2 = vaporTemperature - seawaterInletTemp; // cold end
  let lmtd: number;
  if (dt1 <= 0 || dt2 <= 0) {
    lmtd = 0;
  } else if (Math.abs(dt1 - dt2) < 0.01) {
    lmtd = dt1; // equal → LMTD = ΔT
  } else {
    lmtd = (dt1 - dt2) / Math.log(dt1 / dt2);
  }

  // Condensate flow = vapor flow (all vapor condenses)
  const condensateFlow = vaporFlow;
  const condensateTemperature = vaporTemperature;

  return {
    effectNumber: config.effectNumber,
    vaporFlow,
    vaporTemperature,
    seawaterFlow,
    seawaterInletTemp,
    seawaterOutletTemp: actualOutletTemp,
    heatExchanged: actualQ,
    lmtd,
    condensateFlow,
    condensateTemperature,
  };
}

/**
 * Calculate the seawater temperature progression through a chain of preheaters.
 *
 * Preheaters are arranged so that seawater flows from cold to hot:
 * seawater → PH_last_effect → ... → PH_2 → Effect spray
 *
 * The seawater temperature rises through each preheater it passes.
 *
 * @param preheaterConfigs - Sorted by effect number ascending (PH2, PH4, PH6...)
 * @param vaporTemperatures - Map of effectNumber → vapor temperature
 * @param totalSeawaterFlow - Total seawater flow in kg/hr
 * @param seawaterInletTemp - Initial seawater temperature in °C (after final condenser)
 * @param seawaterSalinity - Seawater salinity in ppm
 */
export function calculatePreheaterChain(
  preheaterConfigs: PreheaterConfig[],
  vaporTemperatures: Map<number, number>,
  totalSeawaterFlow: number,
  seawaterInletTemp: number,
  seawaterSalinity: number
): MEDPreheaterResult[] {
  if (preheaterConfigs.length === 0) return [];

  // Sort preheaters: seawater flows from coldest PH (highest effect #) to hottest (lowest effect #)
  const sorted = [...preheaterConfigs].sort((a, b) => b.effectNumber - a.effectNumber);

  const results: MEDPreheaterResult[] = [];
  let currentTemp = seawaterInletTemp;

  for (const config of sorted) {
    const vaporTemp = vaporTemperatures.get(config.effectNumber);
    if (!vaporTemp) continue;

    const result = calculatePreheater({
      config,
      vaporTemperature: vaporTemp,
      seawaterFlow: totalSeawaterFlow,
      seawaterInletTemp: currentTemp,
      seawaterSalinity,
    });

    results.push(result);
    currentTemp = result.seawaterOutletTemp;
  }

  return results;
}
