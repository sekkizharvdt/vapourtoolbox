/**
 * Result Adapter — MEDPlantResult + EquipmentSizingResult → Designer types
 *
 * Composes the core solver's H&M balance with equipment sizing and shell
 * geometry data to produce MEDDesignerEffect[] and other designer-specific
 * output structures.
 *
 * This is the bridge that lets the designer UI consume core solver results
 * without changing any of its rendering code.
 */

import { getLatentHeat, getDensityVapor, getSeawaterDensity } from '@vapour/constants';
import type { MEDPlantResult } from '@vapour/types';
import type { EquipmentSizingResult } from './equipmentSizing';
import type {
  MEDDesignerEffect,
  MEDDesignerCondenser,
  MEDDesignerPreheater,
  PassOption,
} from './designerTypes';
import type { ResolvedDesignerInputs } from './inputAdapter';
import { satPressureMbar, findMinShellID, getMaxTubesPerRow } from './shellGeometry';

// ============================================================================
// Compose Designer Effects
// ============================================================================

/**
 * Compose MEDDesignerEffect[] from core solver results + equipment sizing.
 *
 * Each MEDDesignerEffect combines:
 * - Thermodynamic data from MEDPlantResult.effects[i]
 * - Equipment sizing from EquipmentSizingResult.evaporators[i]
 * - Shell geometry computed from tube count and pitch
 */
