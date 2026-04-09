/**
 * Auxiliary Equipment Sizing for MED Plants
 *
 * Sizes demisters, spray nozzles, siphons, line headers, pumps, shell nozzles,
 * anti-scalant dosing, and vacuum systems for a multi-effect distillation plant.
 */

import type {
  MEDDesignerEffect as MEDEffectResult,
  MEDDesignerCondenser as MEDCondenserResult,
  MEDAuxiliaryEquipment,
  MEDDemisterResult,
  MEDSprayNozzleResult,
  MEDSiphonResult,
  MEDLineSizing,
  MEDPumpResult,
  MEDShellNozzle,
  MEDNozzleSchedule,
  MEDDosingResult,
  MEDVacuumResult,
} from './designerTypes';

import { getSeawaterDensity, getDensityVapor, getDensityLiquid } from '@vapour/constants';
import { calculateDemisterSizing } from '../demisterCalculator';
import { calculateNozzleLayout } from '../sprayNozzleCalculator';
import { calculateSiphonSizing } from '../siphonSizingCalculator';
import { calculateTDH } from '../pumpSizing';
import { selectPipeByVelocity } from '../pipeService';
import { calculateDosing } from '../chemicalDosingCalculator';
import { calculateVacuumSystem } from '../vacuumSystemCalculator';

export interface AuxContext {
  swSalinity: number;
  maxBrineSalinity: number;
  spraySalinity: number; // blended TDS of make-up + recycled brine
  shellID: number;
  nEff: number;
  totalDistillate: number;
  makeUpFeed: number;
  brineBlowdown: number;
  totalRecirc: number;
  steamFlow: number;
  swTemp: number;
  condenserSWFlowM3h: number;
  /** Per-effect actual bundle width from geometry refinement (mm) */
  bundleWidths?: (number | undefined)[];
}

