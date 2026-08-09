/**
 * Flash Chamber → SSOT Generator tests
 *
 * Runs the real calculateFlashChamber() pipeline and asserts the generated
 * registers are internally consistent, and that the two quantities this mapping
 * is easiest to get wrong are actually distinguished:
 *
 *   1. the OPERATING holdup published under `liquidHoldupM3` is not the
 *      retention-zone volume the calculator reports, and
 *   2. the liquid keeps its boiling point elevation over the vapour.
 *
 * Both are invisible to a steady-state check — they move time constants, not
 * equilibria — so they are asserted here rather than left to review.
 */

import { calculateFlashChamber } from '../thermal/flashChamberCalculator';
import { DEFAULT_FLASH_CHAMBER_INPUT } from '@vapour/types';
import type { FlashChamberInput, FlashChamberResult } from '@vapour/types';
import { generateFlashChamberSSOT } from './flashChamberGenerator';

const SEAWATER_INPUT: FlashChamberInput = { ...DEFAULT_FLASH_CHAMBER_INPUT };

const DM_INPUT: FlashChamberInput = {
  ...DEFAULT_FLASH_CHAMBER_INPUT,
  waterType: 'DM_WATER',
  salinity: 0,
};

/** Stream-tag suffix each nozzle type routes to, mirroring the generator */
function routeSuffix(type: FlashChamberResult['nozzles'][number]['type']): string {
  return type === 'inlet' ? '-IN' : type === 'outlet' ? '-OUT' : '-VAP';
}

let seawater: FlashChamberResult;
let dmWater: FlashChamberResult;

beforeAll(() => {
  seawater = calculateFlashChamber(SEAWATER_INPUT);
  dmWater = calculateFlashChamber(DM_INPUT);
}, 60000);

