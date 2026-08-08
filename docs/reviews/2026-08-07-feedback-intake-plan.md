# Feedback intake — make bug reports diagnosable

**Status:** COMPLETE — A (a7f4e0c0), D (c78d5e6e), B1 (e308c06b), C (af06b1ba), B2 (622ee8f1).
Not yet deployed; ships on the next Deploy dispatch.
**Date:** 2026-08-07
**Origin:** trend analysis over all 289 feedback records, run while working the
2026-08-04→06 feedback batch (see "Evidence" below).

The feedback system collects plenty of records and very little that helps fix
anything. This plan changes what is collected and closes the reply loop, so the
next 289 reports cost less to triage than the last.

---

## Evidence

Measured across all 289 records (168 bugs, 121 features) on 2026-08-07.

### Fill rates are not what they look like

The 100% fields are automatic or derived, not user effort:

| Field              | Bugs | Reality                                                  |
| ------------------ | ---- | -------------------------------------------------------- |
| `pageUrl`          | 100% | auto-captured from `document.referrer`                   |
| `browserInfo`      | 100% | auto-captured from `navigator`                           |
| `priority`         | 100% | **derived, never chosen** — see below                    |
| `screenshotUrls`   | 88%  | user-supplied ✅                                         |
| `module`           | 82%  | user-supplied (selector, auto-prefilled) ✅              |
| `severity`         | 49%  | of those set, **94% are `critical`** — no discrimination |
| `expectedBehavior` | 48%  | user-supplied                                            |
| `actualBehavior`   | 48%  | user-supplied                                            |
| `consoleErrors`    | 21%  | user-supplied, requires opening devtools                 |
| `stepsToReproduce` | 3%   | effectively dead                                         |

`priority` is written as `formData.type === 'bug' ? 'medium' : 'low'`
([FeedbackForm/index.tsx:203](../../apps/web/src/components/common/FeedbackForm/index.tsx)).
The stored distribution is exactly `medium:168 / low:121`, matching the
bug/feature split. It encodes nothing beyond `type`.

### Half of all bug reports carry no user-supplied diagnostics

Of the four diagnostic fields (`pageUrl`, `stepsToReproduce`, `actualBehavior`,
`consoleErrors`):

- **51%** of bugs have exactly one — and it is always the auto-captured `pageUrl`
- **2%** (3 of 168) have all four
- **67%** are "screenshot, no steps, no console"

Median bug description is 197 characters; a third are under 120.

### The record under discussion is usually unidentifiable

- **1%** of bug reports name a document number in the text
- **22%** are identifiable via the `pageUrl`
- **77%** are neither — the record must be inferred from a screenshot or guessed

### The feature form asks two questions and is ignored

`FeatureRequestSection` has exactly two inputs, both optional:

| Question                              | Answered      |
| ------------------------------------- | ------------- |
| Use Case (`stepsToReproduce`)         | 20/122 (16%)  |
| Expected Outcome (`expectedBehavior`) | 21/122 (17%)  |
| **Neither**                           | **101 (83%)** |

`pageUrl` is captured on only 20 of 122 features — it is treated as bug-only, so
the screen that prompted the idea is lost.

### Reporting style differs sharply by person

| Reporter | bugs | steps | actual | console | screenshots |
| -------- | ---- | ----- | ------ | ------- | ----------- |
| Kumaran  | 97   | 2%    | 80%    | 33%     | 91%         |
| Revathi  | 65   | 0%    | 0%     | 2%      | 86%         |

Not a criticism — it is the input any triage process has to work with.

### What actually mattered when fixing four of these bugs

- `3GMR5oij` — `consoleErrors` carried the exact `AuthorizationError`; root-caused
  in minutes. That field is present only 21% of the time.
- `jRO7w8mg` — `pageUrl` contained the PO document id. Straight to the record.
- `pznSBK4c` — description said only "Max office". The bill number
  (`TC2IN/2627/133`) had to be read off a downloaded screenshot.