export function computeAuxiliaryEquipment(
  effects: MEDEffectResult[],
  condenser: MEDCondenserResult,
  ctx: AuxContext
): MEDAuxiliaryEquipment {
  const nEff = ctx.nEff;
  const auxWarnings: string[] = [];

  // ── 1. Demisters per effect ─────────────────────────────────────────
  const demisters: MEDDemisterResult[] = effects.map((e) => {
    try {
      const vapDensity = getDensityVapor(e.vapourOutTemp);
      const liqDensity = getDensityLiquid(e.brineTemp);
      const vapMassFlow = e.distillateFlow / 3.6; // T/h → kg/s

      const dem = calculateDemisterSizing({
        vaporMassFlow: vapMassFlow,
        vaporDensity: vapDensity,
        liquidDensity: liqDensity,
        demisterType: 'wire_mesh',
        orientation: 'horizontal',
        designMargin: 0.8,
        geometry: 'circular',
      });

      return {
        effect: e.effect,
        requiredArea: dem.requiredArea,
        designVelocity: dem.designVelocity,
        loadingStatus: dem.loadingStatus,
        pressureDrop: dem.pressureDrop,
      };
    } catch (err) {
      auxWarnings.push(
        `Demister E${e.effect}: ${err instanceof Error ? err.message : 'sizing failed'}`
      );
      return {
        effect: e.effect,
        requiredArea: 0,
        designVelocity: 0,
        loadingStatus: 'error',
        pressureDrop: 0,
      };
    }
  });

  // ── 2. Spray nozzles per effect (using layout calculator for height) ──
  const sprayNozzles: MEDSprayNozzleResult[] = effects.map((e) => {
    try {
      // Total spray flow = feed + recirculation, convert T/h → lpm
      const sprayFlowTh = e.minSprayFlow; // T/h
      const avgSalinity = (ctx.swSalinity + ctx.maxBrineSalinity) / 2;
      const density = getSeawaterDensity(avgSalinity, e.brineTemp);
      // T/h → lpm: (T/h × 1000 kg/T) / (density kg/m³) = m³/h, × 1000/60 = lpm
      const sprayFlowLpm = ((sprayFlowTh * 1000) / density) * (1000 / 60);

      // Use layout calculator — gives nozzle height, count, and positioning
      const bundleLengthMM = e.tubeLength * 1000; // tube length in mm
      // Use actual bundle width from geometry refinement if available, else approximate
      const effectIdx = effects.indexOf(e);
      const bundleWidthMM = ctx.bundleWidths?.[effectIdx] ?? ctx.shellID * 0.85;

      const layoutResult = calculateNozzleLayout({
        category: 'full_cone_square',
        totalFlow: sprayFlowLpm,
        operatingPressure: 1.5, // bar
        bundleLength: bundleLengthMM,
        bundleWidth: bundleWidthMM,
        targetHeight: 400, // mm — typical for MED spray
        minHeight: 250,
        maxHeight: 600,
      });

      const best = layoutResult.matches[0];
      return {
        effect: e.effect,
        nozzleModel: best?.modelNumber ?? 'N/A',
        nozzleCount: best?.totalNozzles ?? 0,
        flowPerNozzle: best ? best.flowAtPressure : 0,
        sprayAngle: best?.sprayAngle ?? 0,
        sprayHeight: best?.derivedHeight ?? 400,
        coverageWidth: best?.coverageDiameter ?? bundleWidthMM,
        nozzlesAlongLength: best?.nozzlesAlongLength ?? 0,
        rowsAcrossWidth: best?.rowsAcrossWidth ?? 0,
      };
    } catch (err) {
      auxWarnings.push(
        `Spray nozzle E${e.effect}: ${err instanceof Error ? err.message : 'selection failed'}`
      );
      return {
        effect: e.effect,
        nozzleModel: 'N/A',
        nozzleCount: 0,
        flowPerNozzle: 0,
        sprayAngle: 0,
        sprayHeight: 400, // default fallback
        coverageWidth: ctx.bundleWidths?.[effects.indexOf(e)] ?? ctx.shellID * 0.85,
        nozzlesAlongLength: 0,
        rowsAcrossWidth: 0,
      };
    }
  });

  // ── 3. Siphons between effects ──────────────────────────────────────
  const siphons: MEDSiphonResult[] = [];
  for (let i = 0; i < nEff - 1; i++) {
    const eFrom = effects[i]!;
    const eTo = effects[i + 1]!;

    // Distillate siphon — accumulated distillate cascade
    try {
      const distFlowAccum = eFrom.accumDistillateFlow;
      const distSiphon = calculateSiphonSizing({
        upstreamPressure: eFrom.pressure,
        downstreamPressure: eTo.pressure,
        pressureUnit: 'mbar_abs',
        fluidType: 'distillate',
        salinity: 5,
        flowRate: distFlowAccum,
        elbowConfig: '2_elbows',
        horizontalDistance: 1.0,
        offsetDistance: 0.5,
        targetVelocity: 0.3,
        safetyFactor: 20,
      });
      siphons.push({
        fromEffect: eFrom.effect,
        toEffect: eTo.effect,
        fluidType: 'distillate',
        flowRate: distFlowAccum,
        pipeSize: distSiphon.pipe.displayName,
        minimumHeight: distSiphon.minimumHeight,
        velocity: distSiphon.velocity,
      });
    } catch (err) {
      auxWarnings.push(
        `Siphon E${eFrom.effect}→E${eTo.effect} distillate: ${err instanceof Error ? err.message : 'sizing failed'}`
      );
      siphons.push({
        fromEffect: eFrom.effect,
        toEffect: eTo.effect,
        fluidType: 'distillate',
        flowRate: 0,
        pipeSize: 'N/A',
        minimumHeight: 0,
        velocity: 0,
      });
    }

    // Brine siphon — accumulated brine cascade (brine from all effects up to this one)
    try {
      const brineFlow = eFrom.accumBrineFlow;
      const brineSiphon = calculateSiphonSizing({
        upstreamPressure: eFrom.pressure,
        downstreamPressure: eTo.pressure,
        pressureUnit: 'mbar_abs',
        fluidType: 'brine',
        salinity: ctx.maxBrineSalinity,
        flowRate: brineFlow,
        elbowConfig: '2_elbows',
        horizontalDistance: 1.0,
        offsetDistance: 0.5,
        targetVelocity: 0.3,
        safetyFactor: 20,
      });
      siphons.push({
        fromEffect: eFrom.effect,
        toEffect: eTo.effect,
        fluidType: 'brine',
        flowRate: brineFlow,
        pipeSize: brineSiphon.pipe.displayName,
        minimumHeight: brineSiphon.minimumHeight,
        velocity: brineSiphon.velocity,
      });
    } catch (err) {
      auxWarnings.push(
        `Siphon E${eFrom.effect}→E${eTo.effect} brine: ${err instanceof Error ? err.message : 'sizing failed'}`
      );
      siphons.push({
        fromEffect: eFrom.effect,
        toEffect: eTo.effect,
        fluidType: 'brine',
        flowRate: 0,
        pipeSize: 'N/A',
        minimumHeight: 0,
        velocity: 0,
      });
    }
  }

  // ── 4. Line sizing for main headers ─────────────────────────────────
  const lineSizing: MEDLineSizing[] = [];
  const swDensity = getSeawaterDensity(ctx.swSalinity, ctx.swTemp);

  const lineSpecs: {
    service: string;
    flowTh: number;
    density: number;
    targetVel: number;
    velLimits: { min: number; max: number };
  }[] = [
    {
      service: 'Seawater to Condenser',
      flowTh: (ctx.condenserSWFlowM3h * swDensity) / 1000,
      density: swDensity,
      targetVel: 2.0,
      velLimits: { min: 1.0, max: 3.0 },
    },
    {
      service: 'Feed Water Header',
      flowTh: ctx.makeUpFeed,
      density: swDensity,
      targetVel: 1.5,
      velLimits: { min: 0.5, max: 2.5 },
    },
    {
      service: 'Distillate Header',
      flowTh: ctx.totalDistillate,
      density: getDensityLiquid(ctx.swTemp + 5),
      targetVel: 1.0,
      velLimits: { min: 0.5, max: 2.0 },
    },
    {
      service: 'Brine Blowdown Header',
      flowTh: ctx.brineBlowdown,
      density: getSeawaterDensity(ctx.maxBrineSalinity, 40),
      targetVel: 1.5,
      velLimits: { min: 0.5, max: 2.5 },
    },
    {
      service: 'Spray Header (total)',
      flowTh: ctx.totalRecirc + ctx.makeUpFeed, // total spray = recirc + make-up
      density: getSeawaterDensity(
        ctx.spraySalinity ?? (ctx.swSalinity + ctx.maxBrineSalinity) / 2,
        45
      ),
      targetVel: 1.5,
      velLimits: { min: 0.5, max: 2.5 },
    },
  ];

  for (const spec of lineSpecs) {
    try {
      const volFlow = (spec.flowTh * 1000) / (spec.density * 3600); // T/h → m³/s
      const pipe = selectPipeByVelocity(volFlow, spec.targetVel, spec.velLimits);
      lineSizing.push({
        service: spec.service,
        flowRate: spec.flowTh,
        pipeSize: pipe.displayName,
        dn: pipe.dn,
        velocity: pipe.actualVelocity,
        velocityStatus: pipe.velocityStatus,
      });
    } catch (err) {
      auxWarnings.push(
        `Line sizing ${spec.service}: ${err instanceof Error ? err.message : 'failed'}`
      );
      lineSizing.push({
        service: spec.service,
        flowRate: spec.flowTh,
        pipeSize: 'N/A',
        dn: 'N/A',
        velocity: 0,
        velocityStatus: 'error',
      });
    }
  }

  // ── 5. Pump sizing ──────────────────────────────────────────────────
  const pumps: MEDPumpResult[] = [];

  const pumpSpecs: {
    service: string;
    flowTh: number;
    density: number;
    staticHead: number;
    dischargePressure: number; // bar abs
    suctionPressure: number; // bar abs
    qty: string;
  }[] = [
    {
      service: 'Seawater Pump',
      flowTh: (ctx.condenserSWFlowM3h * swDensity) / 1000,
      density: swDensity,
      staticHead: 5,
      dischargePressure: 2.0,
      suctionPressure: 1.013,
      qty: '1+1',
    },
    {
      service: 'Distillate Pump',
      flowTh: ctx.totalDistillate,
      density: getDensityLiquid(ctx.swTemp + 5),
      staticHead: 3,
      dischargePressure: 2.0,
      suctionPressure: condenser.vapourTemp > 40 ? 0.08 : 0.06, // vacuum
      qty: '1+1',
    },
    {
      service: 'Brine Blowdown Pump',
      flowTh: ctx.brineBlowdown,
      density: getSeawaterDensity(ctx.maxBrineSalinity, 40),
      staticHead: 3,
      dischargePressure: 2.0,
      suctionPressure: effects[nEff - 1]?.pressure ? effects[nEff - 1]!.pressure / 1000 : 0.07,
      qty: '1+1',
    },
    {
      service: 'Brine Recirculation Pump',
      flowTh: ctx.totalRecirc + ctx.makeUpFeed, // total spray: make-up + recycled brine
      density: getSeawaterDensity(ctx.spraySalinity, 45),
      staticHead: 3,
      dischargePressure: 1.5,
      suctionPressure: 0.1, // ~100 mbar vacuum
      qty: '1+1',
    },
  ];

  for (const spec of pumpSpecs) {
    try {
      const result = calculateTDH({
        flowRate: spec.flowTh,
        fluidDensity: spec.density,
        suctionPressureDrop: 0.3, // estimated 0.3 bar suction friction
        dischargePressureDrop: 0.5, // estimated 0.5 bar discharge friction
        staticHead: spec.staticHead,
        dischargeVesselPressure: spec.dischargePressure,
        suctionVesselPressure: spec.suctionPressure,
      });
      pumps.push({
        service: spec.service,
        flowRate: spec.flowTh,
        flowRateM3h: result.volumetricFlowM3Hr,
        totalHead: result.totalDifferentialHead,
        hydraulicPower: result.hydraulicPower,
        motorPower: result.recommendedMotorKW,
        quantity: spec.qty,
      });
    } catch (err) {
      auxWarnings.push(
        `Pump ${spec.service}: ${err instanceof Error ? err.message : 'sizing failed'}`
      );
      pumps.push({
        service: spec.service,
        flowRate: spec.flowTh,
        flowRateM3h: 0,
        totalHead: 0,
        hydraulicPower: 0,
        motorPower: 0,
        quantity: spec.qty,
      });
    }
  }

  // ── 6. Nozzle schedule ───────────────────────────────────────────────
  const nozzleSchedule = computeNozzleSchedule(effects, ctx);
  auxWarnings.push(...nozzleSchedule.warnings);

  return { demisters, sprayNozzles, siphons, lineSizing, pumps, nozzleSchedule, auxWarnings };
}

