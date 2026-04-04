/**
 * GOR Configuration Analysis for MED Plants
 *
 * Explores the design space of effect count and preheater count combinations
 * to find configurations that achieve a target Gain Output Ratio (GOR).
 */

import type { GORConfigRow } from './designerTypes';
import { getLatentHeat, getSeawaterSpecificHeat } from '@vapour/constants';

export function computeGORConfigurations(
  steamFlow: number,
  steamTemp: number,
  lastVapT: number,
  maxBrineSalinity: number,
  swSalinity: number,
  condenserSWOutlet: number,
  targetGOR: number,
  avgLossPerEffect: number,
  _NEA: number,
  _demLoss: number,
  _pdLoss: number
): GORConfigRow[] {
  const configs: GORConfigRow[] = [];
  const ventLoss = 0.015;
  const avgTemp = (steamTemp + lastVapT) / 2;
  const Cp = getSeawaterSpecificHeat(swSalinity, avgTemp); // kJ/(kg·K)
  const totalRange = steamTemp - lastVapT;

  for (let nEff = 4; nEff <= 12; nEff++) {
    const workDT = totalRange / nEff - avgLossPerEffect;
    if (workDT <= 0) continue;

    for (let nPH = 0; nPH <= Math.min(nEff - 2, 6); nPH++) {
      // Preheater temperature rise
      const phRise = nPH > 0 ? Math.min((steamTemp - condenserSWOutlet) * 0.7, nPH * 4) : 0;
      const phDTpp = nPH > 0 ? phRise / nPH : 0;

      // Calculate spray temperature for each effect (same logic as detailed model)
      const effSprayTemps: number[] = [];
      for (let ei = 0; ei < nEff; ei++) {
        const effNum = ei + 1;
        if (effNum === nEff) {
          effSprayTemps.push(condenserSWOutlet); // last effect gets cold feed
        } else {
          const stepsFromLast = nEff - effNum;
          if (stepsFromLast <= nPH) {
            effSprayTemps.push(condenserSWOutlet + stepsFromLast * phDTpp);
          } else {
            effSprayTemps.push(condenserSWOutlet + phRise); // hottest PH outlet
          }
        }
      }
      const feedTemp = nPH > 0 ? condenserSWOutlet + phRise : condenserSWOutlet;

      // Estimate feed per effect for sensible heating calculation
      const estFeedPerEff =
        (((steamFlow * targetGOR) / nEff) * maxBrineSalinity) / (maxBrineSalinity - swSalinity);

      // Effect cascade with sensible heating subtracted
      let grossDist = 0;
      let Q = (steamFlow * 1000 * getLatentHeat(steamTemp)) / 3600; // kW

      let vapT = steamTemp;
      const effBrineTemps: number[] = [];
      for (let i = 0; i < nEff; i++) {
        const effVapOutT = vapT - totalRange / nEff;
        const brineT = vapT - workDT; // brine = incoming vapour - working ΔT
        effBrineTemps.push(brineT);
        const hfgEff = getLatentHeat(Math.max(effVapOutT, 30));
        // Subtract sensible heating of feed from available duty
        const sensHeat =
          (estFeedPerEff * 1000 * Cp * Math.max(0, brineT - effSprayTemps[i]!)) / 3600;
        const evapQ = Math.max(0, Q - sensHeat);
        const dist = ((evapQ * 3.6) / hfgEff) * (1 - ventLoss);
        grossDist += dist;
        Q = (dist * hfgEff) / 3.6;
        vapT = effVapOutT;
      }

      const e1Condensate = steamFlow * (1 - ventLoss);
      const netDistBase = grossDist - e1Condensate;

      // Preheater condensate: vapour condensed in PHs is additional product
      let phCondensate = 0;
      if (nPH > 0 && netDistBase > 0) {
        // Estimate total spray flow for PH duty calculation
        const totalSprayEst = estFeedPerEff * nEff * 1.3; // feed + ~30% recirc estimate
        const sprayPerEff = totalSprayEst / nEff;
        let phFlow = totalSprayEst - sprayPerEff; // after E_last peeled off
        for (let pi = 0; pi < nPH; pi++) {
          const phDuty = (phFlow * 1000 * Cp * phDTpp) / 3600; // kW
          const vapSourceIdx = 1 + pi;
          const vapSourceT =
            vapSourceIdx < effBrineTemps.length
              ? effBrineTemps[vapSourceIdx]! - 2 // approximate vapour temp (below brine by ~BPE)
              : lastVapT;
          const hfgPH = getLatentHeat(Math.max(vapSourceT, 30));
          phCondensate += (phDuty * 3.6) / hfgPH;
          phFlow -= sprayPerEff;
        }
      }

      const netDist = netDistBase + phCondensate;
      const gor = steamFlow > 0 ? netDist / steamFlow : 0;
      const deviation = Math.abs(gor - targetGOR);

      if (gor > 0 && workDT > 0.3) {
        configs.push({
          effects: nEff,
          preheaters: nPH,
          feedTemp,
          workDTPerEffect: workDT,
          gor,
          distillate: netDist,
          outputM3Day: netDist * 24,
          gorDeviation: deviation,
          feasible: workDT > 0.5,
          recommended: false,
        });
      }
    }
  }

  // Mark configurations within ±1.0 of target GOR as candidates
  // Find the best (closest to target, feasible, fewest effects for tie)
  const candidates = configs.filter((c) => c.gorDeviation <= 1.5 && c.feasible);
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.gorDeviation - b.gorDeviation || a.effects - b.effects);
    candidates[0]!.recommended = true;
  }

  // Return only configurations within ±2.0 of target GOR
  return configs
    .filter((c) => c.gorDeviation <= 2.0)
    .sort((a, b) => a.effects - b.effects || a.preheaters - b.preheaters);
}
