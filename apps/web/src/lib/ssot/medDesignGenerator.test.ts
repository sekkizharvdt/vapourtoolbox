/**
 * MED Design → SSOT Generator tests
 *
 * Runs the real designMED() pipeline once and asserts the generated registers
 * are internally consistent — every equipment fluid reference resolves to a
 * generated stream, every line points at a real stream and real equipment,
 * and the mass balance survives the mapping.
 */

import { designMED } from '../thermal/medDesigner';
import type { MEDDesignerInput, MEDDesignerResult } from '../thermal/med/designerTypes';
import { generateSSOTFromMEDDesign, LINE_MATERIAL_OPTIONS } from './medDesignGenerator';
import { MaterialCategory } from '@vapour/types';

const BASE_INPUT: MEDDesignerInput = {
  steamFlow: 5,
  steamTemperature: 70,
  seawaterTemperature: 30,
  targetGOR: 8,
  numberOfEffects: 6,
  includeTurndown: false,
};

let design: MEDDesignerResult;

beforeAll(() => {
  design = designMED(BASE_INPUT);
}, 60000);

describe('generateSSOTFromMEDDesign', () => {
  it('generates all three registers', () => {
    const out = generateSSOTFromMEDDesign(design);

    expect(out.streams.length).toBeGreaterThan(0);
    expect(out.equipment.length).toBeGreaterThan(0);
    expect(out.lines.length).toBeGreaterThan(0);
  });

  it('emits one equipment record per effect, plus condenser and preheaters', () => {
    const out = generateSSOTFromMEDDesign(design);
    const tags = out.equipment.map((e) => e.equipmentTag);

    for (const e of design.effects) {
      expect(tags).toContain(`MED-E${e.effect}`);
    }
    expect(tags).toContain('MED-COND');
    for (const ph of design.preheaters) {
      expect(tags).toContain(`MED-PH${ph.id}`);
    }
    expect(new Set(tags).size).toBe(tags.length); // tags unique
  });

  it('resolves every equipment fluid reference to a generated stream', () => {
    const out = generateSSOTFromMEDDesign(design);
    const streamTags = new Set(out.streams.map((s) => s.lineTag));

    const dangling: string[] = [];
    for (const eq of out.equipment) {
      for (const tag of [...eq.fluidIn, ...eq.fluidOut]) {
        if (!streamTags.has(tag)) dangling.push(`${eq.equipmentTag} → ${tag}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('resolves every line to a generated stream and to real equipment', () => {
    const out = generateSSOTFromMEDDesign(design);
    const streamTags = new Set(out.streams.map((s) => s.lineTag));
    const equipTags = new Set(out.equipment.map((e) => e.equipmentTag));

    for (const line of out.lines) {
      expect(streamTags.has(line.inputDataTag)).toBe(true);
      if (line.fromEquipmentTag) expect(equipTags.has(line.fromEquipmentTag)).toBe(true);
      if (line.toEquipmentTag) expect(equipTags.has(line.toEquipmentTag)).toBe(true);
    }
  });

  it('produces unique stream tags and unique line numbers', () => {
    const out = generateSSOTFromMEDDesign(design);

    const streamTags = out.streams.map((s) => s.lineTag);
    expect(new Set(streamTags).size).toBe(streamTags.length);

    const lineNumbers = out.lines.map((l) => l.lineNumber);
    expect(new Set(lineNumbers).size).toBe(lineNumbers.length);
  });

  it('carries the design flows through unchanged (T/h → kg/s)', () => {
    const out = generateSSOTFromMEDDesign(design);
    const byTag = new Map(out.streams.map((s) => [s.lineTag, s]));

    const steam = byTag.get('S0');
    expect(steam).toBeDefined();
    expect(steam!.flowRateKgS).toBeCloseTo((design.inputs.steamFlow * 1000) / 3600, 3);

    const product = byTag.get('DP');
    expect(product).toBeDefined();
    expect(product!.flowRateKgS).toBeCloseTo((design.totalDistillate * 1000) / 3600, 3);

    for (const e of design.effects) {
      const brine = byTag.get(`B${e.effect}`);
      expect(brine).toBeDefined();
      expect(brine!.flowRateKgS).toBeCloseTo((e.brineOutFlow * 1000) / 3600, 3);
    }
  });

  it('chains effects: each effect is fed by the previous effect vapour', () => {
    const out = generateSSOTFromMEDDesign(design);
    const byTag = new Map(out.equipment.map((e) => [e.equipmentTag, e]));

    expect(byTag.get('MED-E1')!.fluidIn).toContain('S0');
    for (let i = 2; i <= design.effects.length; i++) {
      expect(byTag.get(`MED-E${i}`)!.fluidIn).toContain(`S${i - 1}`);
    }
    // Last effect vapour goes to the condenser
    expect(byTag.get('MED-COND')!.fluidIn).toContain(`S${design.effects.length}`);
  });

  it('carries geometry and metal mass onto the effects', () => {
    const out = generateSSOTFromMEDDesign(design);

    for (const e of design.effects) {
      const eq = out.equipment.find((x) => x.equipmentTag === `MED-E${e.effect}`)!;
      expect(eq.equipmentType).toBe('EVAPORATOR_EFFECT');
      expect(eq.shellLengthMM).toBeCloseTo(e.shellLengthMM, 1);
      expect(eq.heatTransferAreaM2).toBeCloseTo(e.installedArea, 2);
      expect(eq.grossVolumeM3).toBeGreaterThan(0);
      expect(eq.metalMassKg).toBeGreaterThan(0);
    }
  });

  it('stamps MED_DESIGN provenance on every generated record', () => {
    const out = generateSSOTFromMEDDesign(design, {
      sourceCalculationId: 'calc-123',
      sourceLabel: '6-effect MED',
    });

    for (const rec of [...out.streams, ...out.equipment, ...out.lines]) {
      expect(rec.provenance?.source).toBe('MED_DESIGN');
      expect(rec.provenance?.sourceCalculationId).toBe('calc-123');
      expect(rec.provenance?.sourceLabel).toBe('6-effect MED');
    }
  });

  it('omits provenance ids when not supplied (rule 12 — no undefined to Firestore)', () => {
    const out = generateSSOTFromMEDDesign(design);
    const prov = out.streams[0]!.provenance!;

    expect(prov.source).toBe('MED_DESIGN');
    expect('sourceCalculationId' in prov).toBe(false);
    expect('sourceLabel' in prov).toBe(false);
  });

  it('honours the area code in line numbers', () => {
    const out = generateSSOTFromMEDDesign(design, { areaCode: '40' });

    for (const line of out.lines) {
      expect(line.lineNumber).toMatch(/^\d+-40-[A-Z0-9]+-(SW|B|D|S|F|NCG)-\d{2}$/);
    }
  });

  it('defaults every service to SS316L (uniform specification)', () => {
    const out = generateSSOTFromMEDDesign(design, { areaCode: '40' });

    // A single grade across the whole plant is the proven default; deviating is a
    // per-project compatibility decision, never something the generator makes.
    for (const line of out.lines) {
      expect(line.lineNumber.split('-')[2]).toBe('SS316L');
    }
  });

  it('applies a per-fluid material override (duplex on the seawater side)', () => {
    const out = generateSSOTFromMEDDesign(design, {
      areaCode: '40',
      materialByFluid: {
        'SEA WATER': MaterialCategory.PIPES_DUPLEX_2205,
        'BRINE WATER': MaterialCategory.PIPES_DUPLEX_2205,
      },
    });
    const codeOf = (tag: string) =>
      out.lines.find((l) => l.inputDataTag === tag)!.lineNumber.split('-')[2];

    expect(codeOf('SW1')).toBe('DX2205');
    expect(codeOf('BH')).toBe('DX2205');
    // Untouched services keep the uniform default
    expect(codeOf('DP')).toBe('SS316L');
    expect(codeOf('S1')).toBe('SS316L');
  });

  it('offers SS316L as the default on every service', () => {
    for (const options of Object.values(LINE_MATERIAL_OPTIONS)) {
      expect(options[0]).toBe(MaterialCategory.PIPES_STAINLESS_316L);
    }
  });

  it('offers the right alternative per service', () => {
    // Distillate and the vapour side may drop to 304L; the seawater-wetted
    // services step up to duplex instead.
    expect(LINE_MATERIAL_OPTIONS['DISTILLATE WATER'][1]).toBe(
      MaterialCategory.PIPES_STAINLESS_304L
    );
    expect(LINE_MATERIAL_OPTIONS.STEAM[1]).toBe(MaterialCategory.PIPES_STAINLESS_304L);
    for (const fluid of ['SEA WATER', 'BRINE WATER', 'FEED WATER'] as const) {
      expect(LINE_MATERIAL_OPTIONS[fluid][1]).toBe(MaterialCategory.PIPES_DUPLEX_2205);
    }
  });

  it('brine salinity rises through the train and stays physical', () => {
    const out = generateSSOTFromMEDDesign(design);
    const byTag = new Map(out.streams.map((s) => [s.lineTag, s]));

    for (const e of design.effects) {
      const brine = byTag.get(`B${e.effect}`)!;
      expect(brine.tds!).toBeGreaterThan(0);
      // Brine leaving an effect is always more concentrated than the spray
      expect(brine.tds!).toBeGreaterThanOrEqual(design.spraySalinity);
    }
  });

  it('does not emit the same inter-effect vapour line twice', () => {
    // The vapour outlet of effect i and the vapour inlet of effect i+1 are one
    // physical pipe — generating both would double the vapour duct count.
    const out = generateSSOTFromMEDDesign(design);

    for (let i = 1; i <= design.effects.length; i++) {
      const forStream = out.lines.filter((l) => l.inputDataTag === `S${i}`);
      expect(forStream).toHaveLength(1);
    }
    const steamSupply = out.lines.filter((l) => l.inputDataTag === 'S0');
    expect(steamSupply).toHaveLength(1);
  });

  it('gives every line the flow of the stream it carries', () => {
    const out = generateSSOTFromMEDDesign(design);
    const byTag = new Map(out.streams.map((s) => [s.lineTag, s]));

    for (const line of out.lines) {
      expect(line.flowRateKgS).toBe(byTag.get(line.inputDataTag)!.flowRateKgS);
    }
  });

  it('populates density on streams and on the lines that carry them', () => {
    const out = generateSSOTFromMEDDesign(design);

    for (const s of out.streams) {
      expect(s.density).toBeGreaterThan(0);
    }
    for (const line of out.lines) {
      expect(line.density).toBeGreaterThan(0);
    }
  });

  it('gives vapour streams real steam-table vapour properties', () => {
    // Regression guard with the REAL @vapour/constants (not mocked here):
    // saturated steam previously resolved to the liquid branch, giving ~970
    // kg/m³ instead of ~0.2 and dropping the latent heat from the enthalpy.
    const out = generateSSOTFromMEDDesign(design);
    const vapourStreams = out.streams.filter((s) => s.fluidType === 'STEAM');

    expect(vapourStreams.length).toBeGreaterThan(0);
    for (const s of vapourStreams) {
      expect(s.density).toBeLessThan(1);
      expect(s.density).toBeGreaterThan(0.01);
      expect(s.enthalpy).toBeGreaterThan(2400);
      expect(s.enthalpy).toBeLessThan(2750);
    }

    // Spot-check against steam tables: 70 °C saturated → ρ≈0.198, h_g≈2626
    const steam = out.streams.find((s) => s.lineTag === 'S0')!;
    expect(steam.density).toBeCloseTo(0.198, 2);
    expect(steam.enthalpy).toBeCloseTo(2626, -1);
  });

  it('reports what it deliberately did not generate', () => {
    const out = generateSSOTFromMEDDesign(design);
    const joined = out.warnings.join(' | ');

    expect(joined).toMatch(/holdup/i);
    expect(out.warnings.length).toBeGreaterThan(0);
  });
});
