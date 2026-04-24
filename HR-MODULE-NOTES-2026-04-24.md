# HR — Module Notes

Date: 2026-04-24

## Status: healthiest of the five modules

HR is the only module where **every active employee shows up** in recent activity data. Core flows (leave, comp-off, holiday overrides) are genuinely live.

| Collection                | Docs | 7d    | 30d | 90d | Last write  | Unique users |
| ------------------------- | ---- | ----- | --- | --- | ----------- | ------------ |
| `hrCompOffGrants`         | 17   | **9** | 9   | 17  | Apr 13      | **9**        |
| `hrLeaveRequests`         | 14   | 0     | 3   | 8   | Apr 12      | 5            |
| `hrLeaveBalances`         | 41   | 1     | 1   | 1   | Apr 13      | 2            |
| `holidayWorkingOverrides` | 9    | 1     | 1   | 3   | Apr 13      | 2            |
| `hrHolidays`              | 17   | 0     | 0   | 0   | Dec 29 2025 | 1            |
| `hrLeaveTypes`            | 3    | 0     | 0   | 0   | Jan 4       | 1            |
| `hrTravelExpenses`        | 3    | 0     | 0   | 0   | Jan 10      | —            |
| `onDutyRecords`           | 0    | —     | —   | —   | —           | —            |

## What's working well

1. **Comp-off grants** — 9 distinct users recorded comp-off in the last 7 days. This is real workforce-wide usage. Whatever nudged this (probably holiday working → comp-off accrual via the overrides flow) is well-designed.
2. **Leave requests** — 5 unique requesters, monthly cadence. Baseline leave workflow is live.
3. **Leave balances** — maintained (1 write in last 7 days suggests admin is actively rebalancing).
4. **Holiday working overrides** — 9 docs, active. This is how exceptions (working on a declared holiday) get captured and flipped to comp-off.

## Dead sub-features

### `onDutyRecords` — 0 documents

Route exists at [hr/on-duty](apps/web/src/app/hr/on-duty). This tracks employees on client-site / business-travel so their absence from office doesn't read as unplanned leave.

Two possibilities, both worth checking:

1. **No one knows to use it** — attendance isn't being tracked via this at all.
2. **It competes with leave** — users who should log on-duty are logging leave instead (or vice versa).

If on-duty is actually important (for attendance reports, travel-day timesheet entries), surface it in the HR home page with a call-to-action. If it's not needed anymore, retire the route.

### `hrTravelExpenses` — 3 docs, last Jan 10

Travel expense claim flow. Functional — 3 claims exist — but not adopted. Either:

- The flow is too heavy for the scale of travel that actually happens, and people are claiming via accounting directly.
- The flow exists but is undiscoverable (no link from on-duty, no link from dashboard).

Quick fix — when an on-duty record ends, prompt: "Create travel expense claim for this trip?" Ties the two dead-ish features together.

### `hrHolidays` — frozen since Dec 29 2025

17 holidays defined, never updated after the FY-26 calendar was set up. Verify FY26-27 holidays are populated before April-May, otherwise the leave balance logic that excludes holidays will be wrong for new-year leaves.

## Suggested improvements (low-effort, high-value)

1. **HR home page with balance card per user** — show "12 leaves remaining, 3 comp-off pending, last travel: Jan 10" on a landing page. Given 9 users actively touch comp-off, a single personal-balances dashboard would get heavy use.

2. **On-duty → timesheet integration** — if time-tracking exists elsewhere, an on-duty record should seed timesheet entries for those dates automatically (client-billable hours, travel days).

3. **Holiday calendar publication** — push `hrHolidays` to a calendar ICS feed so employees can subscribe. Stale holidays become self-evident.

4. **Leave approval path** — confirm the approval workflow matches the rest of the app's state machines ([stateMachines.ts](apps/web/src/lib/workflow/stateMachines.ts) — see CLAUDE.md rule 8). 5 unique requesters but only 2 users write to `hrLeaveBalances` (the approver + admin), which looks correct; verify the approval transition uses `requireValidTransition`.

5. **Comp-off expiry rules** — 17 comp-off grants and growing. If there's no expiry / cap, this becomes a liability. Add a grant-to-use window (e.g. 90 days) and visualise on the balance card.

## What NOT to build yet

- **Payroll** — out of scope given current usage. Don't start here.
- **Performance reviews** — no signal of demand.
- **Full attendance system** — unless on-duty gets revived first, there's no base to build on.

## Priority

HR is the module with the least urgent problems. Focus engineering time on projects + procurement + proposals revival first (see the dedicated docs); come back to HR for on-duty revival and the balances-dashboard when those are settled.
