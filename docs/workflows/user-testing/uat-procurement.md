# Procurement — Workflow Testing

> How to use this: [Testing guide](README.md) · Report problems at **Feedback** in the app, putting the test ID (e.g. `UAT-PROC-14`) at the start of the title.

## What this module does

Procurement runs the whole buying chain in one place: someone raises a purchase request, it gets approved, you float a request for quotation to several vendors, you record and compare their offers, you pick a winner and turn it into a purchase order, and the purchase order goes through two levels of approval before it is issued to the vendor. After that you track the shipment on a packing list, inspect and receive the goods, check the vendor's bill against the order and the receipt, and hand the bill and payment over to Accounting. Service purchase orders end with a work completion certificate instead of a goods receipt.

Everything you do here leaves a trail: each document gets its own number, approvers get a task in their inbox, and the linked project's charter updates itself as the order progresses.

## Before you start

**Permissions you need**

| Permission                 | What it lets you do here                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **View Procurement**       | Open the module, see lists and detail pages, create and edit purchase requests                                                                               |
| **Manage Procurement**     | Create and issue RFQs, record and select quotes, create/submit/approve/issue POs, amendments, packing lists, work completion certificates, three-way matches |
| **Inspect Goods**          | Create a goods receipt                                                                                                                                       |
| **Approve Goods Receipts** | Mark a goods receipt as complete and send it to Accounting                                                                                                   |
| **Manage Accounting**      | Create the vendor bill from a goods receipt and clear it for payment                                                                                         |
| **View Accounting**        | Open Accounting to confirm the bill and payment landed there                                                                                                 |

Permissions are set at **Administration → Admin → Users**. If you do not have one, the button you need will not be on screen, or the app will tell you that you are missing the permission.

**Test data you need first**

- At least **two active vendors** in Entities (so you have something to compare). Give each a GST state so tax calculates.
- At least **one active project** you can charge the purchase to. A project with items on its charter **Procurement** tab is better — you can then watch the charter update itself.
- At least **one bank account** in Accounting, for the payment step.

**Other users you need**

You cannot approve your own work anywhere in this module. Line up **three** people before you start:

| Person         | Needs                                    | Used in                                            |
| -------------- | ---------------------------------------- | -------------------------------------------------- |
| **You**        | View + Manage Procurement, Inspect Goods | Creating everything                                |
| **Approver A** | Manage Procurement                       | PR approval, PO first approval, amendment approval |
| **Approver B** | Manage Procurement                       | PO final approval                                  |
| **Accounts**   | Manage Accounting                        | Vendor bill and payment clearance                  |

Approver A and Approver B must be **different people**, and neither may be you.

**Where approval tasks appear:** the bell icon in the top bar (panel headed **Notifications**), and **Flow → Inbox**.

**Where to find everything:** left sidebar, group **PROCUREMENT & FINANCE** → **Procurement**. That landing page has a card for every sub-page: Purchase Requests, RFQs (Requests for Quotation), Quotes, Purchase Orders, PO Amendments, Packing Lists, Goods Receipts, Work Completion, Three-Way Match, Files, Data Health, Trash.

**Document numbers you should see** (this year / this month):

| Document                    | Format             | Example            |
| --------------------------- | ------------------ | ------------------ |
| Purchase Request            | `PR/YYYY/NNNN`     | `PR/2026/0001`     |
| RFQ                         | `RFQ/YYYY/NNN`     | `RFQ/2026/001`     |
| Vendor quote / offer        | `Q-YYYY-NNNN`      | `Q-2026-0001`      |
| Purchase Order              | `PO/YYYY/NNN`      | `PO/2026/001`      |
| Packing List                | `PL/YYYY/MM/NNNN`  | `PL/2026/07/0001`  |
| Goods Receipt               | `GR/YYYY/MM/NNNN`  | `GR/2026/07/0001`  |
| Work Completion Certificate | `WCC/YYYY/MM/NNNN` | `WCC/2026/07/0001` |
| Three-Way Match             | `TWM/YYYY/MM/NNNN` | `TWM/2026/07/0001` |

Read **Known issues in this module** at the bottom before you start — a few things are already on the fix list and should not be reported again.

---

## Test index

| ID          | Workflow                                                       | Needs a 2nd user?  | Est. time |
| ----------- | -------------------------------------------------------------- | ------------------ | --------- |
| UAT-PROC-01 | Raise a purchase request and submit it for approval            | No                 | 15 min    |
| UAT-PROC-02 | Purchase request round-trip — nothing lost on edit and save    | No                 | 15 min    |
| UAT-PROC-03 | Approve a purchase request                                     | Yes (Approver A)   | 10 min    |
| UAT-PROC-04 | Reject a purchase request, then revise and resubmit it         | Yes (Approver A)   | 15 min    |
| UAT-PROC-05 | Create an RFQ from approved PRs and mark it as sent            | No                 | 20 min    |
| UAT-PROC-06 | RFQ round-trip, and the edit lock after it is marked sent      | No                 | 15 min    |
| UAT-PROC-07 | Cancel an RFQ                                                  | No                 | 5 min     |
| UAT-PROC-08 | Upload a vendor offer against an RFQ                           | No                 | 20 min    |
| UAT-PROC-09 | Log a vendor quote with no RFQ — round-trip                    | No                 | 20 min    |
| UAT-PROC-10 | Move a quote through its own status buttons, including Archive | No                 | 10 min    |
| UAT-PROC-11 | Compare offers, evaluate, recommend and select the winner      | No                 | 20 min    |
| UAT-PROC-12 | Create a purchase order from the winning offer                 | No                 | 20 min    |
| UAT-PROC-13 | Purchase order round-trip — commercial terms survive edit      | No                 | 25 min    |
| UAT-PROC-14 | Submit a PO for approval and give first approval               | Yes (Approver A)   | 15 min    |
| UAT-PROC-15 | Give final approval and issue the PO to the vendor             | Yes (Approver B)   | 15 min    |
| UAT-PROC-16 | Return a PO with comments, reject it, and revise it            | Yes (Approver A)   | 20 min    |
| UAT-PROC-17 | Cancel a purchase order                                        | No                 | 5 min     |
| UAT-PROC-18 | Create a packing list against the PO                           | No                 | 20 min    |
| UAT-PROC-19 | Packing list round-trip                                        | No                 | 10 min    |
| UAT-PROC-20 | Move the packing list Finalized → Shipped → Delivered          | No                 | 10 min    |
| UAT-PROC-21 | Record a goods receipt                                         | No                 | 20 min    |
| UAT-PROC-22 | Record a goods receipt with rejected or damaged items          | No                 | 15 min    |
| UAT-PROC-23 | Goods receipt round-trip — inspection details                  | No                 | 10 min    |
| UAT-PROC-24 | Complete the goods receipt                                     | No                 | 15 min    |
| UAT-PROC-25 | Hand the goods receipt to Accounting and clear it for payment  | Yes (Accounts)     | 20 min    |
| UAT-PROC-26 | Run a three-way match                                          | No                 | 20 min    |
| UAT-PROC-27 | Approve or reject a three-way match, and resolve a discrepancy | Yes (Approver A)   | 20 min    |
| UAT-PROC-28 | Issue a work completion certificate                            | No                 | 15 min    |
| UAT-PROC-29 | Raise a PO amendment (round-trip) and submit it for approval   | Yes (Approver A)   | 25 min    |
| UAT-PROC-30 | Approve an amendment and confirm it is applied to the PO       | Yes (Approver A)   | 15 min    |
| UAT-PROC-31 | Reject an amendment and re-raise it                            | Yes (Approver A)   | 15 min    |
| UAT-PROC-32 | Mark the purchase order completed                              | No                 | 10 min    |
| UAT-PROC-33 | Permission checks — a view-only user cannot change anything    | Yes (any 2nd user) | 20 min    |
| UAT-PROC-34 | Cross-module check — everything reached Accounting             | Yes (Accounts)     | 15 min    |

---

## UAT-PROC-01 — Raise a purchase request and submit it for approval

**Goal:** A purchase request is created, saved as a draft, and sent to a named approver.
**Who:** Anyone with **View Procurement**.
**Before you start:**

- You know which project the purchase is for.
- Approver A exists and is not you.

| #   | Do this                                                                                            | You should see                                                                                                                                        | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Go to Procurement → Purchase Requests.                                                             | The list page **Purchase Requests**, with a **New Purchase Request** button top right.                                                                | ☐     |       |
| 2   | Click **New Purchase Request**.                                                                    | The **New Purchase Request** form.                                                                                                                    | ☐     |       |
| 3   | Set **Type** to _Project_, **Category** to _Raw Material_, **Priority** to _High_.                 | A project picker appears once Type is _Project_.                                                                                                      | ☐     |       |
| 4   | Pick your test project.                                                                            | The project name shows in the picker.                                                                                                                 | ☐     |       |
| 5   | Type a **Title** (e.g. "UAT test — pipe fittings") and set a **Required By Date** a few weeks out. | Both fields hold their values.                                                                                                                        | ☐     |       |
| 6   | Choose **Approver A** in the **Approver** field.                                                   | Your own name is **not** in the list to choose from.                                                                                                  | ☐     |       |
| 7   | Click **Add Item**, then fill Type, Description, Specification, Qty, Unit and Equipment Code.      | A line-item row appears; the chip next to **Line Items** counts up to "1 item".                                                                       | ☐     |       |
| 8   | Add a second line item.                                                                            | The chip reads "2 items".                                                                                                                             | ☐     |       |
| 9   | Click **Save Draft**.                                                                              | You land on the request's page. The number is in the form `PR/2026/0001`. The status chip reads **DRAFT**.                                            | ☐     |       |
| 10  | Click **Edit**, then click **Save & Submit**.                                                      | The status chip changes to **SUBMITTED**, and an **Approval Status** panel shows **Assigned Approver** = Approver A with a **Pending Approval** chip. | ☐     |       |
| 11  | Go back to Procurement → Purchase Requests.                                                        | Your request is in the list with status **SUBMITTED**.                                                                                                | ☐     |       |

**Also check:**

- The number follows `PR/2026/0001` — four digits, this year, and one higher than the last request raised this year.
- Ask Approver A to check the bell icon (**Notifications**) or **Flow → Inbox** — they should have a task telling them a purchase request is waiting for their approval, which opens the request when clicked.
- On the request page, every line item shows status **PENDING**.

**Should NOT be possible:**

- Submitting with no line items — the app must refuse and tell you items are required.
- Submitting without choosing an approver — the app must refuse.
- Naming **yourself** as approver — you are excluded from the approver list, and the app must refuse if you get around it.

---

