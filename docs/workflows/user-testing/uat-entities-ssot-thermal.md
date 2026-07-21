# Entities, Process Data & Thermal Calculators — Workflow Testing

> How to use this: [Testing guide](README.md) · Report problems at **Feedback** in the app, with the test ID at the start of the title (e.g. `UAT-ENT-03 — bank account lost after reopening the edit form`).

## What this module does

**Entity Management** is the company's master list of everyone we do business with — vendors, customers and partners. Each entity carries its contact people, billing and shipping addresses, PAN and GSTIN, bank accounts, credit terms and an opening balance carried forward from the previous year. Every purchase order, bill, invoice and payment in the app points back to one of these records, so a mistake here spreads everywhere.

**Process Data (SSOT)** is the per-project engineering master used to build P&IDs and datasheets. For a chosen project it holds the **Streams** (the fluids and their conditions), the **Equipment** they flow through, the **Lines** (pipes, with automatic sizing), the **Instruments** and **Valves** on those lines, and a **Pipe Table** of standard sizes used when sizing a line. Records are linked to each other by tag text — exactly the way the source engineering spreadsheets are keyed.

**Thermal Calculators** is a suite of around thirty standalone design calculators for MED / MED-TVC / MSF desalination plants, plus a full **MED Plant Designer** wizard, a **Flash Chamber Calculator**, and a read-only **Reference Projects** library of as-built plant data. Most calculators compute as you type; most let you save a named set of inputs and load it back later.

## Before you start

### Permissions you need

| What you want to test                                 | Permission needed                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Open Entity Management, see the list and View Details | **View Entities**                                                                        |
| New Entity, Edit Entity, Archive, Unarchive           | **Create Entities** (there is no separate "edit" permission)                             |
| **View Ledger** on an entity row                      | **View Accounting**                                                                      |
| Open Process Data (SSOT) and read all six tabs        | **View Thermal Desalination**                                                            |
| Add / edit / delete anything in Process Data          | **Manage Process Data (SSOT)** _and_ you must be assigned to the project you are editing |
| Open Thermal Calculators, run and save calculations   | None — open to every signed-in user                                                      |

Permission changes take a few minutes to reach someone who is already signed in. Have them sign out and back in before reporting a permission problem.

### Test data you need first

- **A project you are assigned to.** Everything in Process Data hangs off a project chosen from the **Select Project** dropdown, and you cannot save anything on a project you are not assigned to. Sort this out before starting the SSOT tests.
- **A note pad, physical or otherwise.** The round-trip tests (UAT-ENT-03, and one per Process Data record type) ask you to write down every value you typed and compare it after saving. Do not trust memory — the whole point of the test is spotting a single field that silently changed.
- **A vendor with at least one purchase order against it** for UAT-ENT-11, and **a vendor or customer with a few posted transactions** for UAT-ENT-10.
- **A calculator or two you know the answer to.** For the thermal sweep, being able to say "that number is about right for a plant this size" is worth far more than confirming a number appeared.

### A second user — read this before you start

Three tests need one.

| Account            | What it needs                                                                                                     | Used by     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------- |
| **A limited user** | **View Entities** but **not** Create Entities                                                                     | UAT-ENT-12  |
| **A limited user** | **View Thermal Desalination** but **not** Manage Process Data (SSOT); or a user not assigned to your test project | UAT-SSOT-09 |
| **A colleague**    | Any account that can open the same project's Process Data                                                         | UAT-SSOT-08 |
| **A colleague**    | Any signed-in account                                                                                             | UAT-THRM-05 |

### Sidebar

- Entities: **SETUP → Entity Management**
- Process Data: **ENGINEERING DATA → Process Data (SSOT)**
- Thermal: **SALES & ESTIMATION → Thermal Calculators**

