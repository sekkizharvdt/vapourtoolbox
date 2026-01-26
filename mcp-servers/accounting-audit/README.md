# Accounting Audit MCP Server

An MCP server for analyzing accounting data integrity, finding missing details, and identifying issues that need attention in the Vapour Toolbox accounting module.

## Features

This server provides tools for:

- **Data Integrity Checks**: Find unbalanced GL entries, missing required fields, and orphaned references
- **Business Logic Analysis**: Identify overdue invoices/bills, unapplied payments, and stale drafts
- **Health Scoring**: Get an overall health score for your accounting data
- **Duplicate Detection**: Find duplicate transaction numbers
- **GL Balance Verification**: Ensure debits equal credits

## Available Tools

### `get_audit_summary`

Get a high-level summary of accounting data health with counts of issues by category and an overall health score.

### `audit_data_integrity`

Run a comprehensive audit checking for:

- Unbalanced GL entries (debits != credits)
- Posted transactions without GL entries
- Missing entity references (vendor/customer IDs)
- Missing amounts
- Invalid statuses

### `find_incomplete_transactions`

Find transactions with missing data:

- Missing descriptions
- Missing transaction numbers
- Missing dates
- Line items without account mapping

### `find_overdue_items`

Find overdue invoices (receivables) and bills (payables) that are past their due date and not fully paid.

### `find_unapplied_payments`

Find customer and vendor payments that haven't been applied to any invoice or bill.

### `find_draft_transactions`

Find transactions stuck in DRAFT status that may need review and posting.

### `check_gl_balance`

Verify that the general ledger is balanced for a given period, with individual transaction-level checks.

### `find_orphaned_entities`

Find transactions that reference non-existent vendors, customers, or accounts.

### `find_duplicate_numbers`

Find transactions with duplicate transaction numbers.

## Setup

1. Copy the service account key file to this directory:

   ```bash
   cp /path/to/service-account-key.json ./service-account-key.json
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Add to Claude Code settings (`.claude/settings.local.json`):

   ```json
   {
     "mcpServers": {
       "accounting-audit": {
         "command": "node",
         "args": ["/workspaces/vapourtoolbox/mcp-servers/accounting-audit/index.js"]
       }
     }
   }
   ```

4. Restart Claude Code to load the MCP server.

## Usage Examples

### Quick Health Check

```
Use the get_audit_summary tool to check overall accounting data health.
```

### Find All Data Issues

```
Use the audit_data_integrity tool to run a comprehensive data quality audit.
```

### Check for Overdue Items

```
Use find_overdue_items with type="all" to see all overdue invoices and bills.
```

### Find Items Needing Attention

```
Use find_draft_transactions with olderThanDays=7 to find stale drafts.
```

## Health Score Ratings

- **90-100**: Excellent - Data is in great shape
- **70-89**: Good - Minor issues that should be addressed
- **50-69**: Needs Attention - Several issues requiring review
- **0-49**: Critical - Significant data quality problems
