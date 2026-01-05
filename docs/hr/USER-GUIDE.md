# HR Module User Guide

This guide covers all HR activities in Vapour Toolbox, including leave management, on-duty requests, holiday handling, travel expenses, and employee management.

---

## Table of Contents

1. [Leave Management](#1-leave-management)
2. [On-Duty Requests & Comp-Off](#2-on-duty-requests--comp-off)
3. [Holiday Management](#3-holiday-management)
4. [Travel Expense Management](#4-travel-expense-management)
5. [Employee Management](#5-employee-management)
6. [Admin Configuration](#6-admin-configuration)

---

## 1. Leave Management

### 1.1 Leave Types

The system supports multiple leave types, each with configurable properties:

| Leave Type | Description                                   | Default Quota | Carry Forward |
| ---------- | --------------------------------------------- | ------------- | ------------- |
| SICK       | Sick leave for medical reasons                | 12 days/year  | No            |
| CASUAL     | Personal/casual leave                         | 12 days/year  | No            |
| EARNED     | Annual/earned leave                           | Varies        | Yes (max 5)   |
| UNPAID     | Unpaid leave                                  | Unlimited     | No            |
| MATERNITY  | Maternity leave                               | As per policy | No            |
| PATERNITY  | Paternity leave                               | As per policy | No            |
| COMP_OFF   | Compensatory off (earned by working holidays) | 0 (earned)    | Yes (max 20)  |

### 1.2 Viewing Your Leave Balance

**Path:** HR → Leaves → My Leaves

Your leave dashboard shows:

- **Entitled**: Total days allocated for the fiscal year
- **Used**: Days already taken
- **Pending**: Days in submitted requests awaiting approval
- **Available**: Days you can still apply for (`Entitled + CarryForward - Used - Pending`)

### 1.3 Applying for Leave

**Path:** HR → Leaves → New Request

**Step 1: Create Draft**

1. Select **Leave Type** from dropdown
2. Choose **Start Date** and **End Date**
3. Select session for half-day options (if applicable):
   - Full Day
   - First Half (morning session)
   - Second Half (afternoon session)
4. Enter **Reason** for leave
5. Attach supporting documents if required (e.g., medical certificate for sick leave)
6. Click **Save as Draft** or **Submit for Approval**

**Step 2: Submit for Approval**

- If saved as draft, review and click **Submit**
- System automatically calculates working days (excludes weekends and holidays)
- Days move from "Available" to "Pending" in your balance
- Notification sent to approvers

**Step 3: Approval Process (2-Step)**

1. **First Approver** reviews → Status becomes `PARTIALLY_APPROVED`
2. **Second Approver** reviews → Status becomes `APPROVED` or `REJECTED`

> **Note:** If you are one of the designated approvers, only the other approver needs to approve your request (self-approval prevention).

### 1.4 Leave Request Status Flow

```
DRAFT → PENDING_APPROVAL → PARTIALLY_APPROVED → APPROVED
                ↓                    ↓              ↓
            CANCELLED            REJECTED       (Leave taken)
```

| Status             | Description                                 |
| ------------------ | ------------------------------------------- |
| DRAFT              | Not yet submitted, can be edited or deleted |
| PENDING_APPROVAL   | Submitted, awaiting first approval          |
| PARTIALLY_APPROVED | First approver approved, awaiting second    |
| APPROVED           | Both approvers approved, leave confirmed    |
| REJECTED           | Request declined (reason provided)          |
| CANCELLED          | Withdrawn by employee                       |

### 1.5 Cancelling a Leave Request

You can cancel a request in these statuses:

- **DRAFT**: Deleted without impact
- **PENDING_APPROVAL**: Pending days returned to available
- **PARTIALLY_APPROVED**: Pending days returned to available

> **Note:** Cannot cancel once fully approved. Contact HR for post-approval changes.

### 1.6 Working Day Calculation

When you apply for leave, the system calculates actual working days by excluding:

- All **Sundays**
- **1st and 3rd Saturdays** of each month
- Declared **company holidays**

Example: If you apply for Mon-Fri (5 calendar days) and Wednesday is a company holiday, only 4 working days are deducted.

---

## 2. On-Duty Requests & Comp-Off

### 2.1 What is On-Duty?

On-duty requests allow employees to work on holidays and earn **compensatory leave (comp-off)** in return.

### 2.2 Applying for On-Duty

**Path:** HR → On-Duty → New Request

**Prerequisites:**

- The date must be a holiday (Sunday, 1st/3rd Saturday, or company holiday)
- Cannot apply for past dates
- Only one on-duty request per date allowed

**Steps:**

1. Select the **holiday date** you wish to work
2. Provide **business reason** (why you need to work)
3. Submit for approval

### 2.3 Approval & Comp-Off Granting

- Same 2-step approval process as leave requests
- Upon final approval:
  - 1 comp-off day is automatically added to your COMP_OFF balance
  - Comp-off expires 365 days from grant date

### 2.4 Using Comp-Off

1. Go to **HR → Leaves → New Request**
2. Select **Compensatory Off** as leave type
3. Choose dates and submit
4. Follows standard leave approval process

### 2.5 Comp-Off Limits

| Limit      | Value    | Description                        |
| ---------- | -------- | ---------------------------------- |
| Soft Limit | 10 days  | Warning shown when balance exceeds |
| Hard Limit | 20 days  | Cannot earn more comp-offs         |
| Expiry     | 365 days | From grant date                    |

---

## 3. Holiday Management

### 3.1 Viewing Company Holidays

**Path:** HR → Holidays

View all declared holidays for the current fiscal year:

- **Company Holidays**: Diwali, Holi, Christmas, etc.
- **National Holidays**: Republic Day, Independence Day, etc.
- **Optional Holidays**: If configured

### 3.2 Recurring Holidays

The system automatically considers these as holidays:

- All **Sundays**
- **1st Saturday** of each month
- **3rd Saturday** of each month

> These are excluded from leave day calculations automatically.

### 3.3 Holiday Working Override (Admin)

**Path:** HR → Settings → Holidays (Admin only)

When the company needs to work on a holiday (e.g., special Saturday):

1. Go to Holiday settings page
2. Click **Declare Working Day** on the holiday
3. Select scope:
   - **All Users**: Applies to entire organization
   - **Specific Users**: Select individuals
4. Provide reason
5. Click **Confirm**

**What happens:**

- Selected employees receive 1 comp-off each
- Holiday is treated as a working day for leave calculations
- Record maintained in Holiday Working History

> **Note:** Cannot create duplicate overrides for the same date. If one exists, the system shows an error with details.

---

## 4. Travel Expense Management

### 4.1 Expense Categories

| Category         | Examples                                        |
| ---------------- | ----------------------------------------------- |
| TRAVEL           | Flight, train, bus tickets for intercity travel |
| ACCOMMODATION    | Hotel, resort, lodge stays                      |
| LOCAL_CONVEYANCE | Auto, taxi, Uber, Ola, metro, parking           |
| FOOD             | Meals, refreshments during travel               |
| OTHER            | Miscellaneous expenses                          |

### 4.2 Creating an Expense Report

**Path:** HR → Travel Expenses → New Report

**Step 1: Report Header**

1. Enter **Trip Purpose** (e.g., "Client meeting in Mumbai")
2. Select **Trip Start Date** and **End Date**
3. Add **Destinations** visited
4. Link to **Project** (optional)
5. Link to **Cost Centre** (optional)
6. Save as draft

**Step 2: Add Expense Items**

For each expense:

1. Click **Add Expense**
2. Select **Category**
3. Enter **Description** (e.g., "Flight BLR-BOM")
4. Enter **Date** of expense
5. Enter **Amount**
6. For travel: Add **From** and **To** locations
7. Upload **Receipt** (image or PDF)
8. Enter vendor details:
   - Vendor Name
   - Invoice/Bill Number
   - GST details (if applicable)

**Receipt Parsing (AI-Assisted):**

- Upload receipt image/PDF
- System automatically extracts:
  - Vendor name
  - Invoice number
  - Amount
  - GST breakdown
- Review and correct if needed
- Category suggestion with confidence score

**Step 3: Submit for Approval**

1. Review all items and totals
2. Click **Submit**
3. Status changes to `SUBMITTED`

### 4.3 Expense Report Status Flow

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → REIMBURSED
                          ↓
                      REJECTED
```

### 4.4 GST Details

For expenses with GST:

- **Taxable Amount**: Base amount before tax
- **GST Rate**: 5%, 12%, 18%, or 28%
- **GST Breakdown**:
  - CGST: Central GST (intra-state)
  - SGST: State GST (intra-state)
  - IGST: Integrated GST (inter-state)
- **Vendor GSTIN**: 15-digit GST number
- **Company GSTIN Found**: Badge if our GSTIN appears on receipt

---

## 5. Employee Management

### 5.1 Employee Directory

**Path:** HR → Employees

View all employees with:

- Name and photo
- Employee ID
- Department
- Contact information
- Reporting manager

### 5.2 Employee Profile

**Path:** HR → Employees → [Employee Name]

**Basic Information:**

- Employee ID (e.g., VDT-001)
- Employment Type: Permanent, Contract, Probation, Intern, Consultant
- Date of Joining
- Reporting Manager
- Department

**Personal Information:**

- Date of Birth, Gender, Blood Group
- Personal Email and Phone
- Emergency Contacts (Primary & Secondary)
- Current and Permanent Address

**Bank & Financial Details:**

- Bank Account Number
- IFSC Code
- Account Holder Name

**Identity Documents:**

- PAN Number
- Aadhaar Number
- Passport (Number, Expiry)
- Driving License
- Voter ID

**Statutory Information:**

- PF Account Number
- UAN (Universal Account Number)
- ESIC Number
- Insurance Policy Number

---

## 6. Admin Configuration

### 6.1 Leave Type Setup

**Path:** Admin → HR Setup → Leave Types

Configure leave types with:

- **Code**: Unique identifier (SICK, CASUAL, etc.)
- **Name**: Display name
- **Annual Quota**: Days entitled per year
- **Carry Forward**: Allow/disallow with max limit
- **Paid/Unpaid**: Whether salary is paid
- **Approval Required**: Yes/No
- **Half Day Allowed**: Yes/No
- **Display Color**: For calendar visualization

**Seeding Defaults:**

- Click "Seed Default Leave Types" for quick setup
- Creates SICK and CASUAL with standard configuration

### 6.2 Leave Balance Management

**Path:** Admin → HR Setup → Leave Balances

For each employee:

- Initialize balances at fiscal year start
- Adjust carry forward from previous year
- Manual corrections if needed

### 6.3 Holiday Configuration

**Path:** HR → Settings → Holidays

**Managing Company Holidays:**

1. Click **Add Holiday**
2. Enter holiday name and date
3. Select type: Company, National, or Optional
4. Save

**Declaring Working Day:**

1. Find the holiday in the list
2. Click folder icon to "Declare Working Day"
3. Select scope (All Users or Specific)
4. Confirm

### 6.4 Approver Configuration

Approvers for leave and on-duty requests are configured in Firestore:

- Collection: `hrConfig`
- Document: `leaveSettings`
- Field: `approverEmails` (array)

Contact system administrator to modify approver list.

---

## Appendix: Quick Reference

### Navigation Paths

| Feature            | Path                       |
| ------------------ | -------------------------- |
| My Leave Balance   | HR → Leaves → My Leaves    |
| Apply for Leave    | HR → Leaves → New Request  |
| View Leave Request | HR → Leaves → [Request ID] |
| Team Calendar      | HR → Leaves → Calendar     |
| On-Duty Requests   | HR → On-Duty → My Requests |
| Apply for On-Duty  | HR → On-Duty → New Request |
| View Holidays      | HR → Holidays              |
| Travel Expenses    | HR → Travel Expenses       |
| Employee Directory | HR → Employees             |
| HR Admin Setup     | Admin → HR Setup           |
| Holiday Settings   | HR → Settings → Holidays   |

### Common Actions

| Action                | How To                                                |
| --------------------- | ----------------------------------------------------- |
| Check leave balance   | HR → Leaves → My Leaves                               |
| Apply for leave       | HR → Leaves → New Request → Fill form → Submit        |
| Cancel leave request  | HR → Leaves → [Request] → Cancel                      |
| Work on holiday       | HR → On-Duty → New Request → Select holiday → Submit  |
| Use comp-off          | HR → Leaves → New Request → Select "Compensatory Off" |
| Submit expense report | HR → Travel Expenses → New → Add items → Submit       |
| View employee profile | HR → Employees → Click name                           |

### Approval Workflow Summary

```
Employee Action          → System Response
─────────────────────────────────────────────
Submit Request           → Notify Approvers
First Approval           → Notify Employee + Second Approver
Second Approval          → Notify Employee, Update Balance
Rejection               → Notify Employee, Return Balance
Cancellation            → Return Balance, Close Request
```

---

_Last Updated: January 2026_