// ============================================================================
// Anti-scalant Dosing
// ============================================================================

export function computeDosing(
  makeUpFeedTh: number,
  swDensity: number,
  doseMgL: number
): MEDDosingResult | undefined {
  try {
    const feedFlowM3h = (makeUpFeedTh * 1000) / swDensity;
    const result = calculateDosing({
      feedFlowM3h,
      doseMgL,
      solutionDensityKgL: 1.05, // Belgard EV 2050 typical
      storageDays: 30,
    });
    return {
      feedFlowM3h,
      doseMgL,
      chemicalFlowLh: result.chemicalFlowLh,
      dailyConsumptionKg: result.dailyConsumptionKg,
      monthlyConsumptionKg: result.monthlyConsumptionKg,
      storageTankM3: result.storageTankM3 ?? 0,
      dosingLineOD: result.dosingLine ? `${result.dosingLine.tubingOD}mm OD` : 'N/A',
    };
  } catch {
    return undefined;
  }
}

// ============================================================================
// Vacuum System Sizing
// ============================================================================

export function computeVacuumSystem(
  lastEffectPressureMbar: number,
  lastEffectTempC: number,
  swFlowM3h: number,
  swTempC: number,
  salinityGkg: number,
  systemVolumeM3: number,
  trainConfig: 'single_ejector' | 'two_stage_ejector' | 'lrvp_only' | 'hybrid'
): MEDVacuumResult | undefined {
  try {
    // HEI air leakage tables are for power plant condensers with many flanged
    // connections. MED evaporators are welded with far fewer leak paths.
    // BARC validation: 135.6 m³ system → 0.875 kg/h (HEI would give ~15 kg/h).
    // Apply reduction factor of 0.15 to system volume for HEI lookup.
    const heiReductionFactor = 0.15;
    const effectiveVolumeForHEI = systemVolumeM3 * heiReductionFactor;

    const result = calculateVacuumSystem({
      suctionPressureMbar: lastEffectPressureMbar - 2, // 2 mbar vent line ΔP
      suctionTemperatureC: lastEffectTempC,
      dischargePressureMbar: 1013,
      ncgMode: 'combined',
      includeHeiLeakage: true,
      includeSeawaterGas: true,
      systemVolumeM3: effectiveVolumeForHEI, // reduced for welded MED vessels
      seawaterFlowM3h: swFlowM3h,
      seawaterTemperatureC: swTempC,
      salinityGkg,
      motivePressureBar: 8, // 8 bar motive steam
      coolingWaterTempC: swTempC,
      sealWaterTempC: swTempC,
      trainConfig,
      evacuationVolumeM3: systemVolumeM3, // full volume for evacuation time calc
    });
    return {
      lastEffectPressureMbar,
      systemVolumeM3,
      totalDryNcgKgH: result.totalDryNcgKgH,
      totalMotiveSteamKgH: result.totalMotiveSteamKgH,
      totalPowerKW: result.totalPowerKW,
      trainConfig,
      evacuationTimeMinutes: result.evacuationTimeMinutes ?? 0,
    };
  } catch {
    return undefined;
  }
}