**Read the [Known issues in this module](#known-issues-in-this-module) section at the bottom before you start.** Eight things are already known to be broken or missing; please do not spend time filing them again.

### A note for engineering testers

On every thermal and process-data test, "a number appeared" is not a pass. Check three things each time:

1. **The unit is shown, and it is the unit you expected.** mbar vs bar and kg/s vs T/h are the two that bite.
2. **The magnitude is physically plausible** for the plant you described. A 4-metre shell for a 100 m³/day unit is wrong even if it computes.
3. **The result moves the right way when you change an input.** Double the flow and the pipe should get bigger, not smaller.

Anything that fails one of those three is worth a Feedback item even if nothing on screen looks like an error.

---

## Test index

| ID          | Workflow                                                               | Needs a 2nd user? | Est. time |
| ----------- | ---------------------------------------------------------------------- | ----------------- | --------- |
| UAT-ENT-01  | Browse the entity master and its filters                               | No                | 15 min    |
| UAT-ENT-02  | Create a vendor with every field filled in                             | No                | 30 min    |
| UAT-ENT-03  | Entity round-trip — nothing lost between save and reopen               | No                | 35 min    |
| UAT-ENT-04  | Contacts — add, edit, delete, and the primary-contact rule             | No                | 20 min    |
| UAT-ENT-05  | Bank accounts — add several, edit, delete                              | No                | 15 min    |
| UAT-ENT-06  | Create a customer, and an entity that is both vendor and customer      | No                | 15 min    |
| UAT-ENT-07  | Duplicate and format guards on create                                  | No                | 20 min    |
| UAT-ENT-08  | View Details — everything you saved is shown back                      | No                | 12 min    |
| UAT-ENT-09  | Archive an entity, then restore it                                     | No                | 20 min    |
| UAT-ENT-10  | Entity ledger — opening balance, transactions, running balance, ageing | No                | 25 min    |
| UAT-ENT-11  | Automatic behaviour — entity codes and the vendor-rename ripple        | No                | 20 min    |
| UAT-ENT-12  | Permission checks on the entity master                                 | Yes (limited)     | 15 min    |
| UAT-SSOT-01 | Open Process Data and choose a project                                 | No                | 10 min    |
| UAT-SSOT-02 | Streams — create, derived values, round-trip, delete                   | No                | 30 min    |
| UAT-SSOT-03 | Equipment — create, round-trip, delete, and the stream wiring          | No                | 20 min    |
| UAT-SSOT-04 | Pipe Table — load the standard table, add, edit, delete a size         | No                | 20 min    |
| UAT-SSOT-05 | Lines — automatic pipe sizing, round-trip, recalculation, delete       | No                | 30 min    |
| UAT-SSOT-06 | Instruments — create, round-trip, delete                               | No                | 20 min    |
| UAT-SSOT-07 | Valves — create, round-trip, delete                                    | No                | 20 min    |
| UAT-SSOT-08 | Live updates between two people, and deleting a referenced record      | Yes               | 20 min    |
| UAT-SSOT-09 | Permission checks and the Export Excel button                          | Yes (limited)     | 15 min    |
| UAT-THRM-01 | Tour the Thermal Calculators hub                                       | No                | 15 min    |
| UAT-THRM-02 | MED Plant Designer end to end, with a save-and-reload check            | No                | 60 min    |
| UAT-THRM-03 | MED Plant Designer outputs — reports and the hand-off to Estimation    | No                | 30 min    |
| UAT-THRM-04 | Flash Chamber Calculator end to end                                    | No                | 40 min    |
| UAT-THRM-05 | Save, load and delete a calculation — and who can see it               | Yes               | 20 min    |
| UAT-THRM-06 | Calculator sweep — every remaining calculator, one row each            | No                | 3–4 h     |
| UAT-THRM-07 | Reference Projects library                                             | No                | 10 min    |

---

# Part 1 — Entity Management

## UAT-ENT-01 — Browse the entity master and its filters

**Goal:** confirm the list shows every counterparty correctly and that search, filters, sorting and paging all behave.
**Who:** anyone with **View Entities**.
**Before you start:** nothing. Ideally there are already a few vendors and customers in the system.

| #   | Do this                                                                                           | You should see                                                                                                                                      | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar → **SETUP → Entity Management**                                                           | A page titled **Entity Management**, subtitle "Manage vendors, customers, and business partners"                                                    | ☐     |       |
| 2   | Read the five cards across the top                                                                | **Total Entities**, **Active**, **Archived**, **Vendors**, **Customers**                                                                            | ☐     |       |
| 3   | Add the Active and Archived numbers together                                                      | They equal **Total Entities**                                                                                                                       | ☐     |       |
| 4   | Read the table columns                                                                            | Entity Name, Roles, Contact Person, State, Opening Balance, Status, Actions                                                                         | ☐     |       |
| 5   | Look at a row for a vendor with no billing state recorded                                         | The **State** cell reads **Not set** in red — that is deliberate, it flags an entity that will cause GST problems later                             | ☐     |       |
| 6   | Look at a row with an opening balance                                                             | An amount in rupees, followed by a small **DR** or **CR**; **CR** is shown in red, **DR** in green. A row with no opening balance shows a dash      | ☐     |       |
| 7   | Type part of an entity name into **Search entities...**                                           | The table narrows as you type                                                                                                                       | ☐     |       |
| 8   | Clear search. Set **Status** to **Archived**                                                      | Only archived entities remain, each with an orange **Archived** chip                                                                                | ☐     |       |
| 9   | Set **Status** back to **All Status**. Set **Role** to **Vendor**                                 | Only entities carrying a **VENDOR** chip remain                                                                                                     | ☐     |       |
| 10  | With Role still on **Vendor**, a **Vendor Category** dropdown appears — pick **Bought Out Items** | A further **Sub-Category** dropdown appears next to it                                                                                              | ☐     |       |
| 11  | Set Role to **Supplier**                                                                          | ⚠ known issue — the list comes back empty no matter what. The create form cannot produce a Supplier, so this filter never matches. Do not file this | ☐     |       |
| 12  | Set Role back to **All Roles**. Click the **Entity Name** column heading                          | The list re-sorts alphabetically; click again and it reverses                                                                                       | ☐     |       |
| 13  | Do the same on **Contact Person** and **Status**                                                  | Both sort and reverse                                                                                                                               | ☐     |       |
| 14  | Change the rows-per-page control at the bottom to 25, then 50                                     | Paging works and the total count stays the same                                                                                                     | ☐     |       |
| 15  | Search for a string that matches nothing                                                          | An empty-state message rather than a blank table                                                                                                    | ☐     |       |

**Also check:**

- Role chips are colour-coded: **VENDOR** blue, **CUSTOMER** green, anything else grey.
- Opening balance amounts are formatted in rupees with two decimals, not raw numbers.

---

## UAT-ENT-02 — Create a vendor with every field filled in

**Goal:** create one complete vendor record, using every section of the form, and confirm it lands in the list correctly.
**Who:** someone with **Create Entities**.
**Before you start:** nothing. **Write down every value you type** — UAT-ENT-03 checks them all come back.

> Pick a name you will recognise later, e.g. `UAT Test Vendor 01`.

| #   | Do this                                                                                                                                                                                          | You should see                                                                                                                                                                                                      | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Click **New Entity**                                                                                                                                                                             | A dialog titled **Create New Entity** with sections: Basic Information, Contact Persons, Address & Tax Information, Shipping Address (Optional), Bank Details (Optional), Credit Terms & Opening Balance (Optional) | ☐     |       |
| 2   | **Entity Name** → `UAT Test Vendor 01`. **Legal Name** → `UAT Test Vendor Private Limited`                                                                                                       | Both accept text; Legal Name says it can be left blank if the same                                                                                                                                                  | ☐     |       |
| 3   | Open **Entity Roles** and tick **VENDOR**                                                                                                                                                        | A **VENDOR** chip appears in the field, and a new **Vendor Categorization** section appears further down the form                                                                                                   | ☐     |       |
| 4   | Under **Contact Persons** click **Add Contact**. Fill Name, Designation, Email, Phone, Mobile, Notes. Click **Add Contact**                                                                      | The contact appears in a card with a **Primary** chip — the first contact is always the primary                                                                                                                     | ☐     |       |
| 5   | In **Address & Tax Information** fill Address Line 1, Address Line 2, City, **State** (from the dropdown), Postal Code, Country                                                                  | State is a fixed list of Indian states, not free text                                                                                                                                                               | ☐     |       |
| 6   | Enter a valid **PAN**, e.g. `AAACU9603R`                                                                                                                                                         | The field accepts it and shows no error                                                                                                                                                                             | ☐     |       |
| 7   | Enter a valid **GSTIN** for the same PAN, e.g. `29AAACU9603R1ZM`                                                                                                                                 | Accepted, no error                                                                                                                                                                                                  | ☐     |       |
| 8   | In **Shipping Address (Optional)** tick **Same as billing address**                                                                                                                              | The shipping fields disappear or fill themselves from billing                                                                                                                                                       | ☐     |       |
| 9   | Untick it and fill a **different** shipping address completely                                                                                                                                   | All six shipping fields accept values independently                                                                                                                                                                 | ☐     |       |
| 10  | Under **Bank Details (Optional)** click **Add Bank Account**. Fill Bank Name, Account Name, Account Number, IFSC Code, SWIFT Code, IBAN, Branch Name, Branch Address. Click **Add Bank Account** | The account appears as a card and the header now reads **Bank Details (1)**                                                                                                                                         | ☐     |       |
| 11  | Fill **Credit Days** = `45` and **Credit Limit (INR)** = `500000`                                                                                                                                | Helper text explains credit days are counted from the invoice date                                                                                                                                                  | ☐     |       |
| 12  | Fill **Opening Balance (INR)** = `50000` and set **Balance Type** to **Credit (CR)**                                                                                                             | The helper line reads "DR = They owe us (advance given) \| CR = We owe them (advance received)"                                                                                                                     | ☐     |       |
| 13  | In **Vendor Categorization** pick two **Vendor Categories**, one of them **Bought Out Items**                                                                                                    | A **Bought Out Sub-Category** field appears                                                                                                                                                                         | ☐     |       |
| 14  | Fill **Bought Out Sub-Category** = `Valves` and **Services Offered** = `Ball valves, Butterfly valves`                                                                                           | Both accept text                                                                                                                                                                                                    | ☐     |       |
| 15  | Click **Create Entity**                                                                                                                                                                          | The button shows **Creating...**, then the dialog closes and the new row appears at the top of the list                                                                                                             | ☐     |       |
| 16  | Read the new row                                                                                                                                                                                 | Name, a **VENDOR** chip, your primary contact's name, the billing state, `₹50,000.00 CR` in red, and a green **Active** chip                                                                                        | ☐     |       |
| 17  | Check the **Total Entities** and **Vendors** cards                                                                                                                                               | Both went up by one                                                                                                                                                                                                 | ☐     |       |

**Also check:**

- The **Vendor Categorization** section is present _only_ because you picked VENDOR. Untick VENDOR and it should vanish.
- The opening balance colour matches the type you chose — **CR** red, **DR** green.

**Should NOT be possible:**

- Creating an entity with no name — **Create Entity** must refuse it.
- Creating an entity with **no contact person at all** — at least one contact is required.
- Saving with a badly-formed PAN or GSTIN — the field must show an error and block the save.

---

## UAT-ENT-03 — Entity round-trip — nothing lost between save and reopen

> **This is the most valuable test in the entity section.** The form has roughly forty fields across seven sections, most of them optional. A field that is written on create but not read back on edit is the commonest defect in this app, and it is invisible until somebody notices their bank details vanished.

**Goal:** reopen the vendor you just created, confirm every single value survived, save again unchanged, and confirm it survived a second time.
**Who:** someone with **Create Entities**.
**Before you start:** requires **UAT Test Vendor 01** from UAT-ENT-02, with your written list of values in front of you.

| #   | Do this                                                                                                | You should see                                                                                                                         | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Find the row, open the actions menu at the end of it, choose **Edit Entity**                           | A dialog titled **Edit Entity**                                                                                                        | ☐     |       |
| 2   | **Basic Information** — check Entity Name, Legal Name, and that the **VENDOR** chip is in Entity Roles | All three exactly as typed                                                                                                             | ☐     |       |
| 3   | **Contact Persons** — check the contact's Name, Designation, Email, Phone, Mobile **and Notes**        | All six values present; the **Primary** chip is still on that contact                                                                  | ☐     |       |
| 4   | **Address & Tax Information** — check Address Line 1, Line 2, City, State, Postal Code, Country        | All six exactly as typed; **State** shows the state you picked, not blank                                                              | ☐     |       |
| 5   | Check **PAN** and **GSTIN**                                                                            | Both present and unchanged                                                                                                             | ☐     |       |
| 6   | **Shipping Address** — check all six fields                                                            | The _different_ shipping address you entered, not a copy of billing                                                                    | ☐     |       |
| 7   | **Bank Details** — check the header count, then all eight fields on the account                        | Header reads **Bank Details (1)**; Bank Name, Account Name, Account Number, IFSC, SWIFT, IBAN, Branch Name, Branch Address all present | ☐     |       |
| 8   | **Credit Terms & Opening Balance** — check Credit Days, Credit Limit, Opening Balance and Balance Type | `45`, `500000`, `50000`, and **Credit (CR)** still selected                                                                            | ☐     |       |
| 9   | **Vendor Categorization** — check both Vendor Categories, Services Offered and Bought Out Sub-Category | All present; the sub-category field is still shown because Bought Out Items is still selected                                          | ☐     |       |
| 10  | **Without changing a single thing**, click **Update Entity**                                           | Saves cleanly and the dialog closes                                                                                                    | ☐     |       |
| 11  | Reopen **Edit Entity**                                                                                 | **Every value is still there, unchanged.** Go through steps 2–9 a second time against your notes                                       | ☐     |       |
| 12  | Change exactly one value — say Credit Days to `60` — and click **Update Entity**                       | Only that one value changed; everything else is untouched when you reopen                                                              | ☐     |       |
| 13  | Reopen, add a **second** bank account with all eight fields, save, reopen                              | **Bank Details (2)** and both accounts complete                                                                                        | ☐     |       |
| 14  | Reopen, clear an optional field completely — say **Branch Address** on the second account — and save   | Report what happens: does the field come back blank, or does the old value return?                                                     | ☐     |       |
| 15  | Reload the whole page, then open **Edit Entity** once more                                             | Still everything, after a full page refresh                                                                                            | ☐     |       |

**Also check:**

- The Entity Roles field is a **multi-select** — adding CUSTOMER alongside VENDOR and saving must not drop VENDOR.
- Numbers come back as numbers, not as text with stray spaces.

**Should NOT be possible:**

- Editing an entity that has been archived — the **Edit Entity** action must not be offered at all until it is restored.

---

## UAT-ENT-04 — Contacts — add, edit, delete, and the primary-contact rule

**Goal:** confirm the contact list inside the entity form behaves, including the rule that exactly one contact is primary.
**Who:** someone with **Create Entities**.
**Before you start:** requires **UAT Test Vendor 01**, currently with one contact.

| #   | Do this                                                                       | You should see                                                                            | Pass? | Notes |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open **Edit Entity** on the vendor and find **Contact Persons**               | Header reads **Contact Persons (1)**; the one contact carries a **Primary** chip          | ☐     |       |
| 2   | Click **Add Contact**, fill Name only, click **Add Contact**                  | A second card appears with **no** Primary chip; header now **(2)**                        | ☐     |       |
| 3   | Try to add a contact with the Name box empty                                  | The **Add Contact** confirm button stays disabled — name is required                      | ☐     |       |
| 4   | Click the star icon on the second contact                                     | The **Primary** chip moves to it; the first contact loses it. Only ever one primary       | ☐     |       |
| 5   | Hover the star on the contact that _is_ primary                               | It is disabled — you cannot un-primary without promoting someone else                     | ☐     |       |
| 6   | Click the pencil on the first contact, change the Designation, click **Save** | The card updates in place; nothing else on it changed                                     | ☐     |       |
| 7   | Click the pencil, then **Cancel**                                             | The edit is abandoned and the original values are still shown                             | ☐     |       |
| 8   | Add a third contact with every field filled                                   | Header reads **(3)**                                                                      | ☐     |       |
| 9   | Delete the contact that is currently **Primary** (trash icon)                 | It disappears, and one of the remaining contacts is automatically promoted to **Primary** | ☐     |       |
| 10  | Click **Update Entity**, then reopen **Edit Entity**                          | The exact set of contacts, with the same primary, and every field on each contact intact  | ☐     |       |
| 11  | Delete contacts down to one, save, reopen                                     | One contact, and it is the primary                                                        | ☐     |       |

**Also check:**

- The entity row in the list shows the **primary** contact's name in the **Contact Person** column. Change which contact is primary, save, and the list column should follow.

---

## UAT-ENT-05 — Bank accounts — add several, edit, delete

**Goal:** confirm multiple bank accounts can be held against one entity and survive a save.
**Who:** someone with **Create Entities**.
**Before you start:** requires **UAT Test Vendor 01**.

| #   | Do this                                                                                          | You should see                                                                                  | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open **Edit Entity** and find **Bank Details**                                                   | Header shows the count in brackets                                                              | ☐     |       |
| 2   | Click **Add Bank Account** and fill only Bank Name                                               | The confirm button stays disabled — Bank Name, Account Name and Account Number are all required | ☐     |       |
| 3   | Fill Account Name and Account Number too, then click **Add Bank Account**                        | The card appears; the count goes up                                                             | ☐     |       |
| 4   | Add a third account, this time an **international** one — SWIFT Code and IBAN filled, IFSC blank | Accepted; IFSC is optional                                                                      | ☐     |       |
| 5   | Click the pencil on one account, change the Branch Name, click **Save**                          | Updated in place                                                                                | ☐     |       |
| 6   | Click the pencil, then **Cancel**                                                                | Original values still shown                                                                     | ☐     |       |
| 7   | Delete the middle account (trash icon)                                                           | It goes; the other two are untouched and the count drops                                        | ☐     |       |
| 8   | Click **Update Entity**, reopen **Edit Entity**                                                  | Exactly the accounts you left, each with all eight fields intact                                | ☐     |       |

**Also check:**

- Bank accounts have **no primary flag** — unlike contacts, none is marked. If you see a Primary chip on a bank account, that is new and worth reporting.

---

## UAT-ENT-06 — Create a customer, and an entity that is both vendor and customer

**Goal:** confirm the customer path works and that a dual-role entity behaves in the list and in both modules.
**Who:** someone with **Create Entities**.
**Before you start:** nothing.

| #   | Do this                                                                                        | You should see                                                              | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----- | ----- |
| 1   | **New Entity** → Name `UAT Test Customer 01`, Entity Roles → **CUSTOMER** only                 | A **CUSTOMER** chip; the **Vendor Categorization** section is **not** shown | ☐     |       |
| 2   | Add one contact, a billing state, a GSTIN, and an opening balance of `25000` **Debit (DR)**    | All accepted                                                                | ☐     |       |
| 3   | Click **Create Entity**                                                                        | The row appears with a green **CUSTOMER** chip and `₹25,000.00 DR` in green | ☐     |       |
| 4   | Check the **Customers** card at the top                                                        | It went up by one; the **Vendors** card did not                             | ☐     |       |
| 5   | **New Entity** → Name `UAT Test Both 01`, tick **VENDOR** _and_ **CUSTOMER**                   | Two chips in the field; the Vendor Categorization section appears           | ☐     |       |
| 6   | Fill a contact and create it                                                                   | The row shows both a **VENDOR** and a **CUSTOMER** chip                     | ☐     |       |
| 7   | Filter **Role** → **Vendor**                                                                   | `UAT Test Both 01` is listed                                                | ☐     |       |
| 8   | Filter **Role** → **Customer**                                                                 | `UAT Test Both 01` is listed here too                                       | ☐     |       |
| 9   | Both the **Vendors** and **Customers** cards                                                   | Both counted this one entity                                                | ☐     |       |
| 10  | Go to a place that picks a vendor (raising a purchase order) and search for `UAT Test Both 01` | It is offered                                                               | ☐     |       |
| 11  | Go to a place that picks a customer (raising a customer invoice) and search for the same name  | It is offered there too                                                     | ☐     |       |
| 12  | In the same customer picker, search for `UAT Test Vendor 01`                                   | It is **not** offered — a vendor-only entity must not appear as a customer  | ☐     |       |
| 13  | Add **PARTNER** to `UAT Test Both 01` and save                                                 | Three chips; the Role filter **Partner** now finds it                       | ☐     |       |

---

## UAT-ENT-07 — Duplicate and format guards on create

**Goal:** confirm the app refuses to create a second copy of an entity you already have, and refuses malformed tax IDs.
**Who:** someone with **Create Entities**.
**Before you start:** requires **UAT Test Vendor 01** with its PAN, GSTIN and contact email.

| #   | Do this                                                                                                 | You should see                                                                                                         | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **New Entity** → PAN box → type `ABCD`                                                                  | An error under the field immediately; **Create Entity** is blocked                                                     | ☐     |       |
| 2   | Type a well-formed but wrong-checksum PAN, e.g. `AAAAA1111A`                                            | Record what happens — accepted or rejected — in the Notes column                                                       | ☐     |       |
| 3   | GSTIN box → type `29AAACU`                                                                              | An error under the field; save blocked                                                                                 | ☐     |       |
| 4   | Now fill a fresh name, one contact, and the **same PAN** as UAT Test Vendor 01. Click **Create Entity** | The create is refused with a message naming the duplicate PAN                                                          | ☐     |       |
| 5   | Change the PAN, but use the **same GSTIN** as UAT Test Vendor 01                                        | Refused, naming the duplicate GSTIN                                                                                    | ☐     |       |
| 6   | Change the GSTIN, but give the contact the **same email** as UAT Test Vendor 01's contact               | Refused, naming the duplicate email                                                                                    | ☐     |       |
| 7   | Clear PAN, GSTIN and email. Set the name to exactly `UAT Test Vendor 01` and click **Create Entity**    | ⚠ Refused — but only **after** you click, not while typing. The live check does not look at the name. Do not file this | ☐     |       |
| 8   | Set the name to `uat test vendor 01` (all lower case) and click **Create Entity**                       | Still refused — name matching ignores capitalisation                                                                   | ☐     |       |
| 9   | Set the name to `  UAT Test Vendor 01  ` with leading and trailing spaces                               | Still refused — spaces are trimmed before comparing                                                                    | ☐     |       |
| 10  | Give it a genuinely new name and click **Create Entity**                                                | Created                                                                                                                | ☐     |       |

**Should NOT be possible:**

- Ending up with two entities that share a name, a PAN or a GSTIN. If you manage it, that is a serious finding — record exactly what you typed.

---

## UAT-ENT-08 — View Details — everything you saved is shown back

**Goal:** confirm the read-only view of an entity shows every section, so a colleague can check a vendor's details without opening the edit form.
**Who:** anyone with **View Entities**.
**Before you start:** requires **UAT Test Vendor 01**, fully filled in.

| #   | Do this                                                                 | You should see                                                                                                                                                      | Pass? | Notes |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the row's actions menu, choose **View Details**                    | A dialog headed with the entity name, a **Code:** line beneath it, and a green **Active** chip                                                                      | ☐     |       |
| 2   | Read the code                                                           | It looks like `ENT-001` — a three-digit sequence, not a random string                                                                                               | ☐     |       |
| 3   | Scroll through the dialog                                               | Sections: Basic Information, Contacts, Billing Address, Tax Information, Shipping Address, Bank Details, Credit Terms, Financial Information, Vendor Categorization | ☐     |       |
| 4   | Check **Contacts** against your notes                                   | The right count in the heading, the primary marked, and every contact's details shown                                                                               | ☐     |       |
| 5   | Check **Bank Details**                                                  | The right count in the heading, and each account's full details                                                                                                     | ☐     |       |
| 6   | Check **Tax Information**                                               | Your PAN and GSTIN                                                                                                                                                  | ☐     |       |
| 7   | Check **Financial Information**                                         | The opening balance with the **CR** marker, matching the list row                                                                                                   | ☐     |       |
| 8   | Check **Vendor Categorization**                                         | Both categories, the services text and the bought-out sub-category                                                                                                  | ☐     |       |
| 9   | Click the pencil icon in the dialog header                              | The **Edit Entity** dialog opens on the same entity                                                                                                                 | ☐     |       |
| 10  | Close it, reopen **View Details**, click the archive icon in the header | The **Archive Entity** dialog opens — do not confirm it yet, cancel out                                                                                             | ☐     |       |
| 11  | Click **Close**                                                         | Back to the list, nothing changed                                                                                                                                   | ☐     |       |

---

## UAT-ENT-09 — Archive an entity, then restore it

**Goal:** confirm an entity can be taken out of circulation without deleting it, and brought back.
**Who:** someone with **Create Entities**.
**Before you start:** requires `UAT Test Customer 01` from UAT-ENT-06. Use the customer, not the vendor — you need the vendor active for later tests.

> Archiving is reversible, but an archived entity cannot be edited and drops out of the pickers other modules use. Do not archive a real vendor to test this.

| #   | Do this                                                                                     | You should see                                                                                                              | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the row's actions menu on `UAT Test Customer 01`                                       | **Archive Entity** is offered; **Unarchive Entity** is not                                                                  | ☐     |       |
| 2   | Choose **Archive Entity**                                                                   | A dialog titled **Archive Entity** naming the entity, explaining archived entities can be unarchived later                  | ☐     |       |
| 3   | Try to click **Archive Entity** with the reason box empty                                   | The button is disabled — a reason is required                                                                               | ☐     |       |
| 4   | Type a reason, e.g. `UAT test — archiving to check the flow`, then click **Archive Entity** | The dialog closes; the row's status chip turns orange **Archived**                                                          | ☐     |       |
| 5   | Check the **Active** and **Archived** cards                                                 | Active dropped by one, Archived went up by one                                                                              | ☐     |       |
| 6   | Set **Status** to **Active**                                                                | The archived entity is gone from the list                                                                                   | ☐     |       |
| 7   | Set **Status** to **Archived**, open the row's actions menu                                 | **Edit Entity** and **Archive Entity** are **not** offered; **Unarchive Entity** is                                         | ☐     |       |
| 8   | Choose **View Details**                                                                     | The dialog opens with an orange warning banner about the entity being archived, and no pencil or archive icon in the header | ☐     |       |
| 9   | Go to a place that picks a customer (raising a customer invoice) and search for the name    | It is not offered                                                                                                           | ☐     |       |
| 10  | Back on the list, choose **Unarchive Entity**                                               | A dialog titled **Unarchive Entity** showing your **Archive Reason**, who archived it and when                              | ☐     |       |
| 11  | Click **Restore Entity**                                                                    | The status chip turns green **Active** again                                                                                | ☐     |       |
| 12  | Open **Edit Entity**                                                                        | Editing works again, and **every field is exactly as it was before archiving**                                              | ☐     |       |
| 13  | Search for it again in the customer picker                                                  | It is offered once more                                                                                                     | ☐     |       |
| 14  | Archive an entity that has purchase orders or invoices against it                           | Record whether the dialog shows an extra warning about existing references before you confirm                               | ☐     |       |

**Should NOT be possible:**

- Editing an entity while it is archived.
- Archiving an already-archived entity, or restoring one that is already active — the menu must only offer the one that applies.

---

## UAT-ENT-10 — Entity ledger — opening balance, transactions, running balance, ageing

**Goal:** confirm the ledger reached from an entity row shows the full money history for that counterparty and that the balances add up.
**Who:** someone with **View Entities** _and_ **View Accounting**.
**Before you start:** pick an entity that already has an opening balance **and** at least three posted transactions — ideally a customer with an invoice and a part payment.

| #   | Do this                                                                                                   | You should see                                                                                                          | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On that entity's row, open the actions menu and choose **View Ledger**                                    | The **Entity Ledger** page opens with the entity already selected in the **Select Entity** box                          | ☐     |       |
| 2   | Read the card at the top                                                                                  | The entity name, its role chips, and an **Opening:** chip showing the opening balance with **DR** or **CR**             | ☐     |       |
| 3   | Compare that Opening chip with the Opening Balance you saw on the entity list row                         | Same number, same DR/CR marker                                                                                          | ☐     |       |
| 4   | Read the summary cards                                                                                    | For a customer: **Total Invoiced** and **Total Received**. For a vendor: **Total Billed** and **Total Paid**            | ☐     |       |
| 5   | Read the transactions table columns                                                                       | Date, Type, Transaction #, Description, Debit, Credit, Balance, Status                                                  | ☐     |       |
| 6   | Look at the very first row                                                                                | An **Opening Balance (from prior transactions)** row before any real transaction                                        | ☐     |       |
| 7   | Work down the **Balance** column with a calculator                                                        | Each row's balance = the row above, plus that row's Debit, minus its Credit. It must run continuously, with no jumps    | ☐     |       |
| 8   | Check the last row's Balance against the summary cards                                                    | Consistent — no unexplained difference                                                                                  | ☐     |       |
| 9   | Set **From Date** and **To Date** to a window that excludes the oldest transaction                        | The table narrows; the opening figure absorbs everything before the window rather than the balance restarting from zero | ☐     |       |
| 10  | Clear the dates. Set **Transaction Type** to a single type                                                | Only that type of row remains                                                                                           | ☐     |       |
| 11  | Clear the type filter. Scroll to the ageing section                                                       | **Receivables Aging Analysis** with buckets **Current (0-30 days)**, **31-60 days** and older, colour-graded            | ☐     |       |
| 12  | Add up the ageing buckets                                                                                 | They equal the outstanding amount, not the total invoiced                                                               | ☐     |       |
| 13  | Now go and post a new transaction against this entity in Accounting, then come back and reload the ledger | The new row appears, and the running balance and the summary cards have both moved by the right amount                  | ☐     |       |
| 14  | Click the **Export CSV** icon at the top right                                                            | A file downloads; open it and confirm the same rows and the same numbers                                                | ☐     |       |
| 15  | Click the **Export Excel** icon                                                                           | A file downloads and opens cleanly                                                                                      | ☐     |       |
| 16  | Use the **Select Entity** box to switch to a different entity                                             | The whole page reloads for the new entity — card, summary, table and ageing all change together                         | ☐     |       |

**Also check:**

- Every amount is in rupees with two decimals. If this entity has transactions in a foreign currency, confirm the ledger totals are still consistent and record what currency the totals are stated in.
- A transaction that has been voided or deleted must **not** appear in the ledger or in the totals.

**Should NOT be possible:**

- Reaching **View Ledger** at all without **View Accounting** — the menu item must simply not be there.

---

## UAT-ENT-11 — Automatic behaviour — entity codes and the vendor-rename ripple

**Goal:** confirm the app numbers entities itself, and that renaming a vendor updates the name shown on documents that already reference it.
**Who:** someone with **Create Entities** who can also open Procurement.
**Before you start:** requires a vendor that has **at least one purchase order** raised against it. Note the PO number.

| #   | Do this                                                                                       | You should see                                                                                                      | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Create three entities one after another and open **View Details** on each                     | The **Code:** values run in sequence — `ENT-004`, `ENT-005`, `ENT-006` — with no gaps and no repeats                | ☐     |       |
| 2   | Have a colleague create one at the same moment as you, if you can arrange it                  | Both get codes, and they are different                                                                              | ☐     |       |
| 3   | Open the purchase order you noted and write down the vendor name printed on it                | The current vendor name                                                                                             | ☐     |       |
| 4   | Go to Entity Management, open **Edit Entity** on that vendor and change its **Entity Name**   | Saves cleanly                                                                                                       | ☐     |       |
| 5   | Wait about ten seconds, then reload the purchase order page                                   | The vendor name on the PO has updated on its own to the new name                                                    | ☐     |       |
| 6   | Check a goods receipt, a packing list and a vendor bill against the same vendor, if any exist | All show the new name after a reload                                                                                | ☐     |       |
| 7   | Open the entity ledger for that vendor                                                        | The transaction rows show the new name                                                                              | ☐     |       |
| 8   | Now change the vendor's **contact email** and reload the purchase order                       | The vendor email on the PO updates too                                                                              | ☐     |       |
| 9   | Now change the vendor's **GSTIN** and reload the purchase order                               | ⚠ known issue — the GSTIN on the PO does **not** change. Name and email propagate; GSTIN does not. Do not file this | ☐     |       |
| 10  | Change the vendor name back to what it was                                                    | The documents follow it back                                                                                        | ☐     |       |

**Also check:**

- If somebody had deliberately typed a _different_ vendor name onto a document by hand, the rename must **not** overwrite it. Only names that still matched the old value are updated.
- The rename happens by itself — there is no button to press and no message to confirm it. If nothing has changed after a minute and a reload, that is the finding.

---

## UAT-ENT-12 — Permission checks on the entity master

**Goal:** confirm that a user who may only look at entities cannot change them, and that a user with no entity permission cannot reach the module at all.
**Who:** you, plus a second sign-in with **View Entities** but **not** Create Entities.
**Before you start:** ask an admin to set up the limited account, and have that person sign out and back in after the change.

| #   | Do this                                                                            | You should see                                                                                                                              | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | As the **limited user**, go to **SETUP → Entity Management**                       | The list opens normally                                                                                                                     | ☐     |       |
| 2   | Look at the top right of the page                                                  | There is **no New Entity button at all** — not greyed out, absent                                                                           | ☐     |       |
| 3   | Open a row's actions menu                                                          | **View Details** is offered; **Edit Entity**, **Archive Entity** and **Unarchive Entity** are not                                           | ☐     |       |
| 4   | Open **View Details**                                                              | The dialog opens, but the header has no pencil and no archive icon                                                                          | ☐     |       |
| 5   | If this account also lacks **View Accounting**, check the actions menu again       | **View Ledger** is not offered either                                                                                                       | ☐     |       |
| 6   | Now have an admin remove **View Entities** from that account; sign out and back in |                                                                                                                                             | ☐     |       |
| 7   | Go to **SETUP → Entity Management** again                                          | Either the sidebar entry is gone, or the page shows **Access Denied** — "You do not have permission to access the Entity Management module" | ☐     |       |
| 8   | Restore the account's permissions afterwards                                       |                                                                                                                                             | ☐     |       |

**Should NOT be possible:**

- A user without **Create Entities** managing to save any change to an entity by any route — including editing from inside the View Details dialog.
- Reaching the entity list by typing the address directly when the permission is missing.

---

# Part 2 — Process Data (SSOT)

## UAT-SSOT-01 — Open Process Data and choose a project

**Goal:** confirm the module opens, the project picker works, and all six tabs load.
**Who:** anyone with **View Thermal Desalination**.
**Before you start:** you must be assigned to at least one project.

| #   | Do this                                                       | You should see                                                                                                      | Pass? | Notes |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar → **ENGINEERING DATA → Process Data (SSOT)**          | A page titled **Process Data (SSOT)**, subtitle "Single Source of Truth for process engineering data"               | ☐     |       |
| 2   | Look at the **Select Project** dropdown                       | It has already picked a project for you                                                                             | ☐     |       |
| 3   | Open the dropdown                                             | Only projects you are allowed to see are listed                                                                     | ☐     |       |
| 4   | Read the tab strip                                            | **Streams**, **Equipment**, **Lines**, **Instruments**, **Valves**, **Pipe Table**                                  | ☐     |       |
| 5   | Click through all six tabs on a project that already has data | Each shows a table with an **Add** button above it, and no error banner                                             | ☐     |       |
| 6   | Click through all six tabs on an **empty** project            | Each shows an empty table rather than an error or a permanent spinner                                               | ☐     |       |
| 7   | Switch to a different project in **Select Project**           | The tab you are on reloads with that project's data — data does not leak between projects                           | ☐     |       |
| 8   | Reload the page                                               | You land back on the **Streams** tab with the first project selected                                                | ☐     |       |
| 9   | Click **Export Excel**                                        | ⚠ known issue — a message reading "Excel export coming soon" and no file. Nothing is exported yet. Do not file this | ☐     |       |

---

## UAT-SSOT-02 — Streams — create, derived values, round-trip, delete

> A stream is the canonical record of a fluid. Everything else in Process Data points back at one, so get this one right first.

**Goal:** create a stream with every field, check the calculated properties are sensible, reopen it and confirm nothing was lost, then delete it.
**Who:** someone with **Manage Process Data (SSOT)**, assigned to the test project.
**Before you start:** pick a project you can safely add test data to. **Write down every value you type.**

| #   | Do this                                                                                                             | You should see                                                                                                                            | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **Streams** tab → **Add Stream**                                                                                    | A dialog titled **Add New Stream**                                                                                                        | ☐     |       |
| 2   | Read the table columns behind it                                                                                    | Line Tag, Fluid Type, Flow (kg/s), Flow (kg/hr), Pressure (mbar), Temp (°C), Density (kg/m³), TDS (ppm), Enthalpy (kJ/kg), Actions        | ☐     |       |
| 3   | **Line Tag** → `SW1`                                                                                                | **Fluid Type** changes by itself to **SEA WATER** — the tag prefix decides the fluid                                                      | ☐     |       |
| 4   | Change the tag to `D19`, then `S13`, then back to `SW1`                                                             | Fluid Type follows: **DISTILLATE WATER**, then **STEAM**, then **SEA WATER**                                                              | ☐     |       |
| 5   | **Description** → `UAT test seawater feed to condenser`                                                             | Accepts multi-line text                                                                                                                   | ☐     |       |
| 6   | **Flow Rate** → `27.8` (unit shown: **kg/s**), **Pressure** → `1013` (**mbar(a)**), **Temperature** → `30` (**°C**) | All three accept the value with the unit shown beside the box                                                                             | ☐     |       |
| 7   | **TDS** → `35000` (**ppm**)                                                                                         | Required for seawater — the helper text says so                                                                                           | ☐     |       |
| 8   | Read the **Calculated Values (auto-updated)** strip at the bottom of the dialog                                     | **Flow Rate** ≈ `100080.0 kg/hr`, **Pressure** ≈ `1.013 bar(a)`, **Density** around `1020–1025 kg/m³`, an **Enthalpy** in kJ/kg           | ☐     |       |
| 9   | Sanity-check those four                                                                                             | 27.8 kg/s × 3600 = 100 080 kg/hr exactly; 1013 mbar = 1.013 bar; seawater at 30 °C and 35 000 ppm is about 1022 kg/m³                     | ☐     |       |
| 10  | Change **Temperature** to `80` and watch the strip                                                                  | Density falls, enthalpy rises — both move the right way                                                                                   | ☐     |       |
| 11  | Set Temperature back to `30`. Click **Create**                                                                      | The dialog closes and the row appears in the table with the same numbers                                                                  | ☐     |       |
| 12  | Compare the table row against the dialog values                                                                     | Flow, pressure, temperature, density, TDS and enthalpy all match, each to its stated unit                                                 | ☐     |       |
| 13  | **Round trip:** click the pencil on the row                                                                         | A dialog titled **Edit Stream: SW1**; **every** field — tag, description, flow, pressure, temperature, TDS, fluid type — exactly as typed | ☐     |       |
| 14  | Without changing anything, click **Update**, then reopen the pencil                                                 | Everything still there, unchanged, including the description                                                                              | ☐     |       |
| 15  | Change **Temperature** to `45` and click **Update**                                                                 | The row's Temp column shows 45, and **Density and Enthalpy have both recalculated** — they must not be stale                              | ☐     |       |
| 16  | Change only the **Description** and click **Update**                                                                | The description changes; density, enthalpy and flow-in-kg/hr are **unchanged**                                                            | ☐     |       |
| 17  | Add a second stream, `NCG1`, and a third, `B4`                                                                      | Fluid types come out as **NCG** and **BRINE WATER**                                                                                       | ☐     |       |
| 18  | On the `D19` distillate stream, look at the **TDS** field                                                           | It is disabled and marked not applicable for that fluid                                                                                   | ☐     |       |
| 19  | Click the trash icon on one of the test streams                                                                     | A confirmation reading "Are you sure you want to delete stream ...? This action cannot be undone." with a **Delete** button               | ☐     |       |
| 20  | Click **Delete**                                                                                                    | The row disappears immediately                                                                                                            | ☐     |       |
| 21  | Reload the page and check the Streams tab                                                                           | The remaining streams are still there with all their values                                                                               | ☐     |       |

**Also check:**

- The pressure is in **mbar absolute** on the way in and **bar absolute** in the calculated strip. A value shown in the wrong one of those is a real defect, not a rounding difference.
- Flow in kg/hr must always be exactly 3600 × the kg/s value.

**Should NOT be possible:**

- Saving a stream with no Line Tag — the dialog must say **Line Tag is required**.
- Saving with a Flow Rate or Pressure of zero — the dialog must say the value must be greater than 0.
- Saving a seawater or brine stream with the TDS blank.

---

## UAT-SSOT-03 — Equipment — create, round-trip, delete, and the stream wiring

**Goal:** create an equipment item, wire it to streams by tag, and confirm the round trip.
**Who:** someone with **Manage Process Data (SSOT)**, assigned to the project.
**Before you start:** requires at least two streams from UAT-SSOT-02, e.g. `SW1` and `D19`.

| #   | Do this                                                                                 | You should see                                                                                                        | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **Equipment** tab → **Add Equipment**                                                   | A dialog titled **Add Equipment**                                                                                     | ☐     |       |
| 2   | Read the table columns behind it                                                        | Equipment Tag, Equipment Name, Operating Pressure (mbar), Operating Temp (°C), Inlet Streams, Outlet Streams, Actions | ☐     |       |
| 3   | **Equipment Tag** → `MED-E1`, **Equipment Name** → `MED Effect 1 Evaporator`            | Both accept text                                                                                                      | ☐     |       |
| 4   | **Operating Pressure** → `250` (**mbar(a)**), **Operating Temperature** → `65` (**°C**) | Units shown beside each box                                                                                           | ☐     |       |
| 5   | **Inlet Streams** → `SW1` and **Outlet Streams** → `D19`                                | Helper text says comma-separated stream tags                                                                          | ☐     |       |
| 6   | Click **Create**                                                                        | The row appears with your tags listed in the Inlet and Outlet columns                                                 | ☐     |       |
| 7   | **Round trip:** click the pencil                                                        | **Edit Equipment** with all six values exactly as typed — including both stream-tag lists                             | ☐     |       |
| 8   | Without changing anything, click **Update**, reopen the pencil                          | Everything unchanged                                                                                                  | ☐     |       |
| 9   | Add a second inlet stream tag alongside the first, comma-separated, and **Update**      | Both tags appear in the Inlet Streams column and both come back on reopening                                          | ☐     |       |
| 10  | Type a stream tag that does not exist, e.g. `ZZ99`, and **Update**                      | Record what happens. There is no check that the tag is real — this is expected today, note it and move on             | ☐     |       |
| 11  | Add a second piece of equipment, `LTFV`, with different values                          | Both rows listed                                                                                                      | ☐     |       |
| 12  | Delete the second one (trash icon → confirm **Delete**)                                 | Confirmation titled **Delete Equipment**, then the row goes                                                           | ☐     |       |
| 13  | Reload the page                                                                         | `MED-E1` is still there with everything intact                                                                        | ☐     |       |

**Should NOT be possible:**

- Saving with no Equipment Tag.

---

## UAT-SSOT-04 — Pipe Table — load the standard table, add, edit, delete a size

**Goal:** get the standard pipe size lookup in place for this project, so line sizing has something to work against.
**Who:** someone with **Manage Process Data (SSOT)**, assigned to the project.
**Before you start:** ideally a project whose Pipe Table is still empty. **Run this before UAT-SSOT-05.**

| #   | Do this                                                                                            | You should see                                                                                                                               | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **Pipe Table** tab                                                                                 | The line "Pipe sizing lookup table (ASME B36.10 Schedule 40)" and, on an empty project, a **Load Default Table** button next to **Add Size** | ☐     |       |
| 2   | Read the table columns                                                                             | ID Range Min (mm), ID Range Max (mm), Pipe Size (NB), OD (mm), Thickness Sch40 (mm), ID (mm), Actions                                        | ☐     |       |
| 3   | Click **Load Default Table**                                                                       | A confirmation saying it will add **19 standard pipe sizes** based on ASME B36.10 Schedule 40                                                | ☐     |       |
| 4   | Click **Load**                                                                                     | 19 rows appear, in ascending size order                                                                                                      | ☐     |       |
| 5   | Check a row you know — e.g. 100 NB                                                                 | OD `114.3` mm, Sch 40 thickness `6.02` mm, and ID = OD − 2 × thickness = `102.26` mm                                                         | ☐     |       |
| 6   | Check the **ID (mm)** column on three more rows with a calculator                                  | Every one equals OD − 2 × thickness. This column is computed, not typed                                                                      | ☐     |       |
| 7   | Check the **Load Default Table** button                                                            | It has disappeared now that the table has rows — it only offers itself on an empty table                                                     | ☐     |       |
| 8   | Click **Add Size**. Fill ID Range Min, ID Range Max, Pipe Size NB, Outer Diameter, Thickness Sch40 | A dialog titled **Add Pipe Size**                                                                                                            | ☐     |       |
| 9   | Click **Create**                                                                                   | The row appears with the ID column filled in for you                                                                                         | ☐     |       |
| 10  | **Round trip:** click the pencil on your new row                                                   | **Edit Pipe Size** with all five typed values exactly as entered                                                                             | ☐     |       |
| 11  | Change the Thickness and click **Update**                                                          | The **ID (mm)** column recalculates on its own                                                                                               | ☐     |       |
| 12  | Delete your added row (trash → **Delete**)                                                         | Confirmation titled **Delete Pipe Size**, then the row goes; the 19 standard rows are untouched                                              | ☐     |       |

---

## UAT-SSOT-05 — Lines — automatic pipe sizing, round-trip, recalculation, delete

> This is the one place in Process Data where the app does real engineering for you. Check the arithmetic, not just that the boxes fill in.

**Goal:** create a line that draws its flow from a stream, confirm the calculated bore and actual velocity are right, and confirm the round trip.
**Who:** someone with **Manage Process Data (SSOT)**, assigned to the project.
**Before you start:** requires stream `SW1` from UAT-SSOT-02 and the pipe table from UAT-SSOT-04.

| #   | Do this                                                                                                             | You should see                                                                                                                                        | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **Lines** tab → **Add Line**                                                                                        | A dialog titled **Add Line**                                                                                                                          | ☐     |       |
| 2   | Read the table columns behind it                                                                                    | S.No, Line No., Fluid, Input Tag, Flow (kg/s), Density (kg/m³), Calc. Velocity (m/s), Calc. ID (mm), Selected ID (mm), Actual Velocity (m/s), Actions | ☐     |       |
| 3   | **S.No** → `1`, **Line Number** → `200-40-SS-SW-01`, **Input Data Tag** → `SW1`, **Fluid** → `Sea water`            | All four accept text                                                                                                                                  | ☐     |       |
| 4   | Open the **Streams** tab in another browser tab and read `SW1`'s flow and density                                   | Note them — you are about to copy them across by hand. The line does **not** fetch them for you                                                       | ☐     |       |
| 5   | **Flow Rate** → the stream's kg/s value, **Density** → the stream's kg/m³ value                                     | Units **kg/s** and **kg/m³** shown beside the boxes                                                                                                   | ☐     |       |
| 6   | Under **Pipe Sizing**, **Design Velocity** → `2.0` (**m/s**)                                                        | The read-only **Calculated ID** box beside it fills in with a value in mm                                                                             | ☐     |       |
| 7   | Sanity-check the Calculated ID                                                                                      | For 27.8 kg/s at 1022 kg/m³ and 2 m/s, the required bore is about **133 mm**. Anything an order of magnitude away is a defect                         | ☐     |       |
| 8   | Halve the Design Velocity to `1.0` and watch the Calculated ID                                                      | It grows by about 40 % (√2), not by 2× — slower water needs a bigger, but not double, bore                                                            | ☐     |       |
| 9   | Set Design Velocity back to `2.0`. Look up the next standard size **above** the Calculated ID in the Pipe Table tab | e.g. 150 NB, ID `154.05` mm                                                                                                                           | ☐     |       |
| 10  | Type that ID into **Selected ID** (**mm**)                                                                          | The read-only **Actual Velocity** box fills in                                                                                                        | ☐     |       |
| 11  | Sanity-check the Actual Velocity                                                                                    | It must be **lower** than your design velocity, because you rounded the bore up. Roughly 1.5 m/s here                                                 | ☐     |       |
| 12  | Type a deliberately small Selected ID, e.g. `50`                                                                    | Actual Velocity jumps well above the design velocity — the tool does not silently clamp it                                                            | ☐     |       |
| 13  | Set Selected ID back to the sensible value and click **Create**                                                     | The row appears with Calc. ID, Selected ID and Actual Velocity all populated                                                                          | ☐     |       |
| 14  | **Round trip:** click the pencil                                                                                    | **Edit Line** with S.No, Line Number, Input Data Tag, Fluid, Flow Rate, Density, Design Velocity and Selected ID **all exactly as typed**             | ☐     |       |
| 15  | Without changing anything, click **Update**, reopen                                                                 | Everything unchanged, including the calculated columns                                                                                                | ☐     |       |
| 16  | Change **Flow Rate** only, and **Update**                                                                           | Calc. ID **and** Actual Velocity both move; they must not be left stale                                                                               | ☐     |       |
| 17  | Change **Selected ID** only, and **Update**                                                                         | Actual Velocity moves; Calc. ID does not                                                                                                              | ☐     |       |
| 18  | Change the **Fluid** text only, and **Update**                                                                      | None of the calculated columns change                                                                                                                 | ☐     |       |
| 19  | Add a second line drawing from a different stream                                                                   | Both rows listed, sorted sensibly                                                                                                                     | ☐     |       |
| 20  | Delete the second line (trash → **Delete**)                                                                         | Confirmation titled **Delete Line**, then the row goes                                                                                                | ☐     |       |
| 21  | Reload the page                                                                                                     | The first line survives with every value                                                                                                              | ☐     |       |

**Also check:**

- Update the **stream** `SW1` to a different flow rate. The line does **not** follow it — you must edit the line too. That is how it works today; confirm it, and note in the Notes column whether that surprised you.

**Should NOT be possible:**

- Saving a line with no Line Number — the tab must show **Line number is required**.

---

## UAT-SSOT-06 — Instruments — create, round-trip, delete

**Goal:** create an instrument datasheet row, confirm it links to a line and a valve by tag, and confirm the round trip.
**Who:** someone with **Manage Process Data (SSOT)**, assigned to the project.
**Before you start:** requires the line from UAT-SSOT-05. **Write down every value.**

| #   | Do this                                                                                                                                                       | You should see                                                                                                                                                               | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **Instruments** tab → **Add Instrument**                                                                                                                      | A dialog titled **Add Instrument**                                                                                                                                           | ☐     |       |
| 2   | Read the table columns behind it                                                                                                                              | S.No, Tag No., Type, Line No., Service Location, Fluid, Pressure (mbar), Temp (°C), Flow (kg/hr), Actions                                                                    | ☐     |       |
| 3   | Fill **S.No** `1` and **Tag No.** `PIT-101`                                                                                                                   | Both accept                                                                                                                                                                  | ☐     |       |
| 4   | Open **Instrument Type**                                                                                                                                      | A fixed list — Pressure Indicating Transmitter, Pressure Gauge, Temperature Indicator, Temperature Transmitter, Flow Transmitter, Level Transmitter and so on. Not free text | ☐     |       |
| 5   | Pick **Pressure Indicating Transmitter**                                                                                                                      | Selected                                                                                                                                                                     | ☐     |       |
| 6   | Fill **Instrument Valve No.** `IV-101`, **P&ID No.** `PID-001`, **Line No.** `200-40-SS-SW-01`, **Fluid** `Sea water`, **Service Location** `Condenser inlet` | All five accept text                                                                                                                                                         | ☐     |       |
| 7   | Fill **Pressure** `1013` (**mbar(a)**), **Temperature** `30` (**°C**), **Flow Rate** `100080` (**kg/hr**)                                                     | Units shown beside each                                                                                                                                                      | ☐     |       |
| 8   | Click **Create**                                                                                                                                              | The row appears with all nine columns filled                                                                                                                                 | ☐     |       |
| 9   | **Round trip:** click the pencil                                                                                                                              | **Edit Instrument** with **all eleven** typed values exactly as entered — including P&ID No. and Instrument Valve No., which are not shown in the table                      | ☐     |       |
| 10  | Without changing anything, click **Update**, reopen                                                                                                           | Everything unchanged                                                                                                                                                         | ☐     |       |
| 11  | Change the **Instrument Type** to **Flow Transmitter** and **Update**                                                                                         | The Type column changes; nothing else does                                                                                                                                   | ☐     |       |
| 12  | Add a second instrument with **only** Tag No. filled and everything else blank, then reopen it                                                                | The blank fields come back blank — an empty optional field must not acquire a value from anywhere                                                                            | ☐     |       |
| 13  | Delete the second one (trash → **Delete**)                                                                                                                    | Confirmation titled **Delete Instrument**, then the row goes                                                                                                                 | ☐     |       |
| 14  | Reload the page                                                                                                                                               | `PIT-101` survives intact                                                                                                                                                    | ☐     |       |

**Should NOT be possible:**

- Saving with no Tag No. — the tab must show **Tag number is required**.

---

## UAT-SSOT-07 — Valves — create, round-trip, delete

**Goal:** create a valve datasheet row and confirm the round trip, including the two dropdown fields.
**Who:** someone with **Manage Process Data (SSOT)**, assigned to the project.
**Before you start:** requires the line from UAT-SSOT-05. **Write down every value.**

| #   | Do this                                                                                                                                     | You should see                                                                                                                                                 | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **Valves** tab → **Add Valve**                                                                                                              | A dialog titled **Add Valve**                                                                                                                                  | ☐     |       |
| 2   | Read the table columns behind it                                                                                                            | S.No, Valve Tag, Type, Size, Line No., Service Location, Fluid, Pressure (bar), Temp (°C), ΔP (bar), Actions                                                   | ☐     |       |
| 3   | Fill **S.No** `1` and **Valve Tag** `BFV-101`                                                                                               | Both accept                                                                                                                                                    | ☐     |       |
| 4   | Open **Valve Type**                                                                                                                         | A fixed list — Ball Valve, Butterfly, Gate Valve, Globe Valve, Check Valve, Non Return Valve, Motorized Globe Valve, Control Valve, Safety Valve, Relief Valve | ☐     |       |
| 5   | Pick **BUTTERFLY**                                                                                                                          | Selected                                                                                                                                                       | ☐     |       |
| 6   | Fill **Size (NB)** `150`, **P&ID No.** `PID-001`, **Line Number** `200-40-SS-SW-01`                                                         | All three accept                                                                                                                                               | ☐     |       |
| 7   | Open **End Connection**                                                                                                                     | A fixed list — Threaded, Flanged, Welded, Socket Weld. Pick **FLANGED**                                                                                        | ☐     |       |
| 8   | Fill **Service Location** `Condenser inlet isolation`, **Fluid** `Sea water`                                                                | Both accept                                                                                                                                                    | ☐     |       |
| 9   | Fill **Pressure** `1.013` (**bar**), **Temperature** `30` (**°C**), **Flow Rate** `98` (**m³/hr**), **ΔP (Pressure Drop)** `0.05` (**bar**) | Units shown beside each. Note the valve sheet works in **bar** and **m³/hr**, while the instrument sheet works in **mbar** and **kg/hr**                       | ☐     |       |
| 10  | Click **Create**                                                                                                                            | The row appears with all ten columns filled                                                                                                                    | ☐     |       |
| 11  | **Round trip:** click the pencil                                                                                                            | **Edit Valve** with **all thirteen** typed values exactly as entered — including P&ID No. and End Connection, which are not shown in the table                 | ☐     |       |
| 12  | Confirm both dropdowns came back on their saved value, not on the first item in the list                                                    | **BUTTERFLY** and **FLANGED**, not whatever happens to be first                                                                                                | ☐     |       |
| 13  | Without changing anything, click **Update**, reopen                                                                                         | Everything unchanged                                                                                                                                           | ☐     |       |
| 14  | Change only the **ΔP** and **Update**                                                                                                       | Only that column moves                                                                                                                                         | ☐     |       |
| 15  | Add a second valve with only Valve Tag filled, then reopen it                                                                               | The blank fields come back blank                                                                                                                               | ☐     |       |
| 16  | Delete the second one (trash → **Delete**)                                                                                                  | Confirmation titled **Delete Valve**, then the row goes                                                                                                        | ☐     |       |
| 17  | Reload the page                                                                                                                             | `BFV-101` survives intact                                                                                                                                      | ☐     |       |

**Also check:**

- Cross-check with UAT-SSOT-06: your instrument `PIT-101` names `IV-101` as its instrument valve. Add a valve tagged `IV-101` and confirm nothing anywhere links the two automatically — they are matched by eye today.

**Should NOT be possible:**

- Saving with no Valve Tag — the tab must show **Valve tag is required**.

---

## UAT-SSOT-08 — Live updates between two people, and deleting a referenced record

**Goal:** confirm two engineers can work on the same project's process data at once, and record what happens when a record that others point at is deleted.
**Who:** you and a colleague, both able to open the same project.
**Before you start:** requires stream `SW1`, the line that names `SW1` as its Input Data Tag, and equipment `MED-E1` that names `SW1` as an inlet stream.

| #   | Do this                                                                                                                                                    | You should see                                                                                                           | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Both of you open **Process Data (SSOT)** and select the **same project**, both on **Streams**                                                              | Both see the same rows                                                                                                   | ☐     |       |
| 2   | You add a new stream. Your colleague watches their screen **without reloading**                                                                            | The new row appears on their screen within a few seconds, on its own                                                     | ☐     |       |
| 3   | Your colleague edits that stream's temperature. You watch **without reloading**                                                                            | Your row updates on its own, and the density and enthalpy update with it                                                 | ☐     |       |
| 4   | Your colleague deletes it. You watch                                                                                                                       | Your row disappears on its own                                                                                           | ☐     |       |
| 5   | Both of you open the **same stream** in the edit dialog at the same time, change different fields, and both click **Update** — you first, colleague second | Record which set of changes survives                                                                                     | ☐     |       |
| 6   | Now delete stream `SW1` (trash → **Delete**)                                                                                                               | ⚠ known issue — it deletes with no warning at all, even though a line and a piece of equipment name it. Do not file this | ☐     |       |
| 7   | Go to the **Lines** tab and look at your line's **Input Tag** column                                                                                       | ⚠ known issue — it still reads `SW1`, pointing at a stream that no longer exists. Nothing flags it                       | ☐     |       |
| 8   | Go to the **Equipment** tab and look at `MED-E1`'s **Inlet Streams**                                                                                       | ⚠ known issue — still lists `SW1`                                                                                        | ☐     |       |
| 9   | Recreate a stream tagged `SW1` with the same values                                                                                                        | The line and equipment "reconnect" simply because the text matches again                                                 | ☐     |       |

**Also check:**

- All six tabs update live, not just Streams. Try the same two-person check on **Lines** and on **Valves**.

---

## UAT-SSOT-09 — Permission checks and the Export Excel button

**Goal:** confirm someone who may read process data cannot change it, and that someone with no thermal permission cannot reach the module.
**Who:** you, plus a second sign-in with **View Thermal Desalination** but **not** Manage Process Data (SSOT).
**Before you start:** ask an admin to set up the limited account and have that person sign out and back in.

| #   | Do this                                                                                                                            | You should see                                                                                                                                                                       | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | As the **limited user**, go to **ENGINEERING DATA → Process Data (SSOT)**                                                          | The page opens; the project picker and all six tabs work; data is readable                                                                                                           | ☐     |       |
| 2   | On the **Streams** tab, click **Add Stream**, fill it in and click **Create**                                                      | The save is refused. ⚠ known issue — the message reads only "Failed to save stream. Please try again.", which does not tell you it was a permission problem. Do not file the wording | ☐     |       |
| 3   | Try the pencil on an existing stream, change something, click **Update**                                                           | Refused the same way; the row on the table is unchanged                                                                                                                              | ☐     |       |
| 4   | Try the trash icon on a stream and confirm **Delete**                                                                              | Refused; the row is still there. ⚠ same generic wording                                                                                                                              | ☐     |       |
| 5   | Repeat steps 2–4 once on **Equipment**, **Lines**, **Instruments**, **Valves** and **Pipe Table**                                  | All six tabs refuse writes for this user                                                                                                                                             | ☐     |       |
| 6   | Reload the page and check every tab                                                                                                | Nothing the limited user attempted actually saved                                                                                                                                    | ☐     |       |
| 7   | As **yourself** (with Manage Process Data), pick a project you are **not assigned to**, if one is visible, and try to add a stream | The save is refused, for the same reason — being assigned to the project is required, not just the permission                                                                        | ☐     |       |
| 8   | Have an admin remove **View Thermal Desalination** from the limited account; sign out and back in                                  |                                                                                                                                                                                      | ☐     |       |
| 9   | Go to **Process Data (SSOT)** again                                                                                                | Either the sidebar entry is gone, or the page shows **Access Denied** — "You do not have permission to access the Process Data (SSOT) module"                                        | ☐     |       |
| 10  | Also try **SALES & ESTIMATION → Thermal Calculators** with that same account                                                       | The calculators still open — they are available to every signed-in user and do not need this permission                                                                              | ☐     |       |
| 11  | Restore the account's permissions afterwards                                                                                       |                                                                                                                                                                                      | ☐     |       |

**Should NOT be possible:**

- A read-only user changing any process data by any route, on any of the six tabs.
- Editing process data on a project you are not assigned to.

---

# Part 3 — Thermal Calculators

## UAT-THRM-01 — Tour the Thermal Calculators hub

**Goal:** confirm the calculator directory lists everything, search works, and every tile opens the tool it names.
**Who:** anyone signed in.
**Before you start:** nothing.

| #   | Do this                                                                  | You should see                                                                                                                                            | Pass? | Notes |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Sidebar → **SALES & ESTIMATION → Thermal Calculators**                   | A page headed **Thermal Calculators**                                                                                                                     | ☐     |       |
| 2   | Read the section headings down the page                                  | **Plant Design**, **Compression & Ejectors**, **Heat Exchange & Thermal**, **Fluid Systems & Equipment**, **Plant Auxiliaries**, **Properties & Lookups** | ☐     |       |
| 3   | Count the tiles                                                          | Around thirty in total. Two of them — **Condenser** and **Ejector** — carry a **Coming Soon** chip                                                        | ☐     |       |
| 4   | Click a **Coming Soon** tile                                             | Nothing happens, or you are told it is not ready. It must not open a broken page                                                                          | ☐     |       |
| 5   | Type `pipe` into **Search calculators...**                               | The page narrows to matching tiles as you type; empty sections disappear                                                                                  | ☐     |       |
| 6   | Type something that matches nothing                                      | "No calculators match ..." rather than a blank page                                                                                                       | ☐     |       |
| 7   | Clear the search. Switch the view toggle from card view to **list view** | The same calculators as a compact list                                                                                                                    | ☐     |       |
| 8   | Switch back to card view                                                 | Cards again                                                                                                                                               | ☐     |       |
| 9   | Open **Pipe Sizing**, then use the breadcrumb to come back               | You are back on the hub, and a **Recently Used** strip has appeared at the top with Pipe Sizing in it                                                     | ☐     |       |
| 10  | Open five more calculators, coming back each time                        | Recently Used holds **at most five**, most recent first, and the oldest drops off                                                                         | ☐     |       |
| 11  | Reload the page                                                          | Recently Used survives the reload                                                                                                                         | ☐     |       |
| 12  | Click every remaining tile in turn and note the page heading you land on | Each heading matches the tile you clicked, and none shows an error or an endless spinner                                                                  | ☐     |       |
| 13  | Type the old address `/thermal` into the browser directly                | You are sent to the Thermal Calculators hub — the old landing page no longer exists                                                                       | ☐     |       |

**Also check:**

- The **Flash Chamber** and **Reference Projects** tiles sit in the **Plant Design** section, alongside the two MED tools. They are reached from the hub like everything else.

---

## UAT-THRM-02 — MED Plant Designer end to end, with a save-and-reload check

> This is the largest tool in the app. Work through it with a plant you actually know, so you can judge whether the answers are sensible rather than merely present.

**Goal:** design an MED plant from scratch, sanity-check the results, save the case, start over, reload it, and confirm every input **and** every headline result comes back identical.
**Who:** anyone signed in.
**Before you start:** nothing. Have a notepad — you will be comparing about thirty inputs and a dozen results before and after the reload.

### Part A — the inputs

| #   | Do this                                                                                                            | You should see                                                                                                                                                                                         | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Hub → **Plant Design** → **MED Plant Designer**                                                                    | A page headed **MED Plant Designer** with a **Multi-Effect Distillation** chip, and a four-step strip: **Design Inputs**, **Equipment & Geometry**, **Detailed Design**, **Review & Export**           | ☐     |       |
| 2   | Note the three buttons at the top right                                                                            | **Load**, **Save**, **Start Over**                                                                                                                                                                     | ☐     |       |
| 3   | On **Design Inputs**, read the first group                                                                         | **Heating Steam Flow** in **T/h** (starts at `0.79`) and a **With Thermo Vapor Compressor (TVC)** switch, off                                                                                          | ☐     |       |
| 4   | Read the seawater group                                                                                            | **Seawater Temperature** °C (`30`), **Seawater Salinity** ppm (`35000`), **Max Brine Salinity** ppm (`65000`), **Condenser Approach** °C (`4`), **SW Outlet Temp (absolute)** °C (blank)               | ☐     |       |
| 5   | Read the configuration group                                                                                       | **Number of Effects** (`6`) and a row of per-effect preheater toggles                                                                                                                                  | ☐     |       |
| 6   | Set **Heating Steam Flow** to `2.5` T/h and **Number of Effects** to `8`                                           | The results panel lower down recalculates by itself — there is no Calculate button                                                                                                                     | ☐     |       |
| 7   | Read the headline results panel                                                                                    | **GOR**, **Distillate Output** in m³/day, **Total Distillate** in T/h                                                                                                                                  | ☐     |       |
| 8   | Sanity-check the GOR                                                                                               | For 8 effects with no TVC, a GOR around 7–8 is right. A GOR above the number of effects, or below 2, is wrong                                                                                          | ☐     |       |
| 9   | Sanity-check the distillate                                                                                        | Total Distillate ≈ steam flow × GOR. With 2.5 T/h in and a GOR near 7.5 you expect around 18–19 T/h, i.e. roughly 450 m³/day                                                                           | ☐     |       |
| 10  | **Double** the Heating Steam Flow to `5.0`                                                                         | The distillate output roughly doubles; the GOR barely moves. That is the correct behaviour                                                                                                             | ☐     |       |
| 11  | Set it back to `2.5`. Turn on **With Thermo Vapor Compressor (TVC)**                                               | The first field renames itself to **Motive Steam Flow**, and **Motive Steam Pressure** (bar abs), **Superheat** (°C), **Top Brine Temperature** (°C) and **Entrained from Effect** appear              | ☐     |       |
| 12  | Leave TVC on, set **Motive Steam Pressure** `10` bar abs, **Top Brine Temperature** `65` °C                        | The GOR rises noticeably compared with the no-TVC case — that is what a TVC is for                                                                                                                     | ☐     |       |
| 13  | Turn TVC back off                                                                                                  | The extra fields disappear and the GOR returns to where it was                                                                                                                                         | ☐     |       |
| 14  | Turn on the preheater toggle for two of the later effects, and set **Default Temp Rise per PH** to `4` °C          | The GOR improves slightly. Helper text explains later effects improve GOR more                                                                                                                         | ☐     |       |
| 15  | Open **Advanced Parameters**                                                                                       | **Tube Material**, **Design Margin** %, **Fouling Resistance**, **BPE Safety Factor**, an **Include brine recirculation** switch, **Vacuum System**, **Anti-scalant Dose** mg/L, **Shells per Effect** | ☐     |       |
| 16  | Change **Tube Material**, **Design Margin** to `20`, **BPE Safety Factor** to `1.15`, **Anti-scalant Dose** to `3` | Results move; nothing errors                                                                                                                                                                           | ☐     |       |
| 17  | Set **Vacuum System** to an LRVP option                                                                            | **Seal Water Temperature**, a **Closed-loop seal water** switch and **Chiller COP** appear                                                                                                             | ☐     |       |
| 18  | **Write down every input on this step**, including the advanced ones and which preheaters are on                   | You will need all of them in Part C                                                                                                                                                                    | ☐     |       |
| 19  | Click **Proceed to Equipment & Geometry**                                                                          | Step 2 opens                                                                                                                                                                                           | ☐     |       |

### Part B — geometry, detailed design and the wetting rate

| #   | Do this                                                                                                                                                                    | You should see                                                                                                                                        | Pass? | Notes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 20  | Read the **Equipment Geometry** controls                                                                                                                                   | A **Mode** dropdown with **Fixed Tube Count**, **Fixed Tube Length**, **Uniform Geometry**, and a value box that renames itself to suit               | ☐     |       |
| 21  | Read the per-effect table columns                                                                                                                                          | Effect, Tubes, Tube L (m), Shell ID (mm), Inst. Area (m²), Margin, Spray (T/h), Recirc (T/h), **Γ (kg/m·s)**, Rows                                    | ☐     |       |
| 22  | Look at the **Γ (kg/m·s)** column on every effect                                                                                                                          | Every value should sit comfortably above **0.03 kg/(m·s)** — that is the validated project minimum wetting rate                                       | ☐     |       |
| 23  | **If any Γ is shown in red or bold, note the value and the threshold the app appears to be using**                                                                         | If the app is flagging a design against a threshold **much smaller** than 0.03 kg/(m·s), that is a real finding — report it with the numbers          | ☐     |       |
| 24  | Check the **Margin** column                                                                                                                                                | Every effect should show a positive margin, in green. A negative margin in red means the geometry you chose is undersized                             | ☐     |       |
| 25  | Set **Mode** to **Fixed Tube Length** and reduce the tube length substantially                                                                                             | Tube counts rise, shell IDs change, and Γ moves. Follow it — a shorter tube with the same spray means a **higher** Γ                                  | ☐     |       |
| 26  | Set **Mode** to **Uniform Geometry**, choose **Input → Tubes** and set **Overdesign Margin** to `15` %                                                                     | Every effect ends up with the same geometry, and the margin column stays positive throughout                                                          | ☐     |       |
| 27  | Sanity-check the shell diameters                                                                                                                                           | A warning marker appears against any shell under 1800 mm. Judge whether the sizes suit the plant you described                                        | ☐     |       |
| 28  | Note your final Mode, value and margin, then click **Proceed to Detailed Design**                                                                                          | Step 3 opens                                                                                                                                          | ☐     |       |
| 29  | Read through Step 3                                                                                                                                                        | Effect-by-effect detail, an auxiliary equipment section and, if you enabled it, a turndown table with a **Load** column and a **Wetting OK** column   | ☐     |       |
| 30  | Check the **Wetting OK** column, if shown                                                                                                                                  | A tick or a cross per load point, and a stated **Minimum stable load** percentage. A minimum stable load above about 60 % is worth questioning        | ☐     |       |
| 31  | Click through to **Review & Export**                                                                                                                                       | Step 4 opens, headed **Step 4 — Bill of Materials & Export**, with tabs **Equipment**, **Instruments**, **Valves**, **Summary**, each showing a count | ☐     |       |
| 32  | **Write down the headline results:** GOR, Distillate Output, total heat transfer area, the per-effect tube counts and shell IDs, and the equipment/instrument/valve counts | You need these for Part C                                                                                                                             | ☐     |       |

### Part C — save, start over, reload, and compare

| #   | Do this                                                                        | You should see                                                                                                                                                                                                                                                                                                                                                                       | Pass? | Notes |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 33  | Click **Save** at the top right                                                | A dialog titled **Save Calculation** with a **Name** box                                                                                                                                                                                                                                                                                                                             | ☐     |       |
| 34  | Name it `UAT MED 8-effect` and click **Save**                                  | The dialog closes with no error                                                                                                                                                                                                                                                                                                                                                      | ☐     |       |
| 35  | Click **Start Over**                                                           | The wizard returns to step 1 with the factory defaults — 0.79 T/h, 6 effects, no preheaters, no TVC                                                                                                                                                                                                                                                                                  | ☐     |       |
| 36  | Confirm the reset really is a reset                                            | Advanced Parameters are back to their defaults too, not left on your values                                                                                                                                                                                                                                                                                                          | ☐     |       |
| 37  | Click **Load**                                                                 | A dialog titled **Load Saved Calculation** listing `UAT MED 8-effect` with the date you saved it                                                                                                                                                                                                                                                                                     | ☐     |       |
| 38  | Click the saved case                                                           | The dialog closes and the wizard fills in                                                                                                                                                                                                                                                                                                                                            | ☐     |       |
| 39  | **Compare every step-1 input against your notes from step 18**                 | Steam flow, effects, seawater temperature and salinity, max brine salinity, condenser approach, SW outlet temp, the TVC switch and all its fields, which preheaters are on and the temp rise, tube material, design margin, fouling resistance, BPE safety factor, brine recirculation, vacuum system, seal water settings, anti-scalant dose, shells per effect — **all identical** | ☐     |       |
| 40  | Go to step 2 and compare against your notes from step 28                       | Mode, value and overdesign margin all identical                                                                                                                                                                                                                                                                                                                                      | ☐     |       |
| 41  | **Compare every headline result against your notes from step 32**              | GOR, distillate, areas, per-effect tube counts and shell IDs, and the three BOM counts — **all identical, to the last digit**                                                                                                                                                                                                                                                        | ☐     |       |
| 42  | Look particularly at the **Γ** column                                          | Same values as before the save                                                                                                                                                                                                                                                                                                                                                       | ☐     |       |
| 43  | Reload the whole browser page, then **Load** the case again                    | Same result a second time                                                                                                                                                                                                                                                                                                                                                            | ☐     |       |
| 44  | Save a **second** case with different inputs, then load the **first** one back | You get the first case's inputs, not a mixture of the two                                                                                                                                                                                                                                                                                                                            | ☐     |       |

**Also check:**

- Any input you leave blank must come back blank after a reload, not filled with a default.
- The results panel recomputes as you type throughout. If you ever have to click something to make numbers appear, note where.

**Should NOT be possible:**

- Reaching **Proceed to Detailed Design** before the geometry has actually computed — the button must stay disabled.

---

## UAT-THRM-03 — MED Plant Designer outputs — reports and the hand-off to Estimation

**Goal:** produce each of the three MED reports, export the bill of materials, and confirm the hand-off into the Estimation module lands correctly.
**Who:** anyone signed in; step 8 onwards also needs access to Estimation.
**Before you start:** requires the saved case `UAT MED 8-effect` from UAT-THRM-02. Load it and go to **Review & Export**.

| #   | Do this                                                                                          | You should see                                                                                                                                                                         | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | On **Review & Export**, click through the **Equipment**, **Instruments** and **Valves** tabs     | Each lists real items with tags, and the count in the tab heading matches the number of rows                                                                                           | ☐     |       |
| 2   | Read the **Summary** tab                                                                         | Totals that are consistent with the three lists                                                                                                                                        | ☐     |       |
| 3   | Click **Export All BOM (CSV)**                                                                   | A file downloads. Open it and confirm the same equipment, instruments and valves, with the same tags                                                                                   | ☐     |       |
| 4   | Open the report dialog (**Generate MED Design Report**) and choose **Brief (Proposal)**          | The description says it shows key performance and dimensions only, and does **not** reveal tube counts or HTCs                                                                         | ☐     |       |
| 5   | Fill **Document Number**, **Revision**, **Project Name**, **Notes**, then click **Download PDF** | A PDF downloads                                                                                                                                                                        | ☐     |       |
| 6   | Open the brief PDF                                                                               | Your document number, revision and project name are on it; the GOR and distillate match the screen; **no tube counts or HTCs appear** — this one goes to customers                     | ☐     |       |
| 7   | Repeat with **Detailed (Engineering)**                                                           | A much longer PDF with effect-by-effect design, U-values, a weight breakdown and the equipment list                                                                                    | ☐     |       |
| 8   | Repeat with **Verification**                                                                     | A PDF with property data, the temperature cascade, heat and mass balance, HTC breakdown, correlations and references                                                                   | ☐     |       |
| 9   | In the verification PDF, find the **Wetting Rate Analysis** section                              | A per-effect Γ table and a stated minimum wetting rate in kg/m·s. Check it against the **0.03 kg/(m·s)** project standard — if the report states a threshold far below that, report it | ☐     |       |
| 10  | Cross-check the three PDFs against each other                                                    | GOR, distillate and total area agree across all three. A number that differs between reports is a serious finding                                                                      | ☐     |       |
| 11  | Cross-check the PDFs against the screen                                                          | Same numbers as step 41 of UAT-THRM-02                                                                                                                                                 | ☐     |       |
| 12  | Click **Export to Estimation BOM**                                                               | A dialog titled **Export to Estimation BOM** showing each designed item and what it maps to in the catalogue, with anything unmatched marked **Not mapped (exports unpriced)**         | ☐     |       |
| 13  | Note which items are unmapped, then complete the export                                          | You are told it succeeded                                                                                                                                                              | ☐     |       |
| 14  | Go to the **Estimation** module and open the BOM you exported into                               | The equipment, instruments and valves from the designer are there, with the same tags and quantities                                                                                   | ☐     |       |
| 15  | Check the items that were flagged **Not mapped**                                                 | They appear in the BOM with no price rather than being silently dropped                                                                                                                | ☐     |       |
| 16  | Compare the BOM item count against the designer's tab counts                                     | They agree                                                                                                                                                                             | ☐     |       |

---

## UAT-THRM-04 — Flash Chamber Calculator end to end

**Goal:** size a flash chamber, sanity-check the balance and the sizing, save and reload the case, and produce a datasheet.
**Who:** anyone signed in.
**Before you start:** nothing. Note your input values as you go.

| #   | Do this                                                                                                                                       | You should see                                                                                                                                                                                             | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Hub → **Plant Design** → **Flash Chamber**                                                                                                    | A page headed **Flash Chamber Calculator**, with buttons **Reset to Defaults**, **Save**, **Load** and **Generate Datasheet**                                                                              | ☐     |       |
| 2   | Read the input panel on the left                                                                                                              | A box headed **Inputs** with four tabs: **Process**, **Chamber**, **Elevations**, **Nozzles**                                                                                                              | ☐     |       |
| 3   | On **Process**, set **Water Type**, **Calculation Mode**, **Flow Rate Unit**, then **Water Flow Rate**                                        | The results on the right recalculate by themselves after a moment — there is no Calculate button                                                                                                           | ☐     |       |
| 4   | Set **Operating Pressure**, **Flashing Temperature** and **Inlet Temperature**                                                                | Note the pressure unit shown and use it. Results update                                                                                                                                                    | ☐     |       |
| 5   | Set **Seawater Salinity**                                                                                                                     | Results update                                                                                                                                                                                             | ☐     |       |
| 6   | Read the **Heat & Mass Balance** panel                                                                                                        | A table with **Stream** and **Flow Rate** columns and three rows — the inlet, the vapour and the brine                                                                                                     | ☐     |       |
| 7   | **Check the mass balance yourself**                                                                                                           | Vapour flow + brine flow = inlet flow, to within rounding. If it does not close, that is the finding                                                                                                       | ☐     |       |
| 8   | **Check the flash fraction is plausible**                                                                                                     | Flashing 10 °C off seawater releases roughly 1.5–2 % of the flow as vapour. A double-digit percentage from a small temperature drop is wrong                                                               | ☐     |       |
| 9   | Read the **Chamber Sizing** panel                                                                                                             | A diameter in mm, a vapour velocity in m/s with a status marker, and a vapour loading figure                                                                                                               | ☐     |       |
| 10  | On the **Chamber** tab, change the demister selection                                                                                         | The Souders-Brown factor changes and the required diameter moves with it — a vane pack should allow a smaller vessel than open space                                                                       | ☐     |       |
| 11  | Set **Retention Time**, **Flashing Zone Height** and **Spray Angle**                                                                          | The chamber height changes sensibly — a wider spray angle should shorten the spray zone                                                                                                                    | ☐     |       |
| 12  | **Double the Water Flow Rate**                                                                                                                | Vapour flow roughly doubles; the chamber diameter grows by roughly 40 %, not 100 %. Area scales with flow, diameter with its square root                                                                   | ☐     |       |
| 13  | Set the flow back. Go to **Nozzles** and set **Inlet Water Velocity**, **Outlet Brine Velocity**, **Vapor Outlet Velocity**                   | The **Nozzle Sizing** panel updates                                                                                                                                                                        | ☐     |       |
| 14  | Read the vapour outlet nozzle result                                                                                                          | Hover the help marker beside **Vapor Outlet Velocity** — it states the sonic velocity and the maximum recommended (35 % of sonic) at your saturation temperature. Confirm your chosen velocity is below it | ☐     |       |
| 15  | Go to **Elevations** and set **Pump Centerline Above FFL**, **Operating Level Above Pump**, **Operating Level Ratio**, **BTL Gap Below LG-L** | The **NPSHa Calculation (Three Levels)** panel and the **Elevation Diagram** both update                                                                                                                   | ☐     |       |
| 16  | Read the NPSHa panel                                                                                                                          | Three NPSHa figures for three liquid levels. Sanity-check: the **lowest** level must give the **smallest** NPSHa                                                                                           | ☐     |       |
| 17  | Reduce **Operating Level Above Pump** until NPSHa goes negative or the panel warns                                                            | A warning appears rather than a silently impossible design                                                                                                                                                 | ☐     |       |
| 18  | Set it back to a sensible value. Look at the top of the results column                                                                        | If there are warnings, they appear as a yellow list. Read them and judge whether they make sense                                                                                                           | ☐     |       |
| 19  | **Write down every input across all four tabs**                                                                                               | You need them for the reload check                                                                                                                                                                         | ☐     |       |
| 20  | Click **Save**, name it `UAT Flash Chamber 01`, click **Save**                                                                                | The dialog closes with no error                                                                                                                                                                            | ☐     |       |
| 21  | Click **Reset to Defaults**                                                                                                                   | Every tab returns to its starting values and the results change accordingly                                                                                                                                | ☐     |       |
| 22  | Click **Load** and pick `UAT Flash Chamber 01`                                                                                                | The case reloads                                                                                                                                                                                           | ☐     |       |
| 23  | **Compare all four tabs against your notes**                                                                                                  | Every input identical, including the ones on tabs you are not currently looking at                                                                                                                         | ☐     |       |
| 24  | Compare the results                                                                                                                           | Balance, chamber diameter, nozzle sizes and all three NPSHa figures identical to before the save                                                                                                           | ☐     |       |
| 25  | Look at the browser address bar                                                                                                               | It carries your inputs. Copy the whole address, open it in a new tab                                                                                                                                       | ☐     |       |
| 26  | Check the page that opens from that address                                                                                                   | The same inputs and the same results — the link is shareable                                                                                                                                               | ☐     |       |
| 27  | Click **Generate Datasheet**                                                                                                                  | A dialog headed **Generate Datasheet**, pre-filled with document number `FC-DS-001`, and a summary showing Chamber Diameter, Operating Pressure and Vapor Production                                       | ☐     |       |
| 28  | Check the three summary figures against the screen behind it                                                                                  | They match                                                                                                                                                                                                 | ☐     |       |
| 29  | Fill **Revision**, **Project Name** and **Notes**, click **Download PDF**                                                                     | A PDF downloads                                                                                                                                                                                            | ☐     |       |
| 30  | Open the datasheet                                                                                                                            | Your document number, revision and project name; the balance, chamber sizing, nozzle sizing and NPSHa all matching the screen, each with its unit                                                          | ☐     |       |

**Should NOT be possible:**

- Clicking **Generate Datasheet** before there is a result — the button must stay disabled.

---

## UAT-THRM-05 — Save, load and delete a calculation — and who can see it

> Every calculator that offers Save uses the same mechanism. Test it thoroughly once here, then just spot-check it in the sweep.

**Goal:** confirm saved calculations are kept per calculator and per person, load back exactly, and can be deleted.
**Who:** you, plus a colleague with any signed-in account.
**Before you start:** nothing.

| #   | Do this                                                                                                   | You should see                                                                                                                   | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open **Pipe Sizing** from the hub                                                                         | Buttons **Load Saved** and **Reset** near the title; once a result appears, **Save** and **Generate Report** at the bottom right | ☐     |       |
| 2   | Click **Load Saved** before saving anything                                                               | A dialog titled **Load Saved Calculation** reading "No saved calculations yet."                                                  | ☐     |       |
| 3   | Close it. Set some distinctive inputs — flow `250` ton/hr, target velocity `1.8` m/s, temperature `45` °C | A result appears                                                                                                                 | ☐     |       |
| 4   | Click **Save**                                                                                            | A dialog titled **Save Calculation** with a **Name** box                                                                         | ☐     |       |
| 5   | Try to click **Save** with the name empty                                                                 | The button is disabled — a name is required                                                                                      | ☐     |       |
| 6   | Name it `UAT Pipe A` and click **Save**                                                                   | The dialog closes with no error                                                                                                  | ☐     |       |
| 7   | Change the inputs to something else and save again as `UAT Pipe B`                                        | Saved                                                                                                                            | ☐     |       |
| 8   | Click **Reset**                                                                                           | Inputs return to their defaults                                                                                                  | ☐     |       |
| 9   | Click **Load Saved**                                                                                      | Both entries listed, **most recent first**, each with the date it was saved                                                      | ☐     |       |
| 10  | Pick `UAT Pipe A`                                                                                         | The dialog closes and **every** input comes back exactly as you set it — flow, unit, velocity, temperature, mode                 | ☐     |       |
| 11  | Check the result                                                                                          | The same pipe size and actual velocity as when you saved it                                                                      | ☐     |       |
| 12  | Load `UAT Pipe B`, then `UAT Pipe A` again                                                                | Each load replaces the previous inputs completely — no leftovers from the other case                                             | ☐     |       |
| 13  | Now open a **different** calculator — **Pump Sizing** — and click **Load Saved**                          | Your pipe-sizing entries are **not** listed. Each calculator keeps its own set                                                   | ☐     |       |
| 14  | Save something in Pump Sizing, then go back to Pipe Sizing and open **Load Saved**                        | Only the two pipe entries — the pump one does not leak across                                                                    | ☐     |       |
| 15  | In the load list, click the bin icon next to `UAT Pipe B`                                                 | It disappears **immediately, with no confirmation**. Note this in the Notes column — it is easy to lose a case by mis-clicking   | ☐     |       |
| 16  | Close and reopen **Load Saved**                                                                           | `UAT Pipe B` is gone for good; `UAT Pipe A` is still there                                                                       | ☐     |       |
| 17  | Reload the browser and open **Load Saved** again                                                          | `UAT Pipe A` survives                                                                                                            | ☐     |       |
| 18  | Have your **colleague** open Pipe Sizing on their own sign-in and click **Load Saved**                    | They see **their own** saved cases only — none of yours. Saved calculations are private to the person who made them              | ☐     |       |
| 19  | Have them save one, then check your own list again                                                        | Theirs does not appear in yours                                                                                                  | ☐     |       |
| 20  | Save a case with a name that already exists                                                               | Note whether you end up with two entries of the same name or the first is replaced                                               | ☐     |       |

**Should NOT be possible:**

- Seeing, loading or deleting another person's saved calculation.
- A calculation saved in one calculator turning up in another calculator's list.

---

## UAT-THRM-06 — Calculator sweep — every remaining calculator, one row each

> Do not rush this. For each row: open the calculator, type the inputs, and then judge the answer as an engineer — the units on screen, the magnitude, and how it moves when you change something. A number that appears without erroring is **not** a pass.

**Goal:** confirm every remaining calculator opens, computes, shows its units, and responds sensibly to a change of input.
**Who:** anyone signed in.
**Before you start:** all of these are reached from **SALES & ESTIMATION → Thermal Calculators**. None has a Calculate button — results update as you type, so give each one a second to settle. The one exception is noted in its row.

**For every row, check all four of these before ticking Pass:**

- **Units** — every result carries a unit, and it is the unit the label promises.
- **Magnitude** — the answer is plausible for the plant you described.
- **Response** — when you double the input named in the Check column, the result moves in the direction and by roughly the amount stated.
- **No blanks or errors** — nothing shows a dash, `NaN`, an empty box, or a red error for a perfectly reasonable input.

| #   | Calculator (hub section)                         | Type these inputs                                                                                                                                                                                               | Check                                                                                                                                                                                                                                                                                                                                                        | Pass? | Notes |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | **MED Process Calculator** (Plant Design)        | Steam Flow `790` kg/hr, Steam Temperature `57` °C, Number of Effects `6`, Inlet Temperature `30` °C, Salinity `35000` ppm                                                                                       | GOR (no unit), Net Distillate kg/hr, Output m³/day, Specific Energy kWh/m³. GOR should be near but below 6. Double the steam flow → distillate roughly doubles, GOR barely moves. Tick **With Thermo Vapor Compressor (TVC)** → the first two labels rename and GOR rises                                                                                    | ☐     |       |
| 2   | **Performance Ratio / GOR** (Plant Design)       | Number of Effects `6`, Top Brine Temperature `65` °C, Last Effect Temperature `40` °C, Steam Pressure `2.5` bar abs, Feed Salinity `35000` ppm                                                                  | Big **GOR** figure with a **Typical / Below typical / Above typical** chip, **STE (kWh/m³)**, **Thermal Efficiency** %. Raise the effects to 12 → GOR rises and STE falls. GOR above the number of effects is wrong                                                                                                                                          | ☐     |       |
| 3   | **Thermo Vapour Compressor** (Compression)       | Mode **Specify Entrained**; Motive Steam Pressure `10` bar abs, Suction Vapor Pressure `0.1` bar abs, Discharge Pressure `0.3` bar abs, Entrained Vapor Flow `2` ton/hr                                         | **Entrainment Ratio** (no unit, typically 0.3–1.5), **Compression Ratio** (Pc/Ps = 3 here), **Expansion Ratio** (Pm/Ps = 100 here). Check both ratios by hand. Switch to **Specify Motive** → the flow label changes and the ratios hold                                                                                                                     | ☐     |       |
| 4   | **Mechanical Vapour Compressor** (Compression)   | Suction Pressure `0.1` bar abs, Discharge Pressure `0.2` bar abs, Vapor Flow Rate `5` ton/hr, Isentropic Efficiency `75` %, Mechanical Efficiency `95` %                                                        | **Shaft Power** kW, **Compression Ratio** (= 2 here). Double the vapour flow → shaft power roughly doubles. Drop isentropic efficiency to 50 % → power rises                                                                                                                                                                                                 | ☐     |       |
| 5   | **Heat Exchanger Calculator** (Heat Exchange)    | **Quick Calc → Sensible**: Mass Flow `100` ton/hr, Inlet `25` °C, Outlet `40` °C, Salinity `35000` ppm                                                                                                          | **Heat Duty** kW. Check by hand: 100 t/h ≈ 27.8 kg/s × ~3.99 kJ/kg·K × 15 K ≈ **1660 kW**. Then try the **LMTD** and **Latent** sub-tabs, and the **Full Design** tab — that one has an explicit **Run Design** button and returns **Required Area** m², **Tube Count**, **Shell ID** mm                                                                     | ☐     |       |
| 6   | **Falling Film Evaporator** (Heat Exchange)      | Feed Flow `10` kg/s, Feed Temperature `60` °C, Steam Temperature `70` °C, Feed Salinity `35000` ppm, Tube OD `25.4`, Number of Tubes `500`                                                                      | **Overall HTC** W/(m²·K) — should land in the low thousands for falling film, **Wetting Ratio**, **Heat Duty** kW, **Evaporation Rate** kg/s. Evaporation rate must be a small fraction of feed flow. Halve the tube count → wetting ratio rises                                                                                                             | ☐     |       |
| 7   | **Single Tube Analysis** (Heat Exchange)         | Vapour Temperature `70` °C, Vapour Flow `0.01` kg/s, Spray Flow per tube `0.05` kg/s, Tube OD `25.4` mm, Tube Length `3` m                                                                                      | **Heat Duty (per tube)** kW — a single 3 m tube should give single-digit kW, not hundreds. Double the tube length → duty roughly doubles                                                                                                                                                                                                                     | ☐     |       |
| 8   | **Custom Tube Bundle** (Heat Exchange)           | Shape **Full Circle**, Shell Inner Diameter `2338` mm, Tube OD `25.4` mm, Pitch `33.4` mm, Tube Length `3` m                                                                                                    | **Total Tubes**. Sanity-check: a 2338 mm circle on 33.4 mm triangular pitch holds several thousand tubes. Switch to **Half Circle (Left)** → roughly half. Switch to **Rectangle** and enter a width and height → count changes accordingly                                                                                                                  | ☐     |       |
| 9   | **Lateral Tube Bundle** (Heat Exchange)          | Shell Inner Diameter `2338` mm, Tube OD `25.4` mm, Triangular Pitch `33.4` mm, Number of Lanes `4`, Lane Width `60` mm                                                                                          | **Total Tubes** — must be **fewer** than the half-circle count from row 8, because the vapour lanes remove tubes. Raise Number of Lanes to 8 → the count falls further                                                                                                                                                                                       | ☐     |       |
| 10  | **Central Tube Bundle** (Heat Exchange)          | Shell Inner Diameter `2338` mm, Bundle Width `1500` mm, Bundle Height `1200` mm, Tube OD `25.4` mm, Pitch `33.4` mm                                                                                             | **Total Tubes**. Before entering width and height it should say "Enter bundle width and height to see results." Double the bundle width → tube count roughly doubles. A bundle bigger than the shell should be refused or warned about                                                                                                                       | ☐     |       |
| 11  | **Desuperheating** (Heat Exchange)               | Steam Pressure `10` bar abs, Inlet Steam Temperature `300` °C, Target Outlet Temperature `190` °C, Steam Flow `5` ton/hr, Spray Water Temperature `30` °C                                                       | **Required Spray Water Flow** ton/hr — should be a modest fraction of the steam flow, well under 1 t/h here. Also shown: **Tsat** °C (≈180 °C at 10 bar) and **Inlet Superheat** °C (≈120 K). Set the target below Tsat → it should refuse or warn                                                                                                           | ☐     |       |
| 12  | **Thermal Expansion** (Heat Exchange)            | Mode **Free Expansion**; Initial Length `1000` mm, Installation Temperature `20` °C, Operating Temperature `120` °C, Material carbon steel                                                                      | **Free Thermal Expansion ΔL** — about **1.2 mm** for 1 m of carbon steel over 100 K. Switch to **Fully Restrained** → **Restrained Thermal Stress σ** in MPa, of order 200–250 MPa. Change material to aluminium → ΔL roughly doubles                                                                                                                        | ☐     |       |
| 13  | **Fouling & Scaling Prediction** (Heat Exchange) | Feed Salinity `35000` ppm, Calcium `420`, pH `8.1`, Temperature Max `75`, Concentration Factor `1.5`                                                                                                            | **Max TBT (no antiscalant)** °C, **Max TBT (with antiscalant)** °C, **Dominant Scalant**. The with-antiscalant TBT must be the **higher** of the two. Raise the concentration factor to 2.5 → both max TBTs fall                                                                                                                                             | ☐     |       |
| 14  | **Pipe Sizing** (Fluid Systems)                  | Mode **Size by Flow**; Flow Rate `100` ton/hr, Target Velocity `1.5` m/s, Temperature `40` °C                                                                                                                   | A headline pipe size like `6" Sch 40` with a status chip, plus **Actual Velocity** m/s and **Inner Diameter** mm. Actual velocity must be near but not above the target. Double the flow → the size steps up. Switch to **Check Velocity**, pick a size, and confirm the velocity it reports                                                                 | ☐     |       |
| 15  | **Pressure Drop** (Fluid Systems)                | Pipe Size `4`, Pipe Length `100` m, Mass Flow `50` ton/hr, Pipe Roughness `0.045` mm, Elevation Change `0` m                                                                                                    | **Total Pressure Drop** in m H₂O and **Velocity** m/s. Double the length → drop roughly doubles. Double the flow → drop roughly **quadruples** (it goes with the square). Add a few fittings → the drop increases                                                                                                                                            | ☐     |       |
| 16  | **Pump Sizing** (Fluid Systems)                  | Mass Flow `100` ton/hr, Static Head `20` m, Fluid Density `1025` kg/m³, Pump Efficiency `70` %, Motor Efficiency `95` %                                                                                         | **Total Differential Head** m, **Hydraulic** kW, **Brake (Shaft)** kW. Brake power must exceed hydraulic power. Check by hand: 100 t/h at 20 m ≈ 5.6 kW hydraulic, so ~8 kW brake. Drop pump efficiency to 50 % → brake power rises, hydraulic does not                                                                                                      | ☐     |       |
| 17  | **Suction System Designer** (Fluid Systems)      | Mode **Calculate Required Elevation**; Effect Pressure `300` mbar(a), Mass Flow `100` ton/hr, Pump NPSHr `3.0` m, Safety Margin `0.5` m                                                                         | **Required Minimum Elevation (Nozzle to Pump CL)** m — should exceed NPSHr + margin. Switch to **Verify Provided Elevation**, enter `5.0` m, and read **Elevation is Adequate** or **Elevation is Insufficient**. Enter an elevation well below the required figure → it must say insufficient                                                               | ☐     |       |
| 18  | **Siphon Sizing** (Fluid Systems)                | Upstream `300` mbar, Downstream `250` mbar, Mass Flow `100` ton/hr, Target Velocity `1.0` m/s, Safety Factor `20` %                                                                                             | A headline pipe size, **Min. Siphon Height** m, **Velocity** m/s. The U-bend height must exceed the 50 mbar difference expressed as a water column (~0.5 m). Widen the pressure gap to 100 mbar → the height grows                                                                                                                                           | ☐     |       |
| 19  | **Siphon Sizing — Batch Mode** (Fluid Systems)   | From Siphon Sizing click **Batch Mode (All Effects)**                                                                                                                                                           | A page headed **Batch Siphon Sizing** that sizes several inter-effect siphons at once. Enter a set of effects and confirm each row matches what the single calculator gives for the same conditions                                                                                                                                                          | ☐     |       |
| 20  | **Demister Sizing** (Fluid Systems)              | **Steam / Sat. Water (auto-lookup)** + **By Pressure**; Saturation Pressure `0.08` bar a, Vapor Mass Flow `1.5` kg/s, Design Margin `80` %, demister type **Standard Wire Mesh**                                | **K Factor** m/s and **Design Velocity** m/s, plus **Required demister area** m² and **Min. vessel diameter** m. Switch to **Vane / Chevron Pack** → K factor rises and the required diameter falls. Double the vapour flow → area roughly doubles                                                                                                           | ☐     |       |
| 21  | **Strainer Sizing** (Fluid Systems)              | Volumetric Flow `100` m³/hr, Line Size (NPS) `4`, Strainer Type **Y-type**, Mesh Size left blank, Fluid Density `1025` kg/m³                                                                                    | **Recommended Mesh Size** mm, a **Total** pressure loss and an **Open Area (Clean)**. Then pick a mesh yourself — the label should change to **Selected Mesh Size**. A finer mesh must give a higher pressure loss. Compare the clean and 50 %-clogged losses                                                                                                | ☐     |       |
| 22  | **Strainer Sizing — Batch Mode** (Fluid Systems) | From Strainer Sizing click **Batch Mode**                                                                                                                                                                       | A page headed **Batch Strainer Sizing**. Enter a set of lines and confirm one of the rows matches the single calculator for the same inputs                                                                                                                                                                                                                  | ☐     |       |
| 23  | **Vacuum System Design** (Plant Auxiliaries)     | Mode **2-Stage Ejector**; Suction Pressure `70` mbar abs, Coolant Inlet Temperature `28` °C, Dry NCG Flow `5`, Motive Steam Pressure `8`, Design Margin `10`                                                    | **Suction** mbar, **Dry NCG** kg/h, **Motive Steam** kg/h, **LRVP Power** kW. Switch through **Single Ejector**, **LRVP Only** and **Hybrid** — the equipment listed changes and steam consumption should be lowest on LRVP Only. Halve the suction pressure → motive steam rises sharply                                                                    | ☐     |       |
| 24  | **Vacuum Breaker Sizing** (Plant Auxiliaries)    | Mode **Manual Valve — Size for Target Time**; Total Volume `200` m³, Lowest Operating Vacuum Pressure `50` mbar abs, Number of Vacuum Breakers `2`, Equalization Time `60` min, Ambient Air Temperature `35` °C | **Selected Size (N identical valves)** as `DN nn` with the NPS beside it, plus **Vol. per Breaker** m³ (= 100 here). Halve the equalization time → the valve gets bigger. Try both **Burst Diaphragm** modes and confirm they compute                                                                                                                        | ☐     |       |
| 25  | **Chemical Dosing & CIP** (Plant Auxiliaries)    | **Chemical Dosing** tab: Feed Seawater Flow `500` m³/h, Dose `2` mg/L, Solution Density `1.10` kg/L, Storage Days `30`                                                                                          | **Dosing Flow** (mL/min or L/h), **Daily** kg/day, **Annual** kg/yr. Check by hand: 500 m³/h × 2 mg/L = 1 kg/h = **24 kg/day**. Double the dose → everything doubles. Then use the **Acid CIP** tab and confirm **System Volume** and **Annual Acid** compute                                                                                                | ☐     |       |
| 26  | **Spray Nozzle Selection** (Plant Auxiliaries)   | Mode **Nozzle Selection**, category **Full Cone — Circular**; Total Required Flow (choose the unit), Operating Pressure `3` bar, Number of Nozzles `10`, Flow Tolerance `25` %                                  | **Required Flow (total)**, **Flow per Nozzle**, **Pressure** bar, and a **Matches** count of real catalogue nozzles. Flow per nozzle × 10 must equal the total. Set an absurd flow → it should report no matches rather than an error. Then try **Bundle Layout** with a bundle length and width and confirm **Layout**, **Coverage** mm and **Pitch** mm    | ☐     |       |
| 27  | **Steam Tables** (Properties)                    | **Saturation** + **Temperature**; Temperature `100` °C                                                                                                                                                          | **Saturation Pressure** ≈ **1.013 bar** — this is the one you can check against memory. Switch to **Pressure** and enter `1.013` bar (absolute) → **Saturation Temperature** ≈ 100 °C. Change the unit selector to mbar and kg/cm² (gauge) and confirm the number converts correctly. Try the **Subcooled** and **Superheated** modes                        | ☐     |       |
| 28  | **Seawater Properties** (Properties)             | Temperature `40` °C, Salinity `35000` ppm                                                                                                                                                                       | **Density (ρ)** ≈ **1022 kg/m³**, **Boiling Point Elevation (BPE)** ≈ 0.5–0.7 °C, **Specific Heat (Cp)** ≈ 4.0 kJ/(kg·K). Double the salinity → density and BPE rise, Cp falls. Change the unit to **g/kg (‰)** and enter `35` → identical results                                                                                                           | ☐     |       |
| 29  | **NCG Properties** (Properties)                  | Mode **NCG + Vapour**; Temperature `40` °C, NCG Partial Pressure `0.075`, Total (Wet) Gas Flow `50`                                                                                                             | **Total Pressure** bar abs, **NCG Partial P** bar, **Density** kg/m³. Total pressure must equal the NCG partial pressure plus the saturation pressure of water at 40 °C (≈0.0738 bar), so around 0.149 bar. Toggle the switch that reinterprets the pressure as a total and confirm the label changes to **Total System Pressure (abs)**. Try all four modes | ☐     |       |

**Also check, across the whole sweep:**

- Every calculator's **Reset** puts it back to the state it opened in.
- Where a **Generate Report** button exists, produce one PDF and confirm the numbers on it match the screen and carry their units.
- Note in the Notes column any calculator that has **no Save button** — six of them do not (see Known issues).

---

## UAT-THRM-07 — Reference Projects library

**Goal:** confirm the as-built reference data is readable and usable for validating a calculator result.
**Who:** anyone signed in.
**Before you start:** nothing. This page is read-only — there is nothing to save and nothing to break.

| #   | Do this                                                                       | You should see                                                                                                                                            | Pass? | Notes |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Hub → **Plant Design** → **Reference Projects**                               | A page headed **Reference Projects**, explaining the data is as-built from real MED-TVC plants                                                            | ☐     |       |
| 2   | Read the notice under the heading                                             | It states the data was taken from original project datasheets and that values are as-built unless noted                                                   | ☐     |       |
| 3   | Read the project cards                                                        | Three projects — Campiche, CADAFE and MORON                                                                                                               | ☐     |       |
| 4   | Open each project in turn                                                     | Real design data with units — capacity, number of effects, temperatures, areas                                                                            | ☐     |       |
| 5   | Find the **Cross-Project Comparison** section                                 | The three projects side by side on the same measures                                                                                                      | ☐     |       |
| 6   | Look for anything editable — an Add, Edit, Delete or Save                     | There is none. This is a read-only library                                                                                                                | ☐     |       |
| 7   | Pick one project's inputs and put them through the **MED Process Calculator** | The GOR and distillate you compute should be in the same neighbourhood as the as-built figures. A large gap is worth reporting, with both sets of numbers | ☐     |       |
| 8   | Do the same with the **Performance Ratio / GOR** calculator                   | Again, a comparable answer                                                                                                                                | ☐     |       |

---

## Known issues in this module

Read these before you start. All eight are already on the fix list — please do **not** file feedback for them. If you see something that looks like one of these but behaves differently, that **is** worth reporting.

| #   | What you will see                                                                                                                                                                                                                  | Affects                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | **The Role filter offers "Supplier" but nothing can ever match it.** The create form only offers Vendor, Customer and Partner, so the Supplier filter always returns an empty list.                                                | UAT-ENT-01               |
| 2   | **A duplicate entity _name_ is only caught after you click Create Entity.** The live duplicate check while you type covers email, PAN and GSTIN only. The record is still refused — just later than you would expect.              | UAT-ENT-07               |
| 3   | **Changing an entity's GSTIN does not update the GSTIN printed on existing purchase orders.** Changing the name or the email does propagate; the GSTIN does not.                                                                   | UAT-ENT-11               |
| 4   | **Export Excel on Process Data does nothing.** The button shows "Excel export coming soon" and no file is produced.                                                                                                                | UAT-SSOT-01, UAT-SSOT-09 |
| 5   | **Nothing stops you deleting a stream that a line or a piece of equipment still points at.** There is no warning and no cascade — the line keeps a tag pointing at a record that no longer exists, and nothing anywhere flags it.  | UAT-SSOT-08              |
| 6   | **A refused save in Process Data looks exactly like a network failure.** Whatever the reason — no permission, not assigned to the project, connection lost — the message is the generic "Failed to save …" / "Failed to delete …". | UAT-SSOT-09              |
| 7   | **Six calculators have no Save or Load at all:** Steam Tables, Seawater Properties, Custom Tube Bundle, Lateral Tube Bundle, Central Tube Bundle and Thermal Expansion. Their inputs cannot be kept.                               | UAT-THRM-06              |
| 8   | **Condenser and Ejector are on the hub but marked Coming Soon.** They are placeholders, not working tools.                                                                                                                         | UAT-THRM-01              |

Four more things that are not bugs but will surprise you:

- **There is no separate "edit entities" permission.** Anyone who can create an entity can also edit, archive and restore any entity. If you want someone to be able to add vendors but not change existing ones, that is not possible today.
- **Entity edits are saved straight from your browser.** Creation goes through a checked server-side route; edits do not. It works, but it means the duplicate checks that guard creation do not guard an edit — you can rename an entity to clash with another one.
- **Deleting a saved calculation happens instantly, with no "are you sure".** One mis-click on the bin icon in the load list and the case is gone.
- **Two older calculator pages, Heat Transfer and Heat Duty, still exist but are not listed on the hub.** The hub deliberately points you at the unified **Heat Exchanger Calculator** instead. If you find a link to either of the old ones anywhere in the app, that is worth reporting.