## UAT-PROC-02 — Purchase request round-trip: nothing lost on edit and save

**Goal:** Everything typed into a purchase request is still there after saving, reopening, and saving again.
**Who:** Anyone with **View Procurement**.
**Before you start:** Nothing — this test creates its own request.

> This is the single most valuable test in this document. Work slowly and write down what you typed.

| #   | Do this                                                                                                                                     | You should see                                                                                                                                 | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Go to Procurement → Purchase Requests → **New Purchase Request**.                                                                           | The blank form.                                                                                                                                | ☐     |       |
| 2   | Fill in **every** field: Type, Category, Priority, Project, Title, Required By Date, Approver.                                              | All accept input.                                                                                                                              | ☐     |       |
| 3   | Add **three** line items. On each, fill Type, Description, Specification, Qty, Unit and Equipment Code — use different values on every row. | Three distinct rows.                                                                                                                           | ☐     |       |
| 4   | In **Attachments**, upload a file, set its **Type** and type a **Description**.                                                             | The attachment is listed with its type and description.                                                                                        | ☐     |       |
| 5   | Write down (or screenshot) every value you entered.                                                                                         | —                                                                                                                                              | ☐     |       |
| 6   | Click **Save Draft**.                                                                                                                       | The request page opens, status **DRAFT**.                                                                                                      | ☐     |       |
| 7   | Check the request page against your notes: title, project, priority, dates, all three line items, the attachment.                           | Every value matches. Dates show the date you picked, not today and not blank.                                                                  | ☐     |       |
| 8   | Click **Edit**.                                                                                                                             | The edit form opens **already filled in** with everything you entered — including the Approver, the Required By Date and all three line items. | ☐     |       |
| 9   | Change nothing. Click **Save Draft**.                                                                                                       | Back on the request page.                                                                                                                      | ☐     |       |
| 10  | Compare the page against your notes once more.                                                                                              | Nothing has changed, nothing has been blanked out, no date has shifted by a day.                                                               | ☐     |       |
| 11  | Click **Edit** again, change the Title and one line item's quantity, and click **Save Draft**.                                              | Only those two values changed; everything else is untouched.                                                                                   | ☐     |       |

**Also check:**

- The Required By Date is the same date in the list, on the detail page and inside the edit form — no off-by-one-day shift.
- The attachment is still downloadable after the second save.

---

## UAT-PROC-03 — Approve a purchase request

**Goal:** The named approver approves the request and the items are marked approved.
**Who:** **Approver A** (needs **Manage Procurement**).
**Before you start:** Requires the request from UAT-PROC-01, in status **SUBMITTED**, with Approver A named as approver.

| #   | Do this                                               | You should see                                                                                                 | Pass? | Notes |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As Approver A**, open the bell icon in the top bar. | A task about the submitted purchase request.                                                                   | ☐     |       |
| 2   | Click the task.                                       | The purchase request page opens.                                                                               | ☐     |       |
| 3   | Scroll to **Approval Status**.                        | An **Approval Actions** area with a **Comments (optional)** box and **Approve** / **Reject** buttons.          | ☐     |       |
| 4   | Type a comment and click **Approve**.                 | The status chip changes to **APPROVED**. An **Approved By** line shows Approver A, the date, and your comment. | ☐     |       |
| 5   | Scroll to **Line Items**.                             | Every line item's status is now **APPROVED**.                                                                  | ☐     |       |
| 6   | Open the bell icon again.                             | The approval task is gone / marked done.                                                                       | ☐     |       |
| 7   | **As the original submitter**, open the bell icon.    | A notification telling you the request was approved.                                                           | ☐     |       |
| 8   | Open the request as the submitter.                    | Status **APPROVED**; no **Edit** button (approved requests are locked).                                        | ☐     |       |

**Also check:**

- If the request is charged to a project with a budget, approval must respect it — an approval that would blow the project budget must be refused with a message naming the budget and the amount.

**Should NOT be possible:**

- The **submitter** approving their own request — the Approve/Reject buttons must not appear for them.
- A **different person** with Manage Procurement, who is not the named approver, approving it — the buttons must not appear for them either.

---

## UAT-PROC-04 — Reject a purchase request, then revise and resubmit it

**Goal:** A rejected request goes back to the requester, who can fix it and send it round again.
**Who:** You (requester) plus **Approver A**.
**Before you start:** Raise a fresh request as in UAT-PROC-01 and submit it to Approver A.

| #   | Do this                                                   | You should see                                                            | Pass? | Notes |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As Approver A**, open the request and click **Reject**. | A **Reject Purchase Request** dialog asking for a **Rejection Reason**.   | ☐     |       |
| 2   | Leave the reason blank and try to confirm.                | The app refuses — a reason is compulsory.                                 | ☐     |       |
| 3   | Type a reason and confirm.                                | Status chip changes to **REJECTED**, and the reason is shown on the page. | ☐     |       |
| 4   | Scroll to **Line Items**.                                 | Every line item is now **REJECTED**.                                      | ☐     |       |
| 5   | **As the requester**, open the bell icon.                 | A notification that the request was rejected, with the reason.            | ☐     |       |
| 6   | Open the request and click **Edit**.                      | The edit form opens — a rejected request is editable again.               | ☐     |       |
| 7   | Fix whatever was wrong and click **Save Draft**.          | Status returns to **DRAFT**.                                              | ☐     |       |
| 8   | Click **Edit** → **Save & Submit**.                       | Status is **SUBMITTED** again and Approver A gets a fresh task.           | ☐     |       |

**Should NOT be possible:**

- The requester rejecting their own request.
- Editing a request that is **APPROVED** or **CONVERTED TO RFQ** — the **Edit** button must not be there.

---

## UAT-PROC-05 — Create an RFQ from approved purchase requests and mark it as sent

**Goal:** Approved requests are bundled into one request for quotation, sent to several vendors, and the source requests are closed off.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires the approved request from UAT-PROC-03. At least two active vendors exist.

> Marking an RFQ as sent locks most of it. Get the details right first.

| #   | Do this                                                                                                                                                                             | You should see                                                                                                 | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Go to Procurement → RFQs (Requests for Quotation).                                                                                                                                  | The list page with a **Create RFQ** button.                                                                    | ☐     |       |
| 2   | Click **Create RFQ**.                                                                                                                                                               | A four-step wizard: **Select Purchase Requests**, **Select Vendors**, **RFQ Details**, **Review & Create**.    | ☐     |       |
| 3   | On step 1, tick your approved request.                                                                                                                                              | Only **approved** requests are listed — drafts, submitted and rejected ones are not offered.                   | ☐     |       |
| 4   | Click **Next**, then tick two vendors on step 2.                                                                                                                                    | Both vendors show as selected, with contact details.                                                           | ☐     |       |
| 5   | Click **Next**. On step 3 fill **RFQ Title**, **Description**, **Remarks**, **Due Date**, **Validity Period (days)**, **Payment Terms**, **Delivery Terms** and **Warranty Terms**. | All fields accept input.                                                                                       | ☐     |       |
| 6   | Click **Next** and review, then click **Create RFQ**.                                                                                                                               | The RFQ page opens. The number is in the form `RFQ/2026/001`. Status chip reads **Draft**.                     | ☐     |       |
| 7   | Check the **RFQ Details** panel.                                                                                                                                                    | The line items came across from the purchase request, and **Vendors Invited** lists both vendors with a count. | ☐     |       |
| 8   | Open the original purchase request.                                                                                                                                                 | Its status is now **CONVERTED TO RFQ**, and a **View RFQ (RFQ/2026/001)** button links to your new RFQ.        | ☐     |       |
| 9   | Back on the RFQ, click **Generate PDF**, then **Download Latest PDF**.                                                                                                              | A PDF of the RFQ you can send to vendors yourself.                                                             | ☐     |       |
| 10  | Click **Mark as Sent**.                                                                                                                                                             | A **Mark RFQ as Sent** dialog explaining the app does **not** email vendors — you send it yourself.            | ☐     |       |
| 11  | Confirm with **Mark as Sent**.                                                                                                                                                      | Status changes to **Issued**. The **Edit** button disappears; an **Upload Offer** button appears.              | ☐     |       |
| 12  | Wait a few seconds, then open your project → charter → **Procurement** tab and refresh.                                                                                             | The matching charter row now reads **RFQ ISSUED**, with an "RFQ" link chip.                                    | ☐     |       |

**Also check:**

- The RFQ number runs `RFQ/2026/001`, `RFQ/2026/002`, … — three digits, no gaps, one sequence per year.
- The dialog text is correct: nothing is emailed. You send the PDF to vendors yourself. See **Known issues**.

**Should NOT be possible:**

- Selecting a purchase request that is not approved.
- Creating an RFQ with no vendors selected.
- Editing an RFQ that has already been marked as sent.

---

## UAT-PROC-06 — RFQ round-trip, and the edit lock after it is marked sent

**Goal:** RFQ details survive an edit and save, and become read-only once the RFQ is sent.
**Who:** You, with **Manage Procurement**.
**Before you start:** Create a second RFQ as in UAT-PROC-05 but **stop before** marking it as sent — leave it in **Draft**.

| #   | Do this                                                                                                                                           | You should see                                                                           | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the draft RFQ and note every value: title, description, due date, validity period, payment / delivery / warranty terms, vendors, line items. | —                                                                                        | ☐     |       |
| 2   | Click **Edit**.                                                                                                                                   | The edit page opens **pre-filled** with all of the above — nothing blank, nothing reset. | ☐     |       |
| 3   | Change nothing and click **Save Changes**.                                                                                                        | Back on the RFQ page.                                                                    | ☐     |       |
| 4   | Compare against your notes.                                                                                                                       | Every value is unchanged — the due date has not shifted, the terms are not blank.        | ☐     |       |
| 5   | Click **Edit**, change the title and the due date, and click **Save Changes**.                                                                    | Only those two changed.                                                                  | ☐     |       |
| 6   | Click **Mark as Sent** and confirm.                                                                                                               | Status **Issued**.                                                                       | ☐     |       |
| 7   | Look for the **Edit** button.                                                                                                                     | It is gone.                                                                              | ☐     |       |

**Should NOT be possible:**

- Editing an RFQ once it is **Issued**, **Offers Received**, **Under Evaluation**, **Completed**, **PO Processed** or **Cancelled**.

---

## UAT-PROC-07 — Cancel an RFQ

**Goal:** An RFQ that is no longer wanted can be cancelled with a reason, and cannot be revived.
**Who:** You, with **Manage Procurement**.
**Before you start:** Create a throwaway RFQ (UAT-PROC-05, steps 1–6). Cancelling is **permanent** — do not use an RFQ you still need.