export function composeDesignerEffects(
  hmResult: MEDPlantResult,
  sizing: EquipmentSizingResult,
  resolved: ResolvedDesignerInputs
): MEDDesignerEffect[] {
  const effects: MEDDesignerEffect[] = [];
  const {
    tubeOD,
    pitch,
    shellThkMM,
    tubeSheetThkMM,
    tubeSheetAccessMM,
    minGamma,
    includeRecirc,
    condenserSWOutlet,
  } = resolved;
  const nEff = hmResult.effects.length;

  // Preheater spray temperature logic (replicated from old designMED)
  const numPH = resolved.input.numberOfPreheaters ?? Math.max(0, Math.min(nEff - 2, 4));
  const TBT = hmResult.inputs.topBrineTemp;
  const phTempRise = numPH > 0 ? Math.min((TBT - condenserSWOutlet) * 0.7, numPH * 4) : 0;
  const phDTPerPH = numPH > 0 ? phTempRise / numPH : 0;

  let accumDistillate = 0;
  let accumBrine = 0;

  for (let i = 0; i < nEff; i++) {
    const eff = hmResult.effects[i]!;
    const evap = sizing.evaporators[i];

    // Temperatures from H&M balance
    const incomingVapourTemp = eff.vaporIn.temperature;
    const brineTemp = eff.temperature + eff.bpe; // brine boiling temp
    const vapourOutTemp = eff.totalVaporOut.temperature;
    const workingDeltaT = eff.effectiveDeltaT;
    const pressure = satPressureMbar(vapourOutTemp);

    // Duty and area from equipment sizing (or H&M if sizing unavailable)
    const duty = eff.heatTransferred;
    const tubeSideHTC = evap ? evap.tubeSideHTC : 0;
    const shellSideHTC = evap ? evap.shellSideHTC : 0;
    const overallU = evap ? evap.overallHTC : 2500;
    const requiredArea = evap
      ? evap.requiredArea
      : workingDeltaT > 0
        ? (duty * 1000) / (overallU * workingDeltaT)
        : 0;
    const designArea = evap ? evap.designArea : requiredArea * 1.15;
    const tubes = evap ? evap.tubeCount : 0;
    const tubeLength = evap ? evap.tubeLength : Math.max(...resolved.availableLengths);
    const installedArea = evap ? tubes * Math.PI * (tubeOD / 1000) * tubeLength : 0;
    const areaMargin = requiredArea > 0 ? (installedArea / requiredArea - 1) * 100 : 0;

    // Shell geometry
    const hasVapourLanes = true; // all effects need vapour escape lanes
    const effShellID =
      resolved.input.shellIDOverrides?.[i] ?? findMinShellID(tubes, tubeOD, pitch, hasVapourLanes);
    const effTubesPerRow = getMaxTubesPerRow(effShellID, pitch);

    // Distillate and brine flows from H&M
    const distillateFlow = eff.shellSprayZone.vaporProduced.flow / 1000; // kg/hr → T/h
    accumDistillate += distillateFlow;
    const brineOutFlow = eff.shellSprayZone.brineOut.flow / 1000; // T/h
    accumBrine += brineOutFlow;

    // Flash vapour
    const flashVapourFlow = eff.shellFlashZone.flashVapor
      ? eff.shellFlashZone.flashVapor.flow / 1000
      : 0;

    // Wetting rate / recirculation
    const minSpray = minGamma * 2 * effTubesPerRow * tubeLength * 3.6;
    const feedPerEffect = eff.shellSprayZone.seawaterIn.flow / 1000; // T/h
    const recirc = includeRecirc ? Math.max(0, minSpray - feedPerEffect) : 0;

    // Spray temperature
    const effectNum = i + 1;
    let sprayTemp: number;
    if (effectNum === nEff) {
      sprayTemp = condenserSWOutlet;
    } else {
      const stepsFromLast = nEff - effectNum;
      if (stepsFromLast <= numPH) {
        sprayTemp = condenserSWOutlet + stepsFromLast * phDTPerPH;
      } else {
        sprayTemp = condenserSWOutlet + phTempRise;
      }
    }

    // Vapour velocity check
    const shellR = effShellID / 2;
    const shellArea = (Math.PI * shellR * shellR) / 1e6;
    const bundleCrossSection = (tubes * pitch * pitch) / 1e6;
    const vapourFlowAreaM2 = Math.max(0.1, shellArea - bundleCrossSection * 0.5);
    const vapDensity = getDensityVapor(vapourOutTemp);
    const vapMassFlow = distillateFlow / 3.6; // T/h → kg/s
    const vapVolumetricFlow = vapDensity > 0 ? vapMassFlow / vapDensity : 0;
    const vapVel = vapourFlowAreaM2 > 0 ? vapVolumetricFlow / vapourFlowAreaM2 : 0;
    const velStatus: 'ok' | 'high' | 'low' = vapVel > 40 ? 'high' : vapVel < 5 ? 'low' : 'ok';

    effects.push({
      effect: effectNum,
      incomingVapourTemp,
      brineTemp,
      bpe: eff.bpe,
      nea: eff.nea,
      demisterLoss: eff.deltaTPressureDrop,
      pressureDropLoss: resolved.pdLoss,
      vapourOutTemp,
      workingDeltaT,
      pressure,
      tubeSideHTC,
      shellSideHTC,
      overallU,
      duty,
      requiredArea,
      designArea,
      tubes,
      tubeLength,
      installedArea,
      areaMargin,
      distillateFlow,
      accumDistillateFlow: accumDistillate,
      brineOutFlow,
      accumBrineFlow: accumBrine,
      flashVapourFlow,
      hfg: getLatentHeat(vapourOutTemp),
      hasVapourLanes,
      minSprayFlow: minSpray,
      brineRecirculation: recirc,
      shellLengthMM: Math.round(tubeLength * 1000 + 2 * tubeSheetThkMM + tubeSheetAccessMM),
      shellODmm: Math.round(effShellID + 2 * shellThkMM),
      tiTopRows: 3,
      tiTubeCount: Math.min(3 * effTubesPerRow, tubes),
      sprayNozzleSpaceMM: Math.round(Math.max(275, effShellID * 0.15)),
      drainageClearanceMM: Math.max(250, Math.round(effShellID * 0.12)),
      vapourFlowAreaM2,
      vapourVelocity: vapVel,
      vapourVelocityStatus: velStatus,
      sprayTemp,
    });
  }

  // ---- Multi-shell grouping (when effectsPerShell > 1) ----
  const effectsPerShell = resolved.input.effectsPerShell ?? 1;
  if (effectsPerShell > 1) {
    for (let i = 0; i < effects.length; i++) {
      const shellGroup = Math.floor(i / effectsPerShell) + 1;
      const groupStart = (shellGroup - 1) * effectsPerShell;
      const groupEnd = Math.min(groupStart + effectsPerShell, effects.length);
      const effectsInShell = groupEnd - groupStart;

      effects[i]!.shellGroup = shellGroup;
      effects[i]!.effectsInShell = effectsInShell;

      // Shell ID = MAX of all effects in this group
      let maxShellID = 0;
      let totalShellLength = 0;
      for (let j = groupStart; j < groupEnd; j++) {
        const eff = effects[j]!;
        const effID = eff.shellODmm - 2 * shellThkMM;
        if (effID > maxShellID) maxShellID = effID;
        totalShellLength += eff.tubeLength * 1000; // per-bundle tube length
      }
      // Shell length = sum of tube lengths + tubesheet + access per bundle
      const groupedShellLength = Math.round(
        totalShellLength + effectsInShell * (2 * tubeSheetThkMM + tubeSheetAccessMM)
      );
      const groupedShellOD = Math.round(maxShellID + 2 * shellThkMM);

      effects[i]!.shellODmm = groupedShellOD;
      effects[i]!.shellLengthMM = groupedShellLength;
    }
  }

  return effects;
}

