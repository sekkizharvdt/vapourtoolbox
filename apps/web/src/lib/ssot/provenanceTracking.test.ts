import { resolveProvenanceOnUpdate } from './provenanceTracking';
import type { SSOTProvenance } from '@vapour/types';

const generated: SSOTProvenance = { source: 'MED_DESIGN', generatedKey: 'stream:S1' };

describe('resolveProvenanceOnUpdate', () => {
  it('records the fields a user edited on a generated record', () => {
    const result = resolveProvenanceOnUpdate(generated, {
      description: 'Renamed by engineer',
      temperature: 68,
    });

    expect(result?.manualOverrides).toEqual(['description', 'temperature']);
    expect(result?.generatedKey).toBe('stream:S1'); // identity preserved
  });

  it('accumulates overrides across successive edits', () => {
    const afterFirst = resolveProvenanceOnUpdate(generated, { description: 'x' })!;
    const afterSecond = resolveProvenanceOnUpdate(afterFirst, { temperature: 60 })!;

    expect(afterSecond.manualOverrides).toEqual(['description', 'temperature']);
  });

  it('takes the provenance verbatim when the sync supplies one', () => {
    const syncProvenance: SSOTProvenance = {
      source: 'MED_DESIGN',
      generatedKey: 'stream:S1',
      manualOverrides: ['description'],
    };

    const result = resolveProvenanceOnUpdate(generated, {
      temperature: 60,
      provenance: syncProvenance,
    });

    // The sync owns the value — the update must not add `temperature` as an override,
    // or the generator would lock itself out of its own field.
    expect(result).toBe(syncProvenance);
  });

  it('leaves hand-entered records alone', () => {
    const manual: SSOTProvenance = { source: 'MANUAL' };

    expect(resolveProvenanceOnUpdate(manual, { temperature: 60 })).toBeUndefined();
    expect(resolveProvenanceOnUpdate(undefined, { temperature: 60 })).toBeUndefined();
  });

  it('does not treat bookkeeping fields as engineering edits', () => {
    const result = resolveProvenanceOnUpdate(generated, {
      updatedAt: 'now',
      updatedBy: 'user-1',
      createdAt: 'then',
      id: 'abc',
      projectId: 'p1',
    });

    expect(result).toBeUndefined();
  });

  it('ignores undefined values in the payload', () => {
    const result = resolveProvenanceOnUpdate(generated, {
      description: undefined,
      temperature: 60,
    });

    expect(result?.manualOverrides).toEqual(['temperature']);
  });

  it('returns undefined when the same field is edited twice (no pointless write)', () => {
    const afterFirst = resolveProvenanceOnUpdate(generated, { description: 'x' })!;
    const afterSecond = resolveProvenanceOnUpdate(afterFirst, { description: 'y' });

    expect(afterSecond).toBeUndefined();
  });
});
