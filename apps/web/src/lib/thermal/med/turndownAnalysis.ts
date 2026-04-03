/**
 * Turndown Analysis for MED Plants
 *
 * Evaluates plant performance at reduced steam loads (30%, 50%, 70%, 100%)
 * to determine minimum feasible operating load, checking wetting adequacy,
 * siphon seal integrity, and condenser capacity margins.
 */

import type {
  MEDTurndownPoint,
  MEDTurndownAnalysis,
  MEDDesignerInput,
  MEDDesignerResult,
} from './designerTypes';

// Import designMED from the parent module to re-run the design at reduced loads.
// This creates a circular dependency (medDesigner → turndownAnalysis → medDesigner)
// but it is safe because the turndown call sets includeTurndown=false, preventing recursion.
import { designMED } from '../medDesigner';

export function computeTurndownAnalysis(
  input: MEDDesignerInput,
  baseResult: MEDDesignerResult
): MEDTurndownAnalysis {
  const loadPoints = [30, 50, 70, 100];
  const points: MEDTurndownPoint[] = [];
  const analysisWarnings: string[] = [];

  for (const loadPct of loadPoints) {
    const scaledSteamFlow = input.steamFlow * (loadPct / 100);

    try {
      // Re-run design at reduced load — prevent recursion
      const turndownInput: MEDDesignerInput = {
        ...input,
        steamFlow: scaledSteamFlow,
        includeTurndown: false, // CRITICAL: prevent infinite recursion
        numberOfEffects: baseResult.effects.length, // keep same number of effects
        // Use same tube lengths and counts as base design
        tubeLengthOverrides: baseResult.effects.map((e) => e.tubeLength),
        tubeCountOverrides: baseResult.effects.map((e) => e.tubes),
      };

      const result = designMED(turndownInput);

      // Wetting adequacy check per effect
      const wettingAdequacy = result.effects.map((e) => {
        // At reduced load, the recirculation pump still runs
        // but feed flow is reduced proportionally
        const feedPerEffect = result.makeUpFeed / result.effects.length;
        const totalSpray = feedPerEffect + e.brineRecirculation;
        // Wetting rate: spray flow / (2 × tubes_per_row × tube_length)
        // We need tubes per row — approximate from tube count and rows
        const approxRows = Math.max(1, Math.round(Math.sqrt(e.tubes / 2)));
        const approxTubesPerRow = Math.max(1, Math.round(e.tubes / approxRows));
        const gamma = (totalSpray * 1000) / 3600 / (2 * approxTubesPerRow * e.tubeLength);
        const gammaMin = input.minimumWettingRate ?? 0.035;

        return {
          effect: e.effect,
          gamma: Math.round(gamma * 10000) / 10000,
          gammaMin,
          adequate: gamma >= gammaMin,
        };
      });

      // Siphon seal check: at low loads, the pressure difference between
      // effects is smaller, which may cause siphons to lose seal
      const siphonsSealOk = result.effects.every((e) => e.pressure > 30); // > 30 mbar abs

      // Condenser capacity margin: at reduced load, condenser has excess capacity
      const baseCondenserDuty = baseResult.condenser.duty;
      const condenserMarginPct =
        baseCondenserDuty > 0
          ? ((baseCondenserDuty - result.condenser.duty) / baseCondenserDuty) * 100
          : 0;

      const pointWarnings: string[] = [];
      const allWet = wettingAdequacy.every((w) => w.adequate);
      if (!allWet) {
        const dryEffects = wettingAdequacy
          .filter((w) => !w.adequate)
          .map((w) => `E${w.effect}`)
          .join(', ');
        pointWarnings.push(`Wetting inadequate at ${loadPct}% load: ${dryEffects}`);
      }
      if (!siphonsSealOk) {
        pointWarnings.push(`Siphon seal risk at ${loadPct}% load`);
      }

      points.push({
        loadPercent: loadPct,
        steamFlow: scaledSteamFlow,
        distillateFlow: result.totalDistillate,
        distillateM3Day: result.totalDistillateM3Day,
        gor: result.achievedGOR,
        wettingAdequacy,
        siphonsSealOk,
        condenserMarginPct,
        feasible: allWet && siphonsSealOk,
        warnings: pointWarnings,
      });
    } catch (err) {
      analysisWarnings.push(
        `Turndown ${loadPct}%: ${err instanceof Error ? err.message : 'calculation failed'}`
      );
      points.push({
        loadPercent: loadPct,
        steamFlow: scaledSteamFlow,
        distillateFlow: 0,
        distillateM3Day: 0,
        gor: 0,
        wettingAdequacy: [],
        siphonsSealOk: false,
        condenserMarginPct: 0,
        feasible: false,
        warnings: [`Calculation failed at ${loadPct}% load`],
      });
    }
  }

  // Find minimum feasible load
  const feasiblePoints = points.filter((p) => p.feasible);
  const minimumLoadPercent =
    feasiblePoints.length > 0 ? Math.min(...feasiblePoints.map((p) => p.loadPercent)) : 100;

  return { points, minimumLoadPercent, warnings: analysisWarnings };
}
