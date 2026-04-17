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
import { getMaxTubesPerRow } from './shellGeometry';

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

      // Wetting adequacy check per effect.
      //
      // The design uses minSprayFlow = Γ_min × 2 × tubesPerRow × L (in T/h)
      // and sizes the recirculation pump so actual spray ≥ minSprayFlow.
      // At 100% load, actual spray = minSprayFlow (exactly) when recirc > 0.
      //
      // At reduced load, the seawater feed scales with load (less distillate
      // means less feed), but the recirculation pump runs at constant flow:
      //   spray(load%) = feed_100 × load% + recirc_base
      //   where feed_100 = minSprayFlow - recirc_base
      //
      // Uses the SAME tubesPerRow formula as design sizing (getMaxTubesPerRow)
      // to ensure consistency with resultAdapter.ts.
      const gammaMin = input.minimumWettingRate ?? 0.035;
      const tubeOD = input.tubeOD ?? 25.4;
      const pitch = input.tubePitch ?? tubeOD * 1.315;
      const shellThkMM = input.shellThickness ?? 8;
      const loadFraction = loadPct / 100;

      const wettingAdequacy = baseResult.effects.map((baseEffect) => {
        // Total spray at 100% (from design): feed + recirc = minSprayFlow
        const sprayAt100 = baseEffect.minSprayFlow;
        const recirc = baseEffect.brineRecirculation;
        const feedAt100 = Math.max(0, sprayAt100 - recirc);
        // Feed scales with load, recirc stays constant
        const totalSpray = feedAt100 * loadFraction + recirc; // T/h

        // Use the SAME tubesPerRow formula as design sizing
        const effShellID = baseEffect.shellODmm - 2 * shellThkMM;
        const tubesPerRow = getMaxTubesPerRow(effShellID, pitch);

        // Γ (kg/m·s) = spray (T/h) × 1000/3600 / (2 × tubesPerRow × L)
        const denom = 2 * tubesPerRow * baseEffect.tubeLength;
        const gamma = denom > 0 ? (totalSpray * 1000) / 3600 / denom : 0;

        return {
          effect: baseEffect.effect,
          gamma: Math.round(gamma * 10000) / 10000,
          gammaMin,
          // Tiny tolerance (1%) to avoid floating-point false negatives at 100% load
          adequate: gamma >= gammaMin * 0.99,
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
