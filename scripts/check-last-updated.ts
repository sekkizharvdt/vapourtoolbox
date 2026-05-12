#!/usr/bin/env tsx
/**
 * Check that APP_META.LAST_UPDATED in @vapour/constants is not stale.
 *
 * Stale = more than MAX_DAYS_STALE behind HEAD's commit date.
 *
 * Exit codes:
 *   0  fresh (within window)
 *   1  stale (CI should fail or developer should bump)
 *   2  script error
 *
 * Run: pnpm check:last-updated
 *
 * Wire into CI to enforce that every release-bearing PR also bumps the
 * user-facing version date. Wire into husky pre-push for local enforcement.
 */

import { execSync } from 'node:child_process';
import { APP_META } from '../packages/constants/src';

const MAX_DAYS_STALE = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

try {
  const headIsoDate = execSync('git log -1 --format=%cI HEAD', { encoding: 'utf8' }).trim();
  if (!headIsoDate) {
    console.error('check-last-updated: could not read HEAD commit date');
    process.exit(2);
  }

  const headDate = new Date(headIsoDate);
  const lastUpdated = new Date(`${APP_META.LAST_UPDATED}T00:00:00Z`);

  if (Number.isNaN(headDate.getTime()) || Number.isNaN(lastUpdated.getTime())) {
    console.error('check-last-updated: invalid date format');
    console.error(`  HEAD: ${headIsoDate}`);
    console.error(`  APP_META.LAST_UPDATED: ${APP_META.LAST_UPDATED}`);
    process.exit(2);
  }

  const daysBehind = Math.floor((headDate.getTime() - lastUpdated.getTime()) / MS_PER_DAY);

  if (daysBehind > MAX_DAYS_STALE) {
    console.error(
      `check-last-updated: APP_META.LAST_UPDATED is ${daysBehind} days behind HEAD (limit ${MAX_DAYS_STALE}).`
    );
    console.error(`  APP_META.LAST_UPDATED:        ${APP_META.LAST_UPDATED}`);
    console.error(`  HEAD commit date:              ${headDate.toISOString().slice(0, 10)}`);
    console.error('');
    console.error('Bump APP_META.LAST_UPDATED in packages/constants/src/config.ts');
    console.error('and add a release entry to packages/constants/src/changelog.ts.');
    console.error('Then run `pnpm changelog:sync`.');
    process.exit(1);
  }

  console.log(
    `check-last-updated: ok (LAST_UPDATED=${APP_META.LAST_UPDATED}, HEAD=${headDate
      .toISOString()
      .slice(0, 10)}, ${daysBehind}d behind, limit ${MAX_DAYS_STALE}d)`
  );
  process.exit(0);
} catch (err) {
  console.error('check-last-updated: error', err);
  process.exit(2);
}