| #   | Do this                                                      | You should see                                                        | Pass? | Notes |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the throwaway RFQ and click **Cancel**.                 | A **Cancel RFQ** dialog asking for a reason.                          | ☐     |       |
| 2   | Leave the reason blank.                                      | The **Cancel RFQ** confirm button stays disabled.                     | ☐     |       |
| 3   | Type a reason and click **Cancel RFQ**.                      | The status chip reads **Cancelled**.                                  | ☐     |       |
| 4   | Look at the action buttons.                                  | No **Edit**, no **Mark as Sent**, no **Upload Offer**, no **Cancel**. | ☐     |       |
| 5   | Go to Procurement → RFQs and filter by status **Cancelled**. | The cancelled RFQ is listed.                                          | ☐     |       |

**Also check:**

- An RFQ can be cancelled from **Draft**, **Issued**, **Offers Received** and **Under Evaluation**.

**Should NOT be possible:**

- Cancelling an RFQ that is already **Completed**, **PO Processed** or **Cancelled** — the **Cancel** button must not appear.

---

## UAT-PROC-08 — Upload a vendor offer against an RFQ

**Goal:** A vendor's quotation document is uploaded, read automatically, checked against the RFQ lines, and saved as an offer.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires the RFQ from UAT-PROC-05, in status **Issued**. Have two vendor quotation files ready (PDF or Word) — one per invited vendor. They can be simple; they just need a vendor name, some line items and prices.

| #   | Do this                                                                                 | You should see                                                                                                                                                                                                                                          | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the RFQ and click **Upload Offer**.                                                | The **Upload Vendor Offer** dialog.                                                                                                                                                                                                                     | ☐     |       |
| 2   | Choose the first invited vendor under **Select Vendor**.                                | The vendor is set.                                                                                                                                                                                                                                      | ☐     |       |
| 3   | Drop or choose the vendor's quotation file.                                             | The file uploads, then the dialog says it is analysing the document. This can take up to a minute.                                                                                                                                                      | ☐     |       |
| 4   | Wait for the analysis to finish.                                                        | An **AI Parse Results** panel showing how many items were found, how many matched to the RFQ, and how many did not.                                                                                                                                     | ☐     |       |
| 5   | Check the **Offer Details** section.                                                    | Vendor Offer Number, Vendor Offer Date, Validity Date, Payment / Delivery / Warranty Terms, Price Basis, Transportation, Packing & Forwarding, Insurance, Erection & Commissioning, Inspection and Discount, filled in from the document where present. | ☐     |       |
| 6   | Correct any field the reader got wrong, and fill any it left blank.                     | Your corrections stick.                                                                                                                                                                                                                                 | ☐     |       |
| 7   | Check the line-item table: Description, Qty, Unit, Unit Price, Discount, Amount, Match. | Prices match the document; the **Match** column shows a confidence percentage against the RFQ line.                                                                                                                                                     | ☐     |       |
| 8   | Fix any unmatched or mispriced line.                                                    | The totals at the bottom recalculate as you type.                                                                                                                                                                                                       | ☐     |       |
| 9   | Click **Create Offer**.                                                                 | The dialog closes. The RFQ status changes to **Offers Received** and a **Compare Offers (1)** button appears.                                                                                                                                           | ☐     |       |
| 10  | Repeat steps 1–9 for the second vendor.                                                 | **Compare Offers (2)**. The RFQ status stays **Offers Received** or moves on as offers are evaluated.                                                                                                                                                   | ☐     |       |
| 11  | Go to Procurement → Quotes.                                                             | Both offers are listed with numbers in the form `Q-2026-0001`, status **Uploaded**, and the RFQ they belong to.                                                                                                                                         | ☐     |       |

**Also check:**

- After the **first** offer, the person who created the RFQ gets a notification that an offer has arrived.
- Once offers have been received from **every** invited vendor, that person gets a second, actionable task saying the RFQ is ready for evaluation.
- If a line has no price, the dialog warns you it will be recorded as "not quoted" — creating the offer is still allowed.

**Should NOT be possible:**

- Uploading an offer against an RFQ that is still **Draft** — the **Upload Offer** button is only there once it is marked as sent.
- Creating the offer before choosing a vendor.

---

## UAT-PROC-09 — Log a vendor quote with no RFQ (round-trip)

**Goal:** A quote received by phone, email or WhatsApp is captured with every field, and nothing is lost when it is reopened.
**Who:** You, with **Manage Procurement**.
**Before you start:** Nothing — this test is self-contained.

| #   | Do this                                                                                                                           | You should see                                                                                    | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Go to Procurement → Quotes.                                                                                                       | The **Quotes** list, with **Log Quote** and **Add Standing Quote** buttons.                       | ☐     |       |
| 2   | Click **Log Quote**.                                                                                                              | The **Log Vendor Quote** form.                                                                    | ☐     |       |
| 3   | Leave **Select from existing vendors** switched on and pick a vendor.                                                             | The vendor is set.                                                                                | ☐     |       |
| 4   | Fill **Vendor's Quote No.**, **Quote Date**, **Valid Until**, **Currency** and **Remarks**.                                       | All accept input.                                                                                 | ☐     |       |
| 5   | Tick **Unsolicited — vendor sent this without us asking**.                                                                        | The tick holds. Leave **Link to RFQ** empty.                                                      | ☐     |       |
| 6   | Add three line items covering different **Type** values (Material, Bought Out, Service) with descriptions, quantities and prices. | Totals and the **Grand Total (incl. GST)** update as you type.                                    | ☐     |       |
| 7   | Attach a document.                                                                                                                | The attachment is listed.                                                                         | ☐     |       |
| 8   | Write down every value you entered.                                                                                               | —                                                                                                 | ☐     |       |
| 9   | Click **Save as Draft**.                                                                                                          | You land on the quote page. Number is `Q-2026-nnnn`, status chip **DRAFT**.                       | ☐     |       |
| 10  | Compare the quote page with your notes.                                                                                           | Vendor, offer date, validity, currency, total, remarks, all three lines and the attachment match. | ☐     |       |
| 11  | Click **Edit Details**.                                                                                                           | The dialog opens **pre-filled** with what you entered — no blank fields.                          | ☐     |       |
| 12  | Change nothing and save.                                                                                                          | Nothing on the page has changed.                                                                  | ☐     |       |
| 13  | Now go to Procurement → Quotes → **Add Standing Quote**, fill it in and click **Create Offer**.                                   | A second quote is created and appears in the list.                                                | ☐     |       |
| 14  | Repeat steps 2–9 but click **Create Quote** instead of **Save as Draft**.                                                         | The quote is created with status **UPLOADED** rather than **DRAFT**.                              | ☐     |       |

**Also check:**

- Quote numbers run `Q-2026-0001`, `Q-2026-0002`, … in order.
- If you start filling the form and navigate away, coming back offers to restore your unsaved quote — and **Discard** clears it.
- The Quotes list filters by **Source** and by **Status** and both work.

---

## UAT-PROC-10 — Move a quote through its own status buttons, including Archive

**Goal:** A quote's own status buttons work, and terminal statuses stop offering actions.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires a quote in status **DRAFT** or **UPLOADED** — use one from UAT-PROC-09. Do **not** use a quote you still need for the offer comparison, since **Archive** is final.

| #   | Do this                                         | You should see                                                               | Pass? | Notes |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the quote from Procurement → Quotes.       | Status chip, and a row of status buttons under the details.                  | ☐     |       |
| 2   | If it is **DRAFT**, click **Mark as Uploaded**. | Status changes to **UPLOADED**.                                              | ☐     |       |
| 3   | Click **Mark Under Review**.                    | Status changes to **UNDER_REVIEW**.                                          | ☐     |       |
| 4   | Click **Mark as Evaluated**.                    | Status changes to **EVALUATED**.                                             | ☐     |       |
| 5   | Click **Archive**.                              | Status changes to **ARCHIVED**.                                              | ☐     |       |
| 6   | Look at the buttons.                            | They are replaced by the message "Terminal status — no further transitions." | ☐     |       |
| 7   | Look for **Edit Details**.                      | It is gone.                                                                  | ☐     |       |

**Also check:**

- Only the statuses that are legal from where you are appear as buttons. You never see a button that takes a quote backwards.

**Should NOT be possible:**

- Editing or changing the status of an archived quote.
- Withdrawing a quote from this page — see **Known issues**: there is no Withdraw button anywhere in the app.

---

## UAT-PROC-11 — Compare offers, evaluate, recommend and select the winner

**Goal:** Offers are scored side by side, one is recommended, and one is selected — which rejects the others and closes the RFQ.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires the RFQ from UAT-PROC-05 with **two** offers uploaded (UAT-PROC-08).

> Selecting a winner rejects every other offer and moves the RFQ to **Completed**. It cannot be undone.

| #   | Do this                                                                                      | You should see                                                                                                                                                                                          | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the RFQ and click **Compare Offers (2)**.                                               | A comparison page with a card per vendor, a **Term** table, and a per-line matrix.                                                                                                                      | ☐     |       |
| 2   | Read the comparison table.                                                                   | For each RFQ line: Vendor, Unit Price, Total Price, Delivery, Spec Compliance, Price Score. The cheapest is flagged **Lowest**.                                                                         | ☐     |       |
| 3   | Check the spec compliance chips.                                                             | Offers that meet the spec show **✓ Meets**; others show **⚠ Deviations**.                                                                                                                               | ☐     |       |
| 4   | Click **Evaluate** on the first offer.                                                       | The **Evaluate Offer** dialog with a star rating, an **Evaluation Score (0-100)** box, **Evaluation Notes** and **Red Flags (comma-separated)**.                                                        | ☐     |       |
| 5   | Set a score, type notes and a red flag, then click **Save Evaluation**.                      | The dialog closes and the offer shows as evaluated.                                                                                                                                                     | ☐     |       |
| 6   | Evaluate the second offer too.                                                               | Both are evaluated. The RFQ status moves to **Under Evaluation** once all offers are done.                                                                                                              | ☐     |       |
| 7   | Click **Recommend** on the offer you prefer.                                                 | That offer's button now reads **Recommended** and a **Recommended** chip appears on its card.                                                                                                           | ☐     |       |
| 8   | Click **Recommend** on the other offer.                                                      | The recommendation moves — only **one** offer is ever marked recommended.                                                                                                                               | ☐     |       |
| 9   | Click **Select** on the offer you want to buy from.                                          | A **Select Offer** dialog naming the offer, the vendor and the amount, warning it will reject the others and complete the RFQ.                                                                          | ☐     |       |
| 10  | If it is **not** the cheapest, read the warning and fill **Selection note / justification**. | An amber warning names the lowest price and asks you to record why you are not taking it.                                                                                                               | ☐     |       |
| 11  | Click **Select**.                                                                            | A banner says an offer has been selected and to create a Purchase Order. The winning offer's row now offers **Create PO**; the losing offer no longer offers **Select**, **Evaluate** or **Recommend**. | ☐     |       |
| 12  | Go back to the RFQ page.                                                                     | Status chip reads **Completed**, and a **Create PO** button is on the page.                                                                                                                             | ☐     |       |
| 13  | Go to Procurement → Quotes.                                                                  | The winner is **SELECTED**; the loser is **REJECTED**.                                                                                                                                                  | ☐     |       |

