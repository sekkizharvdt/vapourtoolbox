/**
 * The committed fixture artifact must be exactly what its generator produces.
 *
 * `docs/thermal/fixtures/flash-chamber-cases.json` is a numerical gate for the
 * external dynamic-simulator work. If the committed file drifts from the
 * generator, that team is gating against something nobody can reproduce, and a
 * property change on this side stops propagating to them silently — the worst
 * possible failure for a cross-checking artifact.
 *
 * It drifted once already: lint-staged runs prettier over `docs/**\/*.json`, and
 * prettier's formatting differs from `JSON.stringify(..., 2)`, so every commit
 * rewrote the file and every regeneration produced a spurious diff. The file is
 * now in `.prettierignore`; this test is what stops that reappearing.
 *
 * A failure here means one of:
 *   - the fixtures need regenerating (`pnpm fixtures:flash-chamber`) after a
 *     deliberate property or calculator change — regenerate and bump
 *     schemaVersion with the change declared in `schemaChanges`
 *   - something reformatted the artifact — check `.prettierignore`
 */

import { readFileSync } from 'node:fs';

import {
  buildFixturePayload,
  serialiseFixturePayload,
  FIXTURE_OUTPUT_PATH,
} from './flashChamberFixtures.gen';

describe('committed flash-chamber fixtures are reproducible', () => {
  it('match the generator byte for byte', () => {
    const committed = readFileSync(FIXTURE_OUTPUT_PATH, 'utf8');
    const regenerated = serialiseFixturePayload(buildFixturePayload().payload);

    // Compare parsed first: a structural diff reports the offending key, where a
    // raw string comparison would only say the two 800-line files differ.
    expect(JSON.parse(regenerated)).toEqual(JSON.parse(committed));
    expect(regenerated).toBe(committed);
  });

  it('declare every schemaVersion in schemaChanges', () => {
    // v3 silently dropped two keys and broke a consumer at import time. Every
    // version from v2 on must have an entry, so a bump cannot skip the record.
    const { payload } = buildFixturePayload();
    const documented = Object.keys(payload.schemaChanges);

    for (let v = 2; v <= payload.schemaVersion; v++) {
      expect(documented).toContain(`v${v}`);
    }
  });
});