describe('generateFlashChamberSSOT', () => {
  it('generates one vessel, three streams and a line per nozzle', () => {
    const out = generateFlashChamberSSOT(seawater);

    expect(out.equipment).toHaveLength(1);
    expect(out.streams).toHaveLength(3);
    expect(out.lines).toHaveLength(seawater.nozzles.length);
  });

  it('publishes the OPERATING holdup, not the retention-zone volume', () => {
    // The defect this generator exists to avoid. `liquidHoldupVolume` is the
    // LG-L to LG-H inventory; the register field means BTL to operating level.
    // At the default 0.5 level ratio they differ by roughly 40%, and a
    // simulator reading the wrong one gets a level time constant that is wrong
    // by the same factor.
    const out = generateFlashChamberSSOT(seawater);
    const vessel = out.equipment[0]!;
    const { chamberSizing: cs, elevations } = seawater;

    const expected = cs.crossSectionArea * (elevations.operatingLevel - elevations.btl);
    expect(vessel.liquidHoldupM3).toBeCloseTo(expected, 3);

    // And it must NOT be the retention volume — assert the grid actually
    // distinguishes them rather than passing because they happen to agree.
    expect(Math.abs(vessel.liquidHoldupM3! - cs.liquidHoldupVolume)).toBeGreaterThan(0.001);
    expect(vessel.liquidHoldupM3!).toBeLessThan(cs.liquidHoldupVolume);
  });

  it('reports the retention volume in a warning rather than silently dropping it', () => {
    const out = generateFlashChamberSSOT(seawater);
    expect(out.warnings.some((w) => w.includes('Retention-zone volume'))).toBe(true);
  });

  it('keeps the liquid hotter than the vapour by the boiling point elevation', () => {
    const out = generateFlashChamberSSOT(seawater);
    const liquid = out.streams.find((s) => s.lineTag.endsWith('-OUT'))!;
    const vapour = out.streams.find((s) => s.lineTag.endsWith('-VAP'))!;

    expect(liquid.temperature!).toBeGreaterThan(vapour.temperature!);
  });

  it('closes the salt balance across the vessel', () => {
    const out = generateFlashChamberSSOT(seawater);
    const inlet = out.streams.find((s) => s.lineTag.endsWith('-IN'))!;
    const liquid = out.streams.find((s) => s.lineTag.endsWith('-OUT'))!;
    const vapour = out.streams.find((s) => s.lineTag.endsWith('-VAP'))!;

    const saltIn = inlet.flowRateKgS! * inlet.tds!;
    const saltOut = liquid.flowRateKgS! * liquid.tds!;

    expect(vapour.tds).toBe(0);
    expect(Math.abs(saltOut - saltIn) / saltIn).toBeLessThan(0.005);
  });

  it('conserves mass across the vessel', () => {
    const out = generateFlashChamberSSOT(seawater);
    const inlet = out.streams.find((s) => s.lineTag.endsWith('-IN'))!;
    const liquid = out.streams.find((s) => s.lineTag.endsWith('-OUT'))!;
    const vapour = out.streams.find((s) => s.lineTag.endsWith('-VAP'))!;

    const outFlow = liquid.flowRateKgS! + vapour.flowRateKgS!;
    expect(Math.abs(outFlow - inlet.flowRateKgS!) / inlet.flowRateKgS!).toBeLessThan(0.001);
  });

  it('classifies DM water as distillate at zero TDS', () => {
    const out = generateFlashChamberSSOT(dmWater);

    for (const s of out.streams) {
      if (s.lineTag.endsWith('-VAP')) continue;
      expect(s.fluidType).toBe('DISTILLATE WATER');
      expect(s.tds).toBe(0);
    }
  });

  it('classifies seawater as brine and concentrates it', () => {
    const out = generateFlashChamberSSOT(seawater);
    const inlet = out.streams.find((s) => s.lineTag.endsWith('-IN'))!;
    const liquid = out.streams.find((s) => s.lineTag.endsWith('-OUT'))!;

    expect(liquid.fluidType).toBe('BRINE WATER');
    expect(liquid.tds!).toBeGreaterThan(inlet.tds!);
  });

  it('stamps every record as FLASH_CHAMBER, never MED_DESIGN', () => {
    // The two generated sources must stay distinct or a MED regeneration would
    // overwrite a flash chamber's geometry.
    const out = generateFlashChamberSSOT(seawater);
    const all = [...out.streams, ...out.equipment, ...out.lines];

    expect(all.length).toBeGreaterThan(0);
    for (const r of all) {
      expect(r.provenance?.source).toBe('FLASH_CHAMBER');
      expect(r.provenance?.generatedKey).toBeTruthy();
    }
  });

  it('derives stream tags from the equipment tag so two chambers do not collide', () => {
    const a = generateFlashChamberSSOT(seawater, { equipmentTag: 'FC-01' });
    const b = generateFlashChamberSSOT(seawater, { equipmentTag: 'FC-02' });

    const tagsA = new Set(a.streams.map((s) => s.lineTag));
    const tagsB = b.streams.map((s) => s.lineTag);

    expect(tagsB.some((t) => tagsA.has(t))).toBe(false);
    expect(a.equipment[0]!.equipmentTag).toBe('FC-01');
    expect(b.equipment[0]!.equipmentTag).toBe('FC-02');
  });

  it('routes every line to a generated stream and to the vessel', () => {
    const out = generateFlashChamberSSOT(seawater, { equipmentTag: 'FC-07' });
    const streamTags = new Set(out.streams.map((s) => s.lineTag));

    for (const line of out.lines) {
      expect(streamTags.has(line.inputDataTag)).toBe(true);
      expect(line.fromEquipmentTag ?? line.toEquipmentTag).toBe('FC-07');
      // Flow must come from the stream, not be re-derived.
      const stream = out.streams.find((s) => s.lineTag === line.inputDataTag)!;
      expect(line.flowRateKgS).toBe(stream.flowRateKgS);
      expect(line.density).toBeGreaterThan(0);
    }
  });

  it('leads line numbers with DN in mm, not NPS in inches', () => {
    // The MED bridge's line numbers lead with DN. Leading with NPS produced
    // `5-00-SS316L-B-01` for a bore the MED side would call 125 — the same
    // field meaning inches in one register and mm in the other.
    const out = generateFlashChamberSSOT(seawater);

    for (const line of out.lines) {
      const lead = Number(line.lineNumber.split('-')[0]);
      const nozzle = seawater.nozzles.find((n) => line.inputDataTag.endsWith(routeSuffix(n.type)))!;

      expect(lead).toBe(Number(nozzle.dn));
      // DN is nominal, so it sits within a few percent of the real bore. NPS in
      // inches would be ~25x smaller, which this catches.
      expect(lead).toBeGreaterThan(nozzle.actualID * 0.8);
      expect(lead).toBeLessThan(nozzle.actualID * 1.2);
    }
  });

  it('publishes the vessel geometry the elevations were built on', () => {
    const out = generateFlashChamberSSOT(seawater);
    const vessel = out.equipment[0]!;

    expect(vessel.equipmentType).toBe('FLASH_VESSEL');
    expect(vessel.shellIDmm).toBeCloseTo(seawater.chamberSizing.diameter, 1);
    expect(vessel.shellLengthMM).toBeCloseTo(seawater.chamberSizing.totalHeight, 1);
    expect(vessel.elevationM).toBeCloseTo(seawater.elevations.btl, 3);
    // Holdup can never exceed the vessel it sits in.
    expect(vessel.liquidHoldupM3!).toBeLessThan(vessel.grossVolumeM3!);
  });

  it('publishes metal mass with the derivation that lets a consumer check it', () => {
    const out = generateFlashChamberSSOT(seawater);
    const vessel = out.equipment[0]!;
    const d = vessel.metalMassDerivation!;

    expect(vessel.metalMassKg).toBeCloseTo(seawater.chamberSizing.metalMass.totalKg, 6);
    expect(d.basis).toBe('component-breakdown');

    // The components must sum to the total, or the breakdown describes a
    // different vessel than the number does.
    const summed = Object.values(d.componentsKg!).reduce((a, b) => a + b, 0);
    expect(summed).toBeCloseTo(vessel.metalMassKg!, 6);

    // Only shell and heads are real here — a flash chamber has no bundle and no
    // coolant side, and zero must mean "none", not "not computed".
    expect(d.computedFromGeometry).toEqual(['shell', 'dishedHeads']);
    expect(d.componentsKg!.tubes).toBe(0);
    expect(d.componentsKg!.waterBoxes).toBe(0);
  });

  it('labels the mass as resting on an ASSUMED wall thickness', () => {
    // The mass is real geometry at an assumed thickness, so it is an assumed
    // mass. If that label is ever dropped it becomes a design value by accident.
    const out = generateFlashChamberSSOT(seawater);
    const d = out.equipment[0]!.metalMassDerivation!;

    expect(d.wallThicknessSource).toBe('assumed');
    expect(d.caveats!.some((c) => c.includes('ASSUMED wall thickness'))).toBe(true);
    expect(d.caveats!.some((c) => c.includes('FLOOR'))).toBe(true);
    // Skirt and internals are outside the envelope and must stay named.
    expect(d.excludes.some((e) => e.includes('skirt'))).toBe(true);
  });

  it('warns what the metal mass does and does not cover', () => {
    const out = generateFlashChamberSSOT(seawater);

    expect(out.warnings.some((w) => w.includes('pressure envelope only'))).toBe(true);
    expect(out.warnings.some((w) => w.includes('floor'))).toBe(true);
  });
});