**Also check:**

- The justification you typed is saved against the RFQ for the audit trail — reopen the RFQ and confirm it is visible.
- Evaluating a quote from a registered vendor records its prices against the material records — check a material you priced and confirm the budgetary price is there.

**Should NOT be possible:**

- Selecting a second offer after one has been selected — the **Select** button must be gone.
- Evaluating or recommending offers on a **Completed** RFQ.

---

## UAT-PROC-12 — Create a purchase order from the winning offer

**Goal:** The selected offer becomes a draft purchase order with correct totals, tax and commercial terms.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires the selected offer from UAT-PROC-11.

| #   | Do this                                                                                                                                                                                                                                             | You should see                                                                                                                                                                                            | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On the RFQ page (or the comparison page), click **Create PO**.                                                                                                                                                                                      | The **Create Purchase Order** page, with a **Selected Offer** panel showing the vendor, our offer number, the vendor's offer number and the total.                                                        | ☐     |       |
| 2   | Read the info panel of terms quoted by the vendor.                                                                                                                                                                                                  | Price basis, payment, delivery, warranty, P&F, transportation, insurance, erection & commissioning, inspection and discount as quoted.                                                                    | ☐     |       |
| 3   | Check the **Title** — it is seeded from the RFQ. Change it to something meaningful.                                                                                                                                                                 | The title accepts your edit.                                                                                                                                                                              | ☐     |       |
| 4   | Pick a **Commercial Terms Template**.                                                                                                                                                                                                               | The terms form below fills in from the template.                                                                                                                                                          | ☐     |       |
| 5   | Work through the **Purchase Order Terms** sections, opening each one: Pricing & Payment, Delivery Terms, Scope of Work, Addresses, Quality & Inspection, Penalties & Standard Clauses, Warranty, Buyer Contact, Service Terms, Safety & Compliance. | Each opens and accepts input.                                                                                                                                                                             | ☐     |       |
| 6   | In **Pricing & Payment**, build a payment schedule that includes an **advance** stage. Deliberately leave the percentages adding up to less than 100 first.                                                                                         | The **Pricing & Payment** heading carries a red **Incomplete** chip until the schedule adds up correctly, then it disappears.                                                                             | ☐     |       |
| 7   | Set an **Expected Delivery Date**.                                                                                                                                                                                                                  | The date is accepted.                                                                                                                                                                                     | ☐     |       |
| 8   | Click **Create Purchase Order**.                                                                                                                                                                                                                    | The PO page opens. The number is in the form `PO/2026/001` and the status chip reads **Draft**.                                                                                                           | ☐     |       |
| 9   | Check the **Financial Summary** panel.                                                                                                                                                                                                              | Subtotal, any Discount, any Packing & Forwarding, then either **CGST + SGST** (same-state vendor) or **IGST** (other state), then **Grand Total**. Plus an **Advance Payment (n%)** line with its amount. | ☐     |       |
| 10  | Add up Subtotal − Discount + P&F + tax by hand.                                                                                                                                                                                                     | It equals the Grand Total to the paisa.                                                                                                                                                                   | ☐     |       |
| 11  | Check the line items table.                                                                                                                                                                                                                         | Every line from the winning offer is there with the same quantities and prices.                                                                                                                           | ☐     |       |
| 12  | Go to Procurement → Quotes and open the winning quote.                                                                                                                                                                                              | Its status is now **PO_CREATED**.                                                                                                                                                                         | ☐     |       |
| 13  | Open the RFQ.                                                                                                                                                                                                                                       | Its status is now **PO Processed**.                                                                                                                                                                       | ☐     |       |

**Also check:**

