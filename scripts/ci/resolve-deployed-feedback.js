#!/usr/bin/env node
/**
 * Resolve the feedback items whose fixes just went live.
 *
 * Run by the Deploy - Production workflow immediately after the `prod-deployed`
 * tag moves. It reads the commit range that just shipped, pulls `Feedback: <id>`
 * trailers out of the messages, and moves those items to `resolved`.
 *
 * WHY THIS IS A DEPLOY STEP AND NOT A HUMAN ONE
 *
 * `resolved` used to be set by hand at commit time and it notifies the reporter,
 * so people were told an item was fixed while the code was still sitting
 * unshipped. They tested, it was still broken, and they reopened it — three
 * items went that way before this existed. A deploy is the only event that can
 * truthfully say "this is live", and it already computes the exact commit range
 * to pick its targets. So the deploy says it, not a person.
 *
 * Usage: node scripts/ci/resolve-deployed-feedback.js <baseRef> <headRef>
 *   --dry-run   print what would change and write nothing
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS, already set in the deploy job.
 *
 * Never fails the workflow. The deploy has already succeeded by the time this
 * runs; a tracker update must not turn a good deploy red (rule 27) — it warns
 * and exits 0.
 */

const { execFileSync } = require('node:child_process');
const admin = require('firebase-admin');

const FEEDBACK_ID = /^[A-Za-z0-9]{20}$/;
/** Statuses we may move to `resolved`. Anything else is left alone. */
const RESOLVABLE = new Set(['new', 'in_progress']);

function parseArgs(argv) {
  const args = argv.filter((a) => a !== '--dry-run');
  return { base: args[2], head: args[3] || 'HEAD', dryRun: argv.includes('--dry-run') };
}

/** Feedback ids cited by the commits in base..head, in first-seen order. */
function collectFeedbackIds(base, head) {
  const log = execFileSync('git', ['log', `${base}..${head}`, '--format=%B%x00'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  const ids = new Map(); // id -> first subject that cited it
  for (const message of log.split('\0')) {
    const subject = message.trim().split('\n')[0];
    for (const line of message.split('\n')) {
      const match = line.match(/^Feedback:\s*(\S+)\s*$/i);
      if (!match) continue;
      const id = match[1];
      // commitlint blocks malformed ids at commit time, but history predating
      // that rule still has to pass through here without throwing.
      if (!FEEDBACK_ID.test(id)) {
        console.warn(`  skipping malformed feedback id "${id}" (from "${subject}")`);
        continue;
      }
      if (!ids.has(id)) ids.set(id, subject);
    }
  }
  return ids;
}

async function main() {
  const { base, head, dryRun } = parseArgs(process.argv);
  if (!base) {
    console.error('usage: resolve-deployed-feedback.js <baseRef> [headRef] [--dry-run]');
    process.exit(2);
  }

  const ids = collectFeedbackIds(base, head);
  console.log(`Feedback ids cited in ${base}..${head}: ${ids.size || 'none'}`);
  if (ids.size === 0) return;

  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();

  const runUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined;
  const sha = execFileSync('git', ['rev-parse', head], { encoding: 'utf8' }).trim();

  for (const [id, subject] of ids) {
    try {
      const ref = db.collection('feedback').doc(id);
      const snap = await ref.get();

      if (!snap.exists) {
        console.warn(`  ${id} — no such feedback item (cited by "${subject}")`);
        continue;
      }

      const status = snap.data().status;
      if (!RESOLVABLE.has(status)) {
        // Already resolved, or closed by the reporter — both are further along
        // than we are. Never drag an item backwards.
        console.log(`  ${id} — leaving as "${status}"`);
        continue;
      }

      if (dryRun) {
        console.log(`  ${id} — would resolve (currently "${status}")`);
        continue;
      }

      await ref.update({
        status: 'resolved',
        resolvedByDeploySha: sha,
        ...(runUrl && { resolvedByDeployRun: runUrl }),
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ${id} — resolved (was "${status}")`);
    } catch (error) {
      // One bad item must not stop the rest.
      console.warn(`  ${id} — could not update: ${error instanceof Error ? error.message : error}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.warn(
      `::warning title=Feedback not resolved::${error instanceof Error ? error.message : error}`
    );
    process.exit(0);
  });
