# Vapour Toolbox — Workflow Testing Guide

This folder is for **you, the person who uses the app** — not for developers.

Each document walks you through the workflows of one module, step by step, in the order you
would actually do them at work. Your job is to follow the steps in the live app, tick off
what works, and report what doesn't.

The engineer-facing versions of these workflows live one folder up in
[docs/workflows/](../). You don't need them.

---

## 1. Before you start

### Get your test accounts ready

Many workflows involve **two different people** — one raises a document, another approves it.
You cannot approve your own request; the app blocks it deliberately. So testing an approval
end to end needs a second sign-in.

Set up before you begin:

| Account            | What it needs                                                                           |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Your account**   | Permission to view and create in the module you're testing                              |
| **An approver**    | Permission to _manage_ that module (this is the person who approves)                    |
| **A limited user** | Little or no permission — used to confirm restricted areas are properly blocked         |
| **An admin**       | Permission to manage users — needed for the Administration tests and to grant the above |

Each module document lists exactly which of these its tests need.

> **Permission changes take a few minutes to take effect** for someone already signed in.
> If you grant a permission and the person still can't see the module, have them sign out and
> back in before you report it as a bug.

### Use real-looking data

Test with data that looks like your actual work — real vendor names, realistic quantities and
amounts, realistic dates. Bugs in totals, rounding, and number formats only show up with
realistic numbers. Prefix anything you create with `TEST` in the title or description so it's
easy to find and clean up afterwards.

### Work through a module in order

Tests are numbered in dependency order. `UAT-PROC-05` may need the purchase order created in
`UAT-PROC-04`. Each test names what it needs under **Before you start** — if you skip ahead,
read that line first.

---

## 2. How to run a test

Every test looks like this:

| #   | Do this                       | You should see                         | Pass? | Notes |
| --- | ----------------------------- | -------------------------------------- | ----- | ----- |
| 1   | Click **Submit for Approval** | Status changes to **Pending Approval** | ☐     |       |

- **Do this** — the action you perform. One action per row.
- **You should see** — what must happen. If anything differs, even slightly, that row fails.
- **Pass?** — tick it, or mark it `FAIL`.
- **Notes** — anything odd, slow, confusing, or ugly, even if the step technically passed.

A test case as a whole **passes only if every row passes**. If row 3 of 8 fails, note it, then
carry on with the remaining rows if you can — knowing whether the rest of the flow works is
useful information.

Some tests also have:

- **Also check** — extra things to verify that aren't a click: a total that must add up, a
  number format, an email that should arrive, a record that should appear in another module.
- **Should NOT be possible** — things the app must refuse. These are just as important as the
  things that must work. If the app _lets_ you do one of them, that is a bug, usually a
  serious one.

---

## 3. How to report results

Report through the app: open **Feedback** from the menu (or go to the Feedback page directly).

### Put the test ID at the front of the title

```
UAT-PROC-07 — Goods receipt lets me receive more than the PO quantity
```

This is the single most important thing you can do. The test ID tells us exactly which steps
you ran and what was supposed to happen, which usually saves an entire round of
back-and-forth questions.

### Fill in the form

| Field                  | What to put                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Type**               | _Bug_ if a step failed. _Feature_ if it worked but is missing something you need. _General_ for anything else. |
| **Module**             | The module you were testing                                                                                    |
| **Title**              | Test ID + a one-line description of what went wrong                                                            |
| **Steps to reproduce** | Copy the rows you performed, up to the one that failed                                                         |
| **Expected behaviour** | Copy the **You should see** cell from the failing row                                                          |
| **Actual behaviour**   | What actually happened, in your words. Include any error message word for word.                                |
| **Severity**           | See below                                                                                                      |
| **Frequency**          | Try the step again 2–3 times before answering                                                                  |
| **Screenshot**         | Attach one whenever the screen looks wrong — it is worth several paragraphs                                    |

### Choosing severity

| Severity     | Use it when                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Critical** | Data was lost or is wrong, money or stock figures don't add up, something was approved that shouldn't be, or a page crashes with no way out |
| **Major**    | A workflow cannot be completed at all — a button does nothing, a required step is missing, you are blocked                                  |
| **Minor**    | The workflow finishes but something along the way is wrong — a wrong label, a stale figure until you refresh                                |
| **Cosmetic** | It looks wrong but works — spacing, alignment, truncated text, a colour                                                                     |

Anything involving **money, quantities, or approvals** should be reported as at least Major.
When in doubt, choose the higher severity.

### One report per problem

If you find three unrelated problems in one test, file three reports. If the same problem
appears in five tests, file one report and list the test IDs in the description.

### Also report the good news

