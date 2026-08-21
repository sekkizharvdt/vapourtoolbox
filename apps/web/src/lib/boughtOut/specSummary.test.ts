import { summariseBoughtOutSpec } from './specSummary';
import type { BoughtOutSpecifications } from '@vapour/types';

const specs = (o: Record<string, unknown>) => o as unknown as BoughtOutSpecifications;

describe('summariseBoughtOutSpec', () => {
  it('describes a valve by the fields that tell two of them apart', () => {
    expect(
      summariseBoughtOutSpec(
        'VALVE',
        specs({
          valveType: 'GATE',
          size: 'DN150',
          pressureRating: '150#',
          bodyMaterial: 'CF8M',
          operation: 'GEAR',
        })
      )
    ).toBe('Gate · DN150 · 150# · CF8M · Gear');
  });

  it('builds an instrument range from the min/max/unit triple', () => {
    expect(
      summariseBoughtOutSpec(
        'INSTRUMENT',
        specs({
          instrumentType: 'TRANSMITTER',
          variable: 'PRESSURE',
          rangeMin: 0,
          rangeMax: 20,
          unit: 'bar',
        })
      )
    ).toBe('Transmitter · Pressure · 0 - 20 bar');
  });

  it('omits a range when only one end is present', () => {
    const result = summariseBoughtOutSpec(
      'INSTRUMENT',
      specs({ instrumentType: 'SWITCH', rangeMin: 0 })
    );
    expect(result).toBe('Switch');
  });

  it('drops absent numerics instead of printing "undefined m³/hr"', () => {
    expect(summariseBoughtOutSpec('PUMP', specs({ pumpType: 'CENTRIFUGAL', head: 32 }))).toBe(
      'Centrifugal · 32 m head'
    );
  });

  // Real records caught this: bodyMaterial "WCB" and manufacturer "CGL" are
  // vendor strings that look exactly like enum tokens. Title-casing them to
  // "Wcb" / "Cgl" makes the item harder to recognise, not easier.
  it('leaves vendor codes alone, however enum-shaped they look', () => {
    expect(summariseBoughtOutSpec('VALVE', specs({ size: 'DN50', bodyMaterial: 'CF8M' }))).toBe(
      'DN50 · CF8M'
    );
    expect(
      summariseBoughtOutSpec('VALVE', specs({ bodyMaterial: 'WCB', manufacturer: 'CGL' }))
    ).toBe('WCB · CGL');
  });

  it('collapses and clips a long free-text spec so a list row survives it', () => {
    const long =
      'Demister Pad with Grid, Size: 2060 x 1080 mm, thk: 50 mm,\nMOC: SS316, Bulk Density - 144 kg/m3, Voidage - 98.2%';
    const result = summariseBoughtOutSpec('OTHER', specs({ specification: long }));
    expect(result).not.toContain('\n');
    expect(result!.length).toBeLessThanOrEqual(91);
    expect(result!.endsWith('…')).toBe(true);
  });

  it('appends manufacturer and model after the physical spec', () => {
    expect(
      summariseBoughtOutSpec(
        'INSTRUMENT',
        specs({ instrumentType: 'TRANSMITTER', manufacturer: 'Yokogawa', model: 'EJA510E' })
      )
    ).toBe('Transmitter · Yokogawa · EJA510E');
  });

  it('falls back to free text for OTHER', () => {
    expect(
      summariseBoughtOutSpec('OTHER', specs({ specification: 'Custom fabricated skid' }))
    ).toBe('Custom fabricated skid');
  });

  it('returns undefined when there is nothing worth showing, so the row renders nothing', () => {
    expect(summariseBoughtOutSpec('VALVE', undefined)).toBeUndefined();
    expect(summariseBoughtOutSpec('VALVE', specs({}))).toBeUndefined();
    expect(summariseBoughtOutSpec('VALVE', specs({ size: '   ' }))).toBeUndefined();
  });
});