**Conclusion: every field that works is automatic or visual. Every field
requiring the user to type structured diagnostic detail fails.** Design to that.

---

## Phase A — Close the reply loop

> **DONE — commit a7f4e0c0.**
>
> **Corrected 2026-08-07 after reading the code.** An earlier draft of this plan
> claimed nothing notifies anyone in either direction, and proposed reusing
> `createNotification`. Both were wrong. The gap is real but narrower, and
> `createNotification` is the wrong service — see below.

### What already works

`onFeedbackResolved`
([functions/src/feedback.ts](../../functions/src/feedback.ts), exported from
`functions/src/index.ts`, deployed) fires when a feedback document's status
changes **to `resolved`**. It creates a `FEEDBACK_RESOLUTION_CHECK` task
notification for the reporter and **includes `adminNotes` in the message**.

The live notification path is:

`createTaskNotification` (`lib/tasks/taskNotificationService.ts`) →
`taskNotifications` → `subscribeToUserTasks` (`lib/tasks/channelService.ts`) →
`/flow/inbox`.

The `feedback` channel is already registered with both categories
([packages/types/src/task.ts](../../packages/types/src/task.ts)):
`categories: ['FEEDBACK_RESOLUTION_CHECK', 'FEEDBACK_REOPENED']`.

### Do NOT use `createNotification`

`lib/notifications/` writes `COLLECTIONS.NOTIFICATIONS` and is **dead**: no
callers anywhere, `NotificationCenter` is never mounted, and the
`NotificationType` union in `packages/types/src/notification.ts` is referenced
only by its own file. The AppBar bell
([AppBar.tsx:193](../../apps/web/src/components/dashboard/AppBar.tsx)) is a
static icon with no `onClick` and no data source. Writing there produces an
invisible notification — worse than none, because it looks done.

This is a rule 32 artifact (three notification systems, two dead). Cleaning it
up is out of scope here but worth its own item.

### What is actually missing

**A1 — the reporter is not told when a question is asked mid-flight.** Notes
added while the status is `new` or `in_progress` reach nobody; only the
`resolved` transition notifies. This is exactly what happened on `2CzHpyR8` on
2026-08-07: questions were posted for Revathi and she has no way to know.
Needs a new category (`FEEDBACK_QUESTION_ASKED`, actionable) added to
`TaskNotificationCategory` **and** to the `feedback` channel's `categories`
array, or it will not route to a channel.

**A2 — admins are not told when a reporter replies.** The TODO at
[feedbackTaskService.ts:132-134](../../apps/web/src/lib/feedback/feedbackTaskService.ts)
is real. `FEEDBACK_REOPENED` is already defined and already registered on the
channel but **never used** — this is its slot, so A2 needs no type changes at
all. Recipients via `getUsersWithPermission` (`lib/auth/userLookup.ts`).

No new collection, so no new Firestore rules or indexes are required.

- **Effort:** small (smaller than first estimated — A2 is pure wiring)
- **Risk:** low
- **Decision needed:** who counts as "admin" for A2

## Phase D — Rebuild the request form to actually collect

> **DONE — commit c78d5e6e.** Two corrections found while implementing, both
> recorded below.

Placed before B/C because 122 feature requests currently arrive unrankable, and
every new one adds to that.

**D1 — make one substantive question required, not two optional ones.** Two
optional boxes yield 17%; one required box yields 100%. Recommend requiring
**Use Case** and folding Expected Outcome into the description. Requiring both
risks abandonment and junk input. — _Done: Use Case required, Expected Outcome
removed._

**D2 — capture `pageUrl` for features.** ~~Already free from the referrer~~ —
**this was wrong.** `/feedback` is a page reached by client-side navigation, and
Next.js does not set `document.referrer` on a client-side route change, so it is
empty for most submissions. Bugs reach 100% only because the field is rendered
and required and users paste it by hand; features sat at 16% precisely because
nothing asked.

