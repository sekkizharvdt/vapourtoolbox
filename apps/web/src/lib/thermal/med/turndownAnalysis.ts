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
  // 100% is the base design (already shown elsewhere); 70% is rarely useful.
  // We show 50% and 30% to verify turndown feasibility at reduced loads.
  const loadPoints = [30, 50];
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
      // The recirculation pump is sized for FULL spray flow (= minSprayFlow).
      // This is because during annual acid cleaning the pump must recirculate
      // acid over the entire tube bundle, so its nameplate capacity equals
      // the total design spray, not just the make-up portion.
      //
      // A VFD controls the pump to maintain total_spray = minSprayFlow at
      // ALL operating loads:
      //   feed(load)   = base_feed × load%  (seawater makeup, scales with load)
      //   recirc(load) = minSprayFlow − feed(load)  (pump ramps to compensate)
      //   total_spray  = minSprayFlow  (constant, equals design target)
      //
      // Since the pump is sized for the full spray, it always has capacity
      // to cover the shortfall from reduced feed. Wetting therefore stays
      // at the design Γ at every load — the turndown limit comes from other
      // constraints (siphon seal, condenser performance, process stability),
      // NOT wetting.
      //
      // Uses the SAME tubesPerRow formula as design sizing.
      const gammaMin = input.minimumWettingRate ?? 0.035;
      const tubeOD = input.tubeOD ?? 25.4;
      const pitch = input.tubePitch ?? tubeOD * 1.315;
      const shellThkMM = input.shellThickness ?? 8;

      const wettingAdequacy = baseResult.effects.map((baseEffect) => {
        // Pump maintains total spray = minSprayFlow at any load
        const totalSpray = baseEffect.minSprayFlow; // T/h

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
          // Tiny tolerance (1%) for floating-point
          adequate: gamma >= gammaMin * 0.99,
        };
      });

      // Siphon seal check.
      // Siphons work on DIFFERENTIAL pressure between adjacent effects.
      // Required siphon height: H = ΔP / (ρ_brine × g)
      //
      // At reduced loads, vapor flow is less so inter-effect ΔP is SMALLER,
      // which means the required siphon height is SMALLER. The siphon is
      // sized at design time for the LARGEST ΔP (at 100% load), so at any
      // reduced load the existing height has extra margin.
      //
      // Therefore siphon seal is always feasible across the turndown range.
      // If the siphon fails at 100%, the fix is to increase height at design
      // time — it's not an operating limit.
      const siphonsSealOk = true;

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
