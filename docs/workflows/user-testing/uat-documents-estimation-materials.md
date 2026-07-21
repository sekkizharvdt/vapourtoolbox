# Documents, Estimation & Material Catalogs — Workflow Testing

> How to use this: [Testing guide](README.md) · Report problems at **Feedback** in the app, with the test ID at the start of the title (e.g. `UAT-EST-05 — BOM total stays at zero after calculating`).

## What this module does

**Document control** is how engineering deliverables are tracked on a project: every drawing, calculation and data sheet is registered as a numbered master document, each new version of the file is recorded as a revision and submission, batches of submitted documents are packaged into a numbered transmittal with a cover sheet and a ZIP of the files, and the client's feedback comes back as comments and a Comment Resolution Sheet.

**Estimation** is where a Bill of Materials (BOM) is built for a piece of equipment — fabricated items priced from a shape and a material, bought-out items priced from the catalog — and turned into a costed quote PDF.

**The catalogs** are the reference data everything else prices against: the **Material Database** (plates, pipes, valves, fasteners and so on, with their specifications and current prices), **Bought Out Items** (pumps, valves, instruments as procurable equipment), the **Services** rate catalog (engineering, fabrication, testing rates), and the **Shape Database** (the parametric shapes used for weight and cost calculation).

## Before you start

### Permissions you need

Permissions are set by an administrator in **Administration → Users → Edit User**, where they are grouped by module.

| What you want to test                                               | Permission needed                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| See a project's master document list, transmittals and templates    | **View** under **Projects**, and be assigned to the project         |
| Create documents, import a register, set up numbering, transmittals | **Manage** under **Document Management**                            |
| Submit a revision on a document assigned to you                     | **Submit** under **Document Management**                            |
| Approve or reject a comment resolution                              | **Manage** under **Projects**                                       |
| See BOMs, materials, bought-out items, services, shapes             | **View** under **Estimation**                                       |
| Create or edit BOMs, materials, bought-out items, services          | **Manage** under **Estimation**                                     |
| Delete a bought-out item                                            | **Edit Entities** (an admin-only permission)                        |
| Upload to the Company Documents registry (sidebar → Documents)      | **Manage Users** (the registry treats admins as the only uploaders) |

Two things that catch people out:

- The sidebar shows **Material Database**, **Bought Out Items**, **Services** and **Shape Database** to everyone, but the data behind them is gated on **View** under **Estimation**. A user without it sees the page shell and empty lists, not a clear "no access" message.
- Permission changes take a couple of minutes to reach someone who is already signed in. Have them sign out and back in before reporting a permission problem.

### Test data you need first

- **One project you are assigned to**, with a project code (e.g. `PRJ01`). All master documents, transmittals and CRS work happens inside a project.
- **A second, empty project** for UAT-DOC-01 — auto-numbering can only be set up on a project that has no documents yet (see Known issues).
- **A file to upload as a drawing** — one PDF and one native file (DWG, XLSX or DOCX), each under 50 MB.
- **A file to upload as a CRS** — a PDF, Excel or Word file under 50 MB.
- **An Excel file for the register import** — download the template from inside the import dialog in UAT-DOC-04.
- **At least three materials with a density and a current price**, so BOM cost calculation produces a non-zero number. Material prices can only be set by accepting a vendor quote price in Procurement (see UAT-MAT-04) — arrange this before you start the estimation tests, or accept that costs will come out as ₹0.
- **At least one bought-out item** in the catalog (UAT-MAT-08 creates one).

### A second user

Several tests need one.