// ============================================================================
// Nozzle Sizing for Shell Connections
// ============================================================================

export function computeNozzleSchedule(
  effects: MEDEffectResult[],
  ctx: AuxContext
): MEDNozzleSchedule {
  const nozzles: MEDShellNozzle[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < effects.length; i++) {
    const e = effects[i]!;

    // Flow rates for this effect
    const vapourFlowTh = e.distillateFlow; // vapour produced ≈ distillate
    const brineFlowTh = e.minSprayFlow; // total spray flow
    const distillateFlowTh = e.distillateFlow;
    const ventFlowTh = vapourFlowTh * 0.02; // ~2% vent

    // Vapour density at effect conditions
    const vapDensity = getDensityVapor(e.vapourOutTemp);

    const nozzleSpecs: {
      service: MEDShellNozzle['service'];
      flowTh: number;
      density: number;
      targetVel: number;
      velLimits: { min: number; max: number };
    }[] = [
      {
        service: 'vapour_inlet',
        flowTh: i === 0 ? ctx.steamFlow : effects[i - 1]!.distillateFlow,
        density: getDensityVapor(e.incomingVapourTemp),
        targetVel: 30,
        velLimits: { min: 15, max: 50 },
      },
      {
        service: 'vapour_outlet',
        flowTh: vapourFlowTh,
        density: vapDensity,
        targetVel: 30,
        velLimits: { min: 15, max: 50 },
      },
      {
        service: 'brine_inlet',
        flowTh: brineFlowTh,
        density: getSeawaterDensity(ctx.swSalinity, e.brineTemp),
        targetVel: 1.0,
        velLimits: { min: 0.5, max: 1.5 },
      },
      {
        service: 'brine_outlet',
        flowTh: ctx.brineBlowdown / ctx.nEff,
        density: getSeawaterDensity(ctx.maxBrineSalinity, e.brineTemp),
        targetVel: 1.0,
        velLimits: { min: 0.5, max: 1.5 },
      },
      {
        service: 'distillate_outlet',
        flowTh: distillateFlowTh,
        density: getDensityLiquid(ctx.swTemp + 5),
        targetVel: 0.8,
        velLimits: { min: 0.3, max: 1.5 },
      },
      {
        service: 'vent',
        flowTh: ventFlowTh,
        density: vapDensity,
        targetVel: 20,
        velLimits: { min: 10, max: 30 },
      },
    ];

    for (const spec of nozzleSpecs) {
      try {
        const volFlow = (spec.flowTh * 1000) / (spec.density * 3600); // m³/s
        if (volFlow <= 0 || !isFinite(volFlow)) {
          nozzles.push({
            effect: e.effect,
            service: spec.service,
            flowRate: spec.flowTh,
            pipeSize: 'N/A',
            dn: 'N/A',
            velocity: 0,
            velocityStatus: 'N/A',
          });
          continue;
        }
        const pipe = selectPipeByVelocity(volFlow, spec.targetVel, spec.velLimits);
        nozzles.push({
          effect: e.effect,
          service: spec.service,
          flowRate: spec.flowTh,
          pipeSize: pipe.displayName,
          dn: pipe.dn,
          velocity: pipe.actualVelocity,
          velocityStatus: pipe.velocityStatus,
        });
      } catch (err) {
        warnings.push(
          `Nozzle E${e.effect} ${spec.service}: ${err instanceof Error ? err.message : 'failed'}`
        );
        nozzles.push({
          effect: e.effect,
          service: spec.service,
          flowRate: spec.flowTh,
          pipeSize: 'N/A',
          dn: 'N/A',
          velocity: 0,
          velocityStatus: 'error',
        });
      }
    }
  }

  return { nozzles, warnings };
}
