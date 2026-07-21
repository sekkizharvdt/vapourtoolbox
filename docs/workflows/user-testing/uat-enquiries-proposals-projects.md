# Enquiries, Proposals & Projects — Workflow Testing

> How to use this: [Testing guide](README.md) · Report problems at **Feedback** in the app, with the test ID at the start of the title (e.g. `UAT-PROP-06 — Approve button visible to the submitter`).

## What this module does

This is the sales-to-delivery spine. A client request comes in as an **enquiry** — typed in by hand or read out of the client's scope-of-work PDF by the app. You decide whether to bid. If you bid, the enquiry becomes a **proposal**: scope, internal costing, the price the client sees, delivery milestones, terms, and a PDF. The proposal goes through internal approval, then out to the client. When the client awards the work, the proposal converts into a **project** with a charter, a budget and a procurement list. Approving the charter hands the procurement list over to the Procurement module as draft purchase requests.

## Before you start

**Permissions you need** (granted from Administration → user permissions):

| Group in the permission screen | What you need                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| **Proposals & Enquiries**      | **View** to open the module; **Manage** to create/edit proposals and to approve them |
| **Projects**                   | **View** to open a project; **Manage** to edit, submit and approve a charter         |
| **Entities**                   | **Edit** — only needed to delete an enquiry you did not create                       |
| **Procurement**                | **View** — only for UAT-PROJ-09, to see the drafted purchase requests                |
| **Accounting**                 | **View** — only for UAT-PROJ-07, to see the cost centre that gets created            |

**Test data you need first:**

- At least one **active client entity** with a contact person, email and address filled in (address is needed for the proposal PDF).
- One **scope-of-work PDF** from a real (or realistic) client enquiry, under 10 MB, for UAT-ENQ-03.
- For UAT-PROJ-09, the Procurement module reachable with at least **View Procurement**.

**A second user:** yes — several tests need one.

- **UAT-PROP-05 / 06** need a second person with **Manage Proposals**. You cannot approve a proposal you submitted, and the app hides the buttons from you.
- **UAT-PROJ-06 / 07 / 08 / 10** need a second person with **Manage Projects**. Same rule for the project charter and the order acceptance terms.
- **UAT-PROP-12 / UAT-PROJ-12** need a third, deliberately limited account with **View** only (no Manage), to confirm restricted actions are blocked.

Permission changes take a few minutes to reach someone already signed in. Have them sign out and back in before reporting a permission problem.

**Sidebar:** enquiries and proposals live under **SALES & ESTIMATION → Proposal Management**. Projects live under **DAILY OPERATIONS → Project Management**.

