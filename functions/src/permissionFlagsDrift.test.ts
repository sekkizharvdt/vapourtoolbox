/**
 * Permission-flags drift test (known-gaps 2.6).
 *
 * The functions bundle deploys standalone via npm (`firebase deploy` runs
 * `npm ci` inside functions/), so it cannot import @vapour/constants — the
 * PERMISSION_FLAGS map used to mint custom claims is hand-duplicated in
 * userManagement.ts. This test reads BOTH source files from disk and fails
 * on any divergence (flag added, removed, or re-numbered), so drift breaks CI
 * instead of silently minting wrong claims.
 */

import * as fs from 'fs';
import * as path from 'path';

const FUNCTIONS_COPY = path.join(__dirname, 'userManagement.ts');
const CANONICAL = path.join(__dirname, '../../packages/constants/src/permissions.ts');

/**
 * Extract the PERMISSION_FLAGS object literal from a TS source file and
 * return a { FLAG_NAME: numericValue } map. Only matches uncommented
 * `NAME: 1 << n` or `NAME: <number>` entries inside the first
 * `PERMISSION_FLAGS = {` ... `}` block.
 */
function parsePermissionFlags(filePath: string): Record<string, number> {
  const source = fs.readFileSync(filePath, 'utf8');
  const blockMatch = source.match(/PERMISSION_FLAGS\s*=\s*\{([\s\S]*?)\n\}/);
  if (!blockMatch || !blockMatch[1]) {
    throw new Error(`PERMISSION_FLAGS block not found in ${filePath}`);
  }
  const flags: Record<string, number> = {};
  for (const line of blockMatch[1].split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    const entry = trimmed.match(/^([A-Z][A-Z0-9_]*)\s*:\s*(?:1\s*<<\s*(\d+)|(\d+))\s*,?/);
    if (!entry) continue;
    const name = entry[1] as string;
    const value = entry[2] !== undefined ? 1 << Number(entry[2]) : Number(entry[3]);
    flags[name] = value;
  }
  if (Object.keys(flags).length === 0) {
    throw new Error(`No permission flags parsed from ${filePath}`);
  }
  return flags;
}

/**
 * Extract the flag names OR-ed into a preset expression, e.g.
 *   const VIEWER_PRESET = PERMISSION_FLAGS.VIEW_PROJECTS | PERMISSION_FLAGS.VIEW_ENTITIES ...
 * or the VIEWER entry of PERMISSION_PRESETS.
 */
function parsePresetFlagNames(filePath: string, presetPattern: RegExp): string[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(presetPattern);
  if (!match || !match[1]) {
    throw new Error(`Preset expression not found in ${filePath} (pattern: ${presetPattern})`);
  }
  const names = [...match[1].matchAll(/PERMISSION_FLAGS\.([A-Z][A-Z0-9_]*)/g)].map(
    (m) => m[1] as string
  );
  if (names.length === 0) {
    throw new Error(`No flags parsed from preset expression in ${filePath}`);
  }
  return names;
}

describe('PERMISSION_FLAGS drift (functions copy vs packages/constants)', () => {
  const canonical = parsePermissionFlags(CANONICAL);
  const functionsCopy = parsePermissionFlags(FUNCTIONS_COPY);

  it('every flag in the functions copy exists in packages/constants with the same value', () => {
    const mismatches: string[] = [];
    for (const [name, value] of Object.entries(functionsCopy)) {
      if (!(name in canonical)) {
        mismatches.push(`${name} exists in functions/src/userManagement.ts but not in canonical`);
      } else if (canonical[name] !== value) {
        mismatches.push(`${name}: functions copy = ${value}, canonical = ${canonical[name]}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every canonical flag exists in the functions copy (new flags must be synced)', () => {
    const missing = Object.keys(canonical).filter((name) => !(name in functionsCopy));
    expect(missing).toEqual([]);
  });

  it('sanity: parsers found a plausible number of flags', () => {
    // Guards against a regex change silently matching nothing meaningful.
    expect(Object.keys(canonical).length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(functionsCopy).length).toBeGreaterThanOrEqual(20);
  });

  it('VIEWER_PRESET matches PERMISSION_PRESETS.VIEWER bit-for-bit', () => {
    const functionsPresetNames = parsePresetFlagNames(
      FUNCTIONS_COPY,
      /const\s+VIEWER_PRESET\s*=\s*([\s\S]*?);/
    );
    const canonicalPresetNames = parsePresetFlagNames(
      CANONICAL,
      /VIEWER\s*:\s*([\s\S]*?)(?:,\s*\n\}|\}\s*as\s+const)/
    );

    const toValue = (names: string[], flags: Record<string, number>) =>
      names.reduce((acc, n) => {
        if (!(n in flags)) throw new Error(`Preset references unknown flag ${n}`);
        return acc | (flags[n] as number);
      }, 0);

    expect(toValue(functionsPresetNames, functionsCopy)).toBe(
      toValue(canonicalPresetNames, canonical)
    );
  });

  it('accountBalances.ts inline MANAGE_ACCOUNTING constant matches canonical', () => {
    const source = fs.readFileSync(path.join(__dirname, 'accountBalances.ts'), 'utf8');
    const match = source.match(/const\s+MANAGE_ACCOUNTING\s*=\s*1\s*<<\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(1 << Number(match![1])).toBe(canonical.MANAGE_ACCOUNTING);
  });
});