When you finish a module, file one **General** feedback entry:

```
UAT-PROC — Procurement module: 18 of 22 tests passed
```

…listing which test IDs passed, which failed, and which you skipped and why. This tells us how
much of the app has actually been exercised, which is impossible to know from bug reports alone.

---

## 4. Things you should NOT report

Each module document ends with a **Known issues in this module** section, and some individual
steps are flagged inline like this:

> ⚠ **Known issue — expected to fail.**

These are already on the fix list. Reporting them again adds noise. **Read the known issues
section before you start testing a module** — it takes a minute and saves you from chasing
problems we already know about.

If a known issue behaves _differently_ from how it is described — worse, or in a new place —
that is worth reporting. Say so explicitly in the report.

---

## 5. The modules

Run them in this order if you're doing a full pass. Later modules depend on data created in
earlier ones.

| #   | Module                                                                             | Tests | Test IDs                              | Covers                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------- | ----- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [Administration, Users & Permissions](uat-admin-and-permissions.md)                | 25    | `UAT-ADM-*`                           | Sign-in, user approval, granting permissions, audit logs, feedback triage, trash. **Do this first** — it sets up the accounts everything else needs. |
| 2   | [Entities, Process Data & Thermal Calculators](uat-entities-ssot-thermal.md)       | 28    | `UAT-ENT-*` `UAT-SSOT-*` `UAT-THRM-*` | Vendor and customer master, entity ledger, P&ID process data, the thermal calculator suite                                                           |
| 3   | [Documents, Estimation & Material Catalogs](uat-documents-estimation-materials.md) | 45    | `UAT-DOC-*` `UAT-EST-*` `UAT-MAT-*`   | Master documents, revisions, transmittals, BOM editor and costing, materials, bought-out items, services                                             |
| 4   | [Enquiries, Proposals & Projects](uat-enquiries-proposals-projects.md)             | 30    | `UAT-ENQ-*` `UAT-PROP-*` `UAT-PROJ-*` | Enquiry intake, bid decisions, proposals and pricing, conversion to a project, charter, budget, milestones                                           |
| 5   | [Procurement](uat-procurement.md)                                                  | 34    | `UAT-PROC-*`                          | Purchase requests, RFQs, vendor offers, purchase orders and their two approvals, goods receipts, three-way match                                     |
| 6   | [Accounting](uat-accounting.md)                                                    | 37    | `UAT-ACCT-*`                          | All transaction types, invoices and bills, payments and allocation, journals, chart of accounts, reports                                             |
| 7   | [HR & Flow](uat-hr-and-flow.md)                                                    | 31    | `UAT-HR-*` `UAT-FLOW-*`               | Employees, leave and balances, comp-off, on-duty, travel expenses, tasks, meetings, notifications                                                    |

**230 test cases in total.** You do not have to do a full pass — testing one module properly
is far more useful than skimming all seven.

### How complete is each module?

Every module document ends with its own known-issues list. The counts below are a rough guide
to where you'll hit dead ends, and they came from checking the code, not from the older
engineer-facing docs:

| Module                                       | Known issues | What that means for you                                                                              |
| -------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| Accounting                                   | 4            | Solid. Expect most tests to pass.                                                                    |
| Procurement                                  | 6            | Solid. The gaps are edge cases (recalling an amendment, RFQ emails).                                 |
| Entities, Process Data & Thermal Calculators | 8            | Mostly working. Some calculators can't save; SSOT has no delete-safety.                              |
| Administration, Users & Permissions          | 6            | Mostly working. The AI agent pages have nothing to show yet.                                         |
| Enquiries, Proposals & Projects              | 3            | Working end to end, including conversion to a project.                                               |
| HR & Flow                                    | 11           | Patchy. Several actions exist in the system but have no button. Approver lists must be seeded first. |
| Documents, Estimation & Material Catalogs    | 29           | Roughest area. BOMs can't leave Draft, materials have no price or stock screens.                     |

---

## 6. These documents are the in-app guide

Everything here also appears inside the app, under **User Guide** (`/guide`) — each module's
section ends with **Workflows you can test**, listing the same workflows, the same steps, and
the same known issues. Most people should read it there; these files are the source the guide
is built from.

After editing any `uat-*.md` file in this folder, regenerate the in-app copy:

```bash
node scripts/generate-workflow-guide.mjs
```

That rewrites `apps/web/src/data/workflowGuide/` — generated files, never edited by hand.

## 7. Keeping these current

These scripts describe how the app is meant to behave today. When a workflow changes, the
matching test case changes with it — including its ID, which stays stable so past reports keep
their meaning. If a test case is retired, leave its ID in place marked as withdrawn rather
than renumbering everything below it.