// ============================================================================
// Compose Designer Condenser
// ============================================================================

/**
 * Compose MEDDesignerCondenser from core solver's final condenser result
 * and equipment sizing.
 */
export function composeDesignerCondenser(
  hmResult: MEDPlantResult,
  sizing: EquipmentSizingResult,
  resolved: ResolvedDesignerInputs
): MEDDesignerCondenser {
  const fc = hmResult.finalCondenser;
  const cs = sizing.condenser;

  const tubes = cs.tubeCount;
  const tiTubeOD = 17;
  const tiTubeLengthMM = (resolved.input.tiTubeLength ?? 2.1) * 1000;
  const tiPitch = 21.3;
  const tiTargetVel = resolved.input.tiTargetVelocity ?? 1.6;

  // Build pass options (even passes: 2, 4, 6, 8)
  const passOptions: PassOption[] = [];
  for (let p = 2; p <= 8; p += 2) {
    const tubesPerPass = Math.ceil(tubes / p);
    const totalTubes = tubesPerPass * p;
    const tiTubeID = 16.2;
    const flowArea = tubesPerPass * (Math.PI / 4) * (tiTubeID / 1000) ** 2;
    const swFlow = fc.seawaterIn.flow / 3600; // kg/s
    const swDensity = getSeawaterDensity(
      resolved.input.seawaterSalinity ?? 35000,
      resolved.input.seawaterTemperature
    );
    const vel = flowArea > 0 ? swFlow / (swDensity * flowArea) : 0;
    const area = totalTubes * Math.PI * (tiTubeOD / 1000) * (tiTubeLengthMM / 1000);
    const shellODmm = Math.round(
      findMinShellID(totalTubes, tiTubeOD, tiPitch, false) + 2 * resolved.shellThkMM
    );

    passOptions.push({
      passes: p,
      tubesPerPass,
      totalTubes,
      velocity: Math.round(vel * 100) / 100,
      inRange: vel >= 1.4 && vel <= 1.8,
      area: Math.round(area * 100) / 100,
      shellODmm,
    });
  }

  // Select best pass option (closest to target velocity)
  const bestPass = passOptions.reduce((a, b) =>
    Math.abs(a.velocity - tiTargetVel) < Math.abs(b.velocity - tiTargetVel) ? a : b
  );

  return {
    vapourFlow: fc.vaporIn.flow / 1000, // T/h
    vapourTemp: fc.vaporIn.temperature,
    duty: fc.heatTransferred,
    lmtd: cs.lmtd,
    overallU: cs.overallHTC,
    tubeSideHTC: cs.tubeSideHTC,
    shellSideHTC: cs.shellSideHTC,
    requiredArea: cs.requiredArea,
    designArea: cs.designArea,
    seawaterFlow: fc.seawaterIn.flow / 1000, // T/h
    seawaterFlowM3h:
      fc.seawaterIn.flow /
      getSeawaterDensity(
        resolved.input.seawaterSalinity ?? 35000,
        resolved.input.seawaterTemperature
      ),
    tubes: bestPass.totalTubes,
    passes: bestPass.passes,
    velocity: bestPass.velocity,
    shellODmm: bestPass.shellODmm,
    tubeOD: tiTubeOD,
    tubeLengthMM: tiTubeLengthMM,
    passOptions,
  };
}

// ============================================================================
// Compose Designer Preheaters
// ============================================================================