| Account              | What it needs                                                                                                                        | Used by                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **Your account**     | **Manage** under Document Management, **Manage** under Estimation, **Manage** under Projects                                         | Everything                                       |
| **A limited user**   | Assigned to the same project, **View** under Projects only — no **Manage** under Document Management, no **Manage** under Estimation | UAT-DOC-17, UAT-EST-10, UAT-MAT-17               |
| **A second manager** | **Manage** under Projects, assigned to the project                                                                                   | UAT-DOC-10 (approving someone else's resolution) |
| **An admin**         | **Manage Users** and **Edit Entities**                                                                                               | UAT-MAT-11, UAT-DOC-18                           |

### Where things live in the sidebar

- **SETUP → Documents** — this is the **Company Documents** registry (SOPs, policies, templates). It is **not** the project document control area. Only UAT-DOC-18 tests it.
- **Project master documents** are reached from **DAILY OPERATIONS → Projects → open a project → Documents**. Everything from UAT-DOC-01 to UAT-DOC-17 starts there.
- **SALES & ESTIMATION → Estimation** — the BOM list.
- **ENGINEERING DATA → Material Database**, **Bought Out Items**, **Services**, **Shape Database**.

**Read [Known issues in this module](#known-issues-in-this-module) at the bottom before you start.** Twenty-two things in this module are already known to be broken or missing. Do not spend time filing them again.

---

## Test index

| ID         | Workflow                                                                           | Needs a 2nd user? | Est. time |
| ---------- | ---------------------------------------------------------------------------------- | ----------------- | --------- |
| UAT-DOC-01 | Set up document auto-numbering on a project                                        | No                | 15 min    |
| UAT-DOC-02 | Register a master document and check the number format                             | No                | 15 min    |
| UAT-DOC-03 | Master document round-trip — nothing lost between save and reopen                  | No                | 25 min    |
| UAT-DOC-04 | Import a document register from Excel                                              | No                | 25 min    |
| UAT-DOC-05 | Work the master document list — search, filter, group, export                      | No                | 15 min    |
| UAT-DOC-06 | Submit the first revision and watch the document go to Submitted                   | No                | 20 min    |
| UAT-DOC-07 | Submit a second revision — revision and submission numbers advance                 | No                | 15 min    |
| UAT-DOC-08 | Walk a document through its full status path to Accepted                           | No                | 25 min    |
| UAT-DOC-09 | On Hold and Cancelled — the side paths and the two terminal states                 | No                | 20 min    |
| UAT-DOC-10 | Raise comments and resolve them                                                    | Yes (2nd manager) | 30 min    |
| UAT-DOC-11 | Upload a Comment Resolution Sheet                                                  | No                | 15 min    |
| UAT-DOC-12 | Generate a transmittal and download its PDF and ZIP                                | No                | 30 min    |
| UAT-DOC-13 | Transmittal history — view, re-download, regenerate, delete                        | No                | 20 min    |
| UAT-DOC-14 | Mark a transmittal Sent and Acknowledged — **known issue, expected to fail**       | No                | 5 min     |
| UAT-DOC-15 | Document templates — upload and download                                           | No                | 15 min    |
| UAT-DOC-16 | Document Links, Supply List and Work List                                          | No                | 15 min    |
| UAT-DOC-17 | Document control permission checks                                                 | Yes (limited)     | 20 min    |
| UAT-DOC-18 | Company Documents registry — upload, new version, delete                           | Yes (admin)       | 20 min    |
| UAT-EST-01 | Create a BOM and check the code format                                             | No                | 10 min    |
| UAT-EST-02 | New BOM round-trip — nothing lost between save and reopen                          | No                | 15 min    |
| UAT-EST-03 | Add a fabricated (shape-based) item and watch the live calculation                 | No                | 25 min    |
| UAT-EST-04 | Add a bought-out item from the catalog                                             | No                | 20 min    |
| UAT-EST-05 | Calculate costs and watch the totals recalculate                                   | No                | 25 min    |
| UAT-EST-06 | Generate a quote PDF from a BOM                                                    | No                | 15 min    |
| UAT-EST-07 | BOM list — search, open, delete, and the Draft-only delete rule                    | No                | 15 min    |
| UAT-EST-08 | Move a BOM past Draft — **known issue, expected to fail**                          | No                | 5 min     |
| UAT-EST-09 | Edit an item, remove an item, attach a service — **known issue, expected to fail** | No                | 10 min    |
| UAT-EST-10 | Estimation permission checks                                                       | Yes (limited)     | 15 min    |
| UAT-MAT-01 | Add a material and check the generated code                                        | No                | 20 min    |
| UAT-MAT-02 | Material round-trip — nothing lost between save and reopen                         | No                | 25 min    |
| UAT-MAT-03 | Browse the material category pages — search, filter, paginate                      | No                | 20 min    |
| UAT-MAT-04 | Material prices — where a price comes from                                         | No                | 20 min    |
| UAT-MAT-05 | Record a stock movement — **known issue, expected to fail**                        | No                | 5 min     |
| UAT-MAT-06 | Clear the Needs Review flag on an auto-created material                            | No                | 15 min    |
| UAT-MAT-07 | Deactivate a material — **known issue, expected to fail**                          | No                | 5 min     |
| UAT-MAT-08 | Add a bought-out item and check the code format                                    | No                | 20 min    |
| UAT-MAT-09 | Bought-out round-trip, and the spec code preview                                   | No                | 25 min    |
| UAT-MAT-10 | Bought-out list — category tabs, needs-review filter, mark as reviewed             | No                | 20 min    |
| UAT-MAT-11 | Delete a bought-out item, and the permission guard                                 | Yes (limited)     | 15 min    |
| UAT-MAT-12 | Add a service and check the code format                                            | No                | 15 min    |
| UAT-MAT-13 | Service round-trip — nothing lost between save and reopen                          | No                | 20 min    |
| UAT-MAT-14 | Browse the services catalog and edit a service                                     | No                | 15 min    |
| UAT-MAT-15 | Delete (deactivate) a service and try to get it back                               | No                | 10 min    |
| UAT-MAT-16 | Shape Database — read-only browse and a full calculation                           | No                | 30 min    |
| UAT-MAT-17 | Catalog permission checks                                                          | Yes (limited)     | 20 min    |

---

# Document control

## UAT-DOC-01 — Set up document auto-numbering on a project

**Goal:** the project can allocate document numbers on its own, in the format your engineers expect.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:**

- A project **with no documents in it yet**. If the project already has one document, the setup banner is gone and there is no other way in — use a fresh project.

| #   | Do this                                                                      | You should see                                                                                                                                                                        | Pass? | Notes |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Go to **Projects**, open the empty project, and click the **Documents** card | The **Document Management** page, with the project name and code under the title, and tabs **Master Document List**, **Transmittals**, **Templates**                                  | ☐     |       |
| 2   | Stay on **Master Document List**                                             | A blue tip panel offering **Set Up Auto-Numbering** and **Upload Document Register**, with a note that numbers will look like `{your project code}-01-001`                            | ☐     |       |
| 3   | Click **Set Up Auto-Numbering**                                              | Dialog **Set Up Document Numbering**, explaining numbers will be `{PROJECTCODE}-[DISCIPLINE]-[SEQ]`                                                                                   | ☐     |       |
| 4   | Read the discipline list                                                     | Eleven disciplines, all ticked: 00 Client Inputs, 01 Process, 02 Mechanical, 03 Structural, 04 Piping, 05 Electrical, 06 Instrumentation, 07 Civil, 08 HVAC, 09 Automation, 10 Safety | ☐     |       |
| 5   | Click **Deselect All**                                                       | Every tick clears, and the confirm button greys out                                                                                                                                   | ☐     |       |
| 6   | Tick **01 — Process**, **02 — Mechanical** and **04 — Piping** only          | The confirm button now reads **Initialize 3 Disciplines**                                                                                                                             | ☐     |       |
| 7   | Click **Initialize 3 Disciplines**                                           | The button shows **Initializing...**, then the dialog closes and the tip panel disappears                                                                                             | ☐     |       |
| 8   | Reload the page                                                              | The tip panel stays gone — the setting stuck                                                                                                                                          | ☐     |       |

**Also check:**

- Re-open the same project a day later and confirm the numbering is still in place — the counters are stored per project, not per browser.
- Repeat step 3 on a _second_ empty project and use **Select All** instead. All eleven disciplines should be accepted.

**Should NOT be possible:**

- Confirming with no disciplines ticked — the button must stay disabled.

---

## UAT-DOC-02 — Register a master document and check the number format

**Goal:** a numbered engineering deliverable exists on the project and starts life correctly.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:** the project from **UAT-DOC-01**, with numbering set up.

| #   | Do this                                                                               | You should see                                                                                                                                       | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On **Master Document List**, click **New Document**                                   | Dialog **Create New Master Document**                                                                                                                | ☐     |       |
| 2   | Pick **01 - Process** in **Discipline**                                               | A blue line at the top updates to read **Document Number: {PROJECTCODE}-01-001**                                                                     | ☐     |       |
| 3   | Type `Process Flow Diagram — Unit 1` into **Document Title**                          | The field accepts it                                                                                                                                 | ☐     |       |
| 4   | Choose **Drawing** in **Document Type**                                               | The list offers Drawing, Calculation, Specification, Data Sheet, Report, Manual, Procedure, Schedule, List, General — and you can also type your own | ☐     |       |
| 5   | Leave **Client Visible** switched off                                                 | The caption under it reads _Document is internal only_                                                                                               | ☐     |       |
| 6   | Click **Create Document**                                                             | Button shows **Creating...**, the dialog closes, and a new row appears in the list                                                                   | ☐     |       |
| 7   | Read the new row                                                                      | Doc Number `{PROJECTCODE}-01-001`, your title, Type `Drawing`, **Rev** `R0`, **Status** showing DRAFT                                                | ☐     |       |
| 8   | Create a second Process document called `P&ID — Unit 1`                               | Its number is `{PROJECTCODE}-01-002` — the sequence advanced by one                                                                                  | ☐     |       |
| 9   | Create a third document, this time under discipline **02 - Mechanical**               | Its number is `{PROJECTCODE}-02-001` — each discipline counts separately                                                                             | ☐     |       |
| 10  | Create a fourth under **00 - Client Inputs** and choose sub-code **A - Process Data** | The preview and the created number include the sub-code: `{PROJECTCODE}-00-A-001`                                                                    | ☐     |       |

**Also check:**

- Every new document starts at revision **R0**, status DRAFT, with no submissions recorded.
- On a project where numbering was never set up, the same dialog shows a free-text **Document Number** field instead of the discipline preview, with the helper _"Enter the document number manually…"_.

**Should NOT be possible:**

- Creating a document with an empty title — the dialog must show **Title is required** and not save.
- Creating a document with no discipline chosen — **Discipline code is required**.

---

## UAT-DOC-03 — Master document round-trip: nothing lost between save and reopen

**Goal:** every field you fill on the create form is still there when you reopen the document for editing. This is the single most common defect in this app — check it carefully.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:** the project from UAT-DOC-01, with at least two team members assigned to it.

| #   | Do this                                                                                                                                                                                                                                                                             | You should see                                                                                                                                                         | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Click **New Document** and fill **every** field: Discipline `04 - Piping`, Title `Piping GA — North Rack`, Description `Full round-trip test`, Document Type `Specification`, **Client Visible** switched **on**, **Assign To** two team members, **Due Date** a date two weeks out | Every field accepts input; the caption under the switch changes to _Document is visible to client_                                                                     | ☐     |       |
| 2   | Write down every value you entered                                                                                                                                                                                                                                                  | —                                                                                                                                                                      | ☐     |       |
| 3   | Click **Create Document**                                                                                                                                                                                                                                                           | The document appears in the list with number `{PROJECTCODE}-04-001`                                                                                                    | ☐     |       |
| 4   | Click the row to open the document                                                                                                                                                                                                                                                  | The detail page, headed with the document number, a status chip, a **Client Visible** chip, the title, and chips for Discipline and Revision                           | ☐     |       |
| 5   | On the **Overview** tab, compare every field against your notes                                                                                                                                                                                                                     | Document Number, Title, Description, Discipline Code, Document Type, Current Revision `R0`, Status, Visibility _Client Visible_, Due Date and both assignees all match | ☐     |       |
| 6   | Click **Edit**                                                                                                                                                                                                                                                                      | Dialog **Edit Document**, with the document number shown under the title                                                                                               | ☐     |       |
| 7   | Compare every field in the edit dialog against your notes                                                                                                                                                                                                                           | Title, Discipline, Description, Due Date and the **Client Visible** switch are all pre-filled with what you entered — nothing is blank, nothing reset                  | ☐     |       |
| 8   | Without changing anything, click **Save Changes**                                                                                                                                                                                                                                   | The dialog closes and the page refreshes                                                                                                                               | ☐     |       |
| 9   | Re-open **Edit** and check every field again                                                                                                                                                                                                                                        | Identical to step 7 — a save with no edits must not lose anything                                                                                                      | ☐     |       |
| 10  | Now change the Description, set **Priority** to **High**, move the Due Date a week later, and save                                                                                                                                                                                  | The Overview tab reflects the new description and due date                                                                                                             | ☐     |       |
| 11  | Re-open **Edit**                                                                                                                                                                                                                                                                    | Priority still shows **High**, description and date show the new values                                                                                                | ☐     |       |

**Also check:**

- The assignee list on Overview should still name both team members after step 8. If it empties on save, that is a defect worth reporting.

**Should NOT be possible:**

- Saving with an empty title — the dialog must show **Document title is required**.

---

## UAT-DOC-04 — Import a document register from Excel

**Goal:** a whole document register can be loaded in one go instead of typed in one at a time.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:** a project (numbering set up or not — import works either way).

| #   | Do this                                                                                  | You should see                                                                                                                                            | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On **Master Document List**, click **Import Register**                                   | Dialog **Import Document Register**, listing the required columns: A Document Number, B Document Title, C Discipline Code, D Document Type, E Description | ☐     |       |
| 2   | Click **Download Template**                                                              | An Excel file downloads, named after the project code                                                                                                     | ☐     |       |
| 3   | Fill the template with five rows, giving each a unique document number and title         | —                                                                                                                                                         | ☐     |       |
| 4   | Deliberately blank the title on row 3, and copy an existing document's number into row 5 | —                                                                                                                                                         | ☐     |       |
| 5   | Drop the file into the upload area and click **Parse File**                              | A preview table appears headed **Parsed Rows (5 total, 3 valid)**, with per-row chips **Valid**, **Invalid** and **Duplicate**                            | ☐     |       |
| 6   | Read the warning above the table                                                         | A yellow panel naming the duplicate document number and saying it will be skipped                                                                         | ☐     |       |
| 7   | Click **Import 3 Documents**                                                             | A progress message, then a green line: **Import completed: 3 documents created**                                                                          | ☐     |       |
| 8   | Click **Done** and look at the list                                                      | Three new rows, each at revision **R0** and status DRAFT                                                                                                  | ☐     |       |
| 9   | Repeat the import with the same file                                                     | All rows now flag as **Duplicate** and the import button offers nothing to import                                                                         | ☐     |       |

**Also check:**

- Try uploading a `.txt` file — you should get **Please upload an Excel file (.xlsx or .xls)**.
- Try a file over 10 MB — you should get **File size exceeds 10MB limit**.
- A row with a document number but no title must be flagged **Invalid**, not silently imported.

**Should NOT be possible:**

- Importing while zero rows are valid — the import button must be disabled.

---

## UAT-DOC-05 — Work the master document list: search, filter, group, export

**Goal:** an engineer can find the document they need in a register of hundreds.
**Who:** anyone assigned to the project with **View** under **Projects**.
**Before you start:** the documents created in UAT-DOC-02 and UAT-DOC-04 (at least eight, across two or more disciplines).

| #   | Do this                                                                   | You should see                                                                                                    | Pass? | Notes |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Look at the cards above the table                                         | **Total Documents**, **Overdue**, **In Review** and **Completed**, with counts that match what you have           | ☐     |       |
| 2   | Click the **In Review** card                                              | The table filters to documents under review (probably none yet — an empty result is a pass)                       | ☐     |       |
| 3   | Clear it, then click the **My Documents** chip                            | Only documents assigned to you remain                                                                             | ☐     |       |
| 4   | Clear it and type part of a document title into the search box            | The table narrows as you type; searching by document number works too                                             | ☐     |       |
| 5   | Set **Status** to **Draft**                                               | Only DRAFT documents remain, and the count chip beside the heading drops to match                                 | ☐     |       |
| 6   | Set **Discipline** to `01 - Process`                                      | Only Process documents remain                                                                                     | ☐     |       |
| 7   | Click **Clear** on the filter bar                                         | All filters reset and every document reappears                                                                    | ☐     |       |
| 8   | Switch the view toggle to the grouped view                                | Documents group under discipline headings, each with a _"n documents"_ chip, and extra columns Due Date and Subs. | ☐     |       |
| 9   | Collapse and re-expand a discipline group                                 | The group folds away and comes back with the same rows                                                            | ☐     |       |
| 10  | Switch back to the flat view and click the download icon (**Export CSV**) | A CSV downloads containing every row currently shown                                                              | ☐     |       |
| 11  | Add enough documents to exceed 25, then use the pagination control        | Page 2 shows the remainder; the 50 and 100 per-page options work                                                  | ☐     |       |

**Also check:**

- Status chip text is inconsistent across screens — the list shows `DRAFT` / `IN PROGRESS` while the document detail page shows `DRAFT` / `IN_PROGRESS` with an underscore. This is a known issue; do not file it.
- In the grouped view, the **Submit** icon on a row lands you on the document's Overview tab rather than a submission screen. Known issue.

---

## UAT-DOC-06 — Submit the first revision and watch the document go to Submitted

**Goal:** a drawing file is attached to its master document as a numbered, dated submission, and the document's status and revision move on.
**Who:** the person assigned to the document, with **Submit** under **Document Management** (or **Manage**).
**Before you start:**

- The document `{PROJECTCODE}-01-001` from UAT-DOC-02, at revision **R0** and status DRAFT.
- One PDF and one native file (DWG/XLSX/DOCX) on your machine.

| #   | Do this                                                                   | You should see                                                                                                            | Pass? | Notes |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the document and click the **Revisions** tab                         | Heading **Revisions & Submissions** and the message _"No submissions yet. Upload your first revision to get started."_    | ☐     |       |
| 2   | Click **Submit New Revision**                                             | Dialog **Submit New Revision — {document number}**                                                                        | ☐     |       |
| 3   | Read the **Revision** field                                               | Pre-filled with **R1**, and a helper line reading _Current revision: R0_                                                  | ☐     |       |
| 4   | Under **PDF Files**, click **Add Files** and choose your PDF              | The filename appears in the PDF section                                                                                   | ☐     |       |
| 5   | Under **Native Files (DWG, XLSX, DOCX, etc.)**, add your native file      | The filename appears in the native section                                                                                | ☐     |       |
| 6   | Pick yourself in **Submitted By** and type a note in **Submission Notes** | Both accept input                                                                                                         | ☐     |       |
| 7   | Click **Submit Revision**                                                 | An upload progress line counting the files, then the dialog closes                                                        | ☐     |       |
| 8   | Look at the Revisions tab                                                 | One submission card, showing chip **R1**, **#1**, your name, today's date, your note, and a **Pending** chip on the right | ☐     |       |
| 9   | Look at the file rows inside the card                                     | Two rows, chipped `PDF` and `NATIVE`, each with a filename, a size and a download button                                  | ☐     |       |
| 10  | Click a file's download button                                            | The file downloads and opens correctly — same content you uploaded                                                        | ☐     |       |
| 11  | Go back to the document header                                            | The revision chip now reads **Revision: R1** and the status chip reads SUBMITTED                                          | ☐     |       |
| 12  | Go back to the project's **Master Document List**                         | The row for this document shows Rev **R1** and status SUBMITTED                                                           | ☐     |       |

**Also check:**

- The **Overview** tab's **Submission Information** card should now show **Total Submissions: 1** and a last-submission date.
- The client-review chip on the submission card (**Pending**) is display-only — there is no control anywhere to change it. Known issue.

**Should NOT be possible:**

- Submitting with no files attached — **Submit Revision** must stay disabled.
- Submitting with the revision box cleared — **Submit Revision** must stay disabled.

---

## UAT-DOC-07 — Submit a second revision: revision and submission numbers advance

**Goal:** repeated issues of the same drawing are tracked in order, with the newest one on top.
**Who:** as UAT-DOC-06.
**Before you start:** the document from **UAT-DOC-06**, at revision **R1** with one submission.

| #   | Do this                                                                 | You should see                                                                                       | Pass? | Notes |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the document's **Revisions** tab and click **Submit New Revision** | The **Revision** field is pre-filled with **R2**, helper _Current revision: R1_                      | ☐     |       |
| 2   | Attach a different PDF and submit                                       | The dialog closes                                                                                    | ☐     |       |
| 3   | Read the Revisions tab                                                  | Two submission cards. The new one shows **R2** and **#2**; the old one still shows **R1** and **#1** | ☐     |       |
| 4   | Check the card order                                                    | The newest submission is listed first                                                                | ☐     |       |
| 5   | Check the document header                                               | **Revision: R2**                                                                                     | ☐     |       |
| 6   | Open the R1 card's file and the R2 card's file                          | Each downloads the file that was uploaded with that revision — the older file is still retrievable   | ☐     |       |
| 7   | Overwrite the suggested revision with `R2A` and submit again            | A third card appears labelled **R2A**, **#3**; the header now reads **Revision: R2A**                | ☐     |       |

**Also check:**

- Submission numbers must never repeat or go backwards within a document: #1, #2, #3.

---

## UAT-DOC-08 — Walk a document through its full status path to Accepted

**Goal:** the status of a deliverable reflects where it actually is, and the app only offers the next steps that make sense.
**Who:** someone with **Manage** under **Document Management** (Approved and Accepted need it).
**Before you start:** a freshly created document in status DRAFT, with no submissions. Create one via UAT-DOC-02 if needed.

Status is changed from the **Edit** dialog's **Status** dropdown — there is no separate status button. The dropdown only offers the current status plus the steps allowed from it.

| #   | Do this                                                                                                     | You should see                                                                                                    | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the document, click **Edit**, and open the **Status** dropdown                                         | Four choices: **Draft** (marked _current_), **In Progress**, **On Hold**, **Cancelled** — and nothing else        | ☐     |       |
| 2   | Choose **In Progress** and click **Save Changes**                                                           | The header status chip changes to IN PROGRESS                                                                     | ☐     |       |
| 3   | Re-open **Edit** and open the dropdown                                                                      | **In Progress** (current), **Submitted**, **On Hold**, **Cancelled**                                              | ☐     |       |
| 4   | Choose **Submitted** and save                                                                               | Header shows SUBMITTED                                                                                            | ☐     |       |
| 5   | Re-open **Edit** and open the dropdown                                                                      | **Submitted** (current), **Under Review**, **In Progress** — you can send it back but you cannot jump to Approved | ☐     |       |
| 6   | Choose **Under Review** and save                                                                            | Header shows UNDER REVIEW                                                                                         | ☐     |       |
| 7   | Re-open **Edit** and open the dropdown                                                                      | **Under Review** (current), **Approved**, **In Progress**, **On Hold**                                            | ☐     |       |
| 8   | Choose **Approved** and save                                                                                | Header shows APPROVED                                                                                             | ☐     |       |
| 9   | Re-open **Edit** and open the dropdown                                                                      | **Approved** (current), **Accepted**, **Under Review**                                                            | ☐     |       |
| 10  | Choose **Accepted** and save. **This is the end of the line — an Accepted document cannot be moved again.** | Header shows ACCEPTED                                                                                             | ☐     |       |
| 11  | Re-open **Edit** and open the dropdown                                                                      | **Accepted** is the only option in the list                                                                       | ☐     |       |
| 12  | Go back to the **Master Document List** and find the row                                                    | Its status column matches, and the row's **Delete** action is greyed out                                          | ☐     |       |

**Also check:**

- Take a second document from UNDER REVIEW **back** to **In Progress** and confirm it lands there — rework must be possible.
- Take a third document from APPROVED back to **Under Review** and confirm it lands there.
- On the **Revisions** tab of an Approved or Accepted document, **Submit New Revision** must be greyed out.

**Should NOT be possible:**

- Jumping straight from Draft to Approved, or from Submitted to Accepted — those options must not appear in the dropdown at all.
- Changing the status of an Accepted document.

---

## UAT-DOC-09 — On Hold and Cancelled: the side paths and the two terminal states

**Goal:** work that is paused or abandoned can be marked as such, and abandoned work stays abandoned.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:** three spare documents in status DRAFT.

| #   | Do this                                                                     | You should see                                                                            | Pass? | Notes |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open document A, **Edit**, set **Status** to **On Hold**, save              | Header shows ON HOLD                                                                      | ☐     |       |
| 2   | Re-open **Edit** and open the dropdown                                      | **On Hold** (current), **Draft**, **In Progress**, **Cancelled**                          | ☐     |       |
| 3   | Set it back to **Draft** and save                                           | Header shows DRAFT — a hold can be released back to the beginning                         | ☐     |       |
| 4   | Put it On Hold again, then set it to **In Progress** and save               | Header shows IN PROGRESS — a hold can also be released straight into active work          | ☐     |       |
| 5   | Take document B to **In Progress**, then **On Hold**, then **Under Review** | The dropdown from On Hold has no **Under Review** option — this step should be impossible | ☐     |       |
| 6   | Take document B from **On Hold** to **Cancelled** and save                  | Header shows CANCELLED                                                                    | ☐     |       |
| 7   | Re-open **Edit** and open the dropdown                                      | **Cancelled** is the only option                                                          | ☐     |       |
| 8   | Take document C from **Draft** straight to **Cancelled**                    | Header shows CANCELLED — cancelling from Draft is allowed                                 | ☐     |       |
| 9   | Take a fourth document to **In Progress**, then **Cancelled**               | Allowed                                                                                   | ☐     |       |
| 10  | On the master list, look at the rows for the cancelled documents            | Their **Delete** action is greyed out                                                     | ☐     |       |

**Should NOT be possible:**

- Bringing a Cancelled document back to life.
- Cancelling a document that is already Submitted, Under Review, Approved or Accepted — Cancelled must not appear in the dropdown for those.

---

## UAT-DOC-10 — Raise comments and resolve them

**Goal:** client feedback on a drawing is recorded, answered, and signed off.
**Who:** you (raise and resolve) plus a second person with **Manage** under **Projects** (approve).
**Before you start:** the document from **UAT-DOC-07**, with at least one submission on it. Comments cannot be added to a document that has never been submitted.

| #   | Do this                                                                                                                                      | You should see                                                                                                                 | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open the document and click the **Comments** tab                                                                                             | Heading **Comments & Resolution**, and a panel saying no comments have been added yet                                          | ☐     |       |
| 2   | Click **Add Comment**                                                                                                                        | Dialog **Add Comment**, showing the document number and title                                                                  | ☐     |       |
| 3   | Fill **Comment Text**, set **Severity** to **Major**, **Category** to **Technical**, and fill **Page Number**, **Section** and **Line Item** | All fields accept input, and a chip echoes the chosen severity                                                                 | ☐     |       |
| 4   | Click **Add Comment**                                                                                                                        | The dialog closes and a row appears in the comments table                                                                      | ☐     |       |
| 5   | Read the row                                                                                                                                 | A comment number, severity `MAJOR`, your text, category, the location as _Page n · §x · Item y_, status **OPEN**, today's date | ☐     |       |
| 6   | Read the subtitle under the heading                                                                                                          | A tally: _1 total comment(s) • 1 open • 0 under review • 0 resolved • 0 closed_                                                | ☐     |       |
| 7   | Add three more comments with severities **Critical**, **Minor** and **Suggestion**                                                           | Four rows; the tally updates to 4 total, 4 open                                                                                | ☐     |       |
| 8   | Click the **Open** filter, then **All**                                                                                                      | The table filters and unfilters correctly, and each filter button shows a count                                                | ☐     |       |
| 9   | Click the **Respond** action on the first comment                                                                                            | Dialog **Comment {number}** with the original text, its location, and a **Provide Resolution** section                         | ☐     |       |
| 10  | Type a resolution into **Resolution Response** and click **Submit Resolution**                                                               | The dialog closes; the comment's status changes to **RESOLVED** and the tally moves one from open to resolved                  | ☐     |       |
| 11  | **As the second manager**, sign in, open the same comment via **View Thread**                                                                | A **Project Manager Review** section with **PM Remarks (Optional)**, and buttons **Reject** and **Approve**                    | ☐     |       |
| 12  | Click **Approve**                                                                                                                            | The comment gains a **PM Approved** chip                                                                                       | ☐     |       |
| 13  | Resolve a second comment, then as the second manager type a reason and click **Reject**                                                      | The comment goes back to **OPEN** so it can be answered again                                                                  | ☐     |       |
| 14  | Back on the Comments tab, click **Export CRT**                                                                                               | A comment file downloads listing every comment with its severity, status and resolution                                        | ☐     |       |

**Also check:**

- The **Refresh** button reloads the list without losing your filter.

**Should NOT be possible:**

- Submitting an empty resolution — you should get **Please enter a resolution response**.
- Rejecting a resolution with no remarks — you should get a message asking for a reason.
- Adding a comment on a document that has never been submitted — the dialog warns you to submit the document first and refuses to save.

---

## UAT-DOC-11 — Upload a Comment Resolution Sheet

**Goal:** the client's marked-up comment sheet is filed against the right revision, and the document moves into review on its own.
**Who:** someone with **Manage** or **Submit** under **Document Management**.
**Before you start:** the document from UAT-DOC-07 with at least one submission, and a CRS file (PDF, Excel or Word, under 50 MB).

| #   | Do this                                                                   | You should see                                                                                                                                | Pass? | Notes |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Note the document's current status from the header                        | Write it down — you will compare after upload                                                                                                 | ☐     |       |
| 2   | On the **Comments** tab, click **Upload CRS**                             | Dialog **Upload Comment Resolution Sheet**, showing the document number and title                                                             | ☐     |       |
| 3   | Click **Select File** and choose your CRS file                            | The filename, size and a **Remove** button appear; **Select Submission** auto-picks the latest revision                                       | ☐     |       |
| 4   | Open **Select Submission**                                                | Every submission on this document is listed with its revision and submission number                                                           | ☐     |       |
| 5   | Leave the latest selected and click **Upload**                            | An upload progress line, then the dialog closes                                                                                               | ☐     |       |
| 6   | Look above the comments table                                             | A section **Uploaded Comment Resolution Sheets (1)** with your filename, its revision chip, size, your name, the date, and a **Pending** chip | ☐     |       |
| 7   | Click **Open File**, then **Download**                                    | The file opens in a new tab and downloads correctly                                                                                           | ☐     |       |
| 8   | Look at the document header                                               | The status has moved to UNDER REVIEW on its own — this is automatic, there is no button for it                                                | ☐     |       |
| 9   | Type the comments from your CRS in via **Add Comment** (as in UAT-DOC-10) | Each appears in the table                                                                                                                     | ☐     |       |
| 10  | Look for a way to mark the CRS as processed or complete                   | ⚠ known issue — there is none. The CRS chip stays on **Pending** forever. Do not report this                                                  | ☐     |       |
| 11  | Upload a second CRS against the same submission                           | The section header becomes **Uploaded Comment Resolution Sheets (2)** and both files are listed                                               | ☐     |       |

**Also check:**

- The **Notes (Optional)** box on the upload dialog is not saved anywhere. Known issue; do not report it.
- If the document's status does not permit a move to Under Review (for example it is Accepted), the upload still succeeds and the status simply stays where it was. That is correct behaviour.

**Should NOT be possible:**

- Uploading a file over 50 MB — you should get **File size exceeds 50MB limit**.
- Uploading an image or a ZIP — you should get **Please upload a PDF, Excel, or Word document**.
- Clicking **Upload** before choosing a file and a submission — the button must stay disabled.

---

## UAT-DOC-12 — Generate a transmittal and download its PDF and ZIP

**Goal:** a batch of submitted drawings is issued to the client as one numbered transmittal, with a cover sheet and a single ZIP of the files.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:**

- At least **three documents with at least one submission each** (repeat UAT-DOC-06 on two more documents). Documents with no submission will not appear for selection.

| #   | Do this                                                                                                                 | You should see                                                                                                                                                 | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On the project, open the **Transmittals** tab                                                                           | Heading **Document Transmittals** and a **Generate Transmittal** button                                                                                        | ☐     |       |
| 2   | Click **Generate Transmittal**                                                                                          | Dialog **Generate Document Transmittal**, with the steps **Select Documents → Transmittal Details → Preview & Generate**                                       | ☐     |       |
| 3   | Read the note at the top of step 1                                                                                      | It says only documents with at least one submission are shown                                                                                                  | ☐     |       |
| 4   | Tick two documents                                                                                                      | The summary reads _2 of n documents selected_ and **Next** becomes clickable                                                                                   | ☐     |       |
| 5   | Type into **Search** and confirm the list narrows, then clear it                                                        | Filtering by document number and by title both work                                                                                                            | ☐     |       |
| 6   | Click **Next**                                                                                                          | Step 2 — **Transmittal Details**                                                                                                                               | ☐     |       |
| 7   | Fill **Subject**, **Purpose of Issue**, set **Delivery Method** to **Both Hard & Soft Copy**, and write **Cover Notes** | All fields accept input; the footnote confirms the number and date are generated for you                                                                       | ☐     |       |
| 8   | Click **Next**                                                                                                          | Step 3 — a **Transmittal Summary** repeating everything you entered, plus a **Documents to be Transmitted** table                                              | ☐     |       |
| 9   | Check the summary against what you typed                                                                                | Subject, Purpose of Issue, Cover Notes and the document count all match                                                                                        | ☐     |       |
| 10  | Click **Generate & Download**. **This creates a permanent numbered transmittal record.**                                | The button shows **Generating...**, then a PDF and a ZIP download                                                                                              | ☐     |       |
| 11  | Open the PDF                                                                                                            | A transmittal cover sheet showing the transmittal number, the date, your subject, purpose of issue, cover notes and the list of documents with their revisions | ☐     |       |
| 12  | Check the transmittal number on the PDF                                                                                 | It reads **TR-001** (three digits, counting up per project)                                                                                                    | ☐     |       |
| 13  | Open the ZIP                                                                                                            | It contains the cover sheet PDF plus one file per included document                                                                                            | ☐     |       |
| 14  | Look at the **Transmittals History** list on the page                                                                   | A row for **TR-001** with today's date, your subject, the document count, status **GENERATED** and your name                                                   | ☐     |       |
| 15  | Go back to the **Master Document List**                                                                                 | The documents you included are at status SUBMITTED                                                                                                             | ☐     |       |
| 16  | Generate a second transmittal with one document                                                                         | Its number is **TR-002**                                                                                                                                       | ☐     |       |

**Also check:**

- The **Client** field on the generated transmittal reads the literal text _Client Name_ rather than your customer's name. Known issue; do not report it.
- The **Status** filter on step 1 includes an option **Client Review** that always returns zero documents. Known issue.
- The ZIP contains one file per document, not both the native and the PDF file. Known issue.
- **Delivery Method** decides which files go into the ZIP: _Hard Copy Only_ takes PDFs, _Soft Copy Only_ takes native files, _Both_ takes everything. Generate one of each and confirm the ZIP contents differ.

**Should NOT be possible:**

- Clicking **Next** on step 1 with nothing selected — the button must stay disabled and the helper text tells you to select at least one document.
- Clicking **Generate Transmittal** on a project with no documents — the button must be greyed out.

---

## UAT-DOC-13 — Transmittal history: view, re-download, regenerate, delete

**Goal:** a transmittal issued last month can still be opened and re-sent, and a mistake can be removed.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:** the two transmittals from **UAT-DOC-12**.

| #   | Do this                                                        | You should see                                                                                                                     | Pass? | Notes |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On the **Transmittals** tab, type `TR-001` into the search box | Only that transmittal remains; searching by subject or by your name works too                                                      | ☐     |       |
| 2   | Click **View Details** on TR-001                               | Dialog **Transmittal Details** with the number as a subtitle and a status chip reading GENERATED                                   | ☐     |       |
| 3   | Read the **Transmittal Information** section                   | Project, Client, Transmittal Date, Documents count, Subject, Purpose of Issue and Cover Notes — all matching what you entered      | ☐     |       |
| 4   | Read the **Files** section                                     | A row for the transmittal PDF and a row for the complete package ZIP with its size, each with a **Download** button                | ☐     |       |
| 5   | Click **Download** on the PDF row                              | The same cover sheet downloads again                                                                                               | ☐     |       |
| 6   | Click **Download ZIP** at the bottom of the dialog             | The ZIP downloads again                                                                                                            | ☐     |       |
| 7   | Read the **Documents Included** table                          | Every document with its number, title, revision and status                                                                         | ☐     |       |
| 8   | Close the dialog and click the **Regenerate** action on TR-001 | A message _"Regenerating transmittal…"_, then a fresh PDF and ZIP download and a green toast **TR-001 regenerated and downloaded** | ☐     |       |
| 9   | Confirm the transmittal number after regenerating              | Still **TR-001** — regenerating must not consume a new number                                                                      | ☐     |       |
| 10  | Click **Delete** on TR-002                                     | Dialog **Delete Transmittal** warning it cannot be undone                                                                          | ☐     |       |
| 11  | Confirm the delete                                             | Toast **TR-002 deleted** and the row disappears                                                                                    | ☐     |       |
| 12  | Generate a new transmittal                                     | Its number is **TR-003** — numbers are never reused                                                                                | ☐     |       |

**Also check:**

- The empty transmittal table tells you to click _"Create Transmittal"_, but the button is labelled **Generate Transmittal**. Known issue.

**Should NOT be possible:**

- Downloading the ZIP for a transmittal that has none — you should get a clear error, **ZIP file not available for this transmittal**, not a broken download.

---

## UAT-DOC-14 — Mark a transmittal Sent and Acknowledged

> ⚠ **Known issue — expected to fail.** A transmittal is supposed to progress from Generated to **Sent** (when you post or email it) and then to **Acknowledged** (when the client confirms receipt). Neither step has a button in the app, so no transmittal can ever leave the **GENERATED** status. Do not file feedback for this; it is already on the fix list.

**Goal:** confirm the two missing steps are genuinely missing, so nobody assumes they are hidden somewhere.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:** the transmittal TR-001 from UAT-DOC-12, at status GENERATED.

| #   | Do this                                                         | You should see                                                                                     | Pass? | Notes |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On the **Transmittals** tab, look at the row actions for TR-001 | Only **View Details**, **Download ZIP**, **Regenerate** and **Delete** — ⚠ no Send, no Acknowledge | ☐     |       |
| 2   | Open **View Details** and look at the bottom of the dialog      | Only **Close** and **Download ZIP** — ⚠ no Mark as Sent, no Acknowledge                            | ☐     |       |
| 3   | Confirm the status chip                                         | ⚠ Stays **GENERATED**, and nothing in the app can move it                                          | ☐     |       |

---

## UAT-DOC-15 — Document templates: upload and download

**Goal:** the project team can pull a standard drawing or report template instead of starting from scratch.
**Who:** someone with **Manage** under **Document Management**.
**Before you start:** a template file (Excel, Word or CAD) under 50 MB.

| #   | Do this                                                                                                                                                        | You should see                                                                                            | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On the project, open the **Templates** tab                                                                                                                     | Heading **Document Templates**, subtitle _"Company-wide and project-specific templates"_                  | ☐     |       |
| 2   | Click **Upload Template**                                                                                                                                      | Dialog **Upload Document Template**                                                                       | ☐     |       |
| 3   | Select your file                                                                                                                                               | The filename appears and **Template Name** fills itself from the filename                                 | ☐     |       |
| 4   | Change the name, add a **Description**, set **Category** to **Calculation** and **Scope** to **This Project Only**, and fill **Usage Instructions (Optional)** | Every field accepts input                                                                                 | ☐     |       |
| 5   | Click **Upload Template**                                                                                                                                      | A progress percentage, then the dialog closes                                                             | ☐     |       |
| 6   | Read the new row                                                                                                                                               | Columns Template, Category, Scope (`PROJECT SPECIFIC`), File, Version (`v1`), Downloads, Updated, Actions | ☐     |       |
| 7   | Click **Download** on the row                                                                                                                                  | The template downloads, identical to what you uploaded, and the Downloads count goes up                   | ☐     |       |
| 8   | Upload a second template with **Scope** set to **Company Wide**                                                                                                | It appears with scope `COMPANY WIDE`                                                                      | ☐     |       |
| 9   | Use the **Category** filter and the search box                                                                                                                 | Both narrow the list correctly; the category chips above the table also filter when clicked               | ☐     |       |
| 10  | Open another project's **Templates** tab                                                                                                                       | The company-wide template appears there too; the project-specific one does not                            | ☐     |       |

**Should NOT be possible:**

- Uploading a file over 50 MB — **File size exceeds 50MB limit**.
- Uploading with the name cleared — **Template name is required**, and the button stays disabled.

---

## UAT-DOC-16 — Document Links, Supply List and Work List

**Goal:** a document records what must be finished before it can start, what it depends on, and what material and labour it carries.
**Who:** anyone assigned to the project.
**Before you start:** at least three master documents on the project.

| #   | Do this                                                                            | You should see                                                                                                                                                    | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open a document and click the **Document Links** tab                               | Heading **Document Links & Dependencies** with sections **Predecessors**, **Successors** and **Related Documents**, each currently empty with an explanatory line | ☐     |       |
| 2   | Add another document as a predecessor                                              | It appears under **Predecessors**, and the summary line reads _Predecessors Status: 0 of 1 completed_                                                             | ☐     |       |
| 3   | Take that predecessor document to status **Accepted** (UAT-DOC-08), then come back | The summary reads _1 of 1 completed_ and tells you the document is ready to start                                                                                 | ☐     |       |
| 4   | Open the predecessor document's own **Document Links** tab                         | Your first document is listed under **Successors**, and the summary warns that one document depends on it                                                         | ☐     |       |
| 5   | Click the **Supply List** tab                                                      | Heading **Supply List** with an item count and a total estimated cost, plus **Refresh** and **Add Supply Item**                                                   | ☐     |       |
| 6   | Add a supply item with a name, quantity and estimated cost                         | The row appears and the total at the top of the tab increases by the amount you entered                                                                           | ☐     |       |
| 7   | Delete the supply item                                                             | A confirmation naming the item, and after confirming the row goes and the total drops back                                                                        | ☐     |       |
| 8   | Click the **Work List** tab                                                        | Heading **Work List** with an item count and an estimated hours total                                                                                             | ☐     |       |
| 9   | Add a work item with estimated hours                                               | The row appears and the hours total increases                                                                                                                     | ☐     |       |
| 10  | Return to the **Overview** tab                                                     | The **Linked Items** card shows the Supply Items, Work Items and Document Links counts you just created                                                           | ☐     |       |

**Also check:**

- The "view" action on a supply item shows an information message saying the detail view is coming soon. That is expected, not a defect.

---

## UAT-DOC-17 — Document control permission checks

**Goal:** someone who should only read the register cannot change it.
**Who:** you, plus a limited user assigned to the same project with **View** under **Projects** and **no** Document Management permissions.
**Before you start:** the project with documents and at least one transmittal.

| #   | Do this                                                                                     | You should see                                                                                                                    | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As the limited user**, sign in and open the project's **Documents** page                  | The Master Document List loads and the documents are readable                                                                     | ☐     |       |
| 2   | Look at the action bar                                                                      | **New Document** and **Import Register** are not shown at all                                                                     | ☐     |       |
| 3   | Look at a document row's actions                                                            | Only **View Details** — no Edit, no Delete                                                                                        | ☐     |       |
| 4   | Open the **Transmittals** tab                                                               | The history is readable but **Generate Transmittal** is not shown                                                                 | ☐     |       |
| 5   | Open the **Templates** tab                                                                  | Templates are downloadable but **Upload Template** is not shown                                                                   | ☐     |       |
| 6   | Open a document and try to click **Edit** in the header                                     | Either the button is absent, or clicking through and saving is refused with a permissions message rather than silently succeeding | ☐     |       |
| 7   | **As yourself**, remove the limited user from the project team, then have them retry step 1 | They should no longer be able to see the project's documents at all                                                               | ☐     |       |

**Should NOT be possible:**

- A user without **Manage** under Document Management creating, editing or deleting a master document, generating a transmittal, or uploading a template. If any of these succeeds, that is a serious defect — report it.
- A user who is not on the project team reading that project's documents.

---

## UAT-DOC-18 — Company Documents registry: upload, new version, delete

**Goal:** company-wide SOPs, policies and templates are stored in one place with version history. This is the **Documents** item in the sidebar — it is separate from project document control.
**Who:** an admin (**Manage Users**). Everyone else can read and download but not upload.
**Before you start:** two versions of a policy document (any two files).

| #   | Do this                                                               | You should see                                                                                                                                                                                  | Pass? | Notes |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar **SETUP → Documents**                                         | Page **Company Documents**, subtitle _"SOPs, policies, templates, and company-wide resources"_, with tabs **All**, **SOPs**, **Policies**, **Templates**, **Standards**, **Manuals**, **Other** | ☐     |       |
| 2   | Click **Upload Document**                                             | An upload form with a title, description, category and tags                                                                                                                                     | ☐     |       |
| 3   | Upload the first file as an SOP, with a title and description         | The row appears under the **SOPs** tab, chipped `v1`                                                                                                                                            | ☐     |       |
| 4   | Click the row's download action                                       | The file downloads correctly                                                                                                                                                                    | ☐     |       |
| 5   | Open the row's **⋮** menu and choose **Upload New Version**           | An upload dialog for a replacement file                                                                                                                                                         | ☐     |       |
| 6   | Upload the second file with a version note                            | The row's chip changes to `v2`                                                                                                                                                                  | ☐     |       |
| 7   | Click the version chip (tooltip **View version history**)             | Dialog **Version History: {title}** listing both versions with their uploader, date and notes                                                                                                   | ☐     |       |
| 8   | Download v1 from the history                                          | The original file downloads — old versions are still retrievable                                                                                                                                | ☐     |       |
| 9   | Choose **Edit Details** from the ⋮ menu, change the description, save | The change sticks after a reload                                                                                                                                                                | ☐     |       |
| 10  | Search for the document by a word in its description                  | It is found; searching by title and by tag also works                                                                                                                                           | ☐     |       |
| 11  | Choose **Delete**, confirm on the **Delete Document** dialog          | The row goes                                                                                                                                                                                    | ☐     |       |
| 12  | **As a non-admin user**, open the same page                           | Documents are readable and downloadable, but **Upload Document** and the ⋮ menu are not offered                                                                                                 | ☐     |       |

**Also check:**

- This page must not show any project master documents, and the project Documents page must not show these company documents. They are two separate registers.

---

# Estimation / BOM

## UAT-EST-01 — Create a BOM and check the code format

**Goal:** an estimate exists for a piece of equipment, with a traceable code.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** nothing.

| #   | Do this                                                    | You should see                                                                                                                                               | Pass? | Notes |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Sidebar **SALES & ESTIMATION → Estimation**                | Page **Bill of Materials (BOM)**, subtitle _"Create and manage equipment BOMs with cost estimates"_                                                          | ☐     |       |
| 2   | Click **New BOM**                                          | Page **New Bill of Materials**                                                                                                                               | ☐     |       |
| 3   | Type `HX-101 Shell & Tube` into **BOM Name**               | Accepted                                                                                                                                                     | ☐     |       |
| 4   | Open **Category**                                          | Heat Exchanger, Pressure Vessel, Storage Tank, Piping Assembly, Pump Package, Structure, Electrical, Instrumentation Package, HVAC, General Equipment, Other | ☐     |       |
| 5   | Leave **Heat Exchanger** selected and click **Create BOM** | The button shows **Creating...**, then the BOM editor opens                                                                                                  | ☐     |       |
| 6   | Read the line under the BOM name                           | **BOM Code: EST-2026-0001** — the current year and a four-digit sequence                                                                                     | ☐     |       |
| 7   | Read the status chip beside the name                       | DRAFT                                                                                                                                                        | ☐     |       |
| 8   | Read the **Summary** panel                                 | Total Items 0, Total Weight 0, and every cost line at ₹0.00                                                                                                  | ☐     |       |
| 9   | Go back to **Estimation** and create a second BOM          | Its code is **EST-2026-0002** — the sequence advanced                                                                                                        | ☐     |       |

**Also check:**

- The BOM list row shows the code, name, category, project, item count, total cost, status and created date.
- Occasionally a BOM code comes out as `EST-2026-` followed by eight letters and digits instead of a four-digit number. That is a deliberate fallback, not a defect — record it in Notes but do not file it.

**Should NOT be possible:**

- Creating a BOM with an empty name — you should get **BOM name is required**.

---

## UAT-EST-02 — New BOM round-trip: nothing lost between save and reopen

**Goal:** everything you type on the create form survives the save.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** at least one project exists.

| #   | Do this                                                                                                                                                 | You should see                                                                                                                                            | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open **Estimation → New BOM** and fill **every** field: BOM Name, Description, Category **Pressure Vessel**, and a project in **Project / Cost Centre** | All four accept input                                                                                                                                     | ☐     |       |
| 2   | Write down every value                                                                                                                                  | —                                                                                                                                                         | ☐     |       |
| 3   | Click **Create BOM**                                                                                                                                    | The editor opens                                                                                                                                          | ☐     |       |
| 4   | Compare the editor header against your notes                                                                                                            | The BOM name is the heading and your description appears under the BOM code                                                                               | ☐     |       |
| 5   | Go back to **Estimation** and find the row                                                                                                              | Name, **Category** showing _Pressure Vessel_, and **Project** showing the project you picked — none of them blank or defaulted back to Heat Exchanger     | ☐     |       |
| 6   | Sign out, sign back in and reopen the BOM                                                                                                               | Everything is still as you entered it                                                                                                                     | ☐     |       |
| 7   | Create a BOM from a proposal (open a proposal, use its estimation link)                                                                                 | The new-BOM page shows a **Creating BOM for Proposal** banner with the proposal number and a **Linked** chip, and the name and description are pre-filled | ☐     |       |
| 8   | Create it, then look at the editor header                                                                                                               | A chip reading **Linked to proposal {number}** which opens the proposal when clicked                                                                      | ☐     |       |

---

## UAT-EST-03 — Add a fabricated (shape-based) item and watch the live calculation

**Goal:** a plate or shell is added to the BOM with its weight and cost worked out from its dimensions and material.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** the BOM from UAT-EST-01, and **at least one material with a density and a current price** (see UAT-MAT-04 — without a price the cost comes out as ₹0.00, which is not a defect).

| #   | Do this                                                                                  | You should see                                                                                                                                                                | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | In the BOM editor, click **Add Item**                                                    | Dialog **Add BOM Item** with two tabs: **Bought-Out Component** and **Fabricated (Shape-Based)**                                                                              | ☐     |       |
| 2   | Switch to **Fabricated (Shape-Based)**                                                   | A **Shape Category** dropdown and a **Select Shape** box — nothing else yet                                                                                                   | ☐     |       |
| 3   | Set **Shape Category** to **Plates & Sheets**                                            | The shape list narrows to Rectangular Plate, Circular Plate and Custom Plate                                                                                                  | ☐     |       |
| 4   | Choose **Rectangular Plate**                                                             | A panel confirms the selection and lists its parameters; a **Material Selection** section appears below                                                                       | ☐     |       |
| 5   | Choose a material in **Select Material**                                                 | A **Dimensions** section appears with **Length**, **Width**, **Thickness** and, under **Optional Parameters**, **Cutting Allowance** — each with its unit and a default value | ☐     |       |
| 6   | Set Length 2000, Width 1500, Thickness 12                                                | A **Calculation Results** block appears showing **Unit Weight**, **Surface Area** and **Unit Cost** — it recalculates as you type                                             | ☐     |       |
| 7   | Change Thickness to 20 and watch the results                                             | Unit Weight and Unit Cost both rise — roughly in proportion to the thickness                                                                                                  | ☐     |       |
| 8   | Expand **Cost Breakdown**                                                                | Lines for material cost (finished and blank), scrap recovery, cutting, edge preparation, welding and surface treatment, then a **Total** and an **Effective Rate** per kg     | ☐     |       |
| 9   | Under **Item Details**, set **Item Name**, **Quantity** to 4 and leave **Unit** as `nos` | The results block gains a **Total (4 pcs)** figure, four times the unit cost                                                                                                  | ☐     |       |
| 10  | Click **Add Item**                                                                       | The dialog closes and a card appears in **BOM Items** headed **1. {your item name}**, with a **Fabricated** chip and _Quantity: 4 nos_                                        | ☐     |       |
| 11  | Read the **Summary** panel                                                               | **Total Items** is now 1, **Total Weight** and the **Material** / **Fabrication** cost lines are no longer zero                                                               | ☐     |       |
| 12  | Add a second fabricated item — a **Cylindrical Shell** from **Pressure Vessels**         | It is numbered **2**, and the Summary totals rise again                                                                                                                       | ☐     |       |
| 13  | Add a third item and confirm the numbering                                               | **3** — items are numbered 1, 2, 3 in the order you add them                                                                                                                  | ☐     |       |

**Also check:**

- All five shape categories should be selectable: Plates & Sheets, Tubes, Pressure Vessels, Heat Exchangers, Nozzles & Connections. Add one item from each and confirm each produces a weight.
- Once you have ten or more items, the card order becomes 1, 10, 11, 2, 3… That is a known issue with the sorting; do not report it.

**Should NOT be possible:**

- Adding with no shape chosen — **Please select a shape**.
- Adding with no material chosen — **Please select a material for the shape**.
- Adding with the item name blank — **Item name is required**.
- Adding with quantity 0 — **Quantity must be greater than 0**.

---

## UAT-EST-04 — Add a bought-out item from the catalog

**Goal:** a purchased valve or pump appears on the BOM as a line with its own quantity.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** the BOM from UAT-EST-03, and at least one item in the Bought Out Items catalog (UAT-MAT-08).

| #   | Do this                                                                                             | You should see                                                                                                                                                            | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Click **Add Item** and stay on the **Bought-Out Component** tab                                     | A read-only **Bought-Out Component** field with a **Browse** button                                                                                                       | ☐     |       |
| 2   | Click **Browse**                                                                                    | A picker with two tabs, **Materials** and **Bought-Out**, opening on **Bought-Out**                                                                                       | ☐     |       |
| 3   | Search by code or name, then pick an item                                                           | The picker closes and the field shows `{code} — {name}`; an information line shows its list price                                                                         | ☐     |       |
| 4   | Read the helper text under the field                                                                | It warns that cost calculation for these lines is not wired up yet and currently uses material prices only — expected, do not report                                      | ☐     |       |
| 5   | Fill **Item Name**, set **Quantity** to 2, leave **Unit** as `nos`                                  | Accepted                                                                                                                                                                  | ☐     |       |
| 6   | Set **Item Type** to **Part**                                                                       | The options are Assembly, Part and Material                                                                                                                               | ☐     |       |
| 7   | Click **Add Item**                                                                                  | A new card appears with a **Bought-Out** chip and _Quantity: 2 nos_                                                                                                       | ☐     |       |
| 8   | Now add another item, but this time use the picker's **Materials** tab and choose a priced material | The card is created and shows _Material: {material code}_                                                                                                                 | ☐     |       |
| 9   | From the picker, click **Create New** and create a bought-out item inline                           | Dialog **Create New Bought-Out Item** with Name, Category, Manufacturer, Model, List Price, Currency and Specification; after **Create & Use** it is selected on the form | ☐     |       |
| 10  | Check the Bought Out Items catalog                                                                  | The item you created inline is there too — one catalog, not a copy                                                                                                        | ☐     |       |

**Should NOT be possible:**

- Adding a bought-out line with nothing selected — **Please select an item from the catalog**.

---

## UAT-EST-05 — Calculate costs and watch the totals recalculate

**Goal:** the BOM prices itself from current material prices, and the summary reflects it.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** the BOM from UAT-EST-03 with at least three fabricated items and priced materials.

| #   | Do this                                                           | You should see                                                                                                                                                                                                                                                  | Pass? | Notes |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Look at the item cards                                            | Any item that has never been costed shows a **Not calculated** chip                                                                                                                                                                                             | ☐     |       |
| 2   | Write down the **Summary** panel figures                          | —                                                                                                                                                                                                                                                               | ☐     |       |
| 3   | Click **Calculate Costs**                                         | The button shows **Calculating...**, then a green toast **Cost calculation completed**                                                                                                                                                                          | ☐     |       |
| 4   | Look at the item cards                                            | The **Not calculated** chips are replaced by a **Total Cost** figure with `Mat:` and `Fab:` lines underneath                                                                                                                                                    | ☐     |       |
| 5   | Look at the **Summary** panel straight away                       | ⚠ known issue — it usually still shows the old totals. Wait about ten seconds, then reload the page                                                                                                                                                             | ☐     |       |
| 6   | After reloading, read the **Summary** panel                       | **Total Weight** and the **Material**, **Fabrication** and **Total Direct** figures now match the sum of the item cards                                                                                                                                         | ☐     |       |
| 7   | Add up the item cards' **Total Cost** values by hand              | The sum matches **Total Direct** in the Summary                                                                                                                                                                                                                 | ☐     |       |
| 8   | Add one more item to the BOM                                      | The Summary updates immediately — Total Items goes up by one, and the weight and cost lines increase by that item's contribution                                                                                                                                | ☐     |       |
| 9   | Look at the **Indirect Costs** part of the Summary                | If your company has an overhead / contingency / profit configuration, **Overhead**, **Contingency** and **Profit** appear and **Total Cost** is higher than **Total Direct**. If not, you see _No indirect costs configured_ and Total Cost equals Total Direct | ☐     |       |
| 10  | Check the order the indirect costs are applied                    | Overhead is a percentage of the direct cost; contingency is a percentage of direct **plus** overhead; profit is a percentage of direct plus overhead plus contingency. Work one through on paper and confirm                                                    | ☐     |       |
| 11  | Go back to the **Estimation** list                                | The BOM's **Total Cost** column matches the editor's Total Cost, and **Items** matches the item count                                                                                                                                                           | ☐     |       |
| 12  | Click **Calculate Costs** a second time without changing anything | Same toast, same figures — running it twice must not double anything                                                                                                                                                                                            | ☐     |       |

**Also check:**

- Bought-out lines picked from the Bought Out Items catalog stay at **Not calculated** after this. That is a known issue, not a test failure.
- If a material has no price, its item costs ₹0.00 rather than failing. Set a price on that material (UAT-MAT-04) and recalculate to confirm the figure changes.
- **Service** in the Summary and `Svc:` on the cards will always be ₹0.00 — services cannot be attached to items yet (see UAT-EST-09).

---

## UAT-EST-06 — Generate a quote PDF from a BOM

**Goal:** the estimate becomes a document you can send to a customer.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** the costed BOM from UAT-EST-05.

| #   | Do this                                                                             | You should see                                                                                                                | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | In the editor, click **Generate PDF**                                               | Dialog **Generate Quote PDF - {BOM name}**                                                                                    | ☐     |       |
| 2   | Read the fields                                                                     | **Company Name** pre-filled, plus **Customer Name**, **Customer Address**, **Attention (Contact Person)** and **Prepared By** | ☐     |       |
| 3   | Read **Display Options:**                                                           | Five tick boxes, all ticked: detailed cost breakdown, indirect costs, item descriptions, material codes, service costs        | ☐     |       |
| 4   | Fill Customer Name, address, attention and prepared by, then click **Generate PDF** | The button shows **Generating...**, then a PDF downloads named after the BOM code                                             | ☐     |       |
| 5   | Open the PDF                                                                        | Your company name, the customer details, every BOM item with its quantity and cost, and the total                             | ☐     |       |
| 6   | Cross-check the PDF total against the editor's **Total Cost**                       | They match to the paisa                                                                                                       | ☐     |       |
| 7   | Generate again with **Show indirect costs (overhead, profit)** unticked             | Overhead, contingency and profit are absent from the PDF, and the total shown is the direct cost                              | ☐     |       |
| 8   | Generate again with **Show item descriptions** and **Show material codes** unticked | Those columns disappear from the item table                                                                                   | ☐     |       |

**Should NOT be possible:**

- Generating with **Customer Name** empty — you should get **Customer name is required**.
- Clicking **Generate PDF** on a BOM with no items — the button must be greyed out.

**Also check:**

- **Company Name** is marked as required but is not actually checked. Clearing it still produces a PDF. Known issue.

---

## UAT-EST-07 — BOM list: search, open, delete, and the Draft-only delete rule

**Goal:** estimates can be found and cleaned up, and a released estimate cannot be thrown away.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** at least three BOMs from the tests above.

| #   | Do this                                                    | You should see                                                                                           | Pass? | Notes |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open **Estimation**                                        | The BOM list with columns BOM Code, Name, Category, Project, Items, Total Cost, Status, Created, Actions | ☐     |       |
| 2   | Click anywhere on a row                                    | The editor for that BOM opens                                                                            | ☐     |       |
| 3   | Go back and use the row's **Edit** action                  | The same editor opens — view and edit are the same screen for BOMs                                       | ☐     |       |
| 4   | Look at the **Delete** action on a **DRAFT** BOM           | It is available                                                                                          | ☐     |       |
| 5   | Click it                                                   | Dialog **Delete BOM** naming the BOM and warning it cannot be undone                                     | ☐     |       |
| 6   | Click **Cancel**                                           | Nothing is deleted                                                                                       | ☐     |       |
| 7   | Click **Delete** again and confirm. **This is permanent.** | The row disappears from the list                                                                         | ☐     |       |
| 8   | Reload the page                                            | The deleted BOM stays gone                                                                               | ☐     |       |
| 9   | Check the **Created** and **Total Cost** columns           | Dates read like `21 Jul 2026`; money reads like `₹1,234.56`                                              | ☐     |       |

**Should NOT be possible:**

- Deleting a BOM that is not in **DRAFT** — the Delete action must be greyed out. In practice every BOM stays in Draft (see UAT-EST-08), so you will not be able to demonstrate the block. Note that in your results rather than filing it.

---

## UAT-EST-08 — Move a BOM past Draft

> ⚠ **Known issue — expected to fail.** A BOM is meant to progress from **Draft** through **Under Review**, **Approved**, **Released** and finally **Archived**. None of those steps has a button in the app, so every BOM stays in **DRAFT** forever. Do not file feedback for this; it is already on the fix list.

**Goal:** confirm the missing workflow is genuinely missing.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** the BOM from UAT-EST-05.

| #   | Do this                                                    | You should see                                                                                                | Pass? | Notes |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the BOM editor and look at the header buttons         | Only **Calculate Costs**, **Generate PDF** and **Add Item** — ⚠ no Submit, no Approve, no Release, no Archive | ☐     |       |
| 2   | Look at the status chip                                    | ⚠ Stays DRAFT                                                                                                 | ☐     |       |
| 3   | Look for a status control anywhere on the page or the list | ⚠ There is none                                                                                               | ☐     |       |

---

## UAT-EST-09 — Edit an item, remove an item, attach a service

> ⚠ **Known issue — expected to fail.** Once an item is on a BOM there is no way to change it, remove it, or attach a service (welding, inspection, transport) to it. A mistyped quantity can only be fixed by deleting the whole BOM and rebuilding it. Do not file feedback for this; it is already on the fix list.

**Goal:** confirm the three missing capabilities, so testers do not hunt for them.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** the BOM from UAT-EST-05.

| #   | Do this                                                                 | You should see                                                      | Pass? | Notes |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- | ----- | ----- |
| 1   | Click on an item card in **BOM Items**                                  | ⚠ Nothing happens — the cards are not clickable                     | ☐     |       |
| 2   | Look for an edit or delete icon on the card                             | ⚠ There is none, and no right-click or ⋮ menu either                | ☐     |       |
| 3   | Look for a way to attach a service from the services catalog to an item | ⚠ There is none — no tab, no button, no rate-override field         | ☐     |       |
| 4   | Confirm the effect on the totals                                        | ⚠ **Service** in the Summary and `Svc:` on every card stay at ₹0.00 | ☐     |       |

---

## UAT-EST-10 — Estimation permission checks

**Goal:** someone without estimation access cannot create or change estimates.
**Who:** you, plus a limited user with no Estimation permissions at all.
**Before you start:** at least two BOMs exist.

| #   | Do this                                                                                                   | You should see                                                                                    | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As the limited user**, open **SALES & ESTIMATION → Estimation**                                         | The page loads but the BOM list is empty — no BOMs are readable without **View** under Estimation | ☐     |       |
| 2   | Try **New BOM**, fill the form and click **Create BOM**                                                   | The save must be refused with a clear error, not succeed                                          | ☐     |       |
| 3   | **As yourself**, give the limited user **View** under **Estimation** only. Have them sign out and back in | The BOM list now shows the BOMs                                                                   | ☐     |       |
| 4   | **As the limited user**, open a BOM and try **Add Item**                                                  | The item must not save — a permissions error, not a silent success                                | ☐     |       |
| 5   | **As the limited user**, try to delete a Draft BOM                                                        | Refused                                                                                           | ☐     |       |
| 6   | **As yourself**, add **Manage** under **Estimation**, have them sign in again                             | They can now create a BOM and add an item                                                         | ☐     |       |

**Should NOT be possible:**

- Creating, editing or deleting a BOM or a BOM item without **Manage** under **Estimation**. If any of these succeeds, report it.

---

# Material and equipment catalogs

## UAT-MAT-01 — Add a material and check the generated code

**Goal:** a new material is in the database with a sensible auto-generated code.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** nothing.

| #   | Do this                                                                                               | You should see                                                                                                                                                                       | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Sidebar **ENGINEERING DATA → Material Database**                                                      | Page **Materials** with tiles for Plates, Pipes, Fittings, Flanges, Valves, Pumps, Instruments, Fasteners, Structural Steel, Consumables, Quotes and Needs Review, each with a count | ☐     |       |
| 2   | Click **Add New Material**                                                                            | Page **New Material** with sections Material Type, Basic Information, Specification, Properties, Organization                                                                        | ☐     |       |
| 3   | Set **Material Type** to **Raw Material (Fittings, Structural Steel, Bars, Sheets)**                  | A **Category** dropdown appears                                                                                                                                                      | ☐     |       |
| 4   | Choose a category                                                                                     | The rest of the form appears — nothing shows until a category is picked                                                                                                              | ☐     |       |
| 5   | Fill **Grade** as `A234` and a **Standard**                                                           | **Material Name** fills itself from the standard, grade and form                                                                                                                     | ☐     |       |
| 6   | Fill **Description** (at least 10 characters), set **Density** to 7850 kg/m³ and pick a **Base Unit** | All accepted                                                                                                                                                                         | ☐     |       |
| 7   | Type two tags into **Add Tags**, pressing Enter after each                                            | Each becomes a removable chip                                                                                                                                                        | ☐     |       |
| 8   | Click **Create Material**                                                                             | **Creating...**, then the material's detail page opens                                                                                                                               | ☐     |       |
| 9   | Read the code chip in the header                                                                      | A derived code in the form `{form}-{type}-{grade}`, for example **FT-BW-A234**                                                                                                       | ☐     |       |
| 10  | Create a second material with the same category and grade                                             | Its code gains a suffix — `FT-BW-A234-001` — rather than clashing                                                                                                                    | ☐     |       |
| 11  | Create a third material, this time entering a **Custom Code** yourself                                | Your code is used exactly as typed                                                                                                                                                   | ☐     |       |

**Also check:**

- Add a **plate** material through **Material Database → Plates → Add Plate**. The page is **New Plate Material** and the button reads **Create Plate Material**. Its code comes out like **PL-CS-A36**.
- Now create a second plate with the same grade. You should get a clear message telling you plates use thickness variants and to add a variant instead of a duplicate — this is correct behaviour, not a defect.

**Should NOT be possible:**

- Saving with the name, description, category or base unit empty — the **Create Material** button must stay disabled.
- Saving a material with no grade and no custom code — you should get a message that a grade is needed to generate the code.

---

## UAT-MAT-02 — Material round-trip: nothing lost between save and reopen

**Goal:** every field on the material form survives create → view → edit → save → reopen.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** nothing.

| #   | Do this                                                                                                                                                                                                                                                                          | You should see                                                                                                                                                              | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Create a material filling **every** field: Material Type, Category, Material Name, Custom Code, Description, Standard, Grade, Form / Type, Finish, Density (with its unit), Base Unit, three tags, and tick both **Mark as Standard Material** and **Enable Inventory Tracking** | All accepted                                                                                                                                                                | ☐     |       |
| 2   | Write every value down                                                                                                                                                                                                                                                           | —                                                                                                                                                                           | ☐     |       |
| 3   | Save, then read the detail page's **Overview**, **ASME/ASTM Specification**, **Material Properties** and **Tags** cards                                                                                                                                                          | Material Code, Category, Type, Base Unit, Standard, Grade, Finish, Form, Density and all three tags match your notes                                                        | ☐     |       |
| 4   | Check the header chips                                                                                                                                                                                                                                                           | A **Standard** chip and an **Inventory Tracked** chip are both present                                                                                                      | ☐     |       |
| 5   | Click **Edit**                                                                                                                                                                                                                                                                   | Page **Edit Material** showing the material code and category in the subtitle                                                                                               | ☐     |       |
| 6   | Compare every field against your notes                                                                                                                                                                                                                                           | Name, Custom Code, Material Type, Description, Standard, Grade, Finish, Form, Density and its unit, Base Unit, all three tags, and both tick boxes are pre-filled correctly | ☐     |       |
| 7   | Without changing anything, click **Save Changes**                                                                                                                                                                                                                                | You are returned to the detail page                                                                                                                                         | ☐     |       |
| 8   | Re-open **Edit** and check everything again                                                                                                                                                                                                                                      | Identical to step 6 — nothing lost, nothing reset                                                                                                                           | ☐     |       |
| 9   | Now fill the three optional strength fields (**Tensile Strength**, **Yield Strength**, **Max Operating Temperature**) and save                                                                                                                                                   | The detail page's Material Properties card shows all three                                                                                                                  | ☐     |       |
| 10  | Re-open **Edit**                                                                                                                                                                                                                                                                 | All three are still there                                                                                                                                                   | ☐     |       |
| 11  | Remove one tag, add a different one, and save                                                                                                                                                                                                                                    | The Tags card reflects the change exactly                                                                                                                                   | ☐     |       |

**Also check:**

- The **Material Type** dropdown is worded differently on the create page ("Raw Material (Fittings, Structural Steel, Bars, Sheets)") and the edit page ("Raw Material"). Confirm the _value_ is the same on both, even though the wording differs.

---

## UAT-MAT-03 — Browse the material category pages

**Goal:** an engineer can find the right plate or valve out of hundreds.
**Who:** anyone with **View** under **Estimation**.
**Before you start:** at least five materials across two categories.

| #   | Do this                                                                      | You should see                                                                                                            | Pass? | Notes |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On **Material Database**, click the **Valves** tile                          | Page **Valves** with a subtitle naming the valve types                                                                    | ☐     |       |
| 2   | Read the cards at the top                                                    | **Total Active Valves**, **Valves by Type** with a chip per type, **Recently Added (30d)** and **Missing Specifications** | ☐     |       |
| 3   | Read the table headers                                                       | Material Code, Name, Specification, Category, Properties, Status, Actions                                                 | ☐     |       |
| 4   | Type into the search box                                                     | The list narrows; searching by code and by name both work                                                                 | ☐     |       |
| 5   | Set **Category** and **Standard** filters                                    | The list narrows further; **Standard Only** leaves just the materials marked standard                                     | ☐     |       |
| 6   | Click **Clear**                                                              | Every filter resets                                                                                                       | ☐     |       |
| 7   | Click the **Material Code** and then the **Name** column headers             | The list sorts by each, ascending and descending                                                                          | ☐     |       |
| 8   | Use the row action **View Details**                                          | The material's detail page opens                                                                                          | ☐     |       |
| 9   | Go back and use **Edit Material**                                            | The edit page opens for the same material                                                                                 | ☐     |       |
| 10  | Change the page size to 50 and page through                                  | Pagination works and the row count matches the total                                                                      | ☐     |       |
| 11  | Search for a nonsense string                                                 | _"No valves match your search criteria. Try adjusting your search or filters."_                                           | ☐     |       |
| 12  | Repeat steps 3–10 on the **Plates**, **Fasteners** and **Consumables** pages | Same behaviour on each                                                                                                    | ☐     |       |
| 13  | Open the **Pipes** page                                                      | A different table — NPS, DN, Schedule, OD, ID, WT, Weight per metre and Material                                          | ☐     |       |

**Also check:**

- The **Pipes**, **Flanges** and **Fittings** pages have a **Refresh** button but no Add button. Known issue; do not report it.

---

## UAT-MAT-04 — Material prices: where a price comes from

**Goal:** understand and verify the only route by which a material gets a price, since BOM costing depends on it.

> ⚠ **Partly a known issue.** There is no "Add Price" button, no effective-date field and no price-history screen on a material. The only way to set a material's price in the app is to accept a vendor's quoted price in Procurement. Steps 1–3 confirm the absence; the rest test the route that does work.

**Who:** someone with **Manage** under **Estimation** and access to Procurement quotes.
**Before you start:** a material from UAT-MAT-01, and a vendor quote in Procurement that includes that material with a price.

| #   | Do this                                                                  | You should see                                                                                                  | Pass? | Notes |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the material's detail page and read the **Current Price** card      | _"No price information available"_                                                                              | ☐     |       |
| 2   | Look for an Add Price button on the detail page or the edit page         | ⚠ There is none. Do not report this                                                                             | ☐     |       |
| 3   | Look for a price history list                                            | ⚠ There is none for materials. Do not report this                                                               | ☐     |       |
| 4   | Go to **Procurement → Quotes**, open a quote that includes this material | The quote's line items list the material                                                                        | ☐     |       |
| 5   | Accept the quoted price for that line                                    | A confirmation, and the line is marked accepted                                                                 | ☐     |       |
| 6   | Return to the material's detail page                                     | The **Current Price** card now shows the accepted rate                                                          | ☐     |       |
| 7   | Read the **Quotes** card on the same page                                | A row for the quote, with the price per unit, the GST percentage, the vendor, the date and an **Accepted** chip | ☐     |       |
| 8   | Click that row                                                           | The quote opens in Procurement                                                                                  | ☐     |       |
| 9   | Accept a **higher** price from a **newer** quote for the same material   | The Current Price card updates to the newer figure                                                              | ☐     |       |
| 10  | Accept a price from an **older** quote                                   | The Current Price card keeps the newer figure — an older price must not overwrite a newer one                   | ☐     |       |
| 11  | Open a BOM that uses this material and click **Calculate Costs**         | The item cost reflects the new price                                                                            | ☐     |       |

**Also check:**

- A material with no price still calculates in a BOM — it simply produces ₹0.00. That is expected.

---

## UAT-MAT-05 — Record a stock movement

> ⚠ **Known issue — expected to fail.** Materials can be marked as inventory-tracked, but there is no screen anywhere in the app to record a goods receipt, an issue to production or a stock adjustment, and no stock history to look at. Do not file feedback for this; it is already on the fix list.

**Goal:** confirm the absence, so nobody hunts for a hidden screen.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** the material from UAT-MAT-02, with **Enable Inventory Tracking** ticked.

| #   | Do this                                                                      | You should see                                                 | Pass? | Notes |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- | ----- | ----- |
| 1   | Open the material's detail page                                              | An **Inventory Tracked** chip in the header                    | ☐     |       |
| 2   | Look for a current stock figure, a stock movement button, or a stock history | ⚠ There is none — the chip is the only sign the setting exists | ☐     |       |
| 3   | Open **Edit** and confirm the tick box is the only inventory control         | ⚠ Correct — ticking it unlocks nothing                         | ☐     |       |

---

## UAT-MAT-06 — Clear the Needs Review flag on an auto-created material

**Goal:** materials created automatically when a quote or purchase request is imported get checked by a human and cleared.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** at least one material in the Needs Review queue. These are created automatically when an imported quote or purchase request names a material that is not in the database — arrange one, or use an existing one.

| #   | Do this                                                                                  | You should see                                                                                                     | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | On **Material Database**, click the **Needs Review** tile                                | Page **Materials — Needs Review**, explaining these are auto-created records that need their specification checked | ☐     |       |
| 2   | Read the tile's badge count against the number of rows                                   | They match                                                                                                         | ☐     |       |
| 3   | Read the table                                                                           | Columns Code, Name, Category, Base Unit, Created, By — and each Code carries a small **needs review** chip         | ☐     |       |
| 4   | Search for part of a material's name                                                     | The list narrows; a nonsense search gives **No matches**                                                           | ☐     |       |
| 5   | Open one of the rows                                                                     | The material's detail page                                                                                         | ☐     |       |
| 6   | Click **Edit**, correct the description, grade and base unit, and click **Save Changes** | You are returned to the detail page                                                                                | ☐     |       |
| 7   | Go back to **Needs Review**                                                              | That material is gone from the queue and the tile's count has dropped by one                                       | ☐     |       |
| 8   | Clear the last one in the queue                                                          | An empty state headed **Nothing to review**                                                                        | ☐     |       |

**Also check:**

- The page's own instructions say to "clear the review flag on the detail page", but there is no such button there — saving from the edit page is what clears it. Known issue; do not report it.

---

## UAT-MAT-07 — Deactivate a material

> ⚠ **Known issue — expected to fail.** Materials carry an active/inactive state — the detail page will show an **Inactive** chip if one is set — but there is no delete, deactivate or archive control anywhere in the materials screens. A material added by mistake cannot be retired. Do not file feedback for this; it is already on the fix list.

**Goal:** confirm the absence.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** any material.

| #   | Do this                                                      | You should see                                         | Pass? | Notes |
| --- | ------------------------------------------------------------ | ------------------------------------------------------ | ----- | ----- |
| 1   | Open a material's detail page and look at the header actions | ⚠ Only **Edit** — no Delete, no Deactivate, no Archive | ☐     |       |
| 2   | Open **Edit** and look for an active/inactive control        | ⚠ There is none                                        | ☐     |       |
| 3   | Look at a material row's actions on a category list page     | ⚠ Only **View Details** and **Edit Material**          | ☐     |       |

---

## UAT-MAT-08 — Add a bought-out item and check the code format

**Goal:** a purchasable valve, pump or instrument is in the catalog with a code that procurement and estimation can both use.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** nothing.

| #   | Do this                                                                                                                                                                                   | You should see                                                                                                                     | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar **ENGINEERING DATA → Bought Out Items**                                                                                                                                           | Page **Bought-Out Items**, subtitle _"Manage procurement-ready equipment and components"_                                          | ☐     |       |
| 2   | Read the category tabs                                                                                                                                                                    | **All Items**, then Pumps, Valves, Instruments, Motors, Safety Devices, Local Gauges, Steam Traps, Accessories, Electrical, Others | ☐     |       |
| 3   | Click **New Item**                                                                                                                                                                        | Page **New Bought-Out Item** with cards **Basic Information**, **Specifications** and **Pricing**                                  | ☐     |       |
| 4   | Fill **Item Name** as `Gate Valve 2 inch Class 150`, leave **Category** on **Valves**, and add a description                                                                              | Accepted                                                                                                                           | ☐     |       |
| 5   | In **Specifications**, fill **Manufacturer**, **Model**, **Valve Type** (Gate), **Size**, **Pressure Rating**, **Body Material**, **Trim Material**, **End Connection** and **Operation** | Every field accepts input                                                                                                          | ☐     |       |
| 6   | In **Pricing**, set **List Price**, leave **Currency** on **INR (₹)**, and set **Lead Time (Days)** and **Minimum Order Qty**                                                             | Accepted                                                                                                                           | ☐     |       |
| 7   | Click **Create Item**                                                                                                                                                                     | **Creating...**, then you are returned to the list                                                                                 | ☐     |       |
| 8   | Find the new row and read its code                                                                                                                                                        | **BO-2026-0001** — the current year and a four-digit sequence                                                                      | ☐     |       |
| 9   | Create a second item                                                                                                                                                                      | Its code is **BO-2026-0002**                                                                                                       | ☐     |       |
| 10  | Create one item in each of the **Pumps**, **Instruments** and **Electrical** categories                                                                                                   | Each gets the next code in the same sequence, regardless of category                                                               | ☐     |       |

**Also check:**

- The specification fields change with the category: pumps get Pump Type, Flow Rate, Head, NPSHr, Power, Efficiency and materials; instruments get Instrument Type, Variable, Min/Max Range, Unit, Output Signal and Process Connection; electrical gets Type, Voltage, Power Rating and IP Rating.
- Motors, Safety Devices, Local Gauges, Steam Traps and Accessories show no category-specific fields — only Manufacturer, Model and Additional Notes. Known issue; do not report it.
- The required marks on the create form are cosmetic — submitting an empty form still creates an item with a price of zero. Record this if you see it, but it is already known.

---

## UAT-MAT-09 — Bought-out round-trip, and the spec code preview

**Goal:** everything typed on the bought-out form survives the save, and the automatic specification code behaves.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** nothing.

| #   | Do this                                                                                 | You should see                                                                                                                                                                                                                       | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Start a **New Item** in category **Valves** and fill **every** field on all three cards | All accepted                                                                                                                                                                                                                         | ☐     |       |
| 2   | Write every value down                                                                  | —                                                                                                                                                                                                                                    | ☐     |       |
| 3   | Watch the **Spec code** panel below the specification fields as you fill it in          | ⚠ known issue — it stays on _"Missing: type"_ however completely you fill the form, and the code chip never appears. Do not report this                                                                                              | ☐     |       |
| 4   | Click **Create Item**, then open the new item from the list                             | The detail page, headed with the item code and _Created on {date}_, with an **Active** chip                                                                                                                                          | ☐     |       |
| 5   | Compare **Basic Information**, **Specifications** and **Pricing** against your notes    | Item Name, Category, Description, Manufacturer, Model, Valve Type, Size, Pressure Rating, Body Material, Trim Material, End Connection, Operation, Additional Notes, List Price, Currency, Lead Time and Minimum Order Qty all match | ☐     |       |
| 6   | Without changing anything, click **Save Changes**                                       | A green line reading **Item updated successfully**                                                                                                                                                                                   | ☐     |       |
| 7   | Reload the page and compare every field again                                           | Identical — a save with no edits must not lose anything                                                                                                                                                                              | ☐     |       |
| 8   | Change the model, the price and the lead time, and save                                 | **Item updated successfully**, and the **Last updated** caption under Pricing changes                                                                                                                                                | ☐     |       |
| 9   | Reload                                                                                  | The three changes stuck, and everything else is unchanged                                                                                                                                                                            | ☐     |       |
| 10  | Repeat steps 1–9 for a **Pumps** item and an **Instruments** item                       | Same result — every category-specific field survives                                                                                                                                                                                 | ☐     |       |

**Also check:**

- Because the spec code never resolves, the duplicate warning that is supposed to appear when you create an item matching an existing specification also never appears. Known issue.

---

## UAT-MAT-10 — Bought-out list: category tabs, needs-review filter, mark as reviewed

**Goal:** the catalog can be browsed by equipment type, and machine-created entries get a human check.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** the items from UAT-MAT-08 across several categories, and ideally one item flagged for review (these are created automatically when the quote parser reads an unrecognised item off a vendor quote).

| #   | Do this                                                                      | You should see                                                                                                 | Pass? | Notes |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open **Bought Out Items** and stay on **All Items**                          | Columns Item Code, Name, Category, Price and Actions                                                           | ☐     |       |
| 2   | Click the **Valves** tab                                                     | Only valves remain, the Category column disappears, and new columns **Type**, **Size** and **Pressure** appear | ☐     |       |
| 3   | Click the **Pumps** tab                                                      | Only pumps, with columns **Type**, **Flow Rate** (m³/hr) and **Head** (m)                                      | ☐     |       |
| 4   | Click the **Instruments** tab                                                | Columns **Type**, **Variable** and **Range**                                                                   | ☐     |       |
| 5   | Click the **Electrical** tab                                                 | Columns **Type**, **Voltage** and **Power**                                                                    | ☐     |       |
| 6   | Search by item code, then by name                                            | Both narrow the list                                                                                           | ☐     |       |
| 7   | Click the **Needs review** chip                                              | It fills in and changes to **Showing items to review**; only flagged items remain                              | ☐     |       |
| 8   | Open a flagged item                                                          | A yellow banner explaining it was auto-created by the quote parser, with a **Mark as reviewed** button         | ☐     |       |
| 9   | Correct the specification, click **Save Changes**, then **Mark as reviewed** | **Marked as reviewed**, and the banner disappears                                                              | ☐     |       |
| 10  | Go back to the list with the **Needs review** filter on                      | That item is gone from the filtered list                                                                       | ☐     |       |
| 11  | Clear the filter by clicking the X on the chip                               | The full list returns                                                                                          | ☐     |       |
| 12  | On any item with an accepted price, read the **Price History** card          | Rows showing the price per unit, the vendor, the date and the source document — clicking a row opens the quote | ☐     |       |
| 13  | Read the **Quotes** card on the same item                                    | Every vendor quote that has included this item, with an **Accepted** chip on the one you accepted              | ☐     |       |

---

## UAT-MAT-11 — Delete a bought-out item, and the permission guard

**Goal:** obsolete catalog entries can be retired, but only by someone allowed to.
**Who:** you, plus a user **without** the **Edit Entities** permission.
**Before you start:** two spare bought-out items.

| #   | Do this                                                                                                           | You should see                                                                                       | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On the list, click **Delete Item** on a spare item                                                                | Dialog **Delete Item**: _"Are you sure you want to delete this item? This action cannot be undone."_ | ☐     |       |
| 2   | Click **Cancel**                                                                                                  | Nothing is deleted                                                                                   | ☐     |       |
| 3   | Click **Delete Item** again and confirm with **Delete**                                                           | The row disappears from the list                                                                     | ☐     |       |
| 4   | Reload the page                                                                                                   | The item stays gone                                                                                  | ☐     |       |
| 5   | Open a BOM that used that item                                                                                    | The existing BOM line is still there — deleting from the catalog must not break an existing estimate | ☐     |       |
| 6   | **As the user without Edit Entities**, sign in, open **Bought Out Items** and try to delete the second spare item | The delete must be refused with a clear message                                                      | ☐     |       |
| 7   | Reload                                                                                                            | The item is still there                                                                              | ☐     |       |

**Also check:**

- Deleting gives no success message of any kind — the row simply vanishes. If a delete fails, nothing at all is shown either. Known issue; do not report it. If a row does not disappear, reload before concluding the delete failed.

**Should NOT be possible:**

- Deleting a bought-out item without the **Edit Entities** permission.

---

## UAT-MAT-12 — Add a service and check the code format

**Goal:** a chargeable service (inspection, transport, fabrication) is in the rate catalog with a rate and a calculation basis.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** nothing.

| #   | Do this                                                                                                                                                             | You should see                                                                                                                                                         | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar **ENGINEERING DATA → Services**                                                                                                                             | Page **Services** with twelve category tiles, each with a count                                                                                                        | ☐     |       |
| 2   | Click **Add New Service**                                                                                                                                           | Page **New Service**                                                                                                                                                   | ☐     |       |
| 3   | Fill **Service Name** as `Radiographic Testing` and set **Category** to **Testing & Certification**                                                                 | Accepted                                                                                                                                                               | ☐     |       |
| 4   | Open **Calculation Method**                                                                                                                                         | Five options: **Percentage of Material Cost**, **Percentage of Total Cost (Material + Fabrication)**, **Fixed Amount per Item**, **Rate per Unit**, **Custom Formula** | ☐     |       |
| 5   | Choose **Percentage of Material Cost**                                                                                                                              | The rate field's label becomes **Default Rate (%)** with the helper _"Percentage applied to material/total cost"_                                                      | ☐     |       |
| 6   | Switch to **Fixed Amount per Item**                                                                                                                                 | The label changes to **Default Rate (Amount)** with the helper _"Fixed amount or per-unit rate"_                                                                       | ☐     |       |
| 7   | Set the rate, fill **Unit**, **Estimated Turnaround (days)**, **Test Method / Standard**, **Sample Requirements**, **Required Accreditations** and **Deliverables** | All accepted                                                                                                                                                           | ☐     |       |
| 8   | Turn on the **Standard service** switch                                                                                                                             | It moves to on                                                                                                                                                         | ☐     |       |
| 9   | Click **Create Service**                                                                                                                                            | Toast **Service created successfully**, then the service's detail page                                                                                                 | ☐     |       |
| 10  | Read the code chip beside the name                                                                                                                                  | **SVC-TST-001** — the category prefix and a three-digit sequence                                                                                                       | ☐     |       |
| 11  | Create a second Testing service                                                                                                                                     | **SVC-TST-002**                                                                                                                                                        | ☐     |       |
| 12  | Create an **Engineering/Drawing Generation** service                                                                                                                | **SVC-ENG-001** — each category counts separately                                                                                                                      | ☐     |       |
| 13  | Create one service in each remaining category                                                                                                                       | Prefixes follow the category: FAB, INS, TRN, ERC, COM, CON, CAL, MNT, TRG, OTH                                                                                         | ☐     |       |

**Should NOT be possible:**

- Creating a service with an empty name — **Service name is required**, and the button stays disabled.

---

## UAT-MAT-13 — Service round-trip: nothing lost between save and reopen

**Goal:** every field on the service form survives create → view → edit → save → reopen.
**Who:** someone with **Manage** under **Estimation**.
**Before you start:** nothing.

| #   | Do this                                                                                                                                                                                                                                                                                                                                 | You should see                                                                                                                                                                                                                                                                                                       | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Create a service filling **every** field: Service Name, Category, Description, Calculation Method **Rate per Unit**, Default Rate, Unit, Estimated Turnaround, Test Method / Standard, Sample Requirements, Required Accreditations (two, comma-separated), Deliverables (two, comma-separated), and the **Standard service** switch on | All accepted                                                                                                                                                                                                                                                                                                         | ☐     |
| 2   | Write every value down                                                                                                                                                                                                                                                                                                                  | —                                                                                                                                                                                                                                                                                                                    | ☐     |       |
| 3   | Save, then read the detail page                                                                                                                                                                                                                                                                                                         | **Service Details** (Service Code, Category, **Standard Service** reading _Yes_, Description), **Costing** (Calculation Method, Default Rate), **Procurement Details** (Unit, Estimated Turnaround as _"n days"_, Test Method / Standard, Sample Requirements, Required Accreditations, Deliverables) — all matching | ☐     |       |
| 4   | Click **Edit**                                                                                                                                                                                                                                                                                                                          | Page **Edit Service: {code}**                                                                                                                                                                                                                                                                                        | ☐     |       |
| 5   | Compare every field against your notes                                                                                                                                                                                                                                                                                                  | Every one pre-filled correctly, including both comma-separated lists and the switch                                                                                                                                                                                                                                  | ☐     |       |
| 6   | Without changing anything, click **Save Changes**                                                                                                                                                                                                                                                                                       | Toast **Service updated successfully**                                                                                                                                                                                                                                                                               | ☐     |       |
| 7   | Re-open **Edit** and check again                                                                                                                                                                                                                                                                                                        | Identical to step 5                                                                                                                                                                                                                                                                                                  | ☐     |       |
| 8   | Change the calculation method to **Percentage of Total Cost (Material + Fabrication)**, set a percentage, and save                                                                                                                                                                                                                      | The detail page's Costing card shows the new method and the rate with a `%`                                                                                                                                                                                                                                          | ☐     |       |
| 9   | Re-open **Edit**                                                                                                                                                                                                                                                                                                                        | The new method and rate are pre-selected                                                                                                                                                                                                                                                                             | ☐     |       |
| 10  | Turn the **Standard service** switch off and save                                                                                                                                                                                                                                                                                       | The detail page's **Standard Service** field reads _No_                                                                                                                                                                                                                                                              | ☐     |       |

---

## UAT-MAT-14 — Browse the services catalog and edit a service

**Goal:** rates can be found by category and kept up to date.
**Who:** anyone with **View** under **Estimation**; editing needs **Manage**.
**Before you start:** the services created in UAT-MAT-12, across at least three categories.

| #   | Do this                                                                                       | You should see                                                                                 | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On **Services**, click the **Testing & Certification** tile                                   | The catalog filtered to that category, headed with the category name and a count               | ☐     |       |
| 2   | Read the table headers                                                                        | Code, Name, Category, Calculation Method, Default Rate, Standard, Actions                      | ☐     |       |
| 3   | Read the **Default Rate** column                                                              | Percentage-based services show `15%`; amount-based services show `INR 50,000`; unset shows `-` | ☐     |       |
| 4   | Set the **Category** filter to **All Categories**                                             | The heading becomes **All Services** and every service appears                                 | ☐     |       |
| 5   | Search by service name, then by code                                                          | Both narrow the list                                                                           | ☐     |       |
| 6   | Search for a nonsense string                                                                  | **No services match your search**                                                              | ☐     |       |
| 7   | Click a row                                                                                   | The service detail page                                                                        | ☐     |       |
| 8   | Go back and use the row's **Edit** action                                                     | The edit page for that service                                                                 | ☐     |       |
| 9   | Change the rate and save                                                                      | Toast **Service updated successfully**, and the catalog list shows the new rate                | ☐     |       |
| 10  | Page through the catalog using the 10 / 25 / 50 page sizes                                    | Pagination works and the totals match                                                          | ☐     |       |
| 11  | Compare the tile counts on the **Services** landing page with the number of rows per category | They match                                                                                     | ☐     |       |

**Also check:**

- The tile names and the dropdown category names are worded differently — the tile says _Engineering_, the dropdown says _Engineering/Drawing Generation_; the tile says _Other Services_, the dropdown says _Other_. Confirm they filter to the same set.
- The **Applicability Rules** card on the detail page shows which BOM categories and item types a service applies to.

---

## UAT-MAT-15 — Delete (deactivate) a service and try to get it back

**Goal:** a retired rate stops appearing on new estimates.

> ⚠ **Partly a known issue.** The delete confirmation promises the service "can be restored later", but there is no restore button and no way to list inactive services. Once deleted, a service is unreachable through the app. Do not file feedback for that part.

**Who:** someone with **Manage** under **Estimation**.
**Before you start:** a spare service you do not need.

| #   | Do this                                                                         | You should see                                                                                                                       | Pass? | Notes |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open the spare service's detail page and **copy the page address** for later    | —                                                                                                                                    | ☐     |       |
| 2   | Click **Delete**                                                                | Dialog **Delete Service**: _"Are you sure you want to delete "{name}"? This will deactivate the service. It can be restored later."_ | ☐     |       |
| 3   | Click **Cancel**                                                                | Nothing changes                                                                                                                      | ☐     |       |
| 4   | Click **Delete** again and confirm                                              | Toast **Service deleted**, and you are returned to the Services landing page                                                         | ☐     |       |
| 5   | Look for the service in the catalog, including with **All Categories** selected | It is gone                                                                                                                           | ☐     |       |
| 6   | Look for a "show inactive" filter or toggle                                     | ⚠ There is none. Do not report this                                                                                                  | ☐     |       |
| 7   | Paste the address you copied in step 1                                          | The detail page opens with a red **Inactive** chip                                                                                   | ☐     |       |
| 8   | Look for a Restore button on that page                                          | ⚠ There is none, and the Edit page has no active/inactive control either. Do not report this                                         | ☐     |       |
| 9   | Check the category tile count on the **Services** landing page                  | It has dropped by one                                                                                                                | ☐     |       |
| 10  | Create a new service in the same category                                       | Its code is the **next** number — the deleted service's code is never reissued                                                       | ☐     |       |

---

## UAT-MAT-16 — Shape Database: read-only browse and a full calculation

**Goal:** confirm the built-in shape library is complete and usable, and that it is genuinely reference data.

> The Shape Database is a **built-in reference dataset shipped with the app**. It is not user data — there is no way to add, edit or delete a shape, and there should not be. Adding a new shape requires a change to the app itself. Everything below is read-only apart from the calculator's own inputs.

**Who:** anyone with **View** under **Estimation**.
**Before you start:** at least one material with a density and a current price.

| #   | Do this                                                                          | You should see                                                                                                                                                                                                                                                                                                                                | Pass? | Notes |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar **ENGINEERING DATA → Shape Database**                                    | The **Shape Calculator** page, subtitle _"Calculate dimensions, weights, material requirements, and costs for fabricated shapes"_                                                                                                                                                                                                             | ☐     |       |
| 2   | Read the four numbered steps in the left panel                                   | **1. Select Category**, **2. Select Shape**, **3. Select Material** — step 4 appears later                                                                                                                                                                                                                                                    | ☐     |       |
| 3   | Open **Shape Category**                                                          | Five categories, each with a description and a count: **Plates & Sheets** (3), **Tubes** (1), **Pressure Vessels** (7), **Heat Exchangers** (4), **Nozzles & Connections** (5)                                                                                                                                                                | ☐     |       |
| 4   | Choose **Pressure Vessels** and open **Shape**                                   | Seven shapes: Cylindrical Shell, Conical Shell, Hemispherical Head, Ellipsoidal Head (2:1), Torispherical Head (F&D), Flat Head, Conical Head                                                                                                                                                                                                 | ☐     |       |
| 5   | Type `head` into the shape box                                                   | The list filters to the head shapes — search works on the name, the description, the tags and the standard                                                                                                                                                                                                                                    | ☐     |       |
| 6   | Choose **Ellipsoidal Head (2:1)**                                                | The helper text shows its standard reference (e.g. an ASME Section VIII reference)                                                                                                                                                                                                                                                            | ☐     |       |
| 7   | Open **Material** and pick a priced material                                     | The helper line shows its density in kg/m³ and its price per kg                                                                                                                                                                                                                                                                               | ☐     |       |
| 8   | Read the **Summary** block in the left panel                                     | Shape, Material, Density, Quantity and Standard, all matching your choices                                                                                                                                                                                                                                                                    | ☐     |       |
| 9   | Fill in the dimensions in **4. Enter Dimensions**                                | Each has a label, a unit, an ⓘ information tooltip and a helper line giving its valid range                                                                                                                                                                                                                                                   | ☐     |       |
| 10  | Wait a moment after your last keystroke                                          | Results appear on their own — there is no Calculate button                                                                                                                                                                                                                                                                                    | ☐     |       |
| 11  | Read the four result cards                                                       | **Weight**, **Total Cost**, **Volume** (m³) and **Surface Area** (m²)                                                                                                                                                                                                                                                                         | ☐     |       |
| 12  | Read **Detailed Calculations**                                                   | Rows for Volume, Total / Inner / Outer Surface Area, Unit Weight, Total Weight, then a **Blank Material** block (blank area, scrap percentage), edge and weld length, then a **Cost Breakdown** block (Material Cost, Fabrication Cost with its edge preparation, cutting, welding and surface treatment sub-lines) and a bold **Total Cost** | ☐     |       |
| 13  | Change **Quantity** from 1 to 5                                                  | The weight and cost cards gain per-unit and total lines, and the total is five times the unit figure                                                                                                                                                                                                                                          | ☐     |       |
| 14  | Deliberately enter a dimension outside its stated range                          | A **Warnings:** or **Errors:** panel appears explaining what is wrong                                                                                                                                                                                                                                                                         | ☐     |       |
| 15  | Click **Reset**                                                                  | Every selection and input clears back to the starting state                                                                                                                                                                                                                                                                                   | ☐     |       |
| 16  | Work through **one shape from each of the five categories**                      | Every one produces a weight and a cost without an error                                                                                                                                                                                                                                                                                       | ☐     |       |
| 17  | Choose a **Standard Nozzle Assembly** and read its parameters                    | Dropdown parameters as well as numeric ones — nominal size, schedule, flange pressure rating and flange type                                                                                                                                                                                                                                  | ☐     |       |
| 18  | Click **Share**                                                                  | A toast **Link copied to clipboard**; pasting the link into a new tab reopens the same calculation                                                                                                                                                                                                                                            | ☐     |       |
| 19  | Click **Show Formula Tester**, choose the **Cylinder Volume** preset, and run it | A result appears, and the button changes to **Hide Formula Tester**                                                                                                                                                                                                                                                                           | ☐     |       |

**Also check:**

- The same shapes appear inside the BOM **Add Item** dialog's **Fabricated (Shape-Based)** tab (UAT-EST-03). Calculate a rectangular plate here and again in the BOM dialog with the same dimensions and material — the unit weight must match.
- **Save**, **Export PDF** and **Export Excel** on the calculator do nothing at all. Known issue; do not report it.

**Should NOT be possible:**

- Adding, editing, renaming or deleting a shape. There is no Add Shape, Edit Shape or Delete Shape control anywhere, and there should not be — the shape library ships with the app. If you find a way to change one, report it.
- Choosing a material whose category does not suit the shape — the material list is filtered to what the shape allows.

---

## UAT-MAT-17 — Catalog permission checks

**Goal:** reference data cannot be changed by someone who should only be reading it.
**Who:** you, plus a limited user with **no** Estimation permissions.
**Before you start:** materials, bought-out items and services all exist.

| #   | Do this                                                                                      | You should see                                                                                                                                              | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As the limited user**, open **Material Database**, **Bought Out Items** and **Services**   | The pages load but the lists are empty and the tile counts read zero — reference data needs **View** under **Estimation**                                   | ☐     |       |
| 2   | Try **Add New Material**, fill the form and save                                             | Refused with a clear error, not saved                                                                                                                       | ☐     |       |
| 3   | Try **New Item** on Bought Out Items and save                                                | Refused                                                                                                                                                     | ☐     |       |
| 4   | Try **Add New Service** and save                                                             | Refused                                                                                                                                                     | ☐     |       |
| 5   | Open **Shape Database**                                                                      | The calculator loads and the shapes are listed — the shape library ships with the app and needs no permission. The **Material** dropdown, however, is empty | ☐     |       |
| 6   | **As yourself**, grant **View** under **Estimation** only. Have them sign out and back in    | All three catalogs now populate, and the shape calculator's material list fills                                                                             | ☐     |       |
| 7   | **As the limited user**, try to edit a material, a bought-out item and a service             | All three saves are refused                                                                                                                                 | ☐     |       |
| 8   | **As yourself**, add **Manage** under **Estimation**. Have them sign in again                | They can now create and edit in all three catalogs                                                                                                          | ☐     |       |
| 9   | **As the limited user (with Manage but not Edit Entities)**, try to delete a bought-out item | Refused — deleting needs **Edit Entities** as well                                                                                                          | ☐     |       |

**Should NOT be possible:**

- Creating or editing a material, bought-out item or service without **Manage** under **Estimation**.
- Deleting a bought-out item without **Edit Entities**.
- Reading any catalog without **View** under **Estimation**.

---

## Known issues in this module

Scan this before you start. None of these should be filed as feedback — they are already recorded.

### Document control

1. **Auto-numbering can only be set up on an empty project.** The **Set Up Auto-Numbering** offer only appears while a project has zero documents. Once the first document exists — including one created by an import — there is no way in, and the project is stuck on manual numbering forever. Affects UAT-DOC-01.
2. **Transmittals cannot be marked Sent or Acknowledged.** Both statuses exist but neither has a button, so every transmittal stays at **GENERATED**. Affects UAT-DOC-14.
3. **A Comment Resolution Sheet cannot be marked complete.** There is no control to move a CRS off **Pending**, and no automatic comment extraction — comments from the sheet must be typed in by hand. Affects UAT-DOC-11 step 10.
4. **A transmittal's ZIP contains one file per document, not the native and PDF pair.** If a submission has both a DWG and a PDF, only one goes into the package. Affects UAT-DOC-12.
5. **The client name on every transmittal is the literal text "Client Name".** It is not taken from the project's customer. It appears on the cover sheet PDF and in the transmittal detail dialog. Affects UAT-DOC-12.
6. **The transmittal document filter has a dead option.** On the document-selection step, choosing **Client Review** always returns zero documents. Affects UAT-DOC-12.
7. **The grouped view's Submit shortcut goes nowhere useful.** Clicking the submit icon on a grouped row lands you on the document's Overview tab instead of the submission screen. Use the Revisions tab instead. Affects UAT-DOC-05.
8. **Status text is written three different ways.** The master document list shows `IN PROGRESS`, the document detail header shows `IN_PROGRESS` with an underscore, and the edit dropdown shows `In Progress`. They are the same status. Affects UAT-DOC-05 and UAT-DOC-08.
9. **The transmittals empty state names a button that does not exist.** It tells you to click _"Create Transmittal"_; the button is **Generate Transmittal**. Affects UAT-DOC-13.
10. **The CRS upload dialog's Notes box is not saved.** Anything typed there is discarded. Affects UAT-DOC-11.
11. **The client review status on a submission is display-only.** A submission always shows **Pending**; there is no control to record that the client approved it or approved it with comments. Affects UAT-DOC-06.

### Estimation

12. **A BOM cannot leave Draft.** Under Review, Approved, Released and Archived have no buttons anywhere. As a side effect the Draft-only delete rule can never be demonstrated. Affects UAT-EST-07 and UAT-EST-08.
13. **BOM items cannot be edited or removed.** Once added, an item is fixed. A mistake means rebuilding the BOM. Affects UAT-EST-09.
14. **Services cannot be attached to a BOM item.** There is no control to add one and no rate-override field, so the **Service** cost line is always ₹0.00 even though the services catalog is fully functional. Affects UAT-EST-05 and UAT-EST-09.
15. **The Summary panel lags behind Calculate Costs.** Clicking **Calculate Costs** updates each item card immediately, but the Summary totals only catch up a few seconds later and only after a page reload. The overhead, contingency and profit lines lag further — they refresh the next time an item is added. Affects UAT-EST-05.
16. **Bought-out lines are not priced from the bought-out catalog.** An item picked from the Bought Out Items database stays at **Not calculated** after Calculate Costs. The dialog's own helper text says so. Affects UAT-EST-04 and UAT-EST-05.
17. **BOM items sort as text, not as numbers.** Past ten items the cards appear in the order 1, 10, 11, 2, 3… Affects UAT-EST-03.
18. **Company Name on the quote PDF dialog is marked required but is not checked.** Clearing it still produces a PDF. Affects UAT-EST-06.
19. **There is no way to push BOM items into a purchase request.** BOMs carry only their proposal or enquiry link. Procurement is fed from the project charter's procurement items instead. Do not look for a "create PR from BOM" button — there isn't one.

### Catalogs

20. **Materials have no price screen.** There is no Add Price control, no effective-date field and no price history for a material. The only route to a price is accepting a vendor's quoted price in Procurement. (Bought-out items, by contrast, do have a Price History card.) Affects UAT-MAT-04.
21. **Materials have no stock screen.** Inventory tracking can be ticked on, but there is no way to record a receipt, an issue or an adjustment, and no stock history. Affects UAT-MAT-05.
22. **Materials cannot be deactivated or deleted.** Affects UAT-MAT-07.
23. **The Needs Review page's own instructions are wrong.** It says to clear the review flag on the detail page; there is no such button. Saving from the edit page is what clears it. Affects UAT-MAT-06.
24. **Pipes, Flanges and Fittings have no Add button.** Affects UAT-MAT-03.
25. **The bought-out spec code never resolves.** However completely you fill a valve, pump or instrument specification, the preview stays on _"Missing: type"_ (or _"Missing: variable, instrument type"_). The duplicate-detection warning that depends on it therefore never appears either. Affects UAT-MAT-09.
26. **Five bought-out categories have no specification fields.** Motors, Safety Devices, Local Gauges, Steam Traps and Accessories show only Manufacturer, Model and Additional Notes. Affects UAT-MAT-08.
27. **Deleting a bought-out item gives no confirmation message, and a failed delete gives no message at all.** Reload before concluding a delete failed. Affects UAT-MAT-11.
28. **A deleted service cannot be restored.** The confirmation promises it can be, but there is no restore button and no way to list inactive services. Affects UAT-MAT-15.
29. **Save, Export PDF and Export Excel on the shape calculator do nothing.** Clicking them produces no file and no message. **Share** does work. Affects UAT-MAT-16.
