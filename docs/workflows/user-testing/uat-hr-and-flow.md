# HR & Flow — Workflow Testing

> How to use this: [Testing guide](README.md) · Report problems at **Feedback** in the app, with the test ID at the start of the title (e.g. `UAT-HR-07 — balance not released after rejection`).

## What this module does

**HR & Leave** runs the people side of the business: the employee directory and profiles, the company holiday calendar, leave applications and their two-step approval, the leave balances that go up and down as leave is taken, compensatory leave earned by working on a holiday, and travel expense claims with receipts.

**Flow** is the daily-work side: your personal task list, tasks assigned to you by other people, meeting minutes that turn action items into real tasks, a team board showing what everyone is working on, and the **Inbox** where every approval request and status change from every module lands.

The two are joined by notifications. Almost every HR action creates an item in somebody else's Inbox, and several also send an email. Testing those properly needs two people.

## Before you start

### Permissions you need

| What you want to test                               | Permission needed                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| Apply for leave, on-duty, travel expenses           | None — open to every signed-in user                                       |
| Employee directory, holidays (view), Flow           | None — open to every signed-in user                                       |
| Approve / reject leave and on-duty                  | **Approve Leaves**, _and_ you must be on the HR approver list (see below) |
| Team Requests tab, Team Calendar, Leave Summary     | **Approve Leaves**                                                        |
| Add / edit / delete holidays, declare a working day | **Manage HR Settings**                                                    |
| Open the Edit Profile button on an employee         | **Manage Users**                                                          |
| Actually save an employee profile edit              | **Manage HR Profiles**                                                    |
| Administration → HR Setup (leave types, balances)   | **Manage Users**                                                          |

Permission changes take a few minutes to reach someone already signed in. Have them sign out and back in before reporting a permission problem.

### Test data you need first

- **Leave types and balances must exist for the current year.** If the Leaves page shows _"No leave balances found"_, run **UAT-HR-03** first — nothing else in the leave section will work.
- **At least two company holidays** in the current year, one of them in the future (needed for on-duty). Create them in **UAT-HR-04**.
- **A receipt file** (PDF or photo, under 5 MB) with a vendor name, a date, an amount and ideally a GST breakdown — for the receipt-parsing test.
- **An approver list configured in HR settings.** There is **no screen in the app for this** — the list of people who can approve leave, on-duty and travel expenses is set directly in the database. Confirm with the developer that at least two approvers are configured before you start, otherwise **Submit for Approval** fails with _"Leave approvers not configured"_ or _"No approvers configured. Please contact HR."_

### A second user — read this before you start

Yes, several tests need one. Leave and on-duty need **two approvals**, so you may need a third sign-in for the full path.

| Account                      | What it needs                                                                                   | Used by                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Your account** (applicant) | Nothing special                                                                                 | Everything                                     |
| **Approver A**               | **Approve Leaves** _and_ be on the configured HR approver list                                  | UAT-HR-07, 08, 11, 14, 15, 20, UAT-FLOW-08, 09 |
| **Approver B**               | Same as Approver A — a _different_ person, needed to complete a two-step leave/on-duty approval | UAT-HR-07, UAT-HR-14                           |
| **A limited user**           | No **Manage HR Settings**, no **Approve Leaves**                                                | UAT-HR-11, UAT-HR-04                           |
| **An admin**                 | **Manage Users** + **Manage HR Profiles** + **Manage HR Settings**                              | UAT-HR-02, 03, 04, 13                          |

Wherever a step needs the other person, it is written as **"as Approver A, sign in and…"**. If the applicant happens to also be on the approver list, the app drops them out of the approver set and then only **one** approval is needed — the leave detail page says so explicitly.

**Sidebar:** HR lives under **SETUP → HR & Leave**. Flow lives under **DAILY OPERATIONS → Flow**. Leave types and yearly balance setup live under **ADMINISTRATION → HR Setup**.

