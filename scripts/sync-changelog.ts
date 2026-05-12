#!/usr/bin/env tsx
/**
 * Sync root CHANGELOG.md from the typed source at
 * packages/constants/src/changelog.ts.
 *
 * Run: pnpm changelog:sync
 *
 * CHANGELOG.md is regenerated on each run — do not edit it by hand.
 * Add new releases to changelog.ts instead.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHANGELOG, APP_META, type ChangeType } from '../packages/constants/src';

const TYPE_HEADINGS: Record<ChangeType, string> = {
  feature: 'Added',
  improvement: 'Changed',
  fix: 'Fixed',
  removed: 'Removed',
};

const ORDER: ChangeType[] = ['feature', 'improvement', 'fix', 'removed'];

function renderEntry(entry: (typeof CHANGELOG)[number]): string {
  const lines: string[] = [];
  const header = entry.title
    ? `## [${entry.version}] — ${entry.date} — ${entry.title}`
    : `## [${entry.version}] — ${entry.date}`;
  lines.push(header, '');

  for (const type of ORDER) {
    const items = entry.changes.filter((c) => c.type === type);
    if (items.length === 0) continue;
    lines.push(`### ${TYPE_HEADINGS[type]}`, '');
    for (const item of items) {
      lines.push(`- ${item.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function render(): string {
  const header = [
    '# Changelog',
    '',
    `All notable changes to **${APP_META.NAME}**.`,
    '',
    'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
    '',
    '> This file is generated from `packages/constants/src/changelog.ts`. Run `pnpm changelog:sync` to regenerate.',
    '',
  ].join('\n');

  const entries = CHANGELOG.map(renderEntry).join('\n');
  return `${header}\n${entries}`;
}

const outputPath = resolve(__dirname, '..', 'CHANGELOG.md');
writeFileSync(outputPath, render(), 'utf8');
console.log(`Wrote ${outputPath} (${CHANGELOG.length} releases)`);
