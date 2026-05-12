#!/usr/bin/env tsx
/**
 * Cut a new release.
 *
 * Reads conventional commits since the last `v*` tag, groups them by type,
 * prepends a draft entry to packages/constants/src/changelog.ts, bumps
 * APP_META.VERSION + the three package.json files, and regenerates CHANGELOG.md.
 *
 * Does NOT commit, tag, or push. Review the diff, hand-edit any unclear
 * entries, then commit + tag manually.
 *
 *   pnpm release:cut <version | --patch | --minor | --major>
 *
 * Examples:
 *   pnpm release:cut 1.7.0
 *   pnpm release:cut --minor    # 1.6.0 → 1.7.0
 *   pnpm release:cut --patch    # 1.6.0 → 1.6.1
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_META, type ChangeType } from '../packages/constants/src';

const TYPE_MAP: Record<string, ChangeType> = {
  feat: 'feature',
  feature: 'feature',
  fix: 'fix',
  bugfix: 'fix',
  hotfix: 'fix',
  perf: 'improvement',
  refactor: 'improvement',
  chore: 'improvement',
  style: 'improvement',
  docs: 'improvement',
  test: 'improvement',
  ci: 'improvement',
  build: 'improvement',
  revert: 'removed',
};

const TYPE_ORDER: ChangeType[] = ['feature', 'improvement', 'fix', 'removed'];

interface ParsedCommit {
  type: ChangeType;
  description: string;
  breaking: boolean;
  raw: string;
}

function bumpVersion(current: string, kind: 'patch' | 'minor' | 'major'): string {
  const parts = current.split('.').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Cannot parse current version: ${current}`);
  }
  const [maj, min, patch] = parts as [number, number, number];
  switch (kind) {
    case 'patch':
      return `${maj}.${min}.${patch + 1}`;
    case 'minor':
      return `${maj}.${min + 1}.0`;
    case 'major':
      return `${maj + 1}.0.0`;
  }
}

function parseArgs(): { version: string } {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: pnpm release:cut <version | --patch | --minor | --major>');
    process.exit(1);
  }
  const current = APP_META.VERSION;
  let target: string;
  if (arg === '--patch') target = bumpVersion(current, 'patch');
  else if (arg === '--minor') target = bumpVersion(current, 'minor');
  else if (arg === '--major') target = bumpVersion(current, 'major');
  else if (/^\d+\.\d+\.\d+$/.test(arg)) target = arg;
  else {
    console.error(`Invalid version arg: ${arg}`);
    console.error('Expected: semver like 1.7.0, or --patch/--minor/--major');
    process.exit(1);
  }
  if (target === current) {
    console.error(`Target version ${target} equals current version. Bump higher.`);
    process.exit(1);
  }
  return { version: target };
}

function lastReleaseTag(): string | null {
  try {
    return execSync('git describe --tags --abbrev=0 --match "v*"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function commitsSince(ref: string | null): string[] {
  const range = ref ? `${ref}..HEAD` : 'HEAD';
  const out = execSync(`git log ${range} --format=%s --no-merges`, { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function capitaliseScope(scope: string): string {
  return scope
    .split(',')
    .map((s) => s.trim())
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(', ');
}

function parseCommit(raw: string): ParsedCommit {
  const match = raw.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?(!?):\s+(.+)$/);
  if (!match) {
    return { type: 'improvement', description: raw, breaking: false, raw };
  }
  const [, typeKey, scope, bang, descRest] = match;
  const type = TYPE_MAP[typeKey!.toLowerCase()] ?? 'improvement';
  const breaking = bang === '!';
  const description = scope ? `${capitaliseScope(scope)}: ${descRest}` : (descRest ?? raw);
  return { type, description, breaking, raw };
}

function quote(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function buildEntry(version: string, today: string, commits: ParsedCommit[]): string {
  const byType = new Map<ChangeType, ParsedCommit[]>();
  for (const t of TYPE_ORDER) byType.set(t, []);
  for (const c of commits) byType.get(c.type)!.push(c);

  const lines: string[] = [];
  lines.push('  {');
  lines.push(`    version: ${quote(version)},`);
  lines.push(`    date: ${quote(today)},`);
  lines.push('    // TODO: add a one-line theme/title for this release, then delete this line');
  lines.push('    // title: \'Release title here\',');
  lines.push('    changes: [');
  for (const type of TYPE_ORDER) {
    const items = byType.get(type)!;
    if (items.length === 0) continue;
    lines.push(`      // ${type} (${items.length})`);
    for (const c of items) {
      const prefix = c.breaking ? '[BREAKING] ' : '';
      lines.push(
        `      { type: ${quote(type)}, description: ${quote(prefix + c.description)} },`,
      );
    }
  }
  lines.push('    ],');
  lines.push('  },');
  return lines.join('\n');
}

function updateChangelogTs(entry: string): void {
  const path = resolve(__dirname, '..', 'packages/constants/src/changelog.ts');
  const src = readFileSync(path, 'utf8');
  const marker = 'export const CHANGELOG: ChangelogEntry[] = [';
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error('Could not find CHANGELOG marker in changelog.ts');
  const insertPoint = idx + marker.length;
  const updated = src.slice(0, insertPoint) + '\n' + entry + src.slice(insertPoint);
  writeFileSync(path, updated, 'utf8');
}

function updateVersionInConfig(version: string): void {
  const path = resolve(__dirname, '..', 'packages/constants/src/config.ts');
  const src = readFileSync(path, 'utf8');
  const updated = src.replace(/(VERSION:\s*)'[^']+'/, `$1'${version}'`);
  if (updated === src) throw new Error('Could not update VERSION in config.ts');
  writeFileSync(path, updated, 'utf8');
}

function updatePackageJson(relPath: string, version: string): void {
  const path = resolve(__dirname, '..', relPath);
  const json = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  json.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf8');
}

function regenerateChangelogMd(): void {
  execSync('pnpm changelog:sync', { stdio: 'inherit' });
}

function main(): void {
  const { version } = parseArgs();
  const tag = lastReleaseTag();
  const commits = commitsSince(tag).map(parseCommit);

  if (commits.length === 0) {
    console.error(
      `No commits found since ${tag ?? 'beginning of history'}. Nothing to release.`,
    );
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const entry = buildEntry(version, today, commits);

  updateChangelogTs(entry);
  updateVersionInConfig(version);
  updatePackageJson('package.json', version);
  updatePackageJson('apps/web/package.json', version);
  updatePackageJson('functions/package.json', version);
  regenerateChangelogMd();

  const breakdown = TYPE_ORDER.map((t) => {
    const count = commits.filter((c) => c.type === t).length;
    return count > 0 ? `${count} ${t}` : null;
  })
    .filter(Boolean)
    .join(', ');

  console.log('');
  console.log(
    `release:cut: drafted v${version} from ${commits.length} commit(s) since ${
      tag ?? 'start of history'
    } (${breakdown}).`,
  );
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open packages/constants/src/changelog.ts');
  console.log('       - add a release title');
  console.log('       - rewrite any unclear / duplicate / internal-only entries');
  console.log('  2. Run `pnpm changelog:sync` if you edit changelog.ts');
  console.log(`  3. git add -A && git commit -m "chore(release): v${version} — <theme>"`);
  console.log(`  4. git tag -a v${version} -m "v${version}"`);
  console.log('  5. git push origin main --tags  (when ready)');
}

main();