**Read the [Known issues in this module](#known-issues-in-this-module) section at the bottom before you start.** Nine things in this module are already known to be broken or missing; do not spend time filing them again.

---

## Test index

| ID          | Workflow                                                             | Needs a 2nd user? | Est. time |
| ----------- | -------------------------------------------------------------------- | ----------------- | --------- |
| UAT-HR-01   | Browse the employee directory                                        | No                | 10 min    |
| UAT-HR-02   | Employee profile round-trip — nothing lost between save and reopen   | No (admin acct)   | 30 min    |
| UAT-HR-03   | Set up leave types and this year's balances                          | No (admin acct)   | 20 min    |
| UAT-HR-04   | Manage the holiday calendar — add, edit, copy, delete                | Yes (limited)     | 25 min    |
| UAT-HR-05   | Read your leave balance and comp-off card                            | No                | 8 min     |
| UAT-HR-06   | Apply for leave — save as draft, then submit                         | No                | 20 min    |
| UAT-HR-07   | Two-step leave approval, with the balance arithmetic                 | Yes (two)         | 30 min    |
| UAT-HR-08   | Reject a leave request — held days come back                         | Yes               | 15 min    |
| UAT-HR-09   | Cancel your own leave request                                        | No                | 12 min    |
| UAT-HR-10   | Half-day leave, and holidays dropping out of the day count           | No                | 20 min    |
| UAT-HR-11   | Leave guards — overlap, over-balance, self-approval, double approval | Yes               | 25 min    |
| UAT-HR-12   | Team Calendar and Leave Summary                                      | Yes (limited)     | 15 min    |
| UAT-HR-13   | Declare a working day and grant comp-off in bulk                     | No (admin acct)   | 20 min    |
| UAT-HR-14   | On-duty request through to approval and the comp-off credit          | Yes (two)         | 30 min    |
| UAT-HR-15   | On-duty — reject, cancel, and the date guards                        | Yes               | 20 min    |
| UAT-HR-16   | Spend a comp-off day                                                 | Yes               | 20 min    |
| UAT-HR-17   | Create a travel expense report — round-trip check                    | No                | 15 min    |
| UAT-HR-18   | Add expense lines by hand and by AI receipt reading                  | No                | 30 min    |
| UAT-HR-19   | Submit a claim, get it returned, fix it, resubmit                    | Yes               | 25 min    |
| UAT-HR-20   | Approve and reject a travel expense claim                            | Yes               | 20 min    |
| UAT-HR-21   | Mark a claim reimbursed — **known issue, expected to fail**          | No                | 5 min     |
| UAT-FLOW-01 | Create and assign a task — round-trip check                          | Yes               | 15 min    |
| UAT-FLOW-02 | Move a task through its life, and delete one                         | Yes               | 20 min    |
| UAT-FLOW-03 | Team Board                                                           | Yes               | 10 min    |
| UAT-FLOW-04 | Record meeting minutes and save as a draft                           | No                | 20 min    |
| UAT-FLOW-05 | Finalize a meeting — action items become real tasks                  | Yes               | 25 min    |
| UAT-FLOW-06 | Meeting guards — delete, empty finalize, terminal state              | Yes               | 20 min    |
| UAT-FLOW-07 | Work the Inbox — filter, search, complete                            | Yes               | 20 min    |
| UAT-FLOW-08 | Notifications end to end, and the ones that clear themselves         | Yes (two)         | 30 min    |
| UAT-FLOW-09 | Emails that should arrive alongside the in-app notification          | Yes               | 25 min    |
| UAT-FLOW-10 | Threads and @mentions — **known issue, expected to fail**            | No                | 5 min     |

---

## UAT-HR-01 — Browse the employee directory

**Goal:** confirm every active person appears with the right contact details, and the search and department filter work.
**Who:** anyone signed in.
**Before you start:** nothing.

| #   | Do this                                                                                            | You should see                                                                                                                 | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Sidebar → **SETUP → HR & Leave**                                                                   | The **HR & Leave Management** landing page with cards: Leaves, On-Duty Requests, Travel Expenses, Holidays, Employee Directory | ☐     |       |
| 2   | Click **Employee Directory**                                                                       | A page titled **Employee Directory** with three summary cards — Total Employees, Departments, Blood Groups                     | ☐     |       |
| 3   | Compare the **Total Employees** number against the people you know are active                      | The counts match, and the card also shows how many are active                                                                  | ☐     |       |
| 4   | Read the table                                                                                     | Columns: Employee, Employee ID, Department, Job Title, Contact, Blood Group, Joined                                            | ☐     |       |
| 5   | Type part of a colleague's name into the search box                                                | The table narrows to matching rows as you type; the line under the table reads "Showing _n_ of _m_ employees"                  | ☐     |       |
| 6   | Clear search. Type a colleague's **email address** instead                                         | The same person is found — search covers name, email, employee ID and job title                                                | ☐     |       |
| 7   | Clear search. Set **Department** to a real department                                              | Only people in that department remain                                                                                          | ☐     |       |
| 8   | Set Department to a value with nobody in it (if one exists)                                        | "No employees found matching your filters."                                                                                    | ☐     |       |
| 9   | Set Department back to **All Departments**. Click the phone icon on a row that has a mobile number | Your device offers to dial that number                                                                                         | ☐     |       |
| 10  | Click the eye icon at the end of a row                                                             | The **Employee Profile** page for that person opens                                                                            | ☐     |       |

**Also check:**

- The **Joined** column shows a real date in day-month-year form for anyone whose joining date is filled in, and a dash for anyone whose isn't.
- Blood-group chips on the summary card add up to the number of people who actually have a blood group recorded — people without one are simply not counted.

---

## UAT-HR-02 — Employee profile round-trip — nothing lost between save and reopen

> This is the single most valuable test in the module. The profile form has around forty fields across six collapsible sections; a field that is written but not read back is the commonest defect in this app.

**Goal:** fill in every field on an employee profile, save, reopen the form and confirm every value came back exactly as typed.
**Who:** someone with **Manage Users** (to see the button) and **Manage HR Profiles** (to save). If you have one and not the other, say so in the Notes column — that mismatch is itself worth reporting.
**Before you start:** pick a colleague's profile you are allowed to edit, or your own. Note down every value you type — you will compare against it.

| #   | Do this                                                                                                                                | You should see                                                                                                                             | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | HR & Leave → **Employee Directory** → open a person                                                                                    | **Employee Profile** page with an **Edit Profile** button in the top right                                                                 | ☐     |       |
| 2   | Click **Edit Profile**                                                                                                                 | A dialog titled **Edit Employee Profile**                                                                                                  | ☐     |       |
| 3   | Note that **Email** and **Display Name** are greyed out                                                                                | Helper text explains email cannot be changed and the name is managed in user settings                                                      | ☐     |       |
| 4   | Fill **Phone** and **Mobile** with distinct, memorable numbers                                                                         | Both accept what you type                                                                                                                  | ☐     |       |
| 5   | Fill **Job Title**; pick a **Department** from the dropdown                                                                            | Department is a fixed list, not free text                                                                                                  | ☐     |       |
| 6   | Open **Employment Details**. Fill Employee ID (e.g. `TEST-001`), Employment Type, Date of Joining, Reporting Manager                   | All four accept a value                                                                                                                    | ☐     |       |
| 7   | Open **Personal Details**. Fill Date of Birth, Gender, Blood Group, Marital Status, Nationality, Personal Email, Personal Phone        | All seven accept a value                                                                                                                   | ☐     |       |
| 8   | Open **Addresses**. Fill **both** the Current and the Permanent address completely — Line 1, Line 2, City, State, Postal Code, Country | Twelve fields in total                                                                                                                     | ☐     |       |
| 9   | Open **Emergency Contact**. Fill Contact Name, Relationship, Phone, Alternate Phone, Email                                             | All five accept a value                                                                                                                    | ☐     |       |
| 10  | Open **Bank Details**. Fill Account Holder Name, Bank Name, Account Number, IFSC Code                                                  | The IFSC field forces what you type into capitals                                                                                          | ☐     |       |
| 11  | Open **Government IDs**. Fill PAN Number, Aadhaar Number, PF Account Number, UAN Number                                                | PAN forces capitals                                                                                                                        | ☐     |       |
| 12  | Click **Save Changes**                                                                                                                 | A green _"Employee profile updated successfully!"_ message; the dialog closes on its own after about two seconds                           | ☐     |       |
| 13  | Read the profile page behind it                                                                                                        | The values you just typed appear in the Employment / Personal / Emergency Contact / Bank Details / Government IDs sections                 | ☐     |       |
| 14  | Click **Edit Profile** again                                                                                                           | **Every single field you filled in comes back with exactly the value you typed** — check all forty, section by section, against your notes | ☐     |       |
| 15  | Without changing anything, click **Save Changes** again                                                                                | Saves cleanly; reopening shows the same values a third time                                                                                | ☐     |       |
| 16  | Change **just one** value — say the Emergency Contact phone — and save                                                                 | Only that value changes; nothing else moved                                                                                                | ☐     |       |
| 17  | Reopen the dialog, **clear** the Nationality field completely, and save                                                                | ⚠ known issue — the old value comes back when you reopen. Clearing a saved optional field does not blank it. Do not file this.             | ☐     |       |
| 18  | Close the dialog and reload the page                                                                                                   | Everything still there after a full page reload                                                                                            | ☐     |       |

**Also check:**

- Dates you enter (Date of Joining, Date of Birth) come back as the **same day**, not a day earlier or later.
- The **Blood Groups** chip row on the Employee Directory page now counts this person under the blood group you set.

**Should NOT be possible:**

- Signing in as someone without **Manage Users** and finding an **Edit Profile** button — it should not be rendered at all.
- Editing the Email or Display Name from this dialog.

---

## UAT-HR-03 — Set up leave types and this year's balances

**Goal:** confirm leave types can be configured and that every active employee gets a balance record for the year.
**Who:** an admin with **Manage Users**.
**Before you start:** nothing. **Run this before any other leave test** — if balances don't exist, applying for leave fails.

| #   | Do this                                                                                                                                                                                | You should see                                                                                                      | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar → **ADMINISTRATION → HR Setup**                                                                                                                                                | A page titled **HR Setup** with two tabs: **Leave Types** and **Leave Balances**                                    | ☐     |       |
| 2   | On **Leave Types**, read the list                                                                                                                                                      | At least Sick, Casual and Comp-Off appear, each with a code, annual quota and flags                                 | ☐     |       |
| 3   | Click the button to add a leave type and fill Code, Name, Description, Annual Quota, Min Notice, and the switches (Allow Carry Forward, Paid Leave, Requires Approval, Allow Half Day) | The dialog **Add Leave Type** accepts everything                                                                    | ☐     |       |
| 4   | Save it, then reopen it for editing                                                                                                                                                    | **Every field comes back as typed**, including all four switches and Max Carry Forward if you set it                | ☐     |       |
| 5   | Confirm **Casual** has **Allow Half Day** switched on                                                                                                                                  | Needed for UAT-HR-10 — if it isn't, switch it on and save                                                           | ☐     |       |
| 6   | Switch to the **Leave Balances** tab                                                                                                                                                   | **Employee Leave Balances** with a Year selector and a per-person table                                             | ☐     |       |
| 7   | Note anyone showing **Not Initialized**                                                                                                                                                | Chip is orange                                                                                                      | ☐     |       |
| 8   | Click **Initialize Balances for &lt;year&gt;**                                                                                                                                         | A dialog explaining it creates balances for active users who don't have them, and skips those who do                | ☐     |       |
| 9   | Click **Initialize**                                                                                                                                                                   | A success message naming how many were created; the table refreshes and **Not Initialized** chips become **Active** | ☐     |       |
| 10  | Click **Initialize Balances** a second time straight away                                                                                                                              | It runs again harmlessly — nobody gets a duplicate or a doubled entitlement                                         | ☐     |       |
| 11  | Read one person's row                                                                                                                                                                  | Sick shows an entitlement of **12**, Casual **12**, Comp-Off **0**                                                  | ☐     |       |

**Also check:**

- Switch the Year selector to next year: everyone shows **Not Initialized** until you initialise that year too.

**Should NOT be possible:**

- Reaching **Administration → HR Setup** without **Manage Users** — the page must say you do not have permission rather than showing the tabs.

---

## UAT-HR-04 — Manage the holiday calendar — add, edit, copy, delete

**Goal:** confirm holidays can be maintained, that the same date cannot be entered twice, and that non-admins can only look.
**Who:** someone with **Manage HR Settings**, plus a limited account for step 12.
**Before you start:** nothing.

| #   | Do this                                                                                                                          | You should see                                                                                                                   | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | HR & Leave → **Holidays**                                                                                                        | **Company Holidays &lt;year&gt;**, a card listing the auto-calculated recurring holidays, and a table of company-defined ones    | ☐     |       |
| 2   | Read the recurring-holidays card                                                                                                 | Chips for **All Sundays**, **1st Saturday of each month**, **3rd Saturday of each month**                                        | ☐     |       |
| 3   | Click **Manage Holidays**                                                                                                        | **Holiday Settings**, with a Year selector, **Copy**, **Declare Working Day** and **Add Holiday**                                | ☐     |       |
| 4   | Click **Add Holiday**. Enter a name, a **future date in the current year**, type **Company Holiday**, a description and a colour | The **Add Holiday** dialog takes all five                                                                                        | ☐     |       |
| 5   | Click **Save**                                                                                                                   | _"Holiday created successfully"_; the new row appears, dated as **Day, DD Mon YYYY**, with a coloured dot and a type chip        | ☐     |       |
| 6   | Click the pencil on that row                                                                                                     | The dialog reopens as **Edit Holiday** with **every value you entered**, including the selected colour                           | ☐     |       |
| 7   | Change the name and the type to **National Holiday**, save                                                                       | _"Holiday updated successfully"_; the row's name and chip both change                                                            | ☐     |       |
| 8   | Click **Add Holiday** and try to create a **second holiday on the same date**                                                    | The app refuses, or the existing holiday is replaced rather than duplicated — one date, one holiday. Record exactly what happens | ☐     |       |
| 9   | Add a second holiday on a **different** future date — you will need two for later tests                                          | Both rows now listed                                                                                                             | ☐     |       |
| 10  | Click **Copy**, pick next year as the Target Year, click **Copy Holidays**                                                       | A message reading _"Copied n holidays to &lt;year&gt;. m skipped (already exist)."_                                              | ☐     |       |
| 11  | Switch the Year selector to next year                                                                                            | Your holidays are there, on the same dates                                                                                       | ☐     |       |
| 12  | Run **Copy** again with the same target year                                                                                     | This time everything is reported as **skipped** — no duplicates created                                                          | ☐     |       |
| 13  | Switch back to the current year. Delete one of the two test holidays via the red bin icon                                        | A confirmation naming the holiday; after confirming it disappears from the table                                                 | ☐     |       |
| 14  | Go back to **HR & Leave → Holidays**                                                                                             | The deleted holiday is gone from the read-only view too                                                                          | ☐     |       |
| 15  | **As the limited user, sign in** and open HR & Leave → Holidays                                                                  | The list is visible but there is **no Manage Holidays button**                                                                   | ☐     |       |

**Should NOT be possible:**

- A limited user reaching Holiday Settings — if they get there by other means, the page must say _"You do not have permission to manage HR settings."_
- Two holidays existing on the same date.

---

## UAT-HR-05 — Read your leave balance and comp-off card

**Goal:** understand and record your starting balances, so the arithmetic in the next tests can be checked.
**Who:** anyone.
**Before you start:** requires UAT-HR-03.

| #   | Do this                                                       | You should see                                                                                                                             | Pass? | Notes |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | HR & Leave → **Leaves**                                       | A page titled **Leaves**. If you have **Approve Leaves** you also get the tabs My Leaves / Team Requests / Leave Summary                   | ☐     |       |
| 2   | Stay on **My Leaves**                                         | The current fiscal year is shown, then a **Compensatory Leave Balance** card, then **Leave Balance** cards, then **Recent Leave Requests** | ☐     |       |
| 3   | Read the **Compensatory Leave Balance** card                  | Four numbers: Entitled, Used, Pending, Available                                                                                           | ☐     |       |
| 4   | Read the **Casual Leave** card. **Write these numbers down.** | Available (large, green), a progress bar, then Entitled and Used underneath; Pending appears only if it is above zero                      | ☐     |       |
| 5   | Check the arithmetic yourself                                 | **Available = Entitled − Used − Pending** (plus carry-forward if your company uses it). If it doesn't add up, stop and report it           | ☐     |       |
| 6   | Read **Recent Leave Requests**                                | Up to ten of your most recent requests, each with Request #, Leave Type, From, To, Days, Status and a **View** button                      | ☐     |       |

**Record here before continuing:** Casual Leave — Entitled \_**\_ · Used \_\_** · Pending \_**\_ · Available \_\_**

---

## UAT-HR-06 — Apply for leave — save as draft, then submit

**Goal:** raise a leave request, keep it as a draft, then submit it and watch the days move into the pending bucket.
**Who:** anyone.
**Before you start:** requires UAT-HR-03 and the balances you recorded in UAT-HR-05. Pick **two consecutive working days** at least a week away — no Sunday, no 1st or 3rd Saturday, no company holiday.

| #   | Do this                                                                                        | You should see                                                                                                                                 | Pass?                                                       | Notes |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----- | --- |
| 1   | HR & Leave → **Leaves** → **Apply for Leave**                                                  | A page headed **Apply for Leave**                                                                                                              | ☐                                                           |       |
| 2   | Open the **Leave Type** dropdown and choose **Casual Leave**                                   | Below the field: \*"Available: n days                                                                                                          | Used: m days"\* — matching what you wrote down in UAT-HR-05 | ☐     |     |
| 3   | Open the **Start Date** picker                                                                 | Sundays and the 1st/3rd Saturdays are greyed out and cannot be picked; the helper text says so                                                 | ☐                                                           |       |
| 4   | Try to click a company holiday you created in UAT-HR-04                                        | It is greyed out too                                                                                                                           | ☐                                                           |       |
| 5   | Pick your first working day as **Start Date**                                                  | **End Date** fills in with the same day automatically                                                                                          | ☐                                                           |       |
| 6   | Set **End Date** to the following working day                                                  | A blue box appears reading **Total Leave Days: 2**                                                                                             | ☐                                                           |       |
| 7   | Type a reason, e.g. `TEST — UAT-HR-06 family function`                                         | The reason box accepts multiple lines                                                                                                          | ☐                                                           |       |
| 8   | Click **Save as Draft**                                                                        | You land on the request's own page. Status chip reads **Draft**. The number is in the form **LR-2026-0001** — year, then a four-digit sequence | ☐                                                           |       |
| 9   | Read the detail page                                                                           | Employee, Leave Type, From, To, Number of Days (2), Fiscal Year and your Reason are all shown correctly                                        | ☐                                                           |       |
| 10  | Go back to **Leaves → My Leaves** and re-check your **Casual Leave** card                      | **Nothing has moved** — a draft does not touch the balance                                                                                     | ☐                                                           |       |
| 11  | Open the draft again from **Recent Leave Requests → View**, then click **Submit for Approval** | Status chip becomes **Pending Approval**. A chip beside it reads **0/2 approvals**                                                             | ☐                                                           |       |
| 12  | Read the **Approval Status** panel                                                             | It names the required approvers by email, each with a **Pending** chip, and _"Progress: 0/2 approval(s) received"_                             | ☐                                                           |       |
| 13  | Read the **History** panel                                                                     | An entry showing the submission, with your name and a timestamp                                                                                | ☐                                                           |       |
| 14  | Go back to **Leaves → My Leaves**. Check the Casual Leave card                                 | **Pending now reads 2** and **Available has dropped by exactly 2** from what you recorded. Used is unchanged                                   | ☐                                                           |       |

**Write down the exact numbers now:** Entitled \_**\_ · Used \_\_** · Pending \_**\_ · Available \_\_**

**Also check:**

- The request number is unique — apply for a second (different) date range and confirm the sequence advances by one rather than repeating.
- Days are counted as **working days only**. Two calendar days that include a Sunday should still count as 1.

**Should NOT be possible:**

- Submitting with the reason box empty — the **Submit for Approval** button stays greyed out.
- Picking an End Date earlier than the Start Date — the picker will not allow it.
- Submitting somebody else's draft.

---

## UAT-HR-07 — Two-step leave approval, with the balance arithmetic

**Goal:** take a leave request through both approvals, confirm the notifications reach the right people, and confirm the days move from _pending_ to _used_ — not double-counted.
**Who:** you (the applicant), **Approver A**, and **Approver B**. Both approvers need **Approve Leaves** and must be on the configured approver list.
**Before you start:** requires the **Pending Approval** request from UAT-HR-06 and the numbers you wrote down there.

| #   | Do this                                                                                                                                 | You should see                                                                                                                                                      | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As Approver A, sign in** and open **DAILY OPERATIONS → Flow → Inbox**                                                                 | A card titled **Leave Request: &lt;your name&gt;**, with an **Action Required** chip                                                                                | ☐     |       |
| 2   | Click the **HR** filter chip                                                                                                            | The leave card is one of the items kept                                                                                                                             | ☐     |       |
| 3   | Click the card                                                                                                                          | The leave request opens, showing **Pending Approval** and **0/2 approvals**                                                                                         | ☐     |       |
| 4   | Alternatively reach it via HR & Leave → **Leaves → Team Requests** tab                                                                  | The request is listed under **Pending Approval** with a **Review** button                                                                                           | ☐     |       |
| 5   | Click **Approve**                                                                                                                       | Status becomes **Partially Approved**; the chip reads **1/2 approvals**; a **You approved** chip appears                                                            | ☐     |       |
| 6   | Read the Approval Status panel                                                                                                          | Approver A now has a **✓ Approved** chip; Approver B still shows **Pending**                                                                                        | ☐     |       |
| 7   | Reload the page. Look for the **Approve** button                                                                                        | It is gone for Approver A — you cannot approve the same request twice                                                                                               | ☐     |       |
| 8   | **As yourself, sign in.** Open Flow → **Inbox**                                                                                         | A notification **Leave Request Partially Approved** telling you it was approved by Approver A (1/2)                                                                 | ☐     |       |
| 9   | Check your **Casual Leave** card                                                                                                        | **Still Pending 2, Used 0** — a partial approval must not consume the days yet                                                                                      | ☐     |       |
| 10  | **As Approver B, sign in.** Open Flow → **Inbox**                                                                                       | The same **Leave Request: &lt;your name&gt;** card is waiting for them                                                                                              | ☐     |       |
| 11  | Open it and click **Approve**                                                                                                           | Status becomes **Approved**. The approval-progress chip disappears                                                                                                  | ☐     |       |
| 12  | Read the **History** panel                                                                                                              | Three entries: submitted, approved by A, approved by B — each named and timestamped                                                                                 | ☐     |       |
| 13  | Still as Approver B, go back to Flow → **Inbox**                                                                                        | The **Leave Request** action card has **cleared itself** — the app closes both approvers' items once the decision is final                                          | ☐     |       |
| 14  | **As Approver A, sign in** and check Flow → **Inbox**                                                                                   | Their copy of the action card has cleared too                                                                                                                       | ☐     |       |
| 15  | Approver A should also see a new informational card **Team Leave Notice** reading _"&lt;your name&gt; will be on Casual Leave (dates)"_ | Everyone on the team gets this on final approval                                                                                                                    | ☐     |       |
| 16  | Click that **Team Leave Notice** card                                                                                                   | ⚠ known issue — it opens a page saying _"Leave request not found."_ The link points at the wrong place. Do not file this                                            | ☐     |       |
| 17  | **As yourself, sign in.** Open Flow → **Inbox**                                                                                         | A notification **Leave Request Approved**                                                                                                                           | ☐     |       |
| 18  | Open **Leaves → My Leaves** and read the **Casual Leave** card                                                                          | **Pending is back to 0. Used has gone up by exactly 2. Available is unchanged from step 14 of UAT-HR-06** — the two days moved across, they were not deducted twice | ☐     |       |
| 19  | Compare with your UAT-HR-05 starting numbers                                                                                            | Used = starting Used **+ 2**; Available = starting Available **− 2**; Entitled unchanged                                                                            | ☐     |       |
| 20  | Open **Leaves → Team Calendar** (needs Approve Leaves)                                                                                  | Your two approved days are shown on the calendar with an **On Leave** marker                                                                                        | ☐     |       |

**Also check:**

- The request now appears under **Team Requests → Approved**, and the button on that row reads **View** rather than **Review**.

**Should NOT be possible:**

- The same approver approving twice — the app must refuse with _"You have already approved this request."_
- A single approval finalising the request when two are required.
- Approving a request that is already **Approved**, **Rejected** or **Cancelled** — the buttons must not be offered.

---

## UAT-HR-08 — Reject a leave request — held days come back

**Goal:** confirm rejection releases the held days and tells the employee why.
**Who:** you and **Approver A**.
**Before you start:** raise a fresh 1-day Casual Leave request and submit it (repeat UAT-HR-06 steps 1–11 with a different date). Record your balance immediately after submitting.

| #   | Do this                                                            | You should see                                                                                                             | Pass? | Notes |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Check your Casual Leave card right after submitting                | Pending is **1** higher, Available **1** lower than before you submitted                                                   | ☐     |       |
| 2   | **As Approver A, sign in** and open the request                    | Status **Pending Approval**, with **Approve** and **Reject** buttons                                                       | ☐     |       |
| 3   | Click **Reject**                                                   | A dialog **Reject Leave Request** asking for a **Reason for Rejection**                                                    | ☐     |       |
| 4   | Leave the reason blank and try to confirm                          | The **Reject** button in the dialog is greyed out — a reason is compulsory                                                 | ☐     |       |
| 5   | Type `TEST — UAT-HR-08 clashes with delivery` and click **Reject** | Status becomes **Rejected**                                                                                                | ☐     |       |
| 6   | Read the detail page                                               | A red **Rejection Reason** panel showing exactly the text you typed                                                        | ☐     |       |
| 7   | Read the **History** panel                                         | A **REJECTED** entry with Approver A's name and your reason as the remark                                                  | ☐     |       |
| 8   | Still as Approver A, check Flow → **Inbox**                        | Their leave action card has cleared                                                                                        | ☐     |       |
| 9   | **As yourself, sign in.** Open Flow → **Inbox**                    | A notification **Leave Request Rejected**, quoting the approver's name and the reason                                      | ☐     |       |
| 10  | Open **Leaves → My Leaves**, read the Casual Leave card            | **Pending is back down by 1 and Available is back up by 1 — exactly where it was before you submitted.** Used is unchanged | ☐     |       |
| 11  | Open the rejected request                                          | No Approve, no Reject, no Submit, no Cancel — a rejected request is finished                                               | ☐     |       |
| 12  | Check **Team Requests → Rejected**                                 | The request is listed there                                                                                                | ☐     |       |

**Should NOT be possible:**

- Rejecting without a reason.
- Rejecting a request that is already Approved, Rejected or Cancelled.
- Re-submitting a rejected leave request — there is no path back; you raise a new one.

---

## UAT-HR-09 — Cancel your own leave request

**Goal:** confirm you can withdraw a request while it is still in play, and that the days come back.
**Who:** you, plus **Approver A** for the partially-approved case.
**Before you start:** requires UAT-HR-03.

| #   | Do this                                                                                                 | You should see                                                                                                  | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Create a 1-day Casual Leave request and **Save as Draft**                                               | Status **Draft**                                                                                                | ☐     |       |
| 2   | On the request page, click **Cancel Request**                                                           | A dialog **Cancel Leave Request** with an optional reason and buttons **No, Keep It** / **Yes, Cancel Request** | ☐     |       |
| 3   | Click **No, Keep It**                                                                                   | Nothing changes — still **Draft**                                                                               | ☐     |       |
| 4   | Click **Cancel Request** again, type a reason, click **Yes, Cancel Request**                            | Status becomes **Cancelled**; the History panel records it with your reason                                     | ☐     |       |
| 5   | Check your Casual Leave card                                                                            | Unchanged — a draft never held any days                                                                         | ☐     |       |
| 6   | Create another 1-day request and **Submit for Approval**. Note the balance                              | Pending up by 1                                                                                                 | ☐     |       |
| 7   | Cancel it from the **Pending Approval** state                                                           | Status **Cancelled**                                                                                            | ☐     |       |
| 8   | Check your Casual Leave card                                                                            | **Pending back down by 1, Available back up by 1**                                                              | ☐     |       |
| 9   | **As Approver A**, check Flow → **Inbox**                                                               | Their approval card for that request has cleared                                                                | ☐     |       |
| 10  | Create a third request, submit it, and have **Approver A approve once** (status **Partially Approved**) | Chip reads **1/2 approvals**                                                                                    | ☐     |       |
| 11  | As yourself, click **Cancel Request** on that partially-approved request                                | Allowed. Status becomes **Cancelled**                                                                           | ☐     |       |
| 12  | Check your Casual Leave card                                                                            | Held day released; Used still unchanged                                                                         | ☐     |       |

**Should NOT be possible:**

- Cancelling a request that is already **Approved**, **Rejected** or **Cancelled** — the **Cancel Request** button must not be offered.
- Cancelling somebody else's request — the button must not be offered on their request at all.

---

## UAT-HR-10 — Half-day leave, and holidays dropping out of the day count

**Goal:** confirm the day counter is right — half days count as 0.5, and weekends and company holidays inside a range are not charged.
**Who:** anyone.
**Before you start:** requires **Casual Leave** to have **Allow Half Day** switched on (UAT-HR-03 step 5) and at least one future company holiday (UAT-HR-04).

| #   | Do this                                                                                           | You should see                                                                                     | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **Apply for Leave**. Choose Casual Leave. Set Start Date and End Date to the **same** working day | A **Half Day Leave** switch appears                                                                | ☐     |       |
| 2   | Turn the switch on                                                                                | A **Half Day Type** dropdown appears with **First Half (Morning)** and **Second Half (Afternoon)** | ☐     |       |
| 3   | Choose **Second Half (Afternoon)**                                                                | The summary box reads **Total Leave Days: 0.5 (Half Day)**                                         | ☐     |       |
| 4   | Add a reason and **Submit for Approval**                                                          | The detail page shows **Number of Days: 0.5 (Second Half)**                                        | ☐     |       |
| 5   | Check your Casual Leave card                                                                      | **Pending has gone up by exactly 0.5**                                                             | ☐     |       |
| 6   | Cancel that request, then start a new one                                                         | Pending back to where it was                                                                       | ☐     |       |
| 7   | Choose a date range that **spans a Sunday** — e.g. Friday to Monday                               | The summary box reads **Total Leave Days: 2**, and underneath: _"1 holiday excluded: Sunday"_      | ☐     |       |
| 8   | Choose a range that spans **a company holiday** you created                                       | The count drops by one more, and the excluded line names your holiday                              | ☐     |       |
| 9   | Choose a range spanning a **1st or 3rd Saturday**                                                 | It is excluded too, named **1st Saturday** or **3rd Saturday**                                     | ☐     |       |
| 10  | Choose a long range whose count exceeds your available balance                                    | A red line reads **Exceeds available balance!**                                                    | ☐     |       |
| 11  | Try to submit that over-balance request                                                           | Blocked with a message naming your leave type and the days actually available                      | ☐     |       |
| 12  | Set the range back to two working days and submit                                                 | Goes through normally                                                                              | ☐     |       |

**Also check:**

- Cancel the half-day request afterwards and confirm the 0.5 comes back cleanly — the balance should return to a whole number, not `9.999…`.

**Should NOT be possible:**

- Setting **Half Day** on a multi-day range — the switch must disappear as soon as the two dates differ.
- Turning on Half Day for a leave type whose **Allow Half Day** is off — the switch must not appear.

---

## UAT-HR-11 — Leave guards — overlap, over-balance, self-approval, double approval

**Goal:** confirm the app blocks the four things it is supposed to block, and says why.
**Who:** you, **Approver A**, and a limited user.
**Before you start:** requires UAT-HR-03. You need one **Pending Approval** request of your own.

| #   | Do this                                                                                                                       | You should see                                                                                                                                     | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | With a Pending Approval request already covering, say, 12–13 March, apply for leave on **13 March**                           | Blocked, with a message naming the clashing request number and its leave type                                                                      | ☐     |       |
| 2   | Apply for leave on a range that **partly** overlaps the same request                                                          | Blocked the same way — partial overlaps count                                                                                                      | ☐     |       |
| 3   | Apply for a range on either side of the existing one, not touching it                                                         | Allowed                                                                                                                                            | ☐     |       |
| 4   | Apply for more days than your Available balance                                                                               | Blocked, naming the leave type and the number of days actually available                                                                           | ☐     |       |
| 5   | If you are yourself on the approver list: open your own Pending request and look for **Approve**                              | Either the button is absent, or clicking it is refused with a message about not approving your own request. Either behaviour passes — record which | ☐     |       |
| 6   | Read the Approval Status panel on your own request while you are also an approver                                             | It says only **1** approval is required, from the other approver — the app takes you out of your own approval chain                                | ☐     |       |
| 7   | **As Approver A**, approve the request once, then reload and try to approve again                                             | Refused — _"You have already approved this request."_                                                                                              | ☐     |       |
| 8   | **As the limited user, sign in.** Open HR & Leave → **Leaves**                                                                | Only **My Leaves** — no Team Requests, no Leave Summary tab                                                                                        | ☐     |       |
| 9   | Still as the limited user, open somebody else's leave request via a link you paste in                                         | No **Approve** and no **Reject** buttons                                                                                                           | ☐     |       |
| 10  | **As a user who has Approve Leaves but is NOT on the configured approver list**, open a pending request and click **Approve** | ⚠ known issue — the button is shown but the save is refused with _"You are not authorized to approve this request."_ Do not file this              | ☐     |       |

**Should NOT be possible:**

- Approving your own leave request.
- The same person contributing two of the two required approvals.
- Applying for leave that overlaps a request you already have in Draft, Pending Approval or Approved.
- Applying for more days than you have.

---

## UAT-HR-12 — Team Calendar and Leave Summary

**Goal:** confirm the two management views show the right people and the right numbers.
**Who:** someone with **Approve Leaves**, plus a limited user for the last step.
**Before you start:** requires at least one **Approved** leave request (UAT-HR-07).

| #   | Do this                                                                                    | You should see                                                                                                           | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | HR & Leave → **Team Calendar**                                                             | **Team Leave Calendar**, current month, with a legend: **On Leave**, **Weekend (Sun, 1st/3rd Sat)**, **Company Holiday** | ☐     |       |
| 2   | Find the days of your approved leave                                                       | They are marked **On Leave** with your name                                                                              | ☐     |       |
| 3   | Confirm a **Pending Approval** request is **not** shown                                    | Only approved leave appears here                                                                                         | ☐     |       |
| 4   | Check the Sundays and 1st/3rd Saturdays                                                    | Marked as weekends                                                                                                       | ☐     |       |
| 5   | Check a company holiday you created                                                        | Marked as a company holiday                                                                                              | ☐     |       |
| 6   | Use the arrows to step to the next and previous month, then click the **Go to Today** icon | Navigation works and the month title updates each time                                                                   | ☐     |       |
| 7   | HR & Leave → **Leaves → Leave Summary** tab                                                | **Leave Summary** with a Total Employees card and one card per leave type showing Used and Available totals              | ☐     |       |
| 8   | Find your own row in the table                                                             | Your Used and Available numbers per leave type match your own My Leaves cards exactly                                    | ☐     |       |
| 9   | Search for a colleague by name, then by email                                              | Both find them                                                                                                           | ☐     |       |
| 10  | Change the **Year** selector to last year                                                  | Either past balances or _"No leave balances found for this year."_ — not an error                                        | ☐     |       |
| 11  | **As the limited user, sign in** and try to reach the Leave Summary                        | Not offered; if reached directly it must say you do not have permission to view leave summary                            | ☐     |       |

**Also check:**

- The **Total** column for a person equals the sum of their Used across all leave types.

---

## UAT-HR-13 — Declare a working day and grant comp-off in bulk

**Goal:** confirm an admin can turn a holiday into a working day and hand out a comp-off day to everyone affected in one action.
**Who:** an admin with **Manage HR Settings**. Ask a colleague to check their balance afterwards.
**Before you start:** requires a future company holiday (UAT-HR-04). Note your own and one colleague's **Comp-Off Available** number first.

| #   | Do this                                                                                                                                       | You should see                                                                                | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | HR & Leave → Holidays → **Manage Holidays**                                                                                                   | **Holiday Settings**                                                                          | ☐     |       |
| 2   | On a holiday row, click the small work icon (**Convert to working day**)                                                                      | A dialog **Convert Holiday to Working Day**                                                   | ☐     |       |
| 3   | Choose **Specific Users**, pick yourself and one colleague, type a reason, and submit                                                         | A success message saying the holiday was converted and comp-off will be processed for 2 users | ☐     |       |
| 4   | Scroll to the history section further down the page                                                                                           | A record of the override you just created, showing the date, scope and reason                 | ☐     |       |
| 5   | Open HR & Leave → **Leaves → My Leaves** and read the **Compensatory Leave Balance** card                                                     | **Entitled and Available are each 1 higher than before**                                      | ☐     |       |
| 6   | Ask your colleague to check theirs                                                                                                            | Theirs went up by 1 too                                                                       | ☐     |       |
| 7   | Ask a third colleague who was **not** selected                                                                                                | Their comp-off is unchanged                                                                   | ☐     |       |
| 8   | Try to convert **the same holiday** to a working day a second time                                                                            | The app refuses — a completed override already exists for that date. Record the wording       | ☐     |       |
| 9   | Back on the leave application form, open the Start Date picker and look at that date                                                          | It is now **selectable** — the override beats the holiday calendar                            | ☐     |       |
| 10  | Click **Declare Working Day** in the page header. Pick an upcoming **Sunday**, give it a name, choose **All Users**, add a reason, and submit | A success message naming the day and that comp-off will be processed for all users            | ☐     |       |
| 11  | Check your comp-off card again                                                                                                                | Up by 1 more                                                                                  | ☐     |       |
| 12  | Open the leave application form and look at that Sunday in the date picker                                                                    | Now selectable, even though Sundays are normally blocked                                      | ☐     |       |

**Should NOT be possible:**

- Declaring a working day without a reason, or with **Specific Users** chosen but nobody selected.
- Two completed overrides on the same date.
- A user without **Manage HR Settings** reaching either dialog.

---

## UAT-HR-14 — On-duty request through to approval and the comp-off credit

**Goal:** apply to work on a holiday, get it approved by two people, and confirm one comp-off day is credited.
**Who:** you, **Approver A**, **Approver B**.
**Before you start:** requires a **future** company holiday (UAT-HR-04) with **no** approved leave of yours on that date. Note your **Comp-Off Available** number.

| #   | Do this                                                                                       | You should see                                                                                                                             | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | HR & Leave → **On-Duty Requests**                                                             | **My On-Duty Requests**, a **Compensatory Leave Balance** card, and a **New On-Duty Request** button                                       | ☐     |       |
| 2   | Click **New On-Duty Request**                                                                 | A page explaining that on approval you receive compensatory leave                                                                          | ☐     |       |
| 3   | Pick an ordinary **working day** in the Holiday Date field                                    | A red validation message — the date must genuinely be a holiday                                                                            | ☐     |       |
| 4   | Pick a date **in the past** that was a holiday                                                | Rejected — past dates are not allowed                                                                                                      | ☐     |       |
| 5   | Pick your future company holiday                                                              | The validation clears and the helper text reads **Holiday: &lt;holiday name&gt;**                                                          | ☐     |       |
| 6   | Type a reason, e.g. `TEST — UAT-HR-14 commissioning support`                                  | Accepted                                                                                                                                   | ☐     |       |
| 7   | Click **Save as Draft**                                                                       | Back on **My On-Duty Requests**; a row with status **Draft** and a number in the form **OD-2026-0001**                                     | ☐     |       |
| 8   | Open it with the eye icon, then click **Submit for Approval**                                 | Status chip becomes **Pending Approval**                                                                                                   | ☐     |       |
| 9   | Check the **Comp-Off Granted** field                                                          | Reads **Not yet**                                                                                                                          | ☐     |       |
| 10  | **As Approver A, sign in.** Open Flow → **Inbox**                                             | A card **On-Duty Request: &lt;your name&gt;**                                                                                              | ☐     |       |
| 11  | Click the card, then click **Approve**                                                        | Status becomes **Partially Approved**; an approval timeline appears reading "1 of 2 approvals completed"                                   | ☐     |       |
| 12  | **As yourself**, check your comp-off card                                                     | **Unchanged** — the credit is not given until the second approval                                                                          | ☐     |       |
| 13  | **As Approver B, sign in.** Open the request from their Inbox and click **Approve**           | Status becomes **Approved**                                                                                                                | ☐     |       |
| 14  | Read the request                                                                              | **Comp-Off Granted** now shows a green tick and **Yes**                                                                                    | ☐     |       |
| 15  | Both approvers check Flow → **Inbox**                                                         | Their on-duty action cards have cleared themselves                                                                                         | ☐     |       |
| 16  | Approver A also sees an informational card **Team On-Duty Notice** naming you and the holiday | Everyone is told                                                                                                                           | ☐     |       |
| 17  | **As yourself**, open Flow → **Inbox**                                                        | **On-Duty Request Approved** — _"…You have been granted 1 comp-off day."_                                                                  | ☐     |       |
| 18  | Open HR & Leave → **On-Duty Requests**                                                        | Your row shows **Approved** with a tick under **Comp-Off Granted**; the Compensatory Leave Balance card is **1 higher**                    | ☐     |       |
| 19  | Open **Leaves → My Leaves**                                                                   | The same +1 shows on the Compensatory Leave Balance card there too                                                                         | ☐     |       |
| 20  | Check your **email inbox**, and Approver A's                                                  | ⚠ known issue — **no on-duty email arrives** for anyone at any stage. The in-app notifications above are the only signal. Do not file this | ☐     |       |

**Also check:**

- The comp-off credit expires one year from the day it was granted. There is no way to see the expiry date in the app; note this if it matters to you.

**Should NOT be possible:**

- Raising a second on-duty request for the same holiday date while one is still active.
- Raising an on-duty request for a date on which you already have approved leave.
- Approving your own on-duty request.
- The same approver approving twice.

---

## UAT-HR-15 — On-duty — reject, cancel, and the date guards

**Goal:** confirm rejection and cancellation behave, and see where the app currently blocks you.
**Who:** you and **Approver A**.
**Before you start:** requires a future company holiday and requires UAT-HR-04.

| #   | Do this                                                                       | You should see                                                                                                                                                            | Pass? | Notes |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Raise and submit a new on-duty request for a different future holiday         | Status **Pending Approval**                                                                                                                                               | ☐     |       |
| 2   | **As Approver A**, open it and click **Reject**                               | A dialog **Reject On-Duty Request** demanding a **Rejection Reason**                                                                                                      | ☐     |       |
| 3   | Try to confirm with the reason blank                                          | The Reject button in the dialog stays greyed out                                                                                                                          | ☐     |       |
| 4   | Type a reason and confirm                                                     | Status becomes **Rejected**; a **Rejection Reason** panel names the approver, the reason and the date                                                                     | ☐     |       |
| 5   | **As yourself**, check Flow → **Inbox**                                       | **On-Duty Request Rejected**                                                                                                                                              | ☐     |       |
| 6   | Check your comp-off card                                                      | Unchanged — no credit for a rejected request                                                                                                                              | ☐     |       |
| 7   | Open the rejected request                                                     | No Approve, Reject, Submit or Cancel buttons — only **Back to Requests**                                                                                                  | ☐     |       |
| 8   | Raise another on-duty request and **Save as Draft**. Click **Cancel Request** | A dialog asking to confirm, with an optional reason                                                                                                                       | ☐     |       |
| 9   | Click **Go Back**                                                             | Nothing changes — still **Draft**                                                                                                                                         | ☐     |       |
| 10  | Click **Cancel Request** again and confirm                                    | Status becomes **Cancelled**                                                                                                                                              | ☐     |       |
| 11  | Raise another, submit it, then cancel it from **Pending Approval**            | Cancelled successfully                                                                                                                                                    | ☐     |       |
| 12  | **As Approver A**, check Flow → **Inbox**                                     | Their action card for that request has cleared; a card **On-Duty Request Cancelled** may appear                                                                           | ☐     |       |
| 13  | Take the **Approved** on-duty request from UAT-HR-14 and try to cancel it     | ⚠ known issue — there is **no Cancel Request button** once a request is approved, even though the rule allows cancelling up to a day before the holiday. Do not file this | ☐     |       |

**Should NOT be possible:**

- Cancelling somebody else's on-duty request.
- Cancelling a request that is already Cancelled or Rejected.

---

## UAT-HR-16 — Spend a comp-off day

**Goal:** confirm a comp-off day earned by working a holiday can actually be taken as leave, and the balance goes down.
**Who:** you and **Approver A** (and B if two approvals are required).
**Before you start:** requires at least **1 comp-off day available** — from UAT-HR-13 or UAT-HR-14. Note the number.

| #   | Do this                                                         | You should see                                                                                               | Pass? | Notes |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | HR & Leave → **Leaves → Apply for Leave**                       | The leave form                                                                                               | ☐     |       |
| 2   | Open the **Leave Type** dropdown                                | **Comp Off** (or the name your company gave it) is listed alongside Sick and Casual                          | ☐     |       |
| 3   | Select it                                                       | The helper text reads _"Available: n days"_, matching your comp-off card                                     | ☐     |       |
| 4   | Pick one working day, add a reason, and **Submit for Approval** | Status **Pending Approval**                                                                                  | ☐     |       |
| 5   | Check the **Compensatory Leave Balance** card                   | **Pending is 1 and Available has dropped by 1**                                                              | ☐     |       |
| 6   | Have the approver(s) approve it through to **Approved**         | Status **Approved**                                                                                          | ☐     |       |
| 7   | Check the comp-off card again                                   | **Pending back to 0, Used up by 1, Available unchanged from step 5** — the day was spent, not double-counted | ☐     |       |
| 8   | Try to apply for **more comp-off days than you have available** | Blocked, naming the days actually available                                                                  | ☐     |       |

**Should NOT be possible:**

- Taking comp-off you have not earned — the available figure is the ceiling.
- Comp-off appearing with an entitlement above zero for someone who never worked a holiday.

---

## UAT-HR-17 — Create a travel expense report — round-trip check

**Goal:** create a claim header with every field filled and confirm nothing is lost.
**Who:** anyone.
**Before you start:** know one real project or cost centre name to charge the trip to.

| #   | Do this                                                                                                    | You should see                                                                                                                                      | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | HR & Leave → **Travel Expenses**                                                                           | A page with tabs **All / Drafts / Pending / Approved / Reimbursed** and a **New Report** button                                                     | ☐     |       |
| 2   | Click **New Report**                                                                                       | **New Travel Expense Report**, with a note that you add the expense lines afterwards                                                                | ☐     |       |
| 3   | Fill **Trip Purpose** with something specific, e.g. `TEST — UAT-HR-17 site visit, Desolenator Chennai`     | Accepted                                                                                                                                            | ☐     |       |
| 4   | Choose a **Project / Cost Centre**                                                                         | The selector finds real projects and cost centres                                                                                                   | ☐     |       |
| 5   | Set **Trip Start Date**                                                                                    | **Trip End Date** fills in with the same date                                                                                                       | ☐     |       |
| 6   | Set **Trip End Date** two days later                                                                       | The picker will not let you pick a date before the start                                                                                            | ☐     |       |
| 7   | Add **two destinations** — pick one from the list, type another and press Enter                            | Both appear as chips                                                                                                                                | ☐     |       |
| 8   | Fill **Additional Notes**                                                                                  | Accepted                                                                                                                                            | ☐     |       |
| 9   | Click **Create Report**                                                                                    | You land on the report's own page. Status chip **Draft**. Number in the form **TE-2026-0001**                                                       | ☐     |       |
| 10  | Read the trip summary card                                                                                 | Trip Dates, Destinations (both of them), Total Amount ₹0.00 and GST Amount ₹0.00                                                                    | ☐     |       |
| 11  | Confirm the **trip purpose** appears under the report number, and the **project** appears in the list view | Both correct                                                                                                                                        | ☐     |       |
| 12  | Go back to **Travel Expenses** and read your row                                                           | Report #, Trip Purpose, Project, Destinations, Duration, Amount, Status — all matching what you typed                                               | ☐     |       |
| 13  | Try to change the trip purpose, dates, destinations, project or notes                                      | ⚠ known issue — there is **no way to edit the report header** once it is created. If you got it wrong you must start a new report. Do not file this | ☐     |       |
| 14  | Click the **Drafts** tab                                                                                   | Your report is there, with an **Edit** button rather than **View**                                                                                  | ☐     |       |

**Also check:**

- The **Duration** column shows the trip length in a sensible form (e.g. "3 days"), not a raw date difference.
- Amounts are shown in rupees with two decimals.

---

## UAT-HR-18 — Add expense lines by hand and by AI receipt reading

**Goal:** confirm both ways of adding a cost work, that the receipt reader extracts sensible values, and that the totals recalculate every time.
**Who:** anyone.
**Before you start:** requires the **Draft** report from UAT-HR-17, and a real receipt file (PDF or photo, under 5 MB) with a vendor, date, amount and preferably a GST breakdown.

| #   | Do this                                                                                                                                                          | You should see                                                                                                                                  | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open your draft report and click **Add Expense**                                                                                                                 | A dialog offering two routes: **Upload Receipt** (marked _Recommended_, "Auto-extract details using OCR") and **Manual Entry**                  | ☐     |       |
| 2   | Choose **Manual Entry**. Set Category to **Travel**                                                                                                              | **From Location** and **To Location** fields appear                                                                                             | ☐     |       |
| 3   | Fill Description, Expense Date, Amount (INR), Vendor Name, From and To                                                                                           | All accepted                                                                                                                                    | ☐     |       |
| 4   | Click **Add Item**                                                                                                                                               | The dialog closes; the line appears in the **Expense Items** table with a **Travel** chip and a plane icon                                      | ☐     |       |
| 5   | Read the trip summary card                                                                                                                                       | **Total Amount** now equals your line's amount                                                                                                  | ☐     |       |
| 6   | Read the **Category Summary** block below the table                                                                                                              | Travel shows that amount; other categories show ₹0.00                                                                                           | ☐     |       |
| 7   | Add a second manual line with category **Food** and a different amount                                                                                           | Total Amount = the two amounts added together; Food now has its own figure in the Category Summary                                              | ☐     |       |
| 8   | Click the paperclip on a line without a receipt, upload a file                                                                                                   | The paperclip is replaced by a green eye icon; clicking it opens the receipt in a new tab                                                       | ☐     |       |
| 9   | Click **Add Expense** again, choose **Upload Receipt**, then **Choose File** and pick your receipt                                                               | An upload progress bar, then **Parsing Receipt…** — _"Analyzing with both Google Document AI and Claude AI"_                                    | ☐     |       |
| 10  | Wait for the comparison screen                                                                                                                                   | Two side-by-side cards, **Google Document AI** and **Claude AI**, each with a Success/Failed chip                                               | ☐     |       |
| 11  | Compare the two cards against the actual receipt                                                                                                                 | Each shows Vendor, Amount, Date, Invoice #, GST Amount and a suggested Category, plus a processing time and a confidence percentage             | ☐     |       |
| 12  | Note which parser got the **amount** right, and which got the **vendor** right                                                                                   | Record both in the Notes column — this comparison is the point of the screen                                                                    | ☐     |       |
| 13  | If the receipt carries the company's own GSTIN, look for it                                                                                                      | A green **Found** chip against **Company GST**                                                                                                  | ☐     |       |
| 14  | Click **Use These Results** on the better card                                                                                                                   | That button changes to **Selected** and you move to a review form pre-filled from that parser                                                   | ☐     |       |
| 15  | Read the review form                                                                                                                                             | A note _"(auto-filled from receipt - please review)"_, the receipt filename and size, and the parsing confidence                                | ☐     |       |
| 16  | Check every pre-filled value against the paper receipt — Category, Expense Date, Description, Amount, Vendor Name, Invoice/Bill Number, Vendor GSTIN, GST Amount | Record any field the parser got wrong                                                                                                           | ☐     |       |
| 17  | Correct anything wrong, then click **Add Expense**                                                                                                               | The line joins the table with the values **as you corrected them**, not as the parser guessed                                                   | ☐     |       |
| 18  | Hover the small **GST: ₹…** figure under that line's amount                                                                                                      | A tooltip breaking out CGST / SGST / IGST / Taxable and the vendor's GSTIN                                                                      | ☐     |       |
| 19  | Read the trip summary card                                                                                                                                       | **GST Amount** now reflects the parsed tax; **Total Amount** includes all three lines                                                           | ☐     |       |
| 20  | Delete one line with the red bin icon and confirm                                                                                                                | A warning that it cannot be undone; after confirming, the line goes and **both** the total and the category summary drop by exactly that amount | ☐     |       |
| 21  | Click **Download PDF**                                                                                                                                           | A PDF downloads containing the report, its lines, and the receipt images embedded                                                               | ☐     |       |
| 22  | Try to change an existing line's amount or description                                                                                                           | ⚠ known issue — **lines cannot be edited**, only added and deleted. Delete and re-add instead. Do not file this                                 | ☐     |       |

**Also check:**

- Try uploading a **7 MB** file: refused with _"File size exceeds 5MB limit"_.
- Try uploading a Word document or a spreadsheet: refused with a message naming the allowed types (PDF, JPEG, PNG, WebP).
- If the parsers fail on a difficult receipt, the app should fall back to the manual review form with a warning rather than dead-ending — use **Enter details manually** on the comparison screen to confirm that route works.
- Expense dates on the review form are limited to the trip's own date range.

---

## UAT-HR-19 — Submit a claim, get it returned, fix it, resubmit

**Goal:** confirm the return-for-revision loop works and puts the claim back in your hands.
**Who:** you and **Approver A** (must be on the configured travel-expense approver list).
**Before you start:** requires the report from UAT-HR-18 with at least two lines on it.

| #   | Do this                                                                                   | You should see                                                                                                 | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Create a **new empty** report and try to submit it                                        | There is no **Submit for Approval** button on a report with no lines                                           | ☐     |       |
| 2   | Open your populated report and click **Submit for Approval**                              | A confirmation dialog warning that **you will not be able to edit it after submission**, and showing the total | ☐     |       |
| 3   | Click **Cancel** in that dialog                                                           | Nothing happens — still **Draft**                                                                              | ☐     |       |
| 4   | Click **Submit for Approval** again, then **Submit**                                      | Status chip becomes **Submitted**                                                                              | ☐     |       |
| 5   | Look for **Add Expense** and the bin icons                                                | All gone — a submitted report is locked                                                                        | ☐     |       |
| 6   | Click the **Pending** tab on the Travel Expenses list                                     | Your report is listed there                                                                                    | ☐     |       |
| 7   | **As Approver A, sign in.** Open Flow → **Inbox**                                         | A card **Travel Expense: TE-2026-nnnn** naming you, the trip purpose and the total in rupees                   | ☐     |       |
| 8   | Click the card                                                                            | The report opens with **Approve**, **Return** and **Reject** buttons                                           | ☐     |       |
| 9   | Click **Return**                                                                          | A dialog **Return for Revision** demanding **Comments**                                                        | ☐     |       |
| 10  | Try to confirm with comments blank                                                        | Blocked, with _"Comments are required"_                                                                        | ☐     |       |
| 11  | Type `TEST — UAT-HR-19 hotel bill is missing the GSTIN` and click **Return for Revision** | Status goes back to **Draft**                                                                                  | ☐     |       |
| 12  | Reload as Approver A                                                                      | The Approve / Return / Reject buttons are gone — the claim is no longer theirs                                 | ☐     |       |
| 13  | **As yourself, sign in.** Open Flow → **Inbox**                                           | A card **Travel Expense Report Returned for Revision**, quoting your approver's comment                        | ☐     |       |
| 14  | Open the report                                                                           | Status **Draft**, and **Add Expense** and the bin icons are available again                                    | ☐     |       |
| 15  | Add a line, then click **Submit for Approval** and confirm                                | Status **Submitted** again, and a fresh card lands in Approver A's Inbox                                       | ☐     |       |

**Should NOT be possible:**

- Submitting a report with no expense lines.
- Editing or deleting lines while the report is Submitted.
- Submitting somebody else's report.
- Submitting a report when you are the **only** configured approver — the app must refuse with a message that you cannot approve your own report.

---

## UAT-HR-20 — Approve and reject a travel expense claim

**Goal:** confirm the two decision paths, including approving for less than the amount claimed.
**Who:** you and **Approver A**.
**Before you start:** requires the **Submitted** report from UAT-HR-19, plus a second submitted report to reject.

| #   | Do this                                                                  | You should see                                                                                                     | Pass? | Notes |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | **As Approver A**, open the submitted report and click **Approve**       | A dialog **Approve Travel Expense Report** naming the report number and the amount, with optional **Comments**     | ☐     |       |
| 2   | Click **Cancel**                                                         | Nothing happens — still **Submitted**                                                                              | ☐     |       |
| 3   | Click **Approve** again, add a comment, and confirm                      | Status becomes **Approved**                                                                                        | ☐     |       |
| 4   | Reload                                                                   | Approve / Return / Reject are gone                                                                                 | ☐     |       |
| 5   | Check Approver A's Flow → **Inbox**                                      | Their action card for that report has cleared                                                                      | ☐     |       |
| 6   | **As yourself**, check Flow → **Inbox**                                  | **Travel Expense Report Approved**, naming the report number                                                       | ☐     |       |
| 7   | Open Travel Expenses → **Approved** tab                                  | The report is listed there                                                                                         | ☐     |       |
| 8   | **As Approver A**, open the second submitted report and click **Reject** | A dialog **Reject Travel Expense Report** demanding a **Rejection Reason**, with the field flagged red while empty | ☐     |       |
| 9   | Try to confirm with the reason blank                                     | Blocked                                                                                                            | ☐     |       |
| 10  | Type a reason and confirm                                                | Status becomes **Rejected**                                                                                        | ☐     |       |
| 11  | **As yourself**, check Flow → **Inbox**                                  | **Travel Expense Report Rejected**, quoting the reason                                                             | ☐     |       |
| 12  | Open the rejected report                                                 | No decision buttons; **Download PDF** still works                                                                  | ☐     |       |

**Should NOT be possible:**

- Approving or rejecting **your own** claim — even with the right permission, the buttons must not be offered to the employee named on the report, and the save must be refused if forced.
- Approving a claim that is already Approved, Rejected or Reimbursed.
- Someone who is not on the configured approver list seeing Approve / Return / Reject on any report.

---

## UAT-HR-21 — Mark a claim reimbursed

> ⚠ **Known issue — expected to fail.** There is no **Mark Reimbursed** button anywhere in the app, so an approved claim can never move to **Reimbursed**. Do not file feedback for this; it is already on the fix list. Run the test only to confirm the situation has not changed.

**Goal:** record that the final step of the expense lifecycle is unreachable.
**Who:** anyone with the approved report open.
**Before you start:** requires the **Approved** report from UAT-HR-20.

| #   | Do this                                                    | You should see                                                                                  | Pass? | Notes |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the approved report                                   | Status **Approved**; the only button in the header is **Download PDF**                          | ☐     |       |
| 2   | Look anywhere on the page for a way to record the payment  | ⚠ known issue — nothing exists                                                                  | ☐     |       |
| 3   | Click the **Reimbursed** tab on the Travel Expenses list   | Empty. Note it here if a report has somehow reached that status — that would be new information | ☐     |       |
| 4   | Check your email for a _Travel Expense Reimbursed_ message | None — the email is only sent when the status changes, which cannot happen                      | ☐     |       |

---

## UAT-FLOW-01 — Create and assign a task — round-trip check

**Goal:** create a task with every field filled, assign it to someone else, and confirm it arrives on their list intact.
**Who:** you and any colleague.
**Before you start:** know one real project name.

| #   | Do this                                                                                                                                                         | You should see                                                                                                                                      | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar → **DAILY OPERATIONS → Flow**                                                                                                                           | The **Flow** landing page with **Daily Work** (My Tasks, Inbox) and **Collaboration** (Team Board, Meeting Minutes, Portfolio Review)               | ☐     |       |
| 2   | Click **My Tasks** → **New Task**                                                                                                                               | A dialog **New Task**                                                                                                                               | ☐     |       |
| 3   | Note who is pre-filled in **Assignee**                                                                                                                          | Yourself                                                                                                                                            | ☐     |       |
| 4   | Fill **Title** and **Description**, change **Assignee** to a colleague, pick a **Project**, set **Priority** to **Urgent**, and set a **Due Date** two days out | All six accepted; the assignee list shows names with their department                                                                               | ☐     |       |
| 5   | Click **Create Task**                                                                                                                                           | A green "Task created" message; the dialog closes                                                                                                   | ☐     |       |
| 6   | Look at **My Tasks**                                                                                                                                            | The task is **not** in your list — it belongs to the person you assigned it to                                                                      | ☐     |       |
| 7   | Ask the colleague to open **Flow → My Tasks**                                                                                                                   | The task appears **without them reloading the page** — the list is live                                                                             | ☐     |       |
| 8   | Have them read the card                                                                                                                                         | Title in bold (Urgent tasks are heavier), the description underneath, then chips for **URGENT**, their own name, the due date, and the project name | ☐     |       |
| 9   | Have them confirm every value matches what you typed                                                                                                            | Title, description, priority, due date, project and assignee all exactly as entered                                                                 | ☐     |       |
| 10  | Create a second task assigned to **yourself** with **no** description, **no** project and **no** due date                                                       | Created cleanly; the card shows only the title, the priority chip and your name — no empty chips                                                    | ☐     |       |
| 11  | Reload your **My Tasks** page                                                                                                                                   | Both the task you kept and its values survive the reload                                                                                            | ☐     |       |
| 12  | Try to change a task's title, assignee, due date or priority after creating it                                                                                  | ⚠ known issue — there is **no edit form for a task**. You can only change its status or delete it. Do not file this                                 | ☐     |       |
| 13  | From the Flow landing page, click the **New Task** action in the header                                                                                         | The same **New Task** dialog opens                                                                                                                  | ☐     |       |

**Also check:**

- A due date **in the past** should show as a red **"n d overdue"** chip; one set to today should read **Due today**, tomorrow **Due tomorrow**.

**Should NOT be possible:**

- Assigning a task to a deactivated user — they must not appear in the Assignee list, and the save must be refused if forced.
- Creating a task with an empty title — the **Create Task** button stays greyed out.

---

## UAT-FLOW-02 — Move a task through its life, and delete one

**Goal:** confirm the status control works, terminal states lock, and only the creator can delete.
**Who:** you and a colleague.
**Before you start:** requires both tasks from UAT-FLOW-01.

| #   | Do this                                                                                | You should see                                                                                                             | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On your own task card, hover the circle icon on the left                               | A tooltip reading **Mark as in_progress**                                                                                  | ☐     |       |
| 2   | Click it                                                                               | The icon turns into a blue play symbol; the **In Progress** tab count goes up by one and **Todo** down by one              | ☐     |       |
| 3   | Click the icon again                                                                   | A green tick; the title is struck through; the card fades; **Done** count goes up                                          | ☐     |       |
| 4   | Hover the icon on the completed task                                                   | Tooltip reads **Completed** and the control is disabled — **Done** is the end of the line                                  | ☐     |       |
| 5   | Look for the bin icon on the completed task                                            | Gone — completed tasks cannot be deleted from the card                                                                     | ☐     |       |
| 6   | Click the **Done** tab                                                                 | Your completed task is listed there                                                                                        | ☐     |       |
| 7   | Click the **All** tab                                                                  | Todo, In Progress and Done tasks all appear; the count chip matches the number of cards                                    | ☐     |       |
| 8   | Create a fresh task for yourself. Try to move it from **In Progress** back to **Todo** | ⚠ known issue — the control only steps forward. There is no way back to Todo and no way to cancel a task. Do not file this | ☐     |       |
| 9   | On a task you created but assigned to your colleague, click the bin icon               | A "Task deleted" message; the task disappears from their list too                                                          | ☐     |       |
| 10  | Ask the colleague to create a task **for you**, then try to delete it from your list   | Refused with a message about only the creator being able to delete                                                         | ☐     |       |
| 11  | Ask the colleague to move that task to **In Progress** from their side                 | Your list updates within a couple of seconds without a reload                                                              | ☐     |       |

**Should NOT be possible:**

- Deleting a task somebody else created.
- Changing the status of a task you neither created nor are assigned to.
- Any status change on a task that is already **Done**.

---

## UAT-FLOW-03 — Team Board

**Goal:** confirm the team-wide view shows who is working on what.
**Who:** you and a colleague, each with at least one open task.
**Before you start:** requires UAT-FLOW-01.

| #   | Do this                                               | You should see                                                                            | Pass? | Notes |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Flow → **Team Board**                                 | A page titled **Team Board** and a line reading "_n_ active tasks across _m_ members"     | ☐     |       |
| 2   | Find yourself and your colleague                      | Each with their own Todo and In Progress counts and their open tasks listed               | ☐     |       |
| 3   | Compare your own block against your **My Tasks** page | The same open tasks, with the same priority chips                                         | ☐     |       |
| 4   | Confirm **completed** tasks are not shown             | Only Todo and In Progress appear here                                                     | ☐     |       |
| 5   | Search for a colleague by name                        | The board narrows to them                                                                 | ☐     |       |
| 6   | Have the colleague mark one of their tasks **Done**   | Within a couple of seconds it disappears from the board and the header count drops by one | ☐     |       |

---

## UAT-FLOW-04 — Record meeting minutes and save as a draft

**Goal:** capture a meeting with action items and keep it as a draft.
**Who:** anyone. Pick two colleagues to be attendees.
**Before you start:** nothing.

| #   | Do this                                                                               | You should see                                                                                                                           | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Flow → **Meeting Minutes** → **New Meeting**                                          | A two-step form: **Meeting Details**, then **Action Items**                                                                              | ☐     |       |
| 2   | Fill **Meeting Title**, **Date**, **Duration (min)**, **Location**                    | All accepted                                                                                                                             | ☐     |       |
| 3   | Add two **Attendees**                                                                 | Each appears as a chip with an avatar                                                                                                    | ☐     |       |
| 4   | Fill **Agenda** and **Notes** with several lines each                                 | Both accept multi-line text                                                                                                              | ☐     |       |
| 5   | Try to continue before setting a title, date or attendee                              | **Next: Action Items** stays greyed out until all three are filled                                                                       | ☐     |       |
| 6   | Click **Next: Action Items**                                                          | A table with columns Description, Action, Responsible Person, Due Date, Priority                                                         | ☐     |       |
| 7   | Fill a first row completely, choosing a **Responsible Person** from the attendee list | The Responsible Person dropdown offers your attendees                                                                                    | ☐     |       |
| 8   | Click **Add Row** and fill a **Description only**, leaving Action blank               | That row is highlighted in red and the Action cell shows **Required**                                                                    | ☐     |       |
| 9   | Fill in the Action but leave Responsible Person blank                                 | The row stays highlighted                                                                                                                | ☐     |       |
| 10  | Complete the second row, then add a **third** row and leave it entirely blank         | The blank row is not flagged — it will simply be ignored                                                                                 | ☐     |       |
| 11  | Click the bin on the blank row                                                        | It is removed. The bin on the **last remaining** row must be disabled                                                                    | ☐     |       |
| 12  | Click **Save as Draft**                                                               | "Meeting saved as draft"; you land on the meeting page with a **Draft** chip                                                             | ☐     |       |
| 13  | Read the page                                                                         | Title, date written out in full, duration and location on one line; attendee chips; Agenda and Notes exactly as typed                    | ☐     |       |
| 14  | Read the **Action Items** table                                                       | Both complete rows, with Description, Action, Responsible, Due Date and Priority as entered                                              | ☐     |       |
| 15  | Go back to **Meeting Minutes**                                                        | Your meeting is listed with a **Draft** chip, the date, the duration, the attendee count and your name                                   | ☐     |       |
| 16  | Try to change the title, attendees, agenda, notes or an action item                   | ⚠ known issue — a draft meeting **cannot be edited** after saving, and no action items can be added on the detail page. Do not file this | ☐     |       |

---

## UAT-FLOW-05 — Finalize a meeting — action items become real tasks

**Goal:** confirm finalizing turns every actionable item into a task on the right person's list, and that the meeting then locks.
**Who:** you and the two attendees.
**Before you start:** requires the **Draft** meeting from UAT-FLOW-04 with two actionable rows.

| #   | Do this                                                               | You should see                                                                                               | Pass? | Notes |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open the draft meeting                                                | The header shows **Delete** and **Finalize (2 tasks)** — the count matching your actionable rows             | ☐     |       |
| 2   | Click **Finalize (2 tasks)**                                          | A message _"Meeting finalized — 2 tasks created"_; the chip changes from **Draft** to **Finalized**          | ☐     |       |
| 3   | Read the Action Items table again                                     | A new **Task Status** column, each row showing the live status of its generated task (starting at **Todo**)  | ☐     |       |
| 4   | Ask the first attendee to open **Flow → My Tasks**                    | A new task whose title is the **Action** text from their row, with the due date and priority from the table  | ☐     |       |
| 5   | Ask the second attendee the same                                      | Their own row's task is on their list — not on the first attendee's                                          | ☐     |       |
| 6   | Confirm the rows that were **not** actionable did not generate a task | Only rows with both an Action and a Responsible Person become tasks                                          | ☐     |       |
| 7   | Have the first attendee move their task to **In Progress**            | Back on the meeting page (reload it), the **Task Status** for that row now reads **In Progress**             | ☐     |       |
| 8   | Have them mark it **Done**                                            | On reload, the meeting row reads **Done**                                                                    | ☐     |       |
| 9   | Look at the finalized meeting's header                                | **Delete** and **Finalize** are gone; instead there is **Start next review**                                 | ☐     |       |
| 10  | Read the footer of the page                                           | _"Created by …"_ and _"Finalized on …"_ with the right date                                                  | ☐     |       |
| 11  | Click **Start next review**                                           | _"Next review meeting created"_ and you land on a new **Draft** meeting                                      | ☐     |       |
| 12  | On the new meeting, click **Previous review**                         | You are taken back to the finalized one                                                                      | ☐     |       |
| 13  | Return to the finalized meeting and click **Start next review** again | It reads **Open next review** and takes you to the meeting already created — it does not create a second one | ☐     |       |

**Should NOT be possible:**

- Finalizing the same meeting twice.
- Editing or deleting a meeting once it is **Finalized**.
- A meeting finalizing "half way" — if it fails, no tasks at all should have been created. If you see a partial result, report it immediately.

---

## UAT-FLOW-06 — Meeting guards — delete, empty finalize, terminal state

**Goal:** confirm the guards around meetings.
**Who:** you and a colleague who was **not** an attendee.
**Before you start:** requires UAT-FLOW-04 and UAT-FLOW-05.

| #   | Do this                                                                                     | You should see                                                                                 | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Create a new meeting, fill step 1, and go to step 2 without completing any row              | **Finalize** stays greyed out — at least one row needs both an Action and a Responsible Person | ☐     |       |
| 2   | **Save as Draft** anyway                                                                    | Saved; the meeting page shows _"No action items yet."_ and **Finalize (0 tasks)** disabled     | ☐     |       |
| 3   | Click **Delete** on that draft                                                              | A confirmation naming the meeting and warning it cannot be undone                              | ☐     |       |
| 4   | Click **Cancel**                                                                            | Nothing happens                                                                                | ☐     |       |
| 5   | Click **Delete** again and confirm                                                          | "Meeting deleted"; you are returned to the Meeting Minutes list and it is gone                 | ☐     |       |
| 6   | Ask the **non-attendee colleague** to open the finalized meeting from UAT-FLOW-05           | They can read it; they must not be offered Delete or Finalize on a draft they are not part of  | ☐     |       |
| 7   | Create a draft meeting naming a **deactivated user** as a Responsible Person, then finalize | Refused, naming the inactive person. (Skip this step if you have no deactivated user)          | ☐     |       |

**Should NOT be possible:**

- Deleting a meeting you did not create.
- Finalizing a meeting with no complete action item.
- Finalizing a meeting that names a deactivated person as responsible.

---

## UAT-FLOW-07 — Work the Inbox — filter, search, complete

**Goal:** confirm the Inbox gathers work from every module and that clearing an item works.
**Who:** you and **Approver A** (whose Inbox will have HR items in it from earlier tests).
**Before you start:** works best after UAT-HR-07, UAT-HR-14 and UAT-HR-19 have created real notifications.

| #   | Do this                                                                 | You should see                                                                                                                              | Pass? | Notes |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Flow → **Inbox**                                                        | A page titled **Inbox** with a count in the top right, a search box, and filter chips                                                       | ☐     |       |
| 2   | Read the filter chips                                                   | Only chips that actually have items are shown, each with its count in brackets; **All** is always there                                     | ☐     |       |
| 3   | Click **HR**                                                            | Only HR items remain, and the count matches the number of cards                                                                             | ☐     |       |
| 4   | Click **Approvals**                                                     | Only the items that need a decision from you                                                                                                | ☐     |       |
| 5   | Click **All**, then type part of a colleague's name into the search box | The list narrows to notifications from or about them — search covers the title, message and sender                                          | ☐     |       |
| 6   | Clear search. Read one card                                             | A priority flag, the title, a two-line message preview, who raised it, how long ago, and an **Action Required** chip if it needs a decision | ☐     |       |
| 7   | Click a card that has a link                                            | You are taken to the record it is about — the leave request, on-duty request or expense report                                              | ☐     |       |
| 8   | Return to the Inbox. Click the small open-in-new-tab icon on a card     | The same record opens in a new tab, and the Inbox stays where it was                                                                        | ☐     |       |
| 9   | Find a card with a green **Complete** button and click it               | The card disappears **immediately**, and a "Task completed" message appears                                                                 | ☐     |       |
| 10  | Reload the page                                                         | The completed card is still gone — it really saved                                                                                          | ☐     |       |
| 11  | Filter down to a chip with nothing in it (or clear everything)          | _"No pending notifications. All caught up!"_                                                                                                | ☐     |       |
| 12  | Compare against the **HR & Leave** sidebar badge                        | The number of pending HR approvals in the badge matches the HR items awaiting you                                                           | ☐     |       |

**Should NOT be possible:**

- Completing a notification addressed to somebody else.
- A completed item reappearing after a reload.

---

## UAT-FLOW-08 — Notifications end to end, and the ones that clear themselves

**Goal:** confirm every HR decision produces the right in-app notification for the right person, and that approver items close themselves once a decision is made.
**Who:** you, **Approver A**, **Approver B**. Keep three browsers or three profiles open side by side if you can.
**Before you start:** requires UAT-HR-03 and a configured approver list. This test repeats parts of the earlier ones deliberately, from the notification angle.

| #   | Do this                                                         | You should see                                                                                                                                      | Pass? | Notes |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Submit a leave request                                          | **Both** approvers get a card **Leave Request: &lt;your name&gt;** with an **Action Required** chip                                                 | ☐     |       |
| 2   | Check your own Inbox                                            | You get nothing for your own submission                                                                                                             | ☐     |       |
| 3   | **As Approver A, sign in** and approve once                     | You (the employee) get **Leave Request Partially Approved**                                                                                         | ☐     |       |
| 4   | Check Approver A's Inbox                                        | Their own card has closed; Approver B's is still open                                                                                               | ☐     |       |
| 5   | **As Approver B, sign in** and approve                          | You get **Leave Request Approved**                                                                                                                  | ☐     |       |
| 6   | Check **both** approvers' Inboxes                               | Both action cards have closed on their own — nobody had to tick them off                                                                            | ☐     |       |
| 7   | Ask a colleague who is **not** an approver to check their Inbox | They have a **Team Leave Notice** informational card naming you and the dates                                                                       | ☐     |       |
| 8   | Submit a second leave request and have Approver A **reject** it | You get **Leave Request Rejected** with the reason; both approvers' action cards close                                                              | ☐     |       |
| 9   | Submit a third and **cancel it yourself**                       | Both approvers' action cards close without either of them doing anything                                                                            | ☐     |       |
| 10  | Submit an on-duty request                                       | Both approvers get **On-Duty Request: &lt;your name&gt;**                                                                                           | ☐     |       |
| 11  | Have both approve it                                            | You get **On-Duty Request Approved** mentioning the comp-off day; the team gets **Team On-Duty Notice**                                             | ☐     |       |
| 12  | Submit a travel expense claim                                   | Every configured expense approver gets **Travel Expense: TE-…** with the amount in rupees                                                           | ☐     |       |
| 13  | Have one of them **Return** it                                  | You get **Travel Expense Report Returned for Revision**, quoting their comment                                                                      | ☐     |       |
| 14  | Resubmit and have it approved                                   | You get **Travel Expense Report Approved**                                                                                                          | ☐     |       |
| 15  | Assign a Flow task to a colleague                               | Their **My Tasks** list updates live. Note whether they also get anything in their **Inbox** — Flow tasks are not expected to produce an inbox item | ☐     |       |
| 16  | Finalize a meeting with an action item for a colleague          | Their **My Tasks** list gains the task. Again, note what (if anything) lands in their Inbox                                                         | ☐     |       |

**Also check:**

- Notification counts in the sidebar badge fall as you clear items, and never go negative.
- A card you have already actioned never reappears after a reload.

---

## UAT-FLOW-09 — Emails that should arrive alongside the in-app notification

**Goal:** confirm the emails actually land in a real inbox, with a readable subject and the right details. **Check your email client, not the app.**
**Who:** you and **Approver A**. You each need access to the mailbox registered against your account.
**Before you start:** requires UAT-HR-03. Emails can take a minute or two — wait before recording a failure, and check the spam folder.

| #   | Do this                                                                     | You should see **in your email inbox**                                                                                              | Pass? | Notes |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Submit a leave request                                                      | An email subject **Leave Request: &lt;your name&gt;**, listing Employee, Type, From, To, Days and Reason, with a link into the app  | ☐     |       |
| 2   | Open the link in that email                                                 | It takes you to the Leaves page in the app                                                                                          | ☐     |       |
| 3   | **As Approver A, sign in** and approve once (status **Partially Approved**) | The **remaining** approver receives an email subject **Leave Pending Your Approval: &lt;your name&gt;**, showing "1 of 2 approvals" | ☐     |       |
| 4   | Confirm the approver who already approved does **not** get that one         | Only the outstanding approver is chased                                                                                             | ☐     |       |
| 5   | Complete the second approval                                                | An email subject **Leave Approved: &lt;your name&gt;** arrives, and **your own mailbox is on it**                                   | ☐     |       |
| 6   | Submit and reject another leave request                                     | An email subject **Leave Rejected: &lt;your name&gt;**, again copying you                                                           | ☐     |       |
| 7   | Submit a travel expense claim                                               | An email subject **Travel Expense Submitted: TE-2026-nnnn** with Report #, Employee, Purpose and Amount                             | ☐     |       |
| 8   | Have it approved                                                            | **You** (the employee) receive **Travel Expense Approved: TE-2026-nnnn** — not the person who approved it                           | ☐     |       |
| 9   | Have another claim rejected                                                 | **Travel Expense Rejected: TE-2026-nnnn** in your mailbox                                                                           | ☐     |       |
| 10  | Submit an on-duty request and take it through to approval                   | ⚠ known issue — **no on-duty email is ever sent**, at any stage, to anyone. Do not file this                                        | ☐     |       |
| 11  | Approve the same leave request twice in quick succession (double-click)     | Only **one** email of each kind arrives — no duplicates                                                                             | ☐     |       |

**Also check:**

- Amounts in the emails are formatted in rupees and match the app exactly.
- Dates in the emails match the dates on screen — not a day out.

---

## UAT-FLOW-10 — Threads and @mentions

> ⚠ **Known issue — expected to fail.** Discussion threads on notifications and @mentions of colleagues are built but are **not reachable from any page in the app**. There is no comment box, no mentions list and no mention badge. Do not file feedback for this; it is already on the fix list. Run the test only to confirm nothing has changed.

**Goal:** record that the collaboration layer on notifications is not yet wired up.
**Who:** anyone.
**Before you start:** requires at least one notification in your Inbox.

| #   | Do this                                                                                        | You should see                                                             | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----- | ----- |
| 1   | Flow → **Inbox**, open a notification card                                                     | ⚠ known issue — no comment box, no thread panel, no discussion of any kind | ☐     |       |
| 2   | Look for a comment or message count on any card                                                | ⚠ known issue — none appears                                               | ☐     |       |
| 3   | Look anywhere in Flow for a **Mentions** view or an unread-mentions badge                      | ⚠ known issue — neither exists                                             | ☐     |       |
| 4   | Type `@` followed by a colleague's name in any Flow text box (task description, meeting notes) | The text is stored as plain text; nobody is notified                       | ☐     |       |

---

## Known issues in this module

Read these before you start. All nine are already on the fix list — please do **not** file feedback for them. If you see something that looks like one of these but behaves differently, that **is** worth reporting.

| #   | What you will see                                                                                                                                           | Affects                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | **Threads and @mentions are unreachable.** The discussion layer on notifications exists but no page shows it.                                               | UAT-FLOW-10              |
| 2   | **Travel expense claims can never be marked reimbursed.** There is no button anywhere, so an approved claim is stuck at **Approved** forever.               | UAT-HR-21                |
| 3   | **On-duty emails never send.** In-app notifications work; email does not, at any stage.                                                                     | UAT-HR-14, UAT-FLOW-09   |
| 4   | **An approved on-duty request cannot be cancelled.** The Cancel Request button disappears once approved, even though the rule allows it up to a day before. | UAT-HR-15                |
| 5   | **A saved leave draft cannot be edited or deleted.** Your only options are to submit it or cancel it.                                                       | UAT-HR-06, UAT-HR-09     |
| 6   | **A travel expense report header cannot be edited,** and neither can an individual expense line — lines can only be added and deleted.                      | UAT-HR-17, UAT-HR-18     |
| 7   | **Tasks cannot be edited, moved backwards or cancelled.** The status control only steps Todo → In Progress → Done.                                          | UAT-FLOW-01, UAT-FLOW-02 |
| 8   | **A draft meeting cannot be edited** after saving, and no action item can be added on the meeting page.                                                     | UAT-FLOW-04              |
| 9   | **Clearing a saved optional field on an employee profile does not blank it** — the old value returns when you reopen the form.                              | UAT-HR-02                |

Two more things that are not bugs but will surprise you:

- **The Approve / Reject buttons on a leave or on-duty request appear for anyone with the Approve Leaves permission,** but the save is refused with _"You are not authorized to approve this request"_ unless you are on the configured approver list. That list is maintained directly in the database — **there is no screen for it in the app.**
- **The Team Leave Notice card in the Inbox opens a "Leave request not found" page.** The link points at a page that does not exist.
- **There is no list of on-duty requests or travel expense claims for approvers.** The only way an approver reaches one is through the card in their Flow **Inbox** (or the email link). Leave is the exception — it has a **Team Requests** tab.