- PO numbers run `PO/2026/001`, `PO/2026/002`, … — three digits, one sequence per year.
- The PO records where it came from: the **Vendor**, the **Offer Reference** (our offer number and the vendor's), the **Title**, the **Expected Delivery** date and the **Delivery Address** are all shown on the PO page, and they match the winning offer and the RFQ.
- Click **Download PDF** — the PDF carries the same numbers, terms and totals as the screen.

**Should NOT be possible:**

- Creating a **second** purchase order from the same offer — go back and try; the app must refuse because a PO already exists for it.
- Creating a purchase order from an offer whose vendor is not a registered vendor.

---

## UAT-PROC-13 — Purchase order round-trip: commercial terms survive edit and save

**Goal:** The very long commercial terms form does not lose anything between save and reopen.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires the PO from UAT-PROC-12, in status **Draft**.

> A purchase order can only be edited while it is **Draft**. Do this before you submit it.

| #   | Do this                                                                                                                                         | You should see                                                                                                              | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the PO and note every value on screen: title, all commercial terms sections, expected delivery date, financial summary.                    | —                                                                                                                           | ☐     |       |
| 2   | Click **Edit**.                                                                                                                                 | The **Edit PO/2026/001** page opens **pre-filled** — every terms section carries the values you set, not template defaults. | ☐     |       |
| 3   | Open each terms section in turn and check it against your notes.                                                                                | Nothing is blank, nothing has reverted to a default, no tick-box has flipped.                                               | ☐     |       |
| 4   | Change nothing. Click **Save Changes**.                                                                                                         | Back on the PO page.                                                                                                        | ☐     |       |
| 5   | Compare the PO page with your notes.                                                                                                            | Every value is unchanged. The Grand Total is unchanged to the paisa.                                                        | ☐     |       |
| 6   | Click **Edit** again. Change the **PO Description**, one line item's **Specification** and its **HSN/SAC**, and the **Expected Delivery Date**. | All three accept edits.                                                                                                     | ☐     |       |
| 7   | Add an attachment in the **Attachments** section.                                                                                               | The file uploads and is listed.                                                                                             | ☐     |       |
| 8   | Click **Save Changes**.                                                                                                                         | The PO page shows exactly those changes and nothing else.                                                                   | ☐     |       |
| 9   | Click **Edit** once more.                                                                                                                       | Your new description, specification, HSN/SAC and delivery date are all there, and the attachment is listed.                 | ☐     |       |
| 10  | Click **Download PDF**.                                                                                                                         | The PDF reflects the edited values.                                                                                         | ☐     |       |

**Also check:**

- Changing the payment schedule's advance percentage changes the **Advance Payment (n%)** line in the Financial Summary and its amount.
- Untick **Inspection applicable** and save — the inspection block disappears from the downloaded PDF.

---

## UAT-PROC-14 — Submit a PO for approval and give first approval

**Goal:** A purchase order goes to two named approvers in order, and the first one signs off.
**Who:** You (creator), then **Approver A**.
**Before you start:** Requires the PO from UAT-PROC-12/13, in status **Draft**. Approver A and Approver B both exist and neither is you.

> Once submitted, the PO cannot be edited.

| #   | Do this                                                      | You should see                                                                                                                                           | Pass? | Notes |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the PO and click **Submit for Approval**.               | The **Submit for Approval** dialog, warning you will not be able to edit afterwards, with a **First approver** and a **Second (final) approver** picker. | ☐     |       |
| 2   | Open the **First approver** list.                            | Your own name is not offered.                                                                                                                            | ☐     |       |
| 3   | Choose Approver A as first approver.                         | Approver A is now excluded from the **Second (final) approver** list.                                                                                    | ☐     |       |
| 4   | Choose Approver B as second approver, then click **Submit**. | The status chip changes to **Pending First Approval**. The **Edit** button is gone.                                                                      | ☐     |       |
| 5   | Check the approval panel on the PO.                          | Both approvers are named, in order.                                                                                                                      | ☐     |       |
| 6   | **As Approver A**, open the bell icon.                       | A task saying the purchase order needs your approval.                                                                                                    | ☐     |       |
| 7   | Click the task.                                              | The PO page opens with **Approve**, **Return with Comments** and **Reject** buttons.                                                                     | ☐     |       |
| 8   | Click **Approve**.                                           | A dialog headed **First Approval**, saying it then goes to the second approver, with a **Comments (Optional)** box.                                      | ☐     |       |
| 9   | Type a comment and click **Approve**.                        | The status chip changes to **Pending Final Approval**. Your name and comment are recorded in the approval panel.                                         | ☐     |       |
| 10  | **As Approver B**, open the bell icon.                       | A task saying the purchase order needs your final approval.                                                                                              | ☐     |       |

**Should NOT be possible:**

- Choosing the **same person** as both approvers — each is excluded from the other's list, and **Submit** stays disabled until both are chosen and different.
- The **creator** approving their own purchase order.
- **Approver B** giving first approval before Approver A has approved — trying it must be refused.
- Anyone else with Manage Procurement, who is not one of the two named approvers, giving the approval.
- Editing the PO while it is **Pending First Approval**.

---

## UAT-PROC-15 — Give final approval and issue the PO to the vendor

**Goal:** The second approver signs off and the order is issued, which is what makes goods receipts possible.
**Who:** **Approver B**, then you.
**Before you start:** Requires the PO from UAT-PROC-14, in status **Pending Final Approval**.

> Issuing is the point of no return for the vendor — check the PDF before you click.

| #   | Do this                                                                                | You should see                                                                                                                                                             | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As Approver B**, open the PO from your inbox task.                                   | **Approve**, **Return with Comments** and **Reject** buttons.                                                                                                              | ☐     |       |
| 2   | Click **Approve**.                                                                     | A dialog headed **Final Approval**.                                                                                                                                        | ☐     |       |
| 3   | Add a comment and click **Approve**.                                                   | Status chip changes to **Approved**. An information banner says the PO is approved but not yet issued, and that goods receipts become available after **Issue to Vendor**. | ☐     |       |
| 4   | Check the approval panel.                                                              | Both approvals are listed with names, dates and comments.                                                                                                                  | ☐     |       |
| 5   | If the PO carries an advance, check the chip next to the status.                       | An **Advance Requested** or **Advance Pending** chip.                                                                                                                      | ☐     |       |
| 6   | **As the creator**, open the PO and click **Download PDF**.                            | The PDF is correct and ready to send.                                                                                                                                      | ☐     |       |
| 7   | Click **Issue to Vendor**.                                                             | An **Issue Purchase Order** dialog confirming you want to issue it to the vendor.                                                                                          | ☐     |       |
| 8   | Click **Issue**.                                                                       | Status chip changes to **Issued**. **Create Packing List** and **Receive Goods** buttons appear.                                                                           | ☐     |       |
| 9   | Wait a few seconds, then open the project → charter → **Procurement** tab and refresh. | The matching charter row now reads **PO PLACED**, with a "PO" link chip.                                                                                                   | ☐     |       |
| 10  | If the PO carries an advance, go to Accounting → Payments.                             | An advance payment for this vendor and PO exists. The chip on the PO reads **Advance Requested**.                                                                          | ☐     |       |

**Also check:**

- The charter row never goes backwards — once it says **PO PLACED** it does not revert to **RFQ ISSUED**.
- If the advance payment does **not** appear in Accounting, you should have received a high-priority task telling you to create it manually. Report that with the error text it quotes.

**Should NOT be possible:**

- **Approver A** (the first approver) also giving the final approval.
- The **creator** giving the final approval.
- Issuing a purchase order that is not **Approved** — the **Issue to Vendor** button only exists in that status.
- Editing the PO once it is **Approved** or **Issued**.

---

## UAT-PROC-16 — Return a PO with comments, reject it, and revise it

**Goal:** An approver can send a purchase order back for changes, or reject it outright, and the creator can revive it.
**Who:** You (creator) and **Approver A**.
**Before you start:** Create a second purchase order (repeat UAT-PROC-08 → 12 with the second vendor, or use any draft PO) and submit it to Approver A and Approver B.

**Part 1 — Return with Comments**

| #   | Do this                                                            | You should see                                                                                                     | Pass? | Notes |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | **As Approver A**, open the PO and click **Return with Comments**. | A dialog explaining it goes back to the submitter, returns to Draft, and must go through **both** approvers again. | ☐     |       |
| 2   | Leave the comments box empty.                                      | The confirm button stays disabled — comments are compulsory.                                                       | ☐     |       |
| 3   | Type comments and click **Return with Comments**.                  | The status chip changes back to **Draft**.                                                                         | ☐     |       |
| 4   | **As the creator**, open the PO.                                   | A banner reads "Returned by _Approver A_: _your comments_". The **Edit** button is back.                           | ☐     |       |
| 5   | Edit something, save, then **Submit for Approval** again.          | You must pick two approvers again from scratch. Status returns to **Pending First Approval**.                      | ☐     |       |

**Part 2 — Reject and Revise**

| #   | Do this                                              | You should see                                                        | Pass? | Notes |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------- | ----- | ----- |
| 6   | **As Approver A**, open the PO and click **Reject**. | A **Reject Purchase Order** dialog asking for a **Rejection Reason**. | ☐     |       |
| 7   | Leave the reason blank.                              | The **Reject** confirm button stays disabled.                         | ☐     |       |
| 8   | Type a reason and click **Reject**.                  | The status chip changes to **Rejected**.                              | ☐     |       |
| 9   | **As the creator**, open the PO.                     | A **Revise** button is on the page.                                   | ☐     |       |
| 10  | Click **Revise**.                                    | The status chip returns to **Draft** and the PO is editable again.    | ☐     |       |

**Also check:**

- Rejection is also available to the **second** approver while the PO is **Pending Final Approval**.
- A rejected PO shows who rejected it and why.

**Should NOT be possible:**

- The **creator** rejecting or returning their own purchase order.
- Revising a purchase order that is **Cancelled** or **Completed**.

---

## UAT-PROC-17 — Cancel a purchase order

**Goal:** An unwanted purchase order can be cancelled with a reason, and is then dead.
**Who:** You, with **Manage Procurement**.
**Before you start:** Use a throwaway purchase order. **Cancelling is permanent.**

| #   | Do this                                                                 | You should see                                                                                                      | Pass? | Notes |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the throwaway PO and click **Cancel**.                             | A **Cancel Purchase Order** dialog asking for a **Cancellation Reason**.                                            | ☐     |       |
| 2   | Leave the reason blank.                                                 | The **Cancel PO** confirm button stays disabled.                                                                    | ☐     |       |
| 3   | Type a reason and click **Cancel PO**.                                  | The status chip reads **Cancelled**.                                                                                | ☐     |       |
| 4   | Look at the action buttons.                                             | No **Edit**, **Submit for Approval**, **Issue to Vendor**, **Receive Goods** or **Cancel** — only download options. | ☐     |       |
| 5   | Wait a few seconds, then check the project charter **Procurement** tab. | The matching row reads **CANCELLED**.                                                                               | ☐     |       |

**Also check:**

- Cancelling works from **Draft**, **Pending First Approval**, **Pending Final Approval**, **Approved** and **Issued**.

**Should NOT be possible:**

- Cancelling a purchase order that is already **Delivered**, **Completed** or **Cancelled**.

---

## UAT-PROC-18 — Create a packing list against the PO

**Goal:** A shipment is recorded before the goods arrive, and the app stops you packing more than was ordered.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires the PO from UAT-PROC-15, in status **Issued**.

| #   | Do this                                                                                                                                                                    | You should see                                                                                                | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the PO and click **Create Packing List** (or go to Procurement → Packing Lists → **New Packing List**).                                                               | The **Create Packing List** page, with the PO already chosen if you came from the PO.                         | ☐     |       |
| 2   | Confirm the **Purchase Order** field shows your PO with its vendor and value.                                                                                              | The PO is set.                                                                                                | ☐     |       |
| 3   | Fill **Number of Packages**, **Shipping Method**, **Total Weight (kg)**, **Total Volume (m³)**, **Shipping Company**, **Tracking Number** and **Estimated Delivery Date**. | All accept input.                                                                                             | ☐     |       |
| 4   | Fill **Delivery Address**, **Contact Person** and **Contact Phone**.                                                                                                       | All accept input.                                                                                             | ☐     |       |
| 5   | In the items table, enter a **Qty to Pack** for each line, plus package details, weight and dimensions.                                                                    | The **Available** column shows how much of each line is still unpacked.                                       | ☐     |       |
| 6   | On one line, type a quantity **larger than Available** and try to save.                                                                                                    | The app refuses and tells you the packed quantity is more than what is left on the PO.                        | ☐     |       |
| 7   | Correct that line to a valid quantity. Pack **part** of the order (not all of it).                                                                                         | Values accepted.                                                                                              | ☐     |       |
| 8   | Fill **Packing Instructions** and **Handling Instructions**, and attach a vendor shipping document.                                                                        | All accepted; the attachment is listed.                                                                       | ☐     |       |
| 9   | Click **Create Packing List**.                                                                                                                                             | The packing list page opens. The number is in the form `PL/2026/07/0001` and the status chip reads **Draft**. | ☐     |       |
| 10  | Create a **second** packing list for the same PO.                                                                                                                          | The **Available** column now shows only what the first list left over.                                        | ☐     |       |

**Also check:**

- The packing list number carries this year **and this month**, with a four-digit sequence: `PL/2026/07/0001`, `PL/2026/07/0002`, …
- The packing list page shows the PO number and the vendor name at the top.

**Should NOT be possible:**

- Packing more, in total across all packing lists, than the PO ordered.
- Creating a packing list against a PO that is still **Draft**, **Pending First Approval**, **Pending Final Approval** or **Approved** — the **Create Packing List** button only appears once the PO is **Issued**.

---

## UAT-PROC-19 — Packing list round-trip

**Goal:** Nothing typed on the packing list is lost when it is edited and saved.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires the packing list from UAT-PROC-18, in status **Draft**.

> A packing list can only be edited while it is **Draft**.

| #   | Do this                                                                         | You should see                                                                                                                                                                                    | Pass? | Notes |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the packing list and note every value on screen, including the attachment. | —                                                                                                                                                                                                 | ☐     |       |
| 2   | Click **Edit**.                                                                 | The edit page opens **pre-filled** — packages, shipping method, weight, volume, company, tracking number, estimated delivery date, address, contact person and phone, and both instruction boxes. | ☐     |       |
| 3   | Change nothing. Click **Save Changes**.                                         | Back on the packing list page.                                                                                                                                                                    | ☐     |       |
| 4   | Compare against your notes.                                                     | Nothing lost, nothing changed, the estimated delivery date has not shifted.                                                                                                                       | ☐     |       |
| 5   | Click **Edit**, change the tracking number and the shipping company, and save.  | Only those two changed; the attachment is still there.                                                                                                                                            | ☐     |       |

---

## UAT-PROC-20 — Move the packing list Finalized → Shipped → Delivered

**Goal:** The shipment status moves through its three steps, each stamping a date, and locks at the end.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires the packing list from UAT-PROC-18/19, in status **Draft**.

> Finalizing locks the items. You cannot add or change packed quantities afterwards.

| #   | Do this                                              | You should see                                                                               | Pass? | Notes |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the packing list and click **Finalize**.        | A **Finalize Packing List** dialog warning that items cannot be modified afterwards.         | ☐     |       |
| 2   | Click **Finalize**.                                  | Status chip reads **Finalized**. The **Edit** button is gone. **Mark as Shipped** appears.   | ☐     |       |
| 3   | Click **Mark as Shipped**.                           | A dialog asking for **Shipping Company** and **Tracking Number**, pre-filled from the list.  | ☐     |       |
| 4   | Adjust them if needed and click **Mark as Shipped**. | Status chip reads **Shipped**, and a shipped date is recorded on the page.                   | ☐     |       |
| 5   | Click **Mark as Delivered**.                         | A dialog confirming the shipment arrived and that the actual delivery date will be recorded. | ☐     |       |
| 6   | Click **Mark as Delivered**.                         | Status chip reads **Delivered**, and an actual delivery date appears.                        | ☐     |       |
| 7   | Look at the action buttons.                          | Only **Receive Goods** remains. There is no way to move the status further.                  | ☐     |       |

**Also check:**

- A **Receive Goods** button appears from **Finalized** onwards, and it opens the goods receipt form with both the PO and this packing list already chosen.

**Should NOT be possible:**

- Editing a packing list once it is **Finalized**, **Shipped** or **Delivered**.
- Skipping a step — you cannot go straight from **Draft** to **Shipped**.
- Moving a **Delivered** packing list to any other status.

---

## UAT-PROC-21 — Record a goods receipt

**Goal:** Goods arriving are inspected and booked against the purchase order, and the order's delivery progress moves.
**Who:** You, with **Inspect Goods**.
**Before you start:** Requires the PO from UAT-PROC-15 (status **Issued**) and a packing list for it that is **not** in Draft (UAT-PROC-20).

| #   | Do this                                                                                                                                             | You should see                                                                                                             | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Go to Procurement → Goods Receipts → **New Goods Receipt**.                                                                                         | The **Create Goods Receipt** page.                                                                                         | ☐     |       |
| 2   | Choose your PO under **Purchase Order**.                                                                                                            | A summary panel shows the vendor, project and total. A **Packing List** section appears.                                   | ☐     |       |
| 3   | Choose the finalized packing list.                                                                                                                  | It is selected. (If no packing list exists, an amber warning offers a **Create Packing List** button instead.)             | ☐     |       |
| 4   | Set **Inspection Type**, **Inspection Location**, **Inspection Date** and **Overall Notes**.                                                        | All accept input.                                                                                                          | ☐     |       |
| 5   | In the items table, read the columns Ordered / Prev. Received / Balance.                                                                            | Balance = Ordered − Prev. Received on every line.                                                                          | ☐     |       |
| 6   | On one line, type a **Received** quantity **larger than Balance** and try to save.                                                                  | The app refuses and tells you it is more than what is outstanding on the PO.                                               | ☐     |       |
| 7   | On one line, set **Accepted** higher than **Received** and try to save.                                                                             | The app refuses.                                                                                                           | ☐     |       |
| 8   | Correct the quantities: receive **part** of the order, accept all of what you received, reject nothing, and set **Condition** = Good on every line. | Values accepted.                                                                                                           | ☐     |       |
| 9   | Click **Create Goods Receipt**.                                                                                                                     | The goods receipt page opens. The number is in the form `GR/2026/07/0001` and the status chip reads **In Progress**.       | ☐     |       |
| 10  | Check the items table on the receipt.                                                                                                               | Ordered, Received, Accepted, Rejected and Condition match what you entered.                                                | ☐     |       |
| 11  | Open the purchase order.                                                                                                                            | **Delivery Progress** has moved off 0% and matches the proportion you received.                                            | ☐     |       |
| 12  | Record a **second** goods receipt for the rest of the order.                                                                                        | The **Prev. Received** column now reflects the first receipt; **Balance** is what is left. Delivery Progress reaches 100%. | ☐     |       |

**Also check:**

- Goods receipt numbers carry this year **and this month** with four digits: `GR/2026/07/0001`, `GR/2026/07/0002`, …
- A goods receipt is created directly in **In Progress**. It never shows **Pending** — see **Known issues**.
- The PO's per-line delivery status updates (partly delivered / fully delivered).

**Should NOT be possible:**

- Creating a goods receipt without a packing list — **Create Goods Receipt** stays disabled until one is chosen.
- Receiving more than was ordered, across all goods receipts for that PO.
- Recording a goods receipt against a PO that is **Draft**, **Approved**, **Cancelled** or **Completed**.
- A user without **Inspect Goods** creating one.

---

## UAT-PROC-22 — Record a goods receipt with rejected or damaged items

**Goal:** Damaged or short deliveries are recorded, flagged, and the buyer is told.
**Who:** You, with **Inspect Goods**.
**Before you start:** Requires an **Issued** PO with an outstanding balance and a finalized packing list. Use a second PO if the first one is fully received.

| #   | Do this                                                                  | You should see                                                                                        | Pass? | Notes |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Start a new goods receipt as in UAT-PROC-21, steps 1–4.                  | The items table.                                                                                      | ☐     |       |
| 2   | On one line: set **Received** = 10, **Accepted** = 7, **Rejected** = 3.  | Accepted + Rejected = Received; the app accepts it.                                                   | ☐     |       |
| 3   | Set that line's **Condition** to _Damaged_ and type **Condition Notes**. | Both are saved with the line.                                                                         | ☐     |       |
| 4   | Tick the issues flag on that line and list the issues, one per line.     | The issues box accepts multiple lines.                                                                | ☐     |       |
| 5   | On another line, set **Testing** = _Fail_.                               | Accepted.                                                                                             | ☐     |       |
| 6   | Click **Create Goods Receipt**.                                          | The receipt page opens with a red **Has Issues** chip next to the status.                             | ☐     |       |
| 7   | Check the items table.                                                   | The damaged line shows Rejected = 3, condition Damaged, and **Yes** in the Issues column.             | ☐     |       |
| 8   | Ask the **PO creator** to check the bell icon.                           | A task telling them items on this goods receipt were rejected.                                        | ☐     |       |
| 9   | Open the purchase order.                                                 | Delivery Progress counts the **accepted** quantity, and the rejected quantity is recorded separately. | ☐     |       |

**Should NOT be possible:**

- Accepted + Rejected adding up to more than Received.
- Rejecting more than was received.

---

## UAT-PROC-23 — Goods receipt round-trip: inspection details

**Goal:** Inspection details can be corrected without losing anything, while quantities stay locked.
**Who:** You, with **Inspect Goods**.
**Before you start:** Requires a goods receipt in status **In Progress** (UAT-PROC-21).

| #   | Do this                                                                                        | You should see                                                                                                                                 | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the goods receipt and note the inspection type, date, location, notes and issues summary. | —                                                                                                                                              | ☐     |       |
| 2   | Click **Edit**.                                                                                | An edit page with **Inspection Type**, **Inspection Date**, **Inspection Location**, **Overall Notes** and **Issues Summary**, all pre-filled. | ☐     |       |
| 3   | Check whether quantities are editable here.                                                    | They are not — line quantities are fixed once the receipt is created.                                                                          | ☐     |       |
| 4   | Change nothing and click **Save Changes**.                                                     | Back on the receipt; every value unchanged, the inspection date has not shifted.                                                               | ☐     |       |
| 5   | Click **Edit**, change the location and the notes, then **Save Changes**.                      | Only those two changed.                                                                                                                        | ☐     |       |

**Should NOT be possible:**

- Editing a goods receipt that is **Completed** — the **Edit** button must be gone.
- Changing received / accepted / rejected quantities after creation. If a quantity is wrong, the fix is a new goods receipt, not an edit.

---

## UAT-PROC-24 — Complete the goods receipt

**Goal:** Completing the receipt drafts the vendor bill in Accounting and raises the matching tasks.
**Who:** You, with **Approve Goods Receipts** (or **Manage Procurement**).
**Before you start:** Requires a goods receipt in status **In Progress**.

| #   | Do this                                                                                | You should see                                                                                                     | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open the goods receipt and click **Complete GR**.                                      | A **Complete Goods Receipt** dialog. If the receipt has issues, an amber warning tells you to document them first. | ☐     |       |
| 2   | Click **Complete**.                                                                    | The status chip changes to **Completed**. The **Edit** button disappears.                                          | ☐     |       |
| 3   | Look for a **Bill Created** chip on the page.                                          | Either a **Bill Created** chip, or a **Send to Accounting** button (see UAT-PROC-25).                              | ☐     |       |
| 4   | Go to Accounting → Vendor Bills.                                                       | A draft bill for this vendor referencing this goods receipt and purchase order.                                    | ☐     |       |
| 5   | Ask the **PO creator** to check the bell icon.                                         | A task asking them to run the three-way match for this PO.                                                         | ☐     |       |
| 5b  | Ask **Accounts** to check the bell icon.                                               | A task headed "Clear Payment for GR _number_", asking them to review and clear the receipt for payment.            | ☐     |       |
| 6   | Wait a few seconds, then open the project → charter → **Procurement** tab and refresh. | The matching charter row now reads **DELIVERED**.                                                                  | ☐     |       |

**Also check:**

- If the bill did **not** appear in Accounting, you should have received a high-priority task saying the bill could not be drafted, quoting the error, and telling you to create it manually. Report that with the error text.

**Should NOT be possible:**

- Completing a goods receipt that is already **Completed**.
- A user without **Approve Goods Receipts** or **Manage Procurement** completing it.

---

## UAT-PROC-25 — Hand the goods receipt to Accounting and clear it for payment

**Goal:** Accounts picks the receipt up, raises the bill if it was not drafted automatically, and clears it for payment.
**Who:** You (procurement) and **Accounts** (needs **Manage Accounting**).
**Before you start:** Requires a **Completed** goods receipt from UAT-PROC-24.

| #   | Do this                                                                                         | You should see                                                                                                     | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open the completed goods receipt as yourself (procurement).                                     | If no bill was drafted automatically, a **Send to Accounting** button.                                             | ☐     |       |
| 2   | Click **Send to Accounting**.                                                                   | A dialog asking you to pick an **Accounting User**. Your own name is excluded.                                     | ☐     |       |
| 3   | Choose **Accounts** and click **Send**.                                                         | A chip reads "Sent to Accounting — _Accounts_". The **Send to Accounting** button is gone.                         | ☐     |       |
| 4   | **As Accounts**, open the same goods receipt.                                                   | A **Create Bill** button.                                                                                          | ☐     |       |
| 5   | Click **Create Bill**.                                                                          | A **Bill Created** chip appears on the receipt.                                                                    | ☐     |       |
| 6   | Go to Accounting → Vendor Bills.                                                                | The bill is listed, for the right vendor, with the goods receipt's value.                                          | ☐     |       |
| 7   | Back on the goods receipt **as Accounts**, click **Clear for Payment**.                         | A dialog warning it will automatically create a vendor payment in Accounting.                                      | ☐     |       |
| 8   | Click **Clear for Payment**.                                                                    | The receipt is marked cleared for payment.                                                                         | ☐     |       |
| 9   | Go to Accounting → Payments.                                                                    | A vendor payment for this bill exists.                                                                             | ☐     |       |
| 10  | Once the payment is recorded, reopen the goods receipt after a few seconds and refresh.         | The payment status on the receipt reads **Partly Paid** or **Paid** according to how much was paid against the PO. | ☐     |       |
| 11  | **As yourself (procurement)**, open a completed receipt that has a bill but is not yet cleared. | Instead of a button, a passive chip reading "Awaiting payment clearance by Accounts".                              | ☐     |       |

**Also check:**

- Payment status on the receipt runs **Pending** → **Cleared for Payment** → **Partly Paid** → **Paid** as payments land against the purchase order.

**Should NOT be possible:**

- The **inspector** who created the goods receipt also clearing it for payment — the app must block it.
- A procurement user without **Manage Accounting** clearing it for payment — they see the passive chip instead of the button.
- Clearing a goods receipt that is not **Completed**, or that has no bill.

---

## UAT-PROC-26 — Run a three-way match

**Goal:** The purchase order, the goods receipt and the vendor's bill are compared line by line and differences are flagged.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires a **Completed** goods receipt and its vendor bill in Accounting (UAT-PROC-24/25). You will need the bill's record identifier — open the bill in Accounting and copy the long identifier from the end of the web address.

| #   | Do this                                                                                                                                                                   | You should see                                                                                                                                                                                                                               | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Go to Procurement → Three-Way Match → **New Match**.                                                                                                                      | The **New Three-Way Match** page with three numbered steps.                                                                                                                                                                                  | ☐     |       |
| 2   | Under **1. Select Purchase Order**, choose your PO.                                                                                                                       | A summary shows vendor, project and total, and step 2 appears.                                                                                                                                                                               | ☐     |       |
| 3   | Under **2. Select Goods Receipt**, choose the completed receipt.                                                                                                          | Only **completed** goods receipts for that PO are offered. A summary shows inspection date, who inspected, and overall condition.                                                                                                            | ☐     |       |
| 4   | Under **3. Vendor Bill Information**, paste the bill's record identifier into **Vendor Bill ID** and type the vendor's own invoice number into **Vendor Invoice Number**. | Both accept input. **Perform Three-Way Match** stays disabled until the bill ID is filled.                                                                                                                                                   | ☐     |       |
| 5   | Click **Perform Three-Way Match**.                                                                                                                                        | The match page opens. The number is in the form `TWM/2026/07/0001` and a status chip reads **Matched**, **Partially Matched**, **Not Matched** or **Pending Review**.                                                                        | ☐     |       |
| 6   | Read the **Financial Summary**.                                                                                                                                           | The PO amount, the received amount and the billed amount side by side, with the variance.                                                                                                                                                    | ☐     |       |
| 7   | Read the line items table.                                                                                                                                                | Each bill line is lined up against its PO line and GR line, with quantity, price and amount variances.                                                                                                                                       | ☐     |       |
| 8   | Read the **Discrepancies** panel.                                                                                                                                         | A count in the heading, an amber "_n_ Unresolved" chip, and a row per problem with Type, Description, **Expected**, **Actual** and a **Pending** status chip. A line billed but missing from the PO or the goods receipt is listed here too. | ☐     |       |
| 9   | Repeat the whole test with a bill whose amount is deliberately wrong.                                                                                                     | The status is **Partially Matched** or **Not Matched**, and the discrepancy names both the billed and the expected value.                                                                                                                    | ☐     |       |

**Also check:**

- Match numbers carry this year and month with four digits: `TWM/2026/07/0001`, `TWM/2026/07/0002`, …
- A match that is fully within tolerance and under the auto-approve limit shows as **Matched** and needs no approval.

**Should NOT be possible:**

- Selecting a goods receipt that is not **Completed**.
- Running a match without a vendor bill identifier.
- A user without **Manage Procurement** running a match.

---

## UAT-PROC-27 — Approve or reject a three-way match, and resolve a discrepancy

**Goal:** A flagged match is reviewed by somebody other than the person who ran it, and approval raises the vendor bill.
**Who:** **Approver A** (needs **Manage Procurement**).
**Before you start:** Requires a match from UAT-PROC-26 that needs approval — i.e. one with a discrepancy, out of tolerance, or above the auto-approve limit.

| #   | Do this                                                                                                                                                                                | You should see                                                                                                | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the match and find the **Discrepancies** panel.                                                                                                                                   | Each unresolved row has a **Resolve** button and a **Pending** status chip.                                   | ☐     |       |
| 2   | Click **Resolve** on one row, pick a **Resolution Type** (Accept Variance, Corrected by Vendor, Price Adjustment, Quantity Adjustment, Waived), type **Resolution Notes** and confirm. | That row's status chip changes to **Resolved** and the "_n_ Unresolved" count drops by one.                   | ☐     |       |
| 3   | **As Approver A**, open the match and click **Approve Match**.                                                                                                                         | An **Approve Three-Way Match** dialog.                                                                        | ☐     |       |
| 4   | Confirm.                                                                                                                                                                               | An **Approved** chip appears next to the status chip. The **Approve Match** and **Reject** buttons disappear. | ☐     |       |
| 5   | Go to Accounting → Vendor Bills.                                                                                                                                                       | A vendor bill from this match exists, for the right vendor and amount.                                        | ☐     |       |
| 6   | On a **second** match, click **Reject** as Approver A.                                                                                                                                 | A **Reject Three-Way Match** dialog asking for a **Rejection Reason**.                                        | ☐     |       |
| 7   | Leave the reason blank.                                                                                                                                                                | The confirm button stays disabled.                                                                            | ☐     |       |
| 8   | Type a reason and confirm.                                                                                                                                                             | A **Rejected** chip appears; no vendor bill is created for that match.                                        | ☐     |       |

**Should NOT be possible:**

- The person who **ran** the match approving it — the app must block self-approval with a clear message.
- Approving a match that is already approved or rejected.
- Approving a **Not Matched** result — only reject is offered there.

---

## UAT-PROC-28 — Issue a work completion certificate

**Goal:** A service purchase order is closed off with a signed certificate, and the buyer is told to raise the bill.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires a purchase order in status **In Progress**, **Delivered** or **Completed**. A service PO is the realistic case, but any PO in those statuses will do.

| #   | Do this                                                                                                                                                                                                 | You should see                                                                                                                         | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the PO and click **Issue Work Certificate** (or go to Procurement → Work Completion → **New WCC**).                                                                                                | The **Create Work Completion Certificate** page, with the PO pre-selected if you came from it.                                         | ☐     |       |
| 2   | Confirm the **Purchase Order** field.                                                                                                                                                                   | Your PO with its vendor and value.                                                                                                     | ☐     |       |
| 3   | Type a **Work Description** and set a **Completion Date**.                                                                                                                                              | Both accept input.                                                                                                                     | ☐     |       |
| 4   | Tick the three attestations: **All items have been delivered**, **All items have been accepted (passed inspection)**, **All payments have been completed** — tick only the ones that are actually true. | Each tick holds.                                                                                                                       | ☐     |       |
| 5   | Read and edit the **Certificate Text**.                                                                                                                                                                 | It is pre-written and editable.                                                                                                        | ☐     |       |
| 6   | Add **Remarks (Optional)**.                                                                                                                                                                             | Accepted.                                                                                                                              | ☐     |       |
| 7   | Click **Create Certificate**.                                                                                                                                                                           | The certificate page opens. The number is in the form `WCC/2026/07/0001`.                                                              | ☐     |       |
| 8   | Check the page.                                                                                                                                                                                         | Work description, completion date, the three attestations, certificate text, vendor, project, the linked PO number and the issue date. | ☐     |       |
| 9   | Click **Print**.                                                                                                                                                                                        | A printable certificate with the same content.                                                                                         | ☐     |       |
| 10  | Ask the **PO creator** to check the bell icon.                                                                                                                                                          | A task saying the certificate is ready for billing. **Clicking it must open this certificate.**                                        | ☐     |       |
| 11  | Go to Procurement → Work Completion.                                                                                                                                                                    | The certificate is in the list.                                                                                                        | ☐     |       |

**Also check:**

- Certificate numbers carry this year and month with four digits: `WCC/2026/07/0001`, …
- A certificate has no workflow — once issued, it stands. There is no edit, approve or cancel.

**Should NOT be possible:**

- Issuing a certificate against a PO that is **Draft**, **Approved** or **Issued** — the button only appears from **In Progress** onwards.

---

## UAT-PROC-29 — Raise a PO amendment (round-trip) and submit it for approval

**Goal:** A change to an already-approved purchase order is captured with every field, survives an edit, and goes to a named approver.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires a purchase order in status **Approved**, **Issued**, **Acknowledged**, **In Progress** or **Amended**. Approver A exists and is not you.

> Once you submit an amendment you cannot recall it. See **Known issues** — the only way back is for the approver to reject it, and then you raise a new one.

| #   | Do this                                                                                                                                | You should see                                                                                            | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Go to Procurement → PO Amendments → **New Amendment**.                                                                                 | The **Create PO Amendment** page.                                                                         | ☐     |       |
| 2   | Choose your PO under **Purchase Order**.                                                                                               | A summary panel showing vendor, project and **Current Total**, then the amendment form.                   | ☐     |       |
| 3   | Type a **Reason for Amendment**.                                                                                                       | Accepted. It is compulsory.                                                                               | ☐     |       |
| 4   | Tick **Price Change**, set **Amend by** = _Grand Total_ and enter a **New Grand Total**.                                               | The form shows the change against the current total.                                                      | ☐     |       |
| 5   | Tick **Delivery Change**, set a **New Expected Delivery Date**, tick **Change delivery address?** and type a **New Delivery Address**. | All accepted.                                                                                             | ☐     |       |
| 6   | Tick **Terms Change**, pick a term and type its new value.                                                                             | Accepted.                                                                                                 | ☐     |       |
| 7   | Tick **Quantity Change** and type a **Quantity Change Note**; tick **General Note** and type a **Note**.                               | Accepted. The panel explains these two are recorded for the audit trail but do not change PO fields.      | ☐     |       |
| 8   | Write down every value you entered.                                                                                                    | —                                                                                                         | ☐     |       |
| 9   | Click **Create Amendment**.                                                                                                            | The amendment page opens, headed `PO/2026/001 - Amendment #1`, status chip **Draft**.                     | ☐     |       |
| 10  | Compare the **Changes** table against your notes.                                                                                      | Every change is listed with its previous and new value.                                                   | ☐     |       |
| 11  | Click **Edit**.                                                                                                                        | The form opens **pre-filled** — reason, every tick-box, every value you entered.                          | ☐     |       |
| 12  | Change nothing and save.                                                                                                               | The amendment page is unchanged.                                                                          | ☐     |       |
| 13  | Click **Submit for Approval**.                                                                                                         | A dialog explaining you cannot approve your own amendment, with an **Approver** picker that excludes you. | ☐     |       |
| 14  | Choose Approver A and click **Submit**.                                                                                                | Status chip changes to **Pending Approval**. The **Edit** button disappears.                              | ☐     |       |
| 15  | Ask **Approver A** to check the bell icon.                                                                                             | A task saying an amendment needs their approval.                                                          | ☐     |       |

**Also check:**

- The amendment shows its financial impact: previous grand total, new grand total and the difference.
- Raising a second amendment on the same PO numbers it **Amendment #2**.

**Should NOT be possible:**

- Saving an amendment with no reason.
- Naming **yourself** as the approver — you are excluded from the list.
- Editing an amendment once it is **Pending Approval**.
- Raising an amendment against a PO that is **Draft**, **Pending First Approval**, **Rejected**, **Cancelled** or **Completed**.

---

## UAT-PROC-30 — Approve an amendment and confirm it is applied to the PO

**Goal:** Approving an amendment actually changes the purchase order.
**Who:** **Approver A** (needs **Manage Procurement**).
**Before you start:** Requires the amendment from UAT-PROC-29, in status **Pending Approval**. Note the PO's current grand total, delivery date and delivery address first.

> Approving applies the changes to the live purchase order. It cannot be undone.

| #   | Do this                                                     | You should see                                                                                        | Pass? | Notes |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As Approver A**, open the amendment from your inbox task. | The amendment page with **Approve** and **Reject** buttons.                                           | ☐     |       |
| 2   | Read the **Changes** table.                                 | Each change shows the previous and the new value.                                                     | ☐     |       |
| 3   | Click **Approve**.                                          | A dialog warning it will apply the changes to the purchase order, with a **Comments (optional)** box. | ☐     |       |
| 4   | Add a comment and click **Approve**.                        | The status chip changes to **Approved**. No further buttons.                                          | ☐     |       |
| 5   | Open the purchase order.                                    | The status chip reads **Amended**, and it records that this is the latest amendment number.           | ☐     |       |
| 6   | Check the **Financial Summary**.                            | The grand total is the new one you set in the amendment.                                              | ☐     |       |
| 7   | Check the delivery date and delivery address.               | Both are the new values.                                                                              | ☐     |       |
| 8   | Check the terms field you changed.                          | It carries the new value.                                                                             | ☐     |       |
| 9   | Go back to the amendment and read the history panel.        | Who submitted it, who approved it, when, the comments, and the change made to each field.             | ☐     |       |
| 10  | Click **Download PDF** on the purchase order.               | The PDF shows the amended values.                                                                     | ☐     |       |

**Also check:**

- The quantity-change note and the general note are recorded on the amendment but did **not** change any PO field — this is intended.

**Should NOT be possible:**

- The person who **raised** the amendment approving it — the app must block self-approval.
- A different person with **Manage Procurement**, who is not the named approver, approving it.
- Approving the same amendment twice, or approving an amendment that is already **Rejected**.

---

## UAT-PROC-31 — Reject an amendment and re-raise it

**Goal:** A wrong amendment is rejected with a reason and a corrected one is raised in its place.
**Who:** You (requester) and **Approver A**.
**Before you start:** Raise and submit a second amendment as in UAT-PROC-29.

| #   | Do this                                                                          | You should see                                                                                                  | Pass? | Notes |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As the requester**, open the amendment while it is **Pending Approval**.       | There is **no** way to recall or withdraw it. ⚠ known issue — this is on the fix list; do not report it.        | ☐     |       |
| 2   | **As Approver A**, open the amendment and click **Reject**.                      | A **Reject Amendment** dialog asking for a **Rejection Reason**.                                                | ☐     |       |
| 3   | Leave the reason blank.                                                          | The **Reject** confirm button stays disabled.                                                                   | ☐     |       |
| 4   | Type a reason and click **Reject**.                                              | Status chip changes to **Rejected**.                                                                            | ☐     |       |
| 5   | **As the requester**, open the rejected amendment.                               | The rejection reason is shown. There is **no** Edit and **no** Resubmit button — a rejected amendment is final. | ☐     |       |
| 6   | Open the purchase order.                                                         | Nothing on the PO changed — a rejected amendment applies nothing.                                               | ☐     |       |
| 7   | Go to Procurement → PO Amendments → **New Amendment** and raise a corrected one. | A fresh amendment, numbered one higher than the rejected one.                                                   | ☐     |       |

**Should NOT be possible:**

- The requester rejecting their own amendment.
- Editing or resubmitting a **Rejected** amendment.

---

## UAT-PROC-32 — Mark the purchase order completed

**Goal:** A finished order is closed manually, and the closure shows up on the project charter.
**Who:** You, with **Manage Procurement**.
**Before you start:** Requires a purchase order in status **In Progress** or **Delivered** — i.e. one where goods have been received (UAT-PROC-21).

> **Completed** is a terminal status. Once set, no more goods receipts, packing lists, certificates or amendments can be raised against the order.

| #   | Do this                                                                                 | You should see                                                                              | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the PO and check the **Delivery Progress** and **Payment Progress** bars.          | Both reflect what has actually been received and paid.                                      | ☐     |       |
| 2   | Click **Mark Completed**.                                                               | The status chip changes to **Completed**.                                                   | ☐     |       |
| 3   | Look at the action buttons.                                                             | **Receive Goods**, **Create Packing List**, **Cancel** and **Mark Completed** are all gone. | ☐     |       |
| 4   | Wait a few seconds, then check the project charter **Procurement** tab.                 | The matching row reads **DELIVERED**.                                                       | ☐     |       |
| 5   | Try to raise an amendment against it (Procurement → PO Amendments → **New Amendment**). | This PO is not offered in the purchase order list.                                          | ☐     |       |

**Also check:**

- Completion is a **manual** step — the app does not close the order by itself, even at 100% delivery and 100% payment.

**Should NOT be possible:**

- Marking a PO completed from **Draft**, **Approved**, **Issued** or **Cancelled** — the button only appears at **In Progress** or **Delivered**.
- Any further action on a **Completed** purchase order.

---

## UAT-PROC-33 — Permission checks: a view-only user cannot change anything

**Goal:** Someone with read access can look but not touch.
**Who:** A second user with **View Procurement** only — no Manage Procurement, no Inspect Goods, no Approve Goods Receipts, no Manage Accounting.
**Before you start:** Ask an administrator to set up such a user at Administration → Admin → Users, or temporarily strip the extra permissions from a test account.

| #   | Do this                                                                             | You should see                                                                                            | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As the view-only user**, go to Procurement.                                       | The landing page loads with all its cards.                                                                | ☐     |       |
| 2   | Open Purchase Requests, RFQs, Quotes, Purchase Orders, Goods Receipts.              | All lists load and detail pages open.                                                                     | ☐     |       |
| 3   | Open a **Draft** RFQ.                                                               | No **Edit**, no **Mark as Sent**, no **Cancel**.                                                          | ☐     |       |
| 4   | Open a **Draft** purchase order.                                                    | No **Edit**, no **Submit for Approval**, no **Cancel**.                                                   | ☐     |       |
| 5   | Open a PO that is **Pending First Approval**.                                       | No **Approve**, no **Reject**, no **Return with Comments**.                                               | ☐     |       |
| 6   | Open an **Issued** PO.                                                              | No **Receive Goods**, no **Create Packing List**, no **Issue Work Certificate**.                          | ☐     |       |
| 7   | Open a quote.                                                                       | No status buttons, no **Edit Details**.                                                                   | ☐     |       |
| 8   | Open a **Completed** goods receipt.                                                 | No **Complete GR**, no **Create Bill**, no **Clear for Payment** — at most a passive status chip.         | ☐     |       |
| 9   | Try to reach Procurement → Three-Way Match → **New Match** and run a match.         | Either the button is not there, or the app refuses with a message saying you need **Manage Procurement**. | ☐     |       |
| 10  | Now give the same user **Inspect Goods** only, and try to complete a goods receipt. | They can create one but the app refuses to complete it, saying they need **Approve Goods Receipts**.      | ☐     |       |
| 11  | Remove **View Procurement** entirely and reopen the module.                         | A clear "you do not have permission" message, not a blank page or an error.                               | ☐     |       |

**Also check:**

- If a permission was granted to you in the last few minutes and an action still says you lack permission, sign out and back in, then try once more before reporting it.

---

## UAT-PROC-34 — Cross-module check: everything reached Accounting

**Goal:** Every financial document procurement is supposed to hand over has actually arrived in Accounting.
**Who:** **Accounts** (needs **View Accounting**), with you alongside.
**Before you start:** Run this **last**, after UAT-PROC-01 to 32. Have to hand: the PO number, the goods receipt number and the three-way match number you created.

| #   | Do this                                                                                                        | You should see                                                                                                     | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Go to Accounting → Payments and search for your vendor.                                                        | The **advance payment** raised when the PO was given final approval (if the PO carried an advance).                | ☐     |       |
| 2   | Open it.                                                                                                       | It names your purchase order and the advance amount matches the **Advance Payment (n%)** line on the PO.           | ☐     |       |
| 3   | Go to Accounting → Vendor Bills and search for your vendor.                                                    | A bill raised from the completed goods receipt, referencing the GR and the PO.                                     | ☐     |       |
| 4   | Compare the bill's total against the goods receipt's accepted value.                                           | They agree.                                                                                                        | ☐     |       |
| 5   | Look for the bill raised on approving the three-way match.                                                     | It exists, references the match, and matches the amount approved.                                                  | ☐     |       |
| 6   | Go to Accounting → Payments and find the vendor payment raised when the goods receipt was cleared for payment. | It exists for the right vendor and amount.                                                                         | ☐     |       |
| 7   | Go to Accounting → GRN Bills.                                                                                  | The bills raised from goods receipts are listed there too.                                                         | ☐     |       |
| 8   | Go back to Procurement → Goods Receipts and open the receipt.                                                  | Its payment status reflects what has been paid: **Pending**, **Cleared for Payment**, **Partly Paid** or **Paid**. | ☐     |       |
| 9   | Open the purchase order and check **Payment Progress**.                                                        | It matches the proportion of the PO value that has been paid.                                                      | ☐     |       |

**Also check:**

- No duplicates: exactly **one** bill per completed goods receipt, and exactly **one** bill per approved three-way match.
- If any of these is missing, check the bell icon for a high-priority task saying the hand-over failed — quote its error text when you report it.

---

## Known issues in this module

Read these before you start. Do **not** file feedback for anything on this list.

1. **An amendment cannot be recalled once submitted.** If you send an amendment to the wrong person, or to someone who is away, there is no way to pull it back to Draft. The only route is for that approver to reject it, and for you to raise a new one. Affects **UAT-PROC-31**, step 1.
2. **There is no Withdraw button for a vendor quote anywhere in the app.** A losing quote is rejected automatically when you select a winner, and there is no separate Reject or Withdraw action on the quote page. Affects **UAT-PROC-10**.
3. **Goods receipts never show "Pending".** A new goods receipt is created directly in **In Progress**. This is intended — do not report the missing status.
4. **"Mark as Sent" on an RFQ does not email vendors.** The app records the date and locks the RFQ; you send the PDF to the vendors yourself, outside the app. The dialog says so. This is intended.
5. **The three-way match asks for the vendor bill's record identifier**, which you have to copy out of the web address of the bill in Accounting rather than pick from a list. Awkward, already known, do not report it.
6. **Hand-overs into Accounting are best-effort but never silent.** If the advance payment, the vendor bill or the vendor payment fails to be created, procurement carries on and you get a high-priority task telling you to create the document manually. That task is expected behaviour — but if you get one, **do** report it, quoting the error text it contains.