_Done via `RouteTracker` (`components/common/RouteTracker.tsx`) recording the
route into sessionStorage on every navigation, read back by
`lib/feedback/lastAppRoute.ts`. sessionStorage rather than context because the
command palette opens `/feedback` in a new tab, which is a full page load._

_This also fixed module auto-detection, which fell back to
`detectModuleFromUrl(window.location.href)` — the URL of `/feedback` itself —
whenever the referrer was empty._

**D3 — reuse the B1 record identifier** for features. "This on _this_ PO screen"
beats "PO Dashboard".

**D4 — ~~add~~ enforce a prioritisation signal.** The claim that there is
nothing to rank requests by was **wrong**: `FeedbackImpact` / `IMPACT_OPTIONS`
already existed, were already rendered as a "Feature Priority" select, and were
already written to Firestore — just optional, and set on only 50 of 122
requests. So this was enforcement, not new machinery.

_Done: Impact is now required. `frequency` is the equivalent for bugs (49% set)
and is left optional for now — bugs already have `pageUrl`, screenshots and
(after B2) console errors carrying the diagnostic weight._

- **Effort:** small–medium
- **Risk:** required fields causing abandonment. Mitigation: require exactly one.

## Phase B1 — Capture the record identifier

> **DONE — commit e308c06b.**

The highest diagnostic win per line of code, and cheaper than it first appears:
`pageUrl` is already captured 100% of the time and, for detail pages, already
contains the document id. This is parse + resolve, not new plumbing.

Extract the id from the referrer, resolve it to a human-readable document number
(`BILL-2627-0029`, `TC2IN/2627/133`), store as a `relatedDocument` field, and
show it in the admin list. Turns the 77%-unidentifiable case into ~100% and
removes the screenshot-OCR step.

- **Effort:** small–medium
- **Risk:** low. Route → collection mapping must be explicit; unknown routes
  degrade to storing nothing rather than guessing.

## Phase C — Remove the noise

> **DONE — commit af06b1ba.** C3 landed as _make severity required_
> rather than dropping it: the four levels already carry written definitions,
> so forcing a choice is what makes them discriminate. Mirrors impact in D.

Shortening the form should itself lift the fields that work.

- **C1 — delete `stepsToReproduce`.** 3% over 168 bugs. Two years of evidence
  says asking harder will not fix it.
- **C2 — remove `priority`, or make it a real input.** Today it is a constant
  derived from `type`. **Check first** whether the admin list sorts or filters
  on it.
- **C3 — fix or drop `severity`.** 49% set, of which 94% `critical`. Either give
  the levels written definitions or drop the field.

No migration for the 289 existing records — the fields simply stop being written
(rule 31: do not write migration code for data that does not need it).

- **Effort:** small
- **Risk:** low, pending the C2 check

## Phase B2 — Auto-attach console errors

> **DONE — commit 622ee8f1.**

The form currently instructs users to press F12, open the Console tab, copy and
paste
([ConsoleErrorInstructions.tsx](../../apps/web/src/components/common/FeedbackForm/ConsoleErrorInstructions.tsx)).
That yields 21% overall and 2% from Revathi. Replace with a small client-side
ring buffer of recent `console.error` / `window.onerror` entries, attached on
submit. Keep the manual box as a fallback.

Console errors were the single most decisive input available when fixing the
four bugs in this batch.

- **Effort:** medium — largest item here, which is why it is last
- **Risk:** capturing sensitive values. Mitigation: error-level only, truncate,
  cap the buffer, and never capture request bodies.

---

## Sequencing

**A → D → B1 → C → B2**

A unblocks the conversation with users. D stops the feature backlog getting
less rankable. B1 is the biggest diagnostic win per line. C shortens the form.
B2 is the largest build.

## What this does not fix

The **289 existing records** stay as they are. The 101 context-free feature
requests remain context-free; the only way to enrich them is to ask — which is
why Phase A is the prerequisite for everything else.

## Open questions

- Who receives admin notifications (A2)?
- Does the admin feedback list sort or filter on `priority` (C2)?
- Is `severity` worth keeping with real definitions, or dropped (C3)?
