/**
 * MED Designer — Smoke test with solar flash inputs
 */
import { designMED } from '@/lib/thermal';

describe('MED Designer — Solar Flash 0.79 T/h @ 57°C', () => {
  const result = designMED({
    steamFlow: 0.79,
    steamTemperature: 57.0,
    seawaterTemperature: 30,
    targetGOR: 6,
  });

  it('should auto-select optimal number of effects', () => {
    expect(result.recommendedEffects).toBeGreaterThanOrEqual(4);
    expect(result.recommendedEffects).toBeLessThanOrEqual(8);
    // Print for review
    // eslint-disable-next-line no-console
    console.log('\n═══ MED DESIGNER RESULT ═══');
    // eslint-disable-next-line no-console
    console.log('Recommended effects:', result.recommendedEffects);
    // eslint-disable-next-line no-console
    console.log('GOR:', result.achievedGOR.toFixed(2));
    // eslint-disable-next-line no-console
    console.log(
      'Distillate:',
      result.totalDistillate.toFixed(2),
      'T/h (' + result.totalDistillateM3Day.toFixed(0) + ' m³/day)'
    );
    // eslint-disable-next-line no-console
    console.log('Total evap area:', result.totalEvaporatorArea.toFixed(0), 'm²');
    // eslint-disable-next-line no-console
    console.log('Brine recirc:', result.totalBrineRecirculation.toFixed(1), 'T/h');
    // eslint-disable-next-line no-console
    console.log('Make-up feed:', result.makeUpFeed.toFixed(1), 'T/h');
    // eslint-disable-next-line no-console
    console.log('Brine blowdown:', result.brineBlowdown.toFixed(1), 'T/h');
    // eslint-disable-next-line no-console
    console.log('Warnings:', result.warnings.length > 0 ? result.warnings : 'None');
  });

  it('should produce positive GOR', () => {
    expect(result.achievedGOR).toBeGreaterThan(3);
    expect(result.achievedGOR).toBeLessThan(10);
  });

  it('should produce the scenario comparison table', () => {
    expect(result.scenarios.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log('\n═══ SCENARIO COMPARISON ═══');
    // eslint-disable-next-line no-console
    console.log('Effects │ Work ΔT/eff │ Area margin │  GOR  │ Dist T/h │ Feasible');
    for (const s of result.scenarios) {
      if (s.effects >= 4 && s.effects <= 9) {
        // eslint-disable-next-line no-console
        console.log(
          `   ${s.effects}    │  ${s.workingDTPerEffect.toFixed(2).padStart(6)}°C  │  ${(s.areaMargin >= 0 ? '+' : '') + s.areaMargin.toFixed(0) + '%'}`.padEnd(
            48
          ) +
            ` │ ${s.achievableGOR.toFixed(1).padStart(4)}  │  ${s.distillate.toFixed(2).padStart(5)}   │ ${s.feasible ? 'YES' : 'NO'}`
        );
      }
    }
  });

  it('should produce effect-by-effect results', () => {
    expect(result.effects.length).toBe(result.recommendedEffects);
    // eslint-disable-next-line no-console
    console.log('\n═══ EFFECT-BY-EFFECT ═══');
    // eslint-disable-next-line no-console
    console.log(
      'Eff │ BrineT │ VapOut │  wkΔT │    U   │  Duty │ Tubes │ TubeL │ InstA │ Margin │ Dist'
    );
    for (const e of result.effects) {
      // eslint-disable-next-line no-console
      console.log(
        ` E${e.effect} │ ${e.brineTemp.toFixed(1).padStart(5)}  │ ${e.vapourOutTemp.toFixed(1).padStart(5)} │ ${e.workingDeltaT.toFixed(2).padStart(5)} │ ${e.overallU.toFixed(0).padStart(5)}  │ ${e.duty.toFixed(0).padStart(5)} │ ${e.tubes.toString().padStart(5)} │ ${e.tubeLength.toFixed(1).padStart(4)}  │ ${e.installedArea.toFixed(0).padStart(5)} │ ${((e.areaMargin >= 0 ? '+' : '') + e.areaMargin.toFixed(0) + '%').padStart(5)}  │ ${e.distillateFlow.toFixed(2).padStart(5)}`
      );
    }
  });

  it('should size the final condenser', () => {
    expect(result.condenser.duty).toBeGreaterThan(0);
    expect(result.condenser.designArea).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log('\n═══ FINAL CONDENSER ═══');
    // eslint-disable-next-line no-console
    console.log(
      `Vapour: ${result.condenser.vapourFlow.toFixed(3)} T/h @ ${result.condenser.vapourTemp.toFixed(1)}°C`
    );
    // eslint-disable-next-line no-console
    console.log(
      `Duty: ${result.condenser.duty.toFixed(0)} kW │ LMTD: ${result.condenser.lmtd.toFixed(2)}°C │ Area: ${result.condenser.designArea.toFixed(1)} m² │ SW: ${result.condenser.seawaterFlowM3h.toFixed(0)} m³/h`
    );
  });

  it('should calculate brine recirculation', () => {
    expect(result.totalBrineRecirculation).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log('\n═══ BRINE RECIRCULATION ═══');
    for (const e of result.effects) {
      // eslint-disable-next-line no-console
      console.log(
        `E${e.effect}: minSpray=${e.minSprayFlow.toFixed(1)} T/h, recirc=${e.brineRecirculation.toFixed(1)} T/h`
      );
    }
    // eslint-disable-next-line no-console
    console.log(`Total: ${result.totalBrineRecirculation.toFixed(1)} T/h`);
  });
});
