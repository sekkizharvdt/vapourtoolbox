/**
 * One-time backfill: retitle tasks generated from meeting action items.
 *
 * Before this fix, `finalizeMeeting` titled each generated task by the action
 * item's `action` (the disposition — "To be implemented in toolbox") and put the
 * `description` (the subject discussed) in the task body. A meeting whose rows
 * share one disposition produced N identically-titled tasks, unreadable on the
 * Team Board.
 *
 * This script walks meetingActionItems that generated a task, recomputes
 * title/description with the same rule the app now uses (subject → title,
 * disposition → body), and rewrites only the tasks that still hold the old
 * shape. Idempotent: a second run finds nothing to change.
 *
 * Usage:
 *   node scripts/backfill-meeting-task-titles.js           # dry run (default)
 *   node scripts/backfill-meeting-task-titles.js --apply   # write changes
 *
 * Needs GOOGLE_APPLICATION_CREDENTIALS, or a service-account key path as
 * SERVICE_ACCOUNT_KEY.
 */

const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const MANUAL_TASKS = 'manualTasks';
const MEETING_ACTION_ITEMS = 'meetingActionItems';
const BATCH_LIMIT = 500; // rule 20

if (!admin.apps.length) {
  const keyPath = process.env.SERVICE_ACCOUNT_KEY;
  admin.initializeApp(
    keyPath
      ? { credential: admin.credential.cert(require(require('path').resolve(keyPath))) }
      : { credential: admin.credential.applicationDefault() }
  );
}
const db = admin.firestore();

/** Mirror of buildTaskContent in apps/web/src/lib/tasks/meetingService.ts */
function buildTaskContent(item) {
  const subject = (item.description ?? '').trim();
  const disposition = (item.action ?? '').trim();

  if (!subject) return { title: disposition };
  if (!disposition || disposition === subject) return { title: subject };
  return { title: subject, description: disposition };
}

async function main() {
  const itemsSnap = await db.collection(MEETING_ACTION_ITEMS).get();
  const linked = itemsSnap.docs.filter((d) => d.data().generatedTaskId);
  console.log(`${itemsSnap.size} action items, ${linked.length} with a generated task`);

  const changes = [];

  for (const itemDoc of linked) {
    const item = itemDoc.data();
    const taskRef = db.collection(MANUAL_TASKS).doc(item.generatedTaskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
      console.log(`  skip ${item.generatedTaskId} — task no longer exists`);
      continue;
    }

    const task = taskSnap.data();
    const { title, description } = buildTaskContent(item);
    if (!title) {
      console.log(`  skip ${taskRef.id} — action item has neither description nor action`);
      continue;
    }
    if (task.title === title && (task.description ?? undefined) === description) continue;

    changes.push({
      ref: taskRef,
      from: { title: task.title, description: task.description },
      to: { title, description },
      meetingTitle: task.meetingTitle,
    });
  }

  if (changes.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  console.log(`\n${changes.length} task(s) to retitle:`);
  for (const c of changes) {
    console.log(`  [${c.meetingTitle ?? 'no meeting'}] ${c.ref.id}`);
    console.log(`    title:       "${c.from.title}" -> "${c.to.title}"`);
    console.log(`    description: "${c.from.description ?? ''}" -> "${c.to.description ?? ''}"`);
  }

  if (!APPLY) {
    console.log('\nDry run — re-run with --apply to write these changes.');
    return;
  }

  for (let i = 0; i < changes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const c of changes.slice(i, i + BATCH_LIMIT)) {
      batch.update(c.ref, {
        title: c.to.title,
        // rule 12: clear rather than write undefined when the body collapses away
        description: c.to.description ?? admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
    await batch.commit();
  }
  console.log(`\nUpdated ${changes.length} task(s).`);
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
