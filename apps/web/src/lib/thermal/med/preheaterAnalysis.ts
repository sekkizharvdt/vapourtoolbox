/**
 * Preheater Contribution Analysis for MED Plants
 *
 * Calculates the additional distillate contribution from each preheater
 * by estimating the extra evaporation enabled by feed preheating.
 */

import type {
  PreheaterContribution,
  MEDDesignerPreheater as MEDPreheaterResult,
  MEDDesignerEffect as MEDEffectResult,
} from './designerTypes';
import { getLatentHeat } from '@vapour/constants';

export function computePreheaterContributions(
  preheaters: MEDPreheaterResult[],
  effects: MEDEffectResult[],
  _steamFlow: number,
  _condenserSWOutlet: number
): PreheaterContribution[] {
  const totalDist = effects.reduce((s, e) => s + e.distillateFlow, 0);
  if (totalDist <= 0) return [];

  let cumPct = 0;

  return preheaters.map((ph) => {
    const tempRise = ph.swOutlet - ph.swInlet;
    // Extra distillate from preheating: duty recovered / hfg
    const hfg = getLatentHeat((ph.swInlet + ph.swOutlet) / 2);
    const extraDistKgH = ((ph.duty * 3.6) / hfg) * 1000; // kW → kJ/h, ÷ hfg kJ/kg
    const extraPct = (extraDistKgH / (totalDist * 1000)) * 100;
    cumPct += extraPct;

    return {
      phId: ph.id,
      tempRise,
      extraDistillatePercent: Math.round(extraPct * 10) / 10,
      cumulativePercent: Math.round(cumPct * 10) / 10,
    };
  });
}
