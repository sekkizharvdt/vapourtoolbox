/**
 * Recent console errors, for attaching to bug reports.
 *
 * The form currently tells users to press F12, open the Console tab, and copy
 * what they find. That yields console errors on 21% of bug reports overall and
 * 2% from one of the two main reporters — yet when present it was the single
 * most decisive field available: feedback 3GMR5oij carried the exact
 * AuthorizationError and was root-caused in minutes.
 *
 * So the errors are captured automatically instead. Phase B2 of
 * docs/reviews/2026-08-07-feedback-intake-plan.md.
 *
 * Scope is deliberately narrow. Only error-level output is captured —
 * console.log and console.warn are chattier and far more likely to carry
 * ordinary business data. Nothing here inspects network payloads or request
 * bodies. Entries are truncated and the buffer is capped, so a noisy loop
 * cannot grow unbounded or push a huge string into Firestore.
 */

/** Most recent entries kept. Enough for a stack plus its lead-up. */
const MAX_ENTRIES = 10;

/** Per-entry character cap — long enough for a stack trace, short of a dump. */
const MAX_ENTRY_LENGTH = 800;

/** Overall cap on what gets attached to a report. */
const MAX_TOTAL_LENGTH = 4000;

interface BufferedError {
  at: string;
  text: string;
}

const buffer: BufferedError[] = [];
let installed = false;

function push(text: string): void {
  const clean = text.trim();
  if (!clean) return;

  buffer.push({
    at: new Date().toISOString(),
    text: clean.length > MAX_ENTRY_LENGTH ? `${clean.slice(0, MAX_ENTRY_LENGTH - 1)}…` : clean,
  });

  // Ring: drop the oldest rather than growing.
  while (buffer.length > MAX_ENTRIES) buffer.shift();
}

/** Render a console argument without throwing on circular structures. */
function stringifyArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack ?? ''}`;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/**
 * Start capturing. Safe to call more than once — only the first call patches.
 *
 * console.error is wrapped rather than replaced: the original is always called,
 * so devtools behaviour and any other logging are unchanged.
 */
export function installConsoleErrorCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const original = console.error;
  console.error = (...args: unknown[]) => {
    try {
      push(args.map(stringifyArg).join(' '));
    } catch {
      // Capture must never break logging.
    }
    original.apply(console, args as Parameters<typeof console.error>);
  };

  window.addEventListener('error', (event) => {
    push(
      event.error instanceof Error
        ? `${event.error.name}: ${event.error.message}\n${event.error.stack ?? ''}`
        : `${event.message} (${event.filename}:${event.lineno})`
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    push(
      `Unhandled promise rejection: ${
        reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : stringifyArg(reason)
      }`
    );
  });
}

/**
 * The captured errors, oldest first, as text for the report.
 * Returns '' when nothing was captured.
 */
export function getRecentConsoleErrors(): string {
  if (buffer.length === 0) return '';

  const text = buffer.map((e) => `[${e.at}] ${e.text}`).join('\n\n');
  return text.length > MAX_TOTAL_LENGTH ? text.slice(-MAX_TOTAL_LENGTH) : text;
}

/** Number of captured entries, for showing the user what will be attached. */
export function getConsoleErrorCount(): number {
  return buffer.length;
}

/** Test seam — clears the buffer and lets install run again. */
export function __resetConsoleErrorBufferForTests(): void {
  buffer.length = 0;
  installed = false;
}
