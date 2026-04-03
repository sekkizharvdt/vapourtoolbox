/**
 * Geometry Comparison for MED Plants
 *
 * Compares fixed-length, fixed-tube-count, and auto-optimised tube bundle
 * geometries across all effects to help designers choose the best layout.
 */

import type {
  MEDDesignerEffect as MEDEffectResult,
  GeometryComparisonEffect,
  GeometryComparisonOption,
} from './designerTypes';
import { findMinShellID, countLateralTubes, getMaxTubesPerRow } from './shellGeometry';

export function computeGeometryComparisons(
  effects: MEDEffectResult[],
  nEff: number,
  tubeOD: number,
  pitch: number,
  tubeSheetAccess: number,
  shellThk: number,
  _kWall: number,
  _designMargin: number,
  _Q1: number,
  availableLengths: number[],
  areaPerTubePerM: number,
  _swTemp: number,
  _swSalinity: number,
  _maxBrineSalinity: number
): GeometryComparisonOption[] {
  const options: GeometryComparisonOption[] = [];
  const tubeSheetThk = 8;

  const shellLen = (tubeL: number) => Math.round(tubeL * 1000 + 2 * tubeSheetThk + tubeSheetAccess);

  // ── Mode A: Fixed tube length ─────────────────────────────────────
  for (const fixedL of availableLengths) {
    const geoEffects: GeometryComparisonEffect[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < nEff; i++) {
      const e = effects[i]!;
      const hasLanes = i === 0;
      const tubesNeeded = Math.ceil(e.designArea / (areaPerTubePerM * fixedL));
      const effShellID = findMinShellID(tubesNeeded, tubeOD, pitch, hasLanes);
      const actualTubes = countLateralTubes(effShellID, tubeOD, pitch, hasLanes);
      const instArea = actualTubes * areaPerTubePerM * fixedL;
      const margin = e.requiredArea > 0 ? (instArea / e.requiredArea - 1) * 100 : 0;
      const tpr = getMaxTubesPerRow(effShellID, pitch);
      const minSpray = 0.035 * 2 * tpr * fixedL * 3.6;
      const feedPerEff = (e.distillateFlow * _maxBrineSalinity) / (_maxBrineSalinity - _swSalinity);
      const recirc = Math.max(0, minSpray - feedPerEff);

      geoEffects.push({
        effect: i + 1,
        tubeLength: fixedL,
        tubes: actualTubes,
        installedArea: instArea,
        requiredArea: e.requiredArea,
        margin,
        shellID: effShellID,
        shellLength: shellLen(fixedL),
        brineRecirc: recirc,
        hasVapourLanes: hasLanes,
      });
    }

    const maxShellID = Math.max(...geoEffects.map((e) => e.shellID));
    const trainLen =
      geoEffects.reduce((s, e) => s + e.shellLength, 0) + (nEff - 1) * 200 + tubeSheetAccess;

    if (maxShellID < 1800)
      warnings.push('Max shell ID ' + maxShellID + 'mm < 1,800mm man-entry minimum');

    options.push({
      mode: 'fixed_length',
      label: 'Fixed ' + fixedL + 'm tubes',
      description: 'All effects use ' + fixedL + 'm tube length. Shell diameter varies per effect.',
      effects: geoEffects,
      maxShellID,
      totalArea: geoEffects.reduce((s, e) => s + e.installedArea, 0),
      totalRecirc: geoEffects.reduce((s, e) => s + e.brineRecirc, 0),
      trainLength: trainLen,
      feasible: geoEffects.every((e) => e.margin >= -10),
      warnings,
    });
  }

  // ── Mode B: Fixed tube count ──────────────────────────────────────
  const typicalTubeCounts = [...new Set(effects.map((e) => e.tubes))].sort((a, b) => a - b);

  for (const fixedTubes of typicalTubeCounts) {
    const geoEffects: GeometryComparisonEffect[] = [];
    const warnings: string[] = [];
    const fixedShellID = findMinShellID(fixedTubes, tubeOD, pitch, false);
    const actualTubes = countLateralTubes(fixedShellID, tubeOD, pitch, false);

    for (let i = 0; i < nEff; i++) {
      const e = effects[i]!;
      const minLenNeeded = e.designArea / (actualTubes * areaPerTubePerM);
      const selectedLen =
        availableLengths.find((L) => L >= minLenNeeded - 0.01) ??
        availableLengths[availableLengths.length - 1] ??
        1.5;

      const instArea = actualTubes * areaPerTubePerM * selectedLen;
      const margin = e.requiredArea > 0 ? (instArea / e.requiredArea - 1) * 100 : 0;
      const tpr = getMaxTubesPerRow(fixedShellID, pitch);
      const minSpray = 0.035 * 2 * tpr * selectedLen * 3.6;
      const feedPerEff = (e.distillateFlow * _maxBrineSalinity) / (_maxBrineSalinity - _swSalinity);
      const recirc = Math.max(0, minSpray - feedPerEff);

      geoEffects.push({
        effect: i + 1,
        tubeLength: selectedLen,
        tubes: actualTubes,
        installedArea: instArea,
        requiredArea: e.requiredArea,
        margin,
        shellID: fixedShellID,
        shellLength: shellLen(selectedLen),
        brineRecirc: recirc,
        hasVapourLanes: i === 0,
      });
    }

    if (fixedShellID < 1800)
      warnings.push('Shell ID ' + fixedShellID + 'mm < 1,800mm man-entry minimum');

    options.push({
      mode: 'fixed_tubes',
      label: 'Fixed ' + actualTubes + ' tubes (ID ' + fixedShellID + 'mm)',
      description:
        'All effects use ' +
        actualTubes +
        ' tubes in ' +
        fixedShellID +
        'mm shell. Tube length varies.',
      effects: geoEffects,
      maxShellID: fixedShellID,
      totalArea: geoEffects.reduce((s, e) => s + e.installedArea, 0),
      totalRecirc: geoEffects.reduce((s, e) => s + e.brineRecirc, 0),
      trainLength:
        geoEffects.reduce((s, e) => s + e.shellLength, 0) + (nEff - 1) * 200 + tubeSheetAccess,
      feasible: geoEffects.every((e) => e.margin >= -10),
      warnings,
    });
  }

  // ── Mode C: Optimised (current design) ────────────────────────────
  const optEffects: GeometryComparisonEffect[] = effects.map((e) => ({
    effect: e.effect,
    tubeLength: e.tubeLength,
    tubes: e.tubes,
    installedArea: e.installedArea,
    requiredArea: e.requiredArea,
    margin: e.areaMargin,
    shellID: e.shellODmm - 2 * shellThk,
    shellLength: e.shellLengthMM,
    brineRecirc: e.brineRecirculation,
    hasVapourLanes: e.hasVapourLanes,
  }));

  options.push({
    mode: 'optimised',
    label: 'Auto-optimised',
    description: 'Engine auto-selects tube length and count per effect for minimum shell size.',
    effects: optEffects,
    maxShellID: Math.max(...optEffects.map((e) => e.shellID)),
    totalArea: optEffects.reduce((s, e) => s + e.installedArea, 0),
    totalRecirc: optEffects.reduce((s, e) => s + e.brineRecirc, 0),
    trainLength:
      optEffects.reduce((s, e) => s + e.shellLength, 0) + (nEff - 1) * 200 + tubeSheetAccess,
    feasible: optEffects.every((e) => e.margin >= -10),
    warnings: [],
  });

  return options;
}