**Read the [Known issues in this module](#known-issues-in-this-module) section at the bottom before you start.**

---

## Test index

| ID          | Workflow                                                          | Needs a 2nd user? | Est. time |
| ----------- | ----------------------------------------------------------------- | ----------------- | --------- |
| UAT-ENQ-01  | Log an enquiry by hand                                            | No                | 10 min    |
| UAT-ENQ-02  | Enquiry round-trip — nothing lost between create, edit, save      | No                | 15 min    |
| UAT-ENQ-03  | Let the app read a scope-of-work PDF                              | No                | 20 min    |
| UAT-ENQ-04  | Record a Bid decision, then revise it                             | No                | 15 min    |
| UAT-ENQ-05  | Record a No Bid decision (final)                                  | No                | 8 min     |
| UAT-ENQ-06  | Mark an enquiry Won / Lost, and delete one                        | No                | 10 min    |
| UAT-PROP-01 | Create a proposal from a Bid enquiry                              | No                | 12 min    |
| UAT-PROP-02 | Fill in the proposal content, and check nothing is lost           | No                | 30 min    |
| UAT-PROP-03 | Build the internal costing and the client price                   | No                | 25 min    |
| UAT-PROP-04 | Generate and save the proposal PDF                                | No                | 12 min    |
| UAT-PROP-05 | Submit for approval, then cancel the submission                   | Yes               | 12 min    |
| UAT-PROP-06 | Request changes, reject, then approve                             | Yes               | 20 min    |
| UAT-PROP-07 | Send the proposal to the client                                   | No                | 8 min     |
| UAT-PROP-08 | Record the client outcome: negotiating, then awarded              | No                | 12 min    |
| UAT-PROP-09 | Record a loss and an expiry                                       | Yes               | 15 min    |
| UAT-PROP-10 | Create a revision after client feedback                           | Yes               | 20 min    |
| UAT-PROP-11 | Clone, save as template, extend validity                          | No                | 15 min    |
| UAT-PROP-12 | Proposal permissions and locked records                           | Yes               | 15 min    |
| UAT-PROJ-01 | Convert an awarded proposal into a project                        | No                | 15 min    |
| UAT-PROJ-02 | Fill the charter — authorization, objectives, deliverables, scope | No                | 30 min    |
| UAT-PROJ-03 | Charter procurement items                                         | No                | 20 min    |
| UAT-PROJ-04 | Document requirements                                             | No                | 15 min    |
| UAT-PROJ-05 | Project budget                                                    | No                | 15 min    |
| UAT-PROJ-06 | Submit the charter for approval                                   | Yes               | 15 min    |
| UAT-PROJ-07 | Approve the charter and watch what happens automatically          | Yes               | 20 min    |
| UAT-PROJ-08 | Reject a charter and re-submit it                                 | Yes               | 15 min    |
| UAT-PROJ-09 | Charter procurement items become purchase requests                | Yes               | 15 min    |
| UAT-PROJ-10 | Order acceptance — record the signed order and approve it         | Yes               | 25 min    |
| UAT-PROJ-11 | Milestones and timeline                                           | No                | 15 min    |
| UAT-PROJ-12 | Project permissions and locked records                            | Yes               | 15 min    |

---

## UAT-ENQ-01 — Log an enquiry by hand

**Goal:** capture a client request that arrived by email or phone, so it can be evaluated and turned into a proposal.
**Who:** anyone with **View Proposals**; **Manage Proposals** to be safe.
**Before you start:** you need one active client entity in Entities.

| #   | Do this                                                                                                                   | You should see                                                                                                    | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | From the sidebar, open **Proposal Management**                                                                            | The Proposals landing page, with an **Enquiries** card under "Proposal Workflow"                                  | ☐     |       |
| 2   | Click **Enquiries**                                                                                                       | The Enquiries list, with four count cards across the top: **Active**, **Submitted**, **Won**, **Lost**            | ☐     |       |
| 3   | Click **New enquiry**                                                                                                     | A dialog titled **Create New Enquiry**, with a dashed panel at the top reading "Have an SOW PDF? Read it for me." | ☐     |       |
| 4   | Type an **Enquiry Title** starting with `TEST`                                                                            | The title is accepted                                                                                             | ☐     |       |
| 5   | Pick your client in **Client**                                                                                            | **Contact Person**, **Client Email** and **Client Phone** fill in from the entity's saved contact, if it has one  | ☐     |       |
| 6   | Set the **Received Date** to today                                                                                        | The date shows in day/month/year order                                                                            | ☐     |       |
| 7   | Set **Urgency** to **Urgent**                                                                                             | The dropdown offers exactly **Standard** and **Urgent**                                                           | ☐     |       |
| 8   | Under **Type of work**, tick **Survey** and **Supply**                                                                    | Both cards get a blue border and a tick in the corner                                                             | ☐     |       |
| 9   | Fill **Description / Scope Overview** with a couple of sentences                                                          | Text is accepted                                                                                                  | ☐     |       |
| 10  | Under **Conditions from the buyer**, click **Add condition**; set the category to **Commercial** and type a short summary | A condition row appears with a category dropdown and a summary box                                                | ☐     |       |
| 11  | Click **Add condition** again and add a second one under **Submission requirements**                                      | Two condition rows                                                                                                | ☐     |       |
| 12  | Click **Create Enquiry**                                                                                                  | The dialog closes and the new enquiry appears at the top of the list                                              | ☐     |       |
| 13  | Note the enquiry number, then open the enquiry by clicking its row                                                        | The enquiry detail page, headed by the enquiry number with the title underneath                                   | ☐     |       |
| 14  | Look at the status chip next to the number                                                                                | **New**                                                                                                           | ☐     |       |

**Also check:**

- The enquiry number is exactly in the form `ENQ-26-01` — the letters `ENQ`, the last two digits of the year, and a two-digit sequence. Create a second enquiry and confirm the sequence goes up by one, with no gaps and no repeats.
- Both conditions you typed are listed on the detail page, under their categories.
- The work components you ticked appear as chips on the detail page.

**Should NOT be possible:**

- Saving with no title, no client, or no work component selected — the form must refuse and say which field is missing.

---

## UAT-ENQ-02 — Enquiry round-trip: nothing lost between create, edit, save

**Goal:** prove that every field you type survives a save-and-reopen. This is the single most common defect in this app — take it seriously.
**Who:** the person who created the enquiry.
**Before you start:** the enquiry from UAT-ENQ-01, in status **New**.

| #   | Do this                                                                              | You should see                                                                                                  | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the enquiry, then click **Edit** in the header                                  | The **Edit Enquiry** page, in three sections: **Basic Information**, **Enquiry Details**, **Budget & Timeline** | ☐     |       |
| 2   | Confirm every value you typed in UAT-ENQ-01 is already in the form                   | Title, client, contact person, email, phone, received date, urgency, description all match                      | ☐     |       |
| 3   | Set **Received Via** to a value other than the default                               | The dropdown accepts it                                                                                         | ☐     |       |
| 4   | Fill **Industry** and **Location**                                                   | Both accepted                                                                                                   | ☐     |       |
| 5   | Fill **Estimated Budget**, pick a **Currency**, and set a **Required Delivery Date** | All three accepted                                                                                              | ☐     |       |
| 6   | Change the **Urgency** to the other value                                            | Changed                                                                                                         | ☐     |       |
| 7   | Click **Save Changes**                                                               | You return to the enquiry detail page, and the changed values are shown there                                   | ☐     |       |
| 8   | Click **Edit** again                                                                 | **Every** field from steps 3–6 is still filled in, with exactly the values you entered                          | ☐     |       |
| 9   | Change nothing. Click **Save Changes**                                               | The button may be greyed out until you change something — that is correct. If you can save, do so               | ☐     |       |
| 10  | Click **Edit** once more                                                             | Still exactly the same values — nothing blanked, no date shifted by a day, no currency reset                    | ☐     |       |

**Also check:**

- The **Required Delivery Date** and **Received Date** must show the same calendar day after every reopen. A date that moves by one day is a bug — report it as Major.
- The estimated budget keeps its currency; it must not silently switch to rupees.

---

## UAT-ENQ-03 — Let the app read a scope-of-work PDF

**Goal:** drop a client's scope-of-work PDF on the app and have it fill the enquiry form, extract the buyer's conditions, and draft a scope list.
**Who:** anyone signed in.
**Before you start:** a scope-of-work or tender PDF under 10 MB. PDFs only.

| #   | Do this                                                                                    | You should see                                                                                                                                                                  | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Proposal Management → **Enquiries** → **New enquiry**                                      | The create dialog                                                                                                                                                               | ☐     |       |
| 2   | In the dashed panel at the top, click **Pick a PDF** and choose your file                  | The file name and size appear as a chip, and a **Read PDF** button appears next to it                                                                                           | ☐     |       |
| 3   | Click **Read PDF**                                                                         | The button changes to **Reading…**; this can take up to a minute for a long document                                                                                            | ☐     |       |
| 4   | Wait for it to finish                                                                      | A success message, and the form below is now filled in                                                                                                                          | ☐     |       |
| 5   | Scroll through the filled fields                                                           | Fields taken from the PDF carry a small note underneath: "Filled from PDF — edit if needed"                                                                                     | ☐     |       |
| 6   | Check the **Conditions from the buyer** section                                            | Several conditions, each with a category, a short summary, and an **AI** chip                                                                                                   | ☐     |       |
| 7   | Expand one condition using the arrow at its right                                          | The exact wording lifted from the document, shown in quotes under "From the document"                                                                                           | ☐     |       |
| 8   | Correct anything the app got wrong, add `TEST` to the title, then click **Create Enquiry** | The enquiry is created                                                                                                                                                          | ☐     |       |
| 9   | Open the new enquiry                                                                       | A blue banner: the AI-parsed scope hasn't been reviewed yet, with a **Review & reorganise** button. Below it, a **Scope outline (from SOW)** card listing the parsed work items | ☐     |       |
| 10  | In the scope outline, check the classification chips on a few items                        | Each item is marked **Supply** or **Service**                                                                                                                                   | ☐     |       |
| 11  | Click **Review & reorganise**                                                              | The **Reorganise parsed scope** page, items grouped by discipline, with a count of items to triage                                                                              | ☐     |       |
| 12  | Move one item to a different discipline using its dropdown                                 | The item moves to the other group                                                                                                                                               | ☐     |       |
| 13  | Drop one item you don't want using the delete action on its row                            | The item disappears from the list and the count goes down                                                                                                                       | ☐     |       |
| 14  | Click **Save & continue**                                                                  | You return to the enquiry; the blue "hasn't been reviewed" banner is gone                                                                                                       | ☐     |       |
| 15  | Re-open the scope outline card                                                             | Your move and your deletion both stuck                                                                                                                                          | ☐     |       |

**Now test reading a PDF _after_ the enquiry already exists:**

| #   | Do this                                                                      | You should see                                                                | Pass? | Notes |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----- | ----- |
| 16  | Open the enquiry from UAT-ENQ-01 (the hand-typed one)                        | Its detail page                                                               | ☐     |       |
| 17  | Find the **Read an attached PDF** section and run it against an attached PDF | It reads the document and adds conditions and a scope outline to that enquiry | ☐     |       |

**Should NOT be possible:**

- Uploading a Word file, an image, or a spreadsheet — the picker must only accept PDFs.
- Uploading a PDF larger than 10 MB — the app must refuse with a clear message, not fail silently.

---

## UAT-ENQ-04 — Record a Bid decision, then revise it

**Goal:** evaluate the opportunity against five criteria and decide to bid, then change your mind before a proposal exists.
**Who:** anyone signed in.
**Before you start:** the enquiry from UAT-ENQ-01, in status **New**, with no proposal against it.

| #   | Do this                                                                   | You should see                                                                                                                      | Pass? | Notes |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the enquiry and click **Make Bid Decision**                          | The **Bid/No-Bid Decision** dialog, headed with the enquiry number and title                                                        | ☐     |       |
| 2   | Read the five collapsible sections                                        | **1. Strategic Alignment**, **2. Win Probability**, **3. Commercial Viability**, **4. Risk Exposure**, **5. Capacity & Capability** | ☐     |       |
| 3   | Expand each section, pick a **Rating** and type a short note              | All five accept a rating and an optional note                                                                                       | ☐     |       |
| 4   | Fill the **Rationale** box under **Decision Rationale**                   | It is marked required, with the helper text "Required - Explain the key factors behind this decision"                               | ☐     |       |
| 5   | Under **Final Decision**, choose **Bid - Proceed with Proposal**          | The confirm button reads **Confirm Bid Decision**                                                                                   | ☐     |       |
| 6   | Click **Confirm Bid Decision**                                            | The dialog closes                                                                                                                   | ☐     |       |
| 7   | Look at the enquiry status chip                                           | **Proposal In Progress**                                                                                                            | ☐     |       |
| 8   | Look at the header buttons                                                | **Make Bid Decision** is gone; **Create Proposal** has appeared                                                                     | ☐     |       |
| 9   | Scroll to the **Bid Decision** panel on the detail page                   | It reads "Bid Decision: Bid", shows your five ratings, your notes and your rationale, and has a **Revise** button                   | ☐     |       |
| 10  | Click **Revise**                                                          | The same dialog, now titled **Revise Bid Decision**, pre-filled with what you entered                                               | ☐     |       |
| 11  | Change one rating and one note, keep the decision on **Bid**, and confirm | The panel shows the changed values; the earlier decision is retained as history                                                     | ☐     |       |

**Also check:**

- Try to save without a rationale. The app must refuse.
- After the decision, the enquiry's status chip stays **Proposal In Progress** until a proposal is actually created — it must not jump ahead.

**Should NOT be possible:**

- Revising the bid decision after a proposal exists — re-run **Revise** after UAT-PROP-01 and confirm the app refuses, or that the **Revise** button is gone.

---

## UAT-ENQ-05 — Record a No Bid decision (final)

**Goal:** decline an opportunity and confirm the enquiry closes off for good.
**Who:** anyone signed in.
**Before you start:** create a fresh enquiry (repeat UAT-ENQ-01 quickly, title it `TEST No-bid`). It must be in status **New** with no bid decision.

| #   | Do this                                                       | You should see                                                            | Pass? | Notes |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the enquiry and click **Make Bid Decision**              | The **Bid/No-Bid Decision** dialog                                        | ☐     |       |
| 2   | Fill all five criteria and the rationale                      | Accepted                                                                  | ☐     |       |
| 3   | Choose **No Bid - Decline Opportunity**                       | The confirm button changes to **Confirm No Bid** and turns red            | ☐     |       |
| 4   | Click **Confirm No Bid**                                      | The dialog closes                                                         | ☐     |       |
| 5   | Look at the status chip                                       | **No Bid**                                                                | ☐     |       |
| 6   | Look at the header buttons                                    | Neither **Make Bid Decision** nor **Create Proposal** is offered any more | ☐     |       |
| 7   | Go back to the Enquiries list and filter by status **No Bid** | Your enquiry is listed                                                    | ☐     |       |

**Should NOT be possible:**

- Creating a proposal from a **No Bid** enquiry — there must be no route to it.
- Re-opening the bid decision on a **No Bid** enquiry.

---

## UAT-ENQ-06 — Mark an enquiry Won / Lost, and delete one

**Goal:** close out an enquiry from the enquiry side, and remove a mistaken one.
**Who:** the person who created the enquiry, or someone with **Edit Entities**.
**Before you start:** create two throwaway enquiries, `TEST Won` and `TEST Delete`.

| #   | Do this                                             | You should see                                                           | Pass? | Notes |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open `TEST Won`, click the **⋮** menu in the header | Menu items **Mark as Won**, **Mark as Lost**, and **Delete Enquiry**     | ☐     |       |
| 2   | Click **Mark as Won**                               | The status chip becomes **Won**                                          | ☐     |       |
| 3   | Refresh the page                                    | Still **Won**; an outcome date is recorded                               | ☐     |       |
| 4   | Open a different enquiry and use **Mark as Lost**   | The status chip becomes **Lost**                                         | ☐     |       |
| 5   | Open `TEST Delete`, use **⋮** → **Delete Enquiry**  | The status becomes **Cancelled** — the record is not erased, just closed | ☐     |       |
| 6   | Go to the Enquiries list                            | The cancelled enquiry no longer appears in the normal list               | ☐     |       |
| 7   | Filter the list by status **Cancelled**             | The cancelled enquiry is findable there                                  | ☐     |       |

**Also check:**

- ⚠ **Known issue — do not report.** If the enquiry has a proposal linked to it, **Mark as Won** and **Mark as Lost** change only the enquiry. The proposal keeps whatever status it had. The correct way to record a client outcome is on the **proposal** (see UAT-PROP-08 / UAT-PROP-09), which updates both. Test the enquiry-side buttons on enquiries that have no proposal.
- The Won / Lost counts on the Enquiries list cards go up when you mark an enquiry.

**Should NOT be possible:**

- Deleting an enquiry you did not create, if you do not have **Edit Entities** permission — the app must refuse with a clear message, not fail silently.

---

## UAT-PROP-01 — Create a proposal from a Bid enquiry

**Goal:** turn a bid decision into a working proposal that inherits the enquiry's scope and work components.
**Who:** **Manage Proposals**.
**Before you start:** the enquiry from UAT-ENQ-04, in status **Proposal In Progress**, decision **Bid**. Ideally use the AI-parsed enquiry from UAT-ENQ-03 so there is a scope list to inherit.

| #   | Do this                                          | You should see                                                                                                                    | Pass? | Notes |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the enquiry and click **Create Proposal**   | A dialog titled **Start a new proposal**, subtitled with the enquiry number and client name                                       | ☐     |       |
| 2   | Look at **Type of work**                         | The same work components you ticked on the enquiry, as chips, with a note that they are inherited                                 | ☐     |       |
| 3   | Check the **Proposal title**                     | Pre-filled from the enquiry title; editable                                                                                       | ☐     |       |
| 4   | Set **Valid until** to 30 days from today        | The date is accepted; past dates are refused                                                                                      | ☐     |       |
| 5   | Type something into **Initial notes (optional)** | Accepted                                                                                                                          | ☐     |       |
| 6   | Read the blue note at the bottom of the dialog   | It explains internal costing is in rupees and the client-facing currency is chosen later on the Pricing tab                       | ☐     |       |
| 7   | Click **Create proposal**                        | You land on the proposal detail page                                                                                              | ☐     |       |
| 8   | Read the header                                  | The proposal number, the title underneath, and a status chip reading **Draft**                                                    | ☐     |       |
| 9   | Read the tab strip                               | **Overview, Description, Qualifications, Scope, Compliance, Costing, Pricing, Delivery, Terms, Cover Letter, Preview**            | ☐     |       |
| 10  | Open the **Scope** tab                           | If you started from the AI-parsed enquiry, the parsed scope items are already here, grouped by category and marked Supply/Service | ☐     |       |
| 11  | Open the **Pricing** tab                         | Default settings are already seeded: overhead, contingency and profit percentages, a tax rate of **18%**, and currency **INR**    | ☐     |       |
| 12  | Open the **Terms** tab                           | A set of default terms blocks is already there, not an empty page                                                                 | ☐     |       |
| 13  | Go back to the enquiry                           | Status is still **Proposal In Progress**, and the header button now reads **Open** followed by the proposal number                | ☐     |       |

**Also check:**

- The proposal number is exactly in the form `PROP-26-01` — the letters `PROP`, the last two digits of the year, and a two-digit sequence. Create a second proposal and confirm it increments by one.
- The proposal shows revision 1 (a "Rev" chip only appears from revision 2 onwards).

**Should NOT be possible:**

- Creating a second, parallel proposal from the same enquiry while the first one is still live — the enquiry's header button must offer to **open** the existing proposal instead of creating a new one.
- Creating a proposal from an enquiry whose bid decision was **No Bid**.
- Creating a proposal from an enquiry with no work components — the create button must stay disabled with a warning telling you to set the type of work on the enquiry first.

---

## UAT-PROP-02 — Fill in the proposal content, and check nothing is lost

**Goal:** fill every content tab of a proposal, then reopen each one and confirm every value survived. This is the round-trip test for the proposal form.
**Who:** **Manage Proposals**.
**Before you start:** the proposal from UAT-PROP-01, in status **Draft**.

| #   | Do this                                                                                                                       | You should see                                                                                                           | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open the **Description** tab and write a project brief                                                                        | Text is accepted and there is a save action                                                                              | ☐     |       |
| 2   | Save, move to another tab, come back                                                                                          | Your text is still there, word for word                                                                                  | ☐     |       |
| 3   | Open **Qualifications** and add two entries                                                                                   | Both appear in the list                                                                                                  | ☐     |       |
| 4   | Open **Scope**; in one category click the add action and fill **Name**, **Description**, **Quantity**, **Unit** and **Notes** | The item appears in the category table                                                                                   | ☐     |       |
| 5   | Edit an existing item and change its classification between **Supply** and **Service**                                        | The chip on the row changes to match                                                                                     | ☐     |       |
| 6   | Untick the "included" checkbox on one item                                                                                    | The summary bar at the bottom moves that item from "included" to "excluded"                                              | ☐     |       |
| 7   | Confirm at least **two items are included and classified as Supply**                                                          | The summary bar shows them. You will need these later — they become the project's budget lines                           | ☐     |       |
| 8   | Open **Compliance** and add an entry to the compliance matrix                                                                 | It is listed                                                                                                             | ☐     |       |
| 9   | Open **Delivery**; set **Total Duration (Weeks)** and a **Delivery Description**                                              | Both accepted                                                                                                            | ☐     |       |
| 10  | Click **Add Milestone** three times and fill each row: description, deliverable, duration in weeks, payment %, tax            | Three numbered milestone rows                                                                                            | ☐     |       |
| 11  | Make the three payment percentages add up to 100                                                                              | The **Total Payment** figure in the table footer reads 100%                                                              | ☐     |       |
| 12  | Save the Delivery tab                                                                                                         | Saved                                                                                                                    | ☐     |       |
| 13  | Open **Terms** and edit one of the default terms blocks, then add a new one                                                   | Both changes saved                                                                                                       | ☐     |       |
| 14  | Open **Cover Letter** and write a letter                                                                                      | Saved                                                                                                                    | ☐     |       |
| 15  | **Now reload the whole page** and walk every tab again, in order                                                              | Every single value from steps 1–14 is exactly as you left it — no blank fields, no reset percentages, no lost milestones | ☐     |       |

**Also check:**

- The milestone payment percentages must still total the same after the reload. A total that drifts is a Critical bug.
- Quantities and units on scope items must keep their exact values (`2.5` must not become `2` or `2.50000001`).
- The **Overview** tab shows a pricing summary; leave it for now — it is exercised in UAT-PROP-03.

---

## UAT-PROP-03 — Build the internal costing and the client price

**Goal:** cost the job internally in rupees, then set the price the client sees, in whatever currency they are quoted in.
**Who:** **Manage Proposals**.
**Before you start:** the proposal from UAT-PROP-02, in status **Draft**, with scope items filled in.

**Costing (internal, always in rupees):**

| #   | Do this                                                                   | You should see                                                                                                                                             | Pass? | Notes |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the **Costing** tab                                                  | Costing blocks already seeded from the work components you chose on the enquiry                                                                            | ☐     |       |
| 2   | Check which blocks were seeded                                            | Survey work gives a manpower roster and a per-manday block; engineering and installation give manpower blocks; supply gives a bill-of-materials cost sheet | ☐     |       |
| 3   | In a manpower block, click **Add row** and fill in mandays and a day rate | The row total appears immediately, mandays × rate                                                                                                          | ☐     |       |
| 4   | Change the day rate                                                       | The row total and the block subtotal both update as you type, without saving                                                                               | ☐     |       |
| 5   | Add a second row                                                          | The block subtotal is the sum of both rows                                                                                                                 | ☐     |       |
| 6   | Click **Add block** and add another block type                            | The new block appears with its own rows                                                                                                                    | ☐     |       |
| 7   | In the supply cost sheet block, link a bill of materials                  | The linked BOM's cost pulls into the block subtotal                                                                                                        | ☐     |       |
| 8   | Click **Save**                                                            | A success message                                                                                                                                          | ☐     |       |
| 9   | Reload the page and reopen **Costing**                                    | Every block, row, quantity and rate is exactly as saved                                                                                                    | ☐     |       |

**Pricing (what the client sees):**

| #   | Do this                                                              | You should see                                                                                                           | Pass? | Notes |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 10  | Open the **Pricing** tab                                             | **Overhead**, **Contingency** and **Profit** percentages, price sections, a tax label and tax rate, and a quote currency | ☐     |       |
| 11  | Change the **Profit** percentage                                     | The revenue target and the section amounts recalculate straight away                                                     | ☐     |       |
| 12  | Click **Add section** and give it a name and an amount               | Two price sections now; the totals reflect both                                                                          | ☐     |       |
| 13  | Untick "include" on one section                                      | Its amount drops out of the total                                                                                        | ☐     |       |
| 14  | Change the **Tax rate** from 18 to another value                     | The tax amount and the grand total both change                                                                           | ☐     |       |
| 15  | Change the **Quote currency** to a foreign currency and set the rate | The client-facing figures convert; the costing tab stays in rupees                                                       | ☐     |       |
| 16  | Click **Save**                                                       | Success message                                                                                                          | ☐     |       |
| 17  | Open the **Overview** tab                                            | A pricing summary matching the Pricing tab exactly — same subtotal, same tax, same total                                 | ☐     |       |
| 18  | Reload the page and check both tabs                                  | Percentages, sections, tax rate, currency and rate all survived                                                          | ☐     |       |

**Also check:**

- The header of the proposal shows a chip reading "Quote in" followed by the currency symbol and code once you switch currency.
- Every amount is rounded to two decimals. A total ending in three or more decimals is a bug.
- The Overview summary total and the Preview tab total must be the same number.

---

## UAT-PROP-04 — Generate and save the proposal PDF

**Goal:** produce the client-facing document, and confirm it picks up live company and client details.
**Who:** **Manage Proposals**.
**Before you start:** the proposal from UAT-PROP-03. Your company profile (name, address, logo) must be filled in under Company Settings, and the client entity must have an address.

| #   | Do this                                         | You should see                                                                                                                               | Pass? | Notes |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the proposal and go to the **Preview** tab | A full on-screen rendering: client information, scope of work, commercial summary, terms                                                     | ☐     |       |
| 2   | Check the client block                          | The client's address as held in Entities, not a stale copy                                                                                   | ☐     |       |
| 3   | Check the **Commercial Summary**                | The same total as the Pricing tab                                                                                                            | ☐     |       |
| 4   | Click **Generate PDF**                          | A PDF downloads                                                                                                                              | ☐     |       |
| 5   | Open the PDF                                    | Your company logo and address at the top, the client's details, the scope, the milestones, the terms and the total — all matching the screen | ☐     |       |
| 6   | Return to the app                               | The button now reads **Regenerate PDF**, and a **View PDF** button has appeared                                                              | ☐     |       |
| 7   | Click **View PDF**                              | The saved PDF opens in a new tab                                                                                                             | ☐     |       |

**Also check (after UAT-PROP-06, once the proposal is Approved):**

- The proposal header gains **Download PDF** and **Save PDF** buttons. **Download PDF** downloads without storing; **Save PDF** downloads _and_ stores a copy, after which a **View Saved PDF** link appears in the header.
- The stored PDF's file name contains the proposal number and the revision number.
- While the proposal is still **Draft**, the header **Download PDF** / **Save PDF** buttons are not offered — only the Preview tab's **Generate PDF**.

---

## UAT-PROP-05 — Submit for approval, then cancel the submission

**Goal:** send a finished draft to a colleague for internal approval, and get it back if you sent it by mistake.
**Who:** you (**Manage Proposals**) plus a second person with **Manage Proposals**.
**Before you start:** the proposal from UAT-PROP-04, in status **Draft**.

| #   | Do this                                                                 | You should see                                                                                | Pass? | Notes |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the proposal and click **Submit for Approval**                     | A dialog titled **Submit for Approval**, explaining the chosen person gets an actionable task | ☐     |       |
| 2   | Open the **Approver** dropdown                                          | Your colleagues with proposal-approval permission, by name and email                          | ☐     |       |
| 3   | Confirm your own name is **not** in the list                            | You cannot pick yourself                                                                      | ☐     |       |
| 4   | Choose your second user and click **Send for Approval**                 | The dialog closes                                                                             | ☐     |       |
| 5   | Look at the status chip                                                 | **Pending Approval**, plus a chip reading "Pending with" and the approver's name              | ☐     |       |
| 6   | Look at the banner across the top                                       | "Proposal is locked for edits", telling you to cancel the submission to get back to draft     | ☐     |       |
| 7   | Try to edit anything on the **Scope** or **Pricing** tab                | Editing is blocked — the save controls are disabled                                           | ☐     |       |
| 8   | **As the second user**, sign in and open the notifications bell         | A task titled with the proposal, asking for review                                            | ☐     |       |
| 9   | As the second user, open **Flow → Inbox**                               | The same review task listed there, and clicking it opens the proposal                         | ☐     |       |
| 10  | **Back as yourself**, open the proposal and click **Cancel Submission** | Status returns to **Draft**, the lock banner disappears, and editing works again              | ☐     |       |
| 11  | As the second user, check the notifications bell again                  | The review task is gone (or marked done)                                                      | ☐     |       |
| 12  | Re-submit the proposal to the second user                               | Back to **Pending Approval** — needed for UAT-PROP-06                                         | ☐     |       |

**Should NOT be possible:**

- Picking yourself as the approver.
- The second user seeing a **Cancel Submission** button — only the person who submitted may cancel.
- Editing a proposal that is **Pending Approval**.

---

## UAT-PROP-06 — Request changes, reject, then approve

**Goal:** exercise all three approver decisions and confirm where each one leaves the proposal.
**Who:** the second user, with **Manage Proposals**.
**Before you start:** the proposal from UAT-PROP-05, in status **Pending Approval**, with the second user as approver.

**As the submitter first — confirm you are locked out of approving:**

| #   | Do this                            | You should see                                                                    | Pass? | Notes |
| --- | ---------------------------------- | --------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the proposal as the submitter | **No** Approve button, and no Reject or Request Changes entries in the **⋮** menu | ☐     |       |

**As the second user:**

| #   | Do this                                                           | You should see                                                                                  | Pass? | Notes |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----- | ----- |
| 2   | Open the proposal; look at the header and the **⋮** menu          | An **Approve** button in the header; **Reject** and **Request Changes** in the menu             | ☐     |       |
| 3   | Click **Request Changes**                                         | A dialog asking "What changes are needed?"                                                      | ☐     |       |
| 4   | Type what needs changing and confirm                              | Status returns to **Draft**                                                                     | ☐     |       |
| 5   | **As the submitter**, open the proposal                           | Editable again, and the approval history shows the change request with your colleague's comment | ☐     |       |
| 6   | As the submitter, submit for approval again to the same person    | **Pending Approval**                                                                            | ☐     |       |
| 7   | **As the second user**, click **Reject** and give a reason        | Status returns to **Draft** — rejection here means "returned for revision", not a dead end      | ☐     |       |
| 8   | As the submitter, confirm the rejection reason is visible         | Shown in the approval history                                                                   | ☐     |       |
| 9   | As the submitter, submit for approval a third time                | **Pending Approval**                                                                            | ☐     |       |
| 10  | **As the second user**, click **Approve**, add a comment, confirm | Status becomes **Approved**                                                                     | ☐     |       |
| 11  | **As the submitter**, check the notifications bell                | A notification that your proposal was approved                                                  | ☐     |       |
| 12  | Open the proposal                                                 | Header now offers **Download PDF** and **Save PDF**; the content tabs are still read-only       | ☐     |       |

**Also check:**

- The approval history lists all four events in order — change request, rejection, and the approval — each with who did it and when.

**Should NOT be possible:**

- Approving, rejecting or requesting changes on your own submission. If any of those controls is visible to the submitter, that is a Critical bug.
- Approving a proposal that is already **Approved**.

---

## UAT-PROP-07 — Send the proposal to the client

**Goal:** record that the approved proposal has gone out to the customer.
**Who:** **Manage Proposals**.
**Before you start:** the proposal from UAT-PROP-06, in status **Approved**.

| #   | Do this                                             | You should see                                                                                           | Pass? | Notes |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the proposal and go to the **Preview** tab     | A **Submit to Client** button in green                                                                   | ☐     |       |
| 2   | Click **Submit to Client**                          | A confirmation dialog **Submit Proposal to Client**, showing the proposal number, client and total price | ☐     |       |
| 3   | Read it, then click **Submit to Client** to confirm | The dialog closes                                                                                        | ☐     |       |
| 4   | Look at the status chip                             | **Submitted**                                                                                            | ☐     |       |
| 5   | Look at the Preview tab header                      | A green **Submitted** chip; the **Submit to Client** button is gone                                      | ☐     |       |
| 6   | Look at the proposal header                         | A **Mark as Awarded** button has appeared                                                                | ☐     |       |
| 7   | Open the **⋮** menu                                 | **Mark Under Negotiation**, **Mark as Lost** and **Mark as Expired** are now offered                     | ☐     |       |

**Also check:**

- The submission date recorded is today's date — this is the date sent to the client, and is different from the internal approval date.
- The linked enquiry is still findable and shows the proposal.

---

## UAT-PROP-08 — Record the client outcome: negotiating, then awarded

**Goal:** track the deal through negotiation to a win, and confirm the enquiry follows along automatically.
**Who:** **Manage Proposals**.
**Before you start:** the proposal from UAT-PROP-07, in status **Submitted**.

| #   | Do this                                                    | You should see                                                                               | Pass? | Notes |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the proposal, **⋮** menu → **Mark Under Negotiation** | A dialog asking for optional notes                                                           | ☐     |       |
| 2   | Summarise the client's comments and confirm                | Status becomes **Under Negotiation**                                                         | ☐     |       |
| 3   | Check the header                                           | **Mark as Awarded** is still offered; **Mark Under Negotiation** has dropped out of the menu | ☐     |       |
| 4   | Click **Mark as Awarded**                                  | A dialog asking for an award reference or notes — for example the client's order number      | ☐     |       |
| 5   | Enter the client's order reference and confirm             | Status becomes **Accepted**                                                                  | ☐     |       |
| 6   | Look at the header                                         | A **Convert to Project** button has appeared                                                 | ☐     |       |
| 7   | Open the **linked enquiry**                                | Its status has changed to **Won** on its own, with an outcome date                           | ☐     |       |
| 8   | Go back to the proposal                                    | Still **Accepted**; all content tabs read-only                                               | ☐     |       |

**Also check:**

- The award reference you typed is recorded against the proposal.
- **Accepted** is a final status — the outcome menu entries must not still be offered.

**Should NOT be possible:**

- Marking a proposal **Awarded** while it is still **Draft**, **Pending Approval** or **Approved** — the button must only appear once it has been sent to the client.

---

## UAT-PROP-09 — Record a loss and an expiry

**Goal:** close out the two unhappy endings, and confirm a loss requires a reason.
**Who:** **Manage Proposals**, plus a second user to approve the practice proposals.
**Before you start:** two more proposals taken through to **Submitted** (repeat UAT-PROP-01 → 07 quickly on throwaway enquiries). Call them `TEST Lost` and `TEST Expired`.

| #   | Do this                                               | You should see                                                             | Pass? | Notes |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open `TEST Lost`, **⋮** → **Mark as Lost**            | A dialog asking for a **Reason for loss**                                  | ☐     |       |
| 2   | Leave the reason blank and try to confirm             | The app refuses — a reason is required for a loss                          | ☐     |       |
| 3   | Type a reason (price, scope, competitor…) and confirm | Status becomes **Rejected** — this is the client's rejection, and is final | ☐     |       |
| 4   | Open the linked enquiry                               | Its status has changed to **Lost** on its own                              | ☐     |       |
| 5   | Open `TEST Expired`, **⋮** → **Mark as Expired**      | A dialog asking for optional notes                                         | ☐     |       |
| 6   | Confirm without typing anything                       | Accepted — notes are optional here. Status becomes **Expired**             | ☐     |       |
| 7   | Check the linked enquiry for `TEST Expired`           | The enquiry is unchanged — only a win or a loss syncs across               | ☐     |       |

**Should NOT be possible:**

- Converting a **Rejected** or **Expired** proposal to a project.
- Editing a **Rejected** or **Expired** proposal — the only way forward is a new revision.

---

## UAT-PROP-10 — Create a revision after client feedback

**Goal:** fold client feedback into a new revision without losing the record of what was originally sent.
**Who:** **Manage Proposals**, plus a second user to approve the revision.
**Before you start:** a proposal in status **Submitted** or **Under Negotiation** — use `TEST Expired` from UAT-PROP-09 or take a fresh one to **Submitted**.

| #   | Do this                                                                                       | You should see                                                                                         | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open the proposal, **⋮** menu → **Create Revision**                                           | A dialog titled **Create Revision 2 of** the proposal number, explaining everything will be pre-filled | ☐     |       |
| 2   | Try to confirm with the reason box empty                                                      | The confirm button stays disabled — a reason is required                                               | ☐     |       |
| 3   | Type the reason (e.g. "Client asked for a 24-month warranty") and confirm                     | You land on the new revision                                                                           | ☐     |       |
| 4   | Look at the header                                                                            | Same proposal number, a **Rev 2** chip, and status **Draft**                                           | ☐     |       |
| 5   | Walk through Scope, Costing, Pricing, Delivery, Terms and Cover Letter                        | Every value carried over from revision 1                                                               | ☐     |       |
| 6   | Check the PDF area of the header                                                              | No saved PDF is attached to the new revision — it starts clean                                         | ☐     |       |
| 7   | Change the pricing (e.g. add 5% to the profit) and save                                       | Saved                                                                                                  | ☐     |       |
| 8   | Find the revision history on the proposal                                                     | Revision 1 is listed and still openable, marked as an earlier revision                                 | ☐     |       |
| 9   | Open revision 1                                                                               | It is read-only and keeps its original status and figures                                              | ☐     |       |
| 10  | Compare the two revisions using the comparison view                                           | The pricing difference you made in step 7 is shown, along with any scope, terms or delivery changes    | ☐     |       |
| 11  | Submit revision 2 for approval, have the second user approve it, then submit it to the client | The full cycle works on a revision exactly as it did on revision 1                                     | ☐     |       |

**Should NOT be possible:**

- Creating a revision from revision 1 once revision 2 exists — only the latest revision may spawn a new one.
- Creating a revision from a plain **Draft** proposal — a draft is simply edited. The menu entry must not be offered.

---

## UAT-PROP-11 — Clone, save as template, extend validity

**Goal:** reuse a proposal for a different client, keep a reusable template, and push out the validity date.
**Who:** **Manage Proposals**.
**Before you start:** any proposal with scope, pricing and terms filled in.

| #   | Do this                                                                        | You should see                                                                                                                                    | Pass? | Notes |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the proposal, **⋮** → **Clone Proposal**                                  | A dialog with a **New Proposal Title** box and four toggles: **Scope Matrix**, **Pricing Configuration**, **Terms & Conditions**, **Attachments** | ☐     |       |
| 2   | Give the clone a title, switch **Attachments** off, leave the rest on, confirm | A new, independent proposal is created with its own new proposal number                                                                           | ☐     |       |
| 3   | Open the clone                                                                 | Status **Draft**, revision 1; scope, pricing and terms copied; no attachments                                                                     | ☐     |       |
| 4   | Change something in the clone's pricing                                        | The original proposal is unaffected                                                                                                               | ☐     |       |
| 5   | On the original, **⋮** → **Save as Template**                                  | A dialog with **Template Name**, **Description**, **Category** and content toggles                                                                | ☐     |       |
| 6   | Fill it in and save                                                            | Saved                                                                                                                                             | ☐     |       |
| 7   | Go to Proposal Management → **Templates**                                      | Your template is listed under the category you chose                                                                                              | ☐     |       |
| 8   | On any proposal, **⋮** → **Extend Validity**                                   | A dialog **Extend Proposal Validity** with a **Valid Until** date                                                                                 | ☐     |       |
| 9   | Push the date out by 30 days and confirm                                       | The new validity date shows on the proposal                                                                                                       | ☐     |       |
| 10  | Reload the page                                                                | The new validity date persisted                                                                                                                   | ☐     |       |

---

## UAT-PROP-12 — Proposal permissions and locked records

**Goal:** confirm someone with view-only access can look but not touch, and that finished proposals can't be edited.
**Who:** a limited account with **View Proposals** but **not** Manage Proposals.
**Before you start:** proposals in **Draft**, **Pending Approval**, **Approved** and **Accepted** from the tests above.

| #   | Do this                                                                        | You should see                                                  | Pass? | Notes |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----- | ----- |
| 1   | Sign in as the limited user; open **Proposal Management**                      | The module opens; enquiries and proposals are readable          | ☐     |       |
| 2   | Open a **Draft** proposal and try to edit the Scope tab                        | Editing is refused, or the save controls are disabled           | ☐     |       |
| 3   | Try to submit that draft for approval                                          | Refused, with a message about permission — not a silent failure | ☐     |       |
| 4   | Open a **Pending Approval** proposal                                           | No approve, reject or request-changes controls                  | ☐     |       |
| 5   | Sign in again as a **Manage Proposals** user and open an **Approved** proposal | The lock banner is shown and all content tabs are read-only     | ☐     |       |
| 6   | Try to edit the **Accepted** proposal from UAT-PROP-08                         | Read-only; the only forward path offered is a new revision      | ☐     |       |

**Should NOT be possible:**

- A user without **View Proposals** reaching the Proposal Management module at all — they must see a "no access" page, not a blank screen or an error.
- Any editing of a proposal that is not in **Draft**.

---

## UAT-PROJ-01 — Convert an awarded proposal into a project

**Goal:** turn the won proposal into a live project with a charter, a budget and a client link.
**Who:** the person who won the work; **Manage Projects** to do anything with the resulting project.
**Before you start:** the proposal from UAT-PROP-08, in status **Accepted**, with at least two included **Supply** scope items (from UAT-PROP-02 step 7).

| #   | Do this                                                           | You should see                                                                                                                   | Pass? | Notes |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Open the accepted proposal and click **Convert to Project**       | A dialog **Convert to Project** previewing the project name, budget, duration, deliverable count and client                      | ☐     |       |
| 2   | Check the **Budget** figure                                       | It matches the proposal's total price                                                                                            | ☐     |       |
| 3   | Check the **Duration**                                            | It matches the delivery duration in weeks you set in UAT-PROP-02                                                                 | ☐     |       |
| 4   | Read the "The project will be created with" list                  | Charter with objectives and deliverables, budget from proposal pricing, timeline, client information, and you as project manager | ☐     |       |
| 5   | Click **Create Project**                                          | You are taken to the new project's page                                                                                          | ☐     |       |
| 6   | Read the project header                                           | Project name, a status chip reading **Planning**, a priority chip, and a line with the project code, client and project manager  | ☐     |       |
| 7   | Note the project code                                             | It is exactly in the form `PROJ-2026-0001` — the letters `PROJ`, the four-digit year, and a four-digit sequence                  | ☐     |       |
| 8   | Go back to the proposal                                           | Still **Accepted**, now linked to the project; **Convert to Project** is gone                                                    | ☐     |       |
| 9   | On the project page, open **Charter**                             | The charter page with tabs: **Overview, Charter, Technical, Vendors, Procurement, Documents, Budget, Timeline, Team, Reports**   | ☐     |       |
| 10  | On the **Charter** tab, check the **Project Authorization** panel | Status chip **Draft**; you are named as sponsor                                                                                  | ☐     |       |
| 11  | Open the **Budget** tab                                           | The estimated budget matches the proposal total                                                                                  | ☐     |       |
| 12  | Open the project's **Scope** page                                 | In-scope items taken from the proposal's scope                                                                                   | ☐     |       |
| 13  | Open the project's **Objectives** page                            | Objectives and deliverables carried over from the proposal                                                                       | ☐     |       |

**Also check:**

- Within a few seconds of creating the project, a cost centre is created automatically. Go to **Accounting → Cost Centres** and confirm there is **exactly one** entry for this project, coded `CC-` followed by the project code, with the project's budget on it. Two cost centres for one project is a bug — report it.
- Click **Convert to Project** twice in quick succession (double-click it). Only **one** project must be created.

**Should NOT be possible:**

- Converting the same proposal a second time.
- Converting a proposal that is not **Accepted**.

---

## UAT-PROJ-02 — Fill the charter: authorization, objectives, deliverables, scope

**Goal:** complete the charter so it can be submitted for approval, and confirm the authorization form round-trips.
**Who:** **Manage Projects**.
**Before you start:** the project from UAT-PROJ-01, charter in **Draft**.

**Authorization (the round-trip check for this form):**

| #   | Do this                                                                              | You should see                                                         | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----- | ----- |
| 1   | Project → **Charter** → **Charter** tab; click **Edit** on **Project Authorization** | Three boxes: **Sponsor Name**, **Sponsor Title**, **Budget Authority** | ☐     |       |
| 2   | Fill all three and click **Save**                                                    | The panel returns to read-only and shows all three values              | ☐     |       |
| 3   | Reload the page                                                                      | All three still exactly as typed                                       | ☐     |       |
| 4   | Click **Edit** again                                                                 | All three boxes are pre-filled with the saved values — none blank      | ☐     |       |
| 5   | Change the sponsor title, save, reload, and re-open Edit                             | The new title persisted; the other two are untouched                   | ☐     |       |
| 6   | Try to save with **Sponsor Name** blank                                              | Refused with a message that sponsor name and title are required        | ☐     |       |

**Objectives and deliverables:**

| #   | Do this                                                                                   | You should see                                                                        | Pass? | Notes |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----- | ----- |
| 7   | Open the project's **Objectives** page; click **Add Objective**                           | A dialog with **Description**, **Priority**, **Status** and a criteria list           | ☐     |       |
| 8   | Fill it in, add two success criteria, save                                                | The objective appears as a card                                                       | ☐     |       |
| 9   | Edit that objective; change the priority and add a third criterion; save                  | Reopen it — all three criteria and the new priority are there                         | ☐     |       |
| 10  | Click **Add Deliverable**                                                                 | A dialog with **Name**, **Description**, **Type**, **Status** and acceptance criteria | ☐     |       |
| 11  | Add two deliverables, each with a name, description and at least one acceptance criterion | Both listed                                                                           | ☐     |       |
| 12  | Reload the page                                                                           | Both objectives and both deliverables survived exactly                                | ☐     |       |

**Scope:**

| #   | Do this                                                                                     | You should see                                 | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----- | ----- |
| 13  | Charter → **Scope** area; check **In-Scope Items**                                          | Items carried over from the proposal           | ☐     |       |
| 14  | Add one in-scope item, one **Out-of-Scope / Exclusions** item and one **Assumptions** entry | All three added                                | ☐     |       |
| 15  | Edit one of them in place and save                                                          | The change sticks after a reload               | ☐     |       |
| 16  | Delete one entry                                                                            | It is removed and stays removed after a reload | ☐     |       |

**Also check:**

- The Charter tab shows summary cards counting **Objectives**, **Deliverables** and **Risks Identified**. The counts must match what you actually added.

---

## UAT-PROJ-03 — Charter procurement items

**Goal:** list what needs buying for the project, so purchase requests can be drafted from it.
**Who:** **Manage Projects**.
**Before you start:** the project from UAT-PROJ-02, charter still in **Draft**.

| #   | Do this                                                                                                                                                                                    | You should see                                                                                                                             | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Project → Charter → **Procurement** tab                                                                                                                                                    | **Procurement Planning**, with an **Add Item** button and a note that High/Critical items auto-draft purchase requests on charter approval | ☐     |       |
| 2   | Click **Add Item**                                                                                                                                                                         | A dialog **Add Procurement Item**                                                                                                          | ☐     |       |
| 3   | Fill **every** field: Item Name, Category, Description, Quantity, Unit, Est. Unit Price (INR), Priority, Required By Date, Equipment Code, Equipment Name, Technical Specifications, Notes | All accepted                                                                                                                               | ☐     |       |
| 4   | Set **Priority** to **High** and save                                                                                                                                                      | The item appears in the table with a status chip reading **PLANNING**                                                                      | ☐     |       |
| 5   | Check the **Est. Total** column                                                                                                                                                            | Quantity × unit price, rounded to two decimals                                                                                             | ☐     |       |
| 6   | Click the edit action on the row                                                                                                                                                           | **Every** field you filled in step 3 is pre-filled — nothing blank                                                                         | ☐     |       |
| 7   | Change the quantity and save                                                                                                                                                               | The Est. Total recalculates                                                                                                                | ☐     |       |
| 8   | Reopen the edit dialog                                                                                                                                                                     | The new quantity and all the other fields are intact                                                                                       | ☐     |       |
| 9   | Add a second item with priority **Critical** and a third with priority **Low**                                                                                                             | Three rows, three priority chips                                                                                                           | ☐     |       |
| 10  | Delete the **Low** priority item                                                                                                                                                           | It is removed from the table and stays removed after a reload                                                                              | ☐     |       |
| 11  | Add it back (you will need it in UAT-PROJ-09 to prove low-priority items are not auto-drafted)                                                                                             | Three rows again                                                                                                                           | ☐     |       |
| 12  | On one item, click the **Create PR** action on its row                                                                                                                                     | A draft purchase request is created straight away; the item's status chip changes to **PR DRAFTED** and a **PR** link chip appears         | ☐     |       |
| 13  | Note the purchase request number shown                                                                                                                                                     | It is exactly in the form `PR/2026/0001`                                                                                                   | ☐     |       |
| 14  | Look at that row's actions again                                                                                                                                                           | The **Create PR** action is gone — you cannot draft a second request for the same item                                                     | ☐     |       |

**Should NOT be possible:**

- Adding a procurement item with a preferred vendor that is archived — the app must name the vendor and refuse.
- Creating a second purchase request for an item that already has one.

---

## UAT-PROJ-04 — Document requirements

**Goal:** list the documents the client expects, and confirm they get ticked off automatically when a matching document is uploaded.
**Who:** **Manage Projects**.
**Before you start:** the project from UAT-PROJ-03.

| #   | Do this                                                                                     | You should see                                                                                                                           | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Project → Charter → **Documents** tab                                                       | **Document Requirements** with six count tiles and an **Add Requirement** button                                                         | ☐     |       |
| 2   | Click **Add Requirement**                                                                   | A dialog **Add Document Requirement**                                                                                                    | ☐     |       |
| 3   | Fill every field: Document Type, Category, Description, Priority, Required, Due Date, Notes | All accepted                                                                                                                             | ☐     |       |
| 4   | Save                                                                                        | The requirement is listed with a status chip reading **NOT SUBMITTED**, and the "Not Submitted" tile count goes up                       | ☐     |       |
| 5   | Click the edit action                                                                       | Every field pre-filled with what you typed — including the due date and the notes                                                        | ☐     |       |
| 6   | Change the priority and the due date, save, then reopen the edit dialog                     | Both changes stuck; nothing else was lost                                                                                                | ☐     |       |
| 7   | Add two more requirements in different categories                                           | Three rows; the completion bar reads 0%                                                                                                  | ☐     |       |
| 8   | Upload a document to this project in the same category as one of the requirements           | Within a few seconds that requirement changes to **SUBMITTED** on its own, and shows a link to the document — refresh the page to see it | ☐     |       |
| 9   | Take the linked document through its own approval so it becomes approved                    | The requirement changes to **APPROVED** and the completion percentage goes up                                                            | ☐     |       |
| 10  | Delete one requirement                                                                      | Removed; the tile counts adjust                                                                                                          | ☐     |       |

**Also check:**

- The tiles across the top (**Total**, **Not Submitted**, **Submitted**, **Under Review**, **Approved**, and the completion percentage) must always add up to what the table shows.

---

## UAT-PROJ-05 — Project budget

**Goal:** confirm the project budget carries over from the proposal, tracks actual spend, and locks once the charter is approved.
**Who:** **Manage Projects**.
**Before you start:** the project from UAT-PROJ-01, charter still in **Draft**.

| #   | Do this                                                        | You should see                                                                                                     | Pass? | Notes |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Project → Charter → **Budget** tab                             | **Budget Overview** with an **Edit Budget** button                                                                 | ☐     |       |
| 2   | Check the estimated figure                                     | It matches the proposal's total price from UAT-PROP-03                                                             | ☐     |       |
| 3   | Click **Edit Budget**                                          | **Estimated Budget (INR)** and **Actual Spent (INR)** boxes, both pre-filled                                       | ☐     |       |
| 4   | Change the estimated budget and click **Save**                 | The new figure shows in the overview, and the utilisation percentage recalculates                                  | ☐     |       |
| 5   | Reload the page                                                | The change persisted                                                                                               | ☐     |       |
| 6   | Look at **Budget Breakdown**                                   | A table by category, with amounts, percentage of budget, and status chips such as **Committed** and **Spent**      | ☐     |       |
| 7   | Check that the estimated budget change reached the cost centre | In **Accounting → Cost Centres**, the cost centre for this project shows the new budget amount — refresh to see it | ☐     |       |

**Come back to this test after UAT-PROJ-07 (charter approved):**

| #   | Do this                                                                                  | You should see                                                                                                                   | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 8   | Open the **Budget** tab again                                                            | A message saying the budget is locked because the charter has been approved, and **no** Edit Budget button                       | ☐     |       |
| 9   | Post an expense against this project (a vendor bill or expense claim through Accounting) | Within a few seconds the **Actual Spent** figure and the utilisation percentage update on their own — refresh the page to see it | ☐     |       |

**Also check:**

- ⚠ **Known issue — do not report.** When actual spend passes 90% or 100% of the budget, no alert or task is raised for anyone. The figures update correctly; only the warning is missing.

---

## UAT-PROJ-06 — Submit the charter for approval

**Goal:** confirm the charter cannot be sent for approval until it is complete, and that it reaches an approver when it is.
**Who:** you (**Manage Projects**) plus a second person with **Manage Projects**.
**Before you start:** the project from UAT-PROJ-02 to 05, charter in **Draft**.

| #   | Do this                                                                                           | You should see                                                                                                                                                                         | Pass? | Notes |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Before filling anything in, on a **fresh** project try **Submit for Approval** on the Charter tab | The button is not offered until the sponsor name is saved                                                                                                                              | ☐     |       |
| 2   | On your test project, temporarily delete every objective, then click **Submit for Approval**      | A message listing exactly what is missing, naming the objectives                                                                                                                       | ☐     |       |
| 3   | Put the objectives back and try again with all the deliverable descriptions cleared               | A message naming the incomplete deliverables                                                                                                                                           | ☐     |       |
| 4   | Restore everything and click **Submit for Approval**                                              | Either it submits, or a **Charter Validation Warnings** dialog listing soft warnings (missing risks, missing out-of-scope items, missing acceptance criteria) with a **Submit** button | ☐     |       |
| 5   | If the warnings dialog appears, read the list, then click **Submit**                              | It submits                                                                                                                                                                             | ☐     |       |
| 6   | Look at the **Project Authorization** status chip                                                 | **Pending Approval**                                                                                                                                                                   | ☐     |       |
| 7   | Look at the panel below the chip                                                                  | **Submitted By** with your name and today's date                                                                                                                                       | ☐     |       |
| 8   | Look for approval buttons on your own screen                                                      | None. Instead, a note that you submitted it and another user with project management access must approve                                                                               | ☐     |       |
| 9   | Try to click **Edit** on the authorization panel                                                  | Not offered — a charter awaiting approval cannot be edited                                                                                                                             | ☐     |       |
| 10  | **As the second user**, check the notifications bell                                              | A task headed "Review Charter" with the project name                                                                                                                                   | ☐     |       |
| 11  | As the second user, click the task                                                                | It opens this project's charter page                                                                                                                                                   | ☐     |       |

**Also check:**

- ⚠ The charter cannot be submitted without at least one budget line item, and **there is no screen in the app to add or edit budget line items**. They are created only at conversion, from the proposal's included **Supply** scope items. If your proposal had none, this test cannot pass — see [Known issues](#known-issues-in-this-module). Do not report it; but if you have supply items and the charter still says budget lines are missing, that _is_ worth reporting.

**Should NOT be possible:**

- Submitting a charter with no sponsor details, no objectives, no deliverables, no in-scope items, or no budget lines.

---

## UAT-PROJ-07 — Approve the charter and watch what happens automatically

**Goal:** approve the charter and confirm the three automatic consequences: purchase requests drafted, cost centre in place, budget frozen.
**Who:** the second user, with **Manage Projects**.
**Before you start:** the charter from UAT-PROJ-06, in **Pending Approval**, with the High and Critical procurement items from UAT-PROJ-03 still in status **PLANNING**.

> Approving a charter is not reversible from the app — it drafts purchase requests and freezes the budget. Be sure before you click.

| #   | Do this                                                           | You should see                                                                                                                          | Pass? | Notes |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As the submitter**, open the charter                            | No **Approve Charter** button — you cannot approve what you submitted                                                                   | ☐     |       |
| 2   | **As the second user**, open the charter                          | **Approve Charter** and **Reject** buttons                                                                                              | ☐     |       |
| 3   | Click **Approve Charter**                                         | A confirmation dialog **Approve Project Charter**, warning that purchase requests will be created automatically for High/Critical items | ☐     |       |
| 4   | Click **Approve**                                                 | The status chip becomes **Approved**, and **Approved By** / **Approved At** appear                                                      | ☐     |       |
| 5   | **As the submitter**, check the notifications bell                | A notification that your charter was approved                                                                                           | ☐     |       |
| 6   | Wait a few seconds, then reload the charter's **Procurement** tab | The **High** and **Critical** items have moved to status **PR DRAFTED** and each shows a **PR** link chip                               | ☐     |       |
| 7   | Check the **Low** priority item                                   | Still **PLANNING**, with no purchase request — only High and Critical are auto-drafted                                                  | ☐     |       |
| 8   | Open **Accounting → Cost Centres**                                | Still exactly **one** cost centre for this project — approval must not create a second one                                              | ☐     |       |
| 9   | Open the charter **Budget** tab                                   | A message that the budget is locked because the charter is approved, and no Edit Budget button                                          | ☐     |       |
| 10  | Go back to the **Charter** tab and try to edit the authorization  | The **Edit** button is gone — approved is final                                                                                         | ☐     |       |
| 11  | Try to approve again as a third user with Manage Projects         | Refused — the charter is already approved                                                                                               | ☐     |       |

**Also check:**

- The item that already had a purchase request from UAT-PROJ-03 step 12 must **not** get a second one.

**Should NOT be possible:**

- The submitter approving their own charter. If the **Approve Charter** button is visible to the submitter, that is a Critical bug.
- Editing the charter authorization, or the budget, after approval.

---

## UAT-PROJ-08 — Reject a charter and re-submit it

**Goal:** send an incomplete charter back to its author with a reason, and confirm it can be fixed and re-submitted.
**Who:** you plus a second user, both with **Manage Projects**.
**Before you start:** a **second** project with a charter in **Pending Approval** — repeat UAT-PROJ-01 to 06 on another accepted proposal, or use a project you have not yet approved.

| #   | Do this                                                       | You should see                                                                               | Pass? | Notes |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | **As the second user**, open the charter and click **Reject** | A dialog **Reject Charter**, saying it will be returned to Draft for the submitter to revise | ☐     |       |
| 2   | Try to confirm with the reason box empty                      | The confirm button stays disabled — a reason is required                                     | ☐     |       |
| 3   | Type a reason and click **Reject Charter**                    | The status chip returns to **Draft** — not to a separate "rejected" state                    | ☐     |       |
| 4   | **As the submitter**, open the charter                        | An orange panel headed "Returned for revision:" with the reason your colleague typed         | ☐     |       |
| 5   | Confirm you can edit again                                    | The **Edit** button on the authorization panel is back                                       | ☐     |       |
| 6   | Address the comment, then click **Submit for Approval**       | Status returns to **Pending Approval**; the "Returned for revision" panel clears             | ☐     |       |
| 7   | **As the second user**, approve it                            | **Approved**                                                                                 | ☐     |       |

**Should NOT be possible:**

- The submitter rejecting their own charter.
- Rejecting a charter that is already **Approved**.

---

## UAT-PROJ-09 — Charter procurement items become purchase requests

**Goal:** confirm the handover to Procurement actually happened — the drafted requests are real, findable records with the project's details on them.
**Who:** someone with **View Procurement** (plus **Manage Projects** to see the project side).
**Before you start:** the approved charter from UAT-PROJ-07, with items showing **PR DRAFTED**.

| #   | Do this                                                                                        | You should see                                                                                                         | Pass? | Notes |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Note the purchase request numbers shown against the procurement items on the charter           | Each is in the form `PR/2026/0001`                                                                                     | ☐     |       |
| 2   | Sidebar → **Procurement** → **Purchase Requests**                                              | The purchase requests list                                                                                             | ☐     |       |
| 3   | Find the requests whose numbers you noted                                                      | They are listed, in draft state                                                                                        | ☐     |       |
| 4   | Open one                                                                                       | It names **this project**, and the line item matches the charter item: description, quantity, unit and estimated price | ☐     |       |
| 5   | Check who the request is attributed to                                                         | The colleague who approved the charter, by name — not "System"                                                         | ☐     |       |
| 6   | Check the required-by date                                                                     | The date you set on the charter procurement item                                                                       | ☐     |       |
| 7   | Go back to the project charter's **Procurement** tab, and follow the **PR** link chip on a row | It takes you to the matching purchase request                                                                          | ☐     |       |
| 8   | Take that purchase request forward one step in Procurement (submit it)                         | Back on the charter's Procurement tab, that item's status keeps up with the purchase request — refresh to see it       | ☐     |       |

**Also check:**

- Each purchase request number is unique. Two items must never share one.
- The **Low** priority item still has no purchase request.

---

## UAT-PROJ-10 — Order acceptance: record the signed order and approve it

**Goal:** capture how the client's signed order differs from the proposal you sent, and push those terms onto the charter.
**Who:** you plus a second person, both with **Manage Projects**.
**Before you start:** any project with a charter. This workflow is on the **Charter** tab, below the authorization panel.

| #   | Do this                                                                                 | You should see                                                                                                                                      | Pass? | Notes |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 1   | Project → Charter → **Charter** tab; find the **Order Acceptance** panel                | A status chip reading **Draft**, a **Record** button, and an explanation that this captures the delta from the proposal                             | ☐     |       |
| 2   | Click **Record**                                                                        | A dialog for the signed order                                                                                                                       | ☐     |       |
| 3   | Fill in the document reference, signature date, contract value and currency             | All accepted                                                                                                                                        | ☐     |       |
| 4   | Fill in the schedule duration in days, payment terms in days and a retention percentage | All accepted                                                                                                                                        | ☐     |       |
| 5   | Add at least one entry to the deliverables register                                     | Listed                                                                                                                                              | ☐     |       |
| 6   | Save                                                                                    | A confirmation message; the panel now shows document reference, signature date, contract value, schedule duration and payment terms                 | ☐     |       |
| 7   | Click **Edit** and reopen the dialog                                                    | Every value you entered is pre-filled — nothing blank, no reset dates                                                                               | ☐     |       |
| 8   | Change the retention percentage and save; reopen                                        | The change stuck and nothing else changed                                                                                                           | ☐     |       |
| 9   | Click **Submit for Approval**                                                           | Status chip becomes **Pending Approval**, and a note says another user must approve                                                                 | ☐     |       |
| 10  | Confirm you have no approve or reject buttons                                           | Correct — you submitted it                                                                                                                          | ☐     |       |
| 11  | **As the second user**, open the panel and click **Reject**                             | A dialog **Reject Order Acceptance**, requiring a reason                                                                                            | ☐     |       |
| 12  | Give a reason and reject                                                                | Status becomes **Rejected**, and the reason is shown                                                                                                | ☐     |       |
| 13  | **As either user with Manage Projects**, click **Reopen for Revision**                  | Status returns to **Draft** and the record becomes editable again                                                                                   | ☐     |       |
| 14  | Correct it and submit for approval again                                                | **Pending Approval**                                                                                                                                | ☐     |       |
| 15  | **As the second user**, click **Approve & Apply to Charter**                            | A confirmation warning that the terms will be applied to the charter's schedule, payment terms, key personnel and deliverables register immediately | ☐     |       |
| 16  | Confirm with **Approve & Apply**                                                        | Status becomes **Approved**, and a green message says the terms were applied to the charter, with the date                                          | ☐     |       |
| 17  | Check the charter's schedule, payment terms and deliverables                            | They now match what you entered on the order acceptance, not the original proposal                                                                  | ☐     |       |
| 18  | Look for edit controls on the Order Acceptance panel                                    | None — approved is final                                                                                                                            | ☐     |       |

**Should NOT be possible:**

- The submitter approving the order acceptance terms they submitted.
- Editing an **Approved** order acceptance.
- Approving one still in **Draft**.

---

## UAT-PROJ-11 — Milestones and timeline

**Goal:** confirm the delivery milestones you priced on the proposal, and the charter deliverables, show up on the project timeline.
**Who:** **Manage Projects**.
**Before you start:** the project from UAT-PROJ-02, with milestones set on the source proposal (UAT-PROP-02 steps 10–12) and deliverables with due dates on the charter.

| #   | Do this                                                                    | You should see                                                           | Pass? | Notes |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----- | ----- |
| 1   | Open the project and go to **Timeline**                                    | The "Timeline & Milestones" view                                         | ☐     |       |
| 2   | Look for the charter deliverables                                          | Each deliverable with a due date shows as an event on the timeline       | ☐     |       |
| 3   | Look for the document requirements from UAT-PROJ-04                        | Requirements with due dates also appear as timeline events               | ☐     |       |
| 4   | Add a due date to a deliverable that has none, on the Objectives page      | Within a few seconds it appears on the timeline — refresh to see it      | ☐     |       |
| 5   | Go back to the source proposal and open the **Delivery** tab               | Your three payment milestones, with their payment percentages, unchanged | ☐     |       |
| 6   | Compare the proposal's total duration in weeks against the project's dates | The project's estimated end date is that many weeks after its start date | ☐     |       |

---

## UAT-PROJ-12 — Project permissions and locked records

**Goal:** confirm view-only users cannot change a project, and that approved records stay closed.
**Who:** a limited account with **View Projects** but **not** Manage Projects.
**Before you start:** the approved project from UAT-PROJ-07.

| #   | Do this                                                     | You should see                                                                             | Pass? | Notes |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----- | ----- |
| 1   | Sign in as the limited user and open **Project Management** | The project list opens                                                                     | ☐     |       |
| 2   | Open a project and go to the **Charter** tab                | Readable, but no **Edit** button on the authorization panel                                | ☐     |       |
| 3   | Go to the **Procurement** tab                               | The items are listed, but there is no **Add Item** button and no row actions               | ☐     |       |
| 4   | Go to the **Documents** tab                                 | Requirements listed, but no **Add Requirement** button and no row actions                  | ☐     |       |
| 5   | Go to the **Budget** tab                                    | Figures visible, but no **Edit Budget** button                                             | ☐     |       |
| 6   | Go to the **Objectives** page                               | Objectives and deliverables listed, but no **Add Objective** / **Add Deliverable** buttons | ☐     |       |
| 7   | Look at the projects list                                   | No **New Project** button                                                                  | ☐     |       |

**Should NOT be possible:**

- A user with **View Projects** only submitting, approving or rejecting a charter.
- A user with no project permissions at all reaching Project Management — they must see a "no access" page.

---

## Known issues in this module

Read this before you start. These are already on the fix list — **do not file feedback for them.**

1. **Marking an enquiry Won or Lost does not move its proposal.** On the enquiry's **⋮** menu, **Mark as Won** and **Mark as Lost** update only the enquiry; a proposal linked to it keeps whatever status it had. Record client outcomes on the **proposal** instead (**Mark as Awarded** / **Mark as Lost**) — that path updates both. Affects UAT-ENQ-06.

2. **Charter budget line items cannot be added or edited anywhere in the app.** They are created once, at the moment a proposal is converted to a project, from the proposal's included **Supply** scope items. Charter approval requires at least one budget line item with a description, a cost above zero and an execution type. So a proposal that was purely services (no supply scope items) produces a project whose charter can never be submitted or approved, with no way to fix it from the screen. Affects UAT-PROJ-06 and UAT-PROJ-07 — make sure your test proposal has at least two included Supply scope items (UAT-PROP-02 step 7) so you can get through those tests. Do not report the missing editor; **do** report it if you have supply items and the charter still complains about budget lines.

3. **Budget threshold alerts are not raised.** When actual spend on a project passes 90% or 100% of the budget, the figures update correctly but nobody is notified — no task, no email, no banner. Affects UAT-PROJ-05.

**Previously broken, now expected to work — report these if they fail:**

- **Recording a client outcome on the proposal and converting to a project.** An older version of this app had no way to mark a proposal as accepted, which made **Convert to Project** unreachable. That has been fixed: **Mark as Awarded** on a **Submitted** or **Under Negotiation** proposal moves it to **Accepted** and reveals **Convert to Project**. If UAT-PROP-08 or UAT-PROJ-01 fails, that is a real regression — report it as Major.
- **Charter submit-for-approval and self-approval blocking.** The charter previously jumped straight from draft to approved with no approver check. It now has a proper **Submit for Approval** step and the submitter cannot approve their own charter. If UAT-PROJ-06 or UAT-PROJ-07 shows otherwise, report it as Critical.
- **Duplicate cost centres.** A project used to be able to end up with two cost centres — one at creation, one at charter approval. This is fixed. If UAT-PROJ-01 or UAT-PROJ-07 turns up two, report it as Major.
- **Repeated or clashing document numbers.** Enquiry, proposal, project and purchase request numbers all come from proper counters now. If you ever see the same number twice, or a gap where two people created records at the same moment, report it as Critical.