/**
 * Compose MEDDesignerPreheater[] from core solver's preheater results
 * and equipment sizing. Uses the same sizeCondensingHX() data as the condenser.
 */
export function composeDesignerPreheaters(
  hmResult: MEDPlantResult,
  sizing: EquipmentSizingResult,
  resolved: ResolvedDesignerInputs
): MEDDesignerPreheater[] {
  const tiTubeOD = 17;
  const tiTubeLengthMM = (resolved.input.tiTubeLength ?? 2.1) * 1000;
  const tiPitch = 21.3;
  const tiTargetVel = resolved.input.tiTargetVelocity ?? 1.6;
  const swSalinity = resolved.input.seawaterSalinity ?? 35000;

  return hmResult.preheaters.map((ph, idx) => {
    const ps = sizing.preheaters[idx];

    // If sizing data not available for this preheater, return H&M only
    if (!ps || ps.designArea <= 0) {
      return {
        id: idx + 1,
        vapourSource: `Effect ${ph.effectNumber}`,
        vapourTemp: ph.vaporTemperature,
        swInlet: ph.seawaterInletTemp,
        swOutlet: ph.seawaterOutletTemp,
        duty: ph.heatExchanged,
        lmtd: ph.lmtd,
        overallU: 0,
        tubeSideHTC: 0,
        shellSideHTC: 0,
        requiredArea: 0,
        designArea: 0,
        flowTh: ph.seawaterFlow / 1000,
        tubes: 0,
        passes: 4,
        velocity: 0,
        shellODmm: 0,
        tubeOD: tiTubeOD,
        tubeLengthMM: tiTubeLengthMM,
        passOptions: [],
      };
    }

    const tubes = ps.tubeCount;

    // Build pass options (same pattern as condenser)
    const passOptions: PassOption[] = [];
    for (let p = 2; p <= 8; p += 2) {
      const tubesPerPass = Math.ceil(tubes / p);
      const totalTubes = tubesPerPass * p;
      const tiTubeID = 16.2; // mm (17mm OD - 2×0.4mm wall for Ti)
      const flowArea = tubesPerPass * (Math.PI / 4) * (tiTubeID / 1000) ** 2;
      const avgSwTemp = (ph.seawaterInletTemp + ph.seawaterOutletTemp) / 2;
      const swDensity = getSeawaterDensity(swSalinity, avgSwTemp);
      const swFlow = ph.seawaterFlow / 3600; // kg/s
      const vel = flowArea > 0 ? swFlow / (swDensity * flowArea) : 0;
      const area = totalTubes * Math.PI * (tiTubeOD / 1000) * (tiTubeLengthMM / 1000);
      const shellODmm = Math.round(
        findMinShellID(totalTubes, tiTubeOD, tiPitch, false) + 2 * resolved.shellThkMM
      );

      passOptions.push({
        passes: p,
        tubesPerPass,
        totalTubes,
        velocity: Math.round(vel * 100) / 100,
        inRange: vel >= 1.2 && vel <= 1.8,
        area: Math.round(area * 100) / 100,
        shellODmm,
      });
    }

    // Select best pass option (closest to target velocity)
    const bestPass =
      passOptions.length > 0
        ? passOptions.reduce((a, b) =>
            Math.abs(a.velocity - tiTargetVel) < Math.abs(b.velocity - tiTargetVel) ? a : b
          )
        : { totalTubes: tubes, passes: 4, velocity: 0, shellODmm: 0 };

    return {
      id: idx + 1,
      vapourSource: `Effect ${ph.effectNumber}`,
      vapourTemp: ph.vaporTemperature,
      swInlet: ph.seawaterInletTemp,
      swOutlet: ph.seawaterOutletTemp,
      duty: ph.heatExchanged,
      lmtd: ph.lmtd,
      overallU: ps.overallHTC,
      tubeSideHTC: ps.tubeSideHTC,
      shellSideHTC: ps.shellSideHTC,
      requiredArea: ps.requiredArea,
      designArea: ps.designArea,
      flowTh: ph.seawaterFlow / 1000,
      tubes: bestPass.totalTubes,
      passes: bestPass.passes,
      velocity: bestPass.velocity,
      shellODmm: bestPass.shellODmm,
      tubeOD: tiTubeOD,
      tubeLengthMM: tiTubeLengthMM,
      passOptions,
    };
  });
}
