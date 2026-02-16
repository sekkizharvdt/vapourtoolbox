'use client';

/**
 * Accounting Section
 */

import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { StepGuide } from './helpers';

export function AccountingSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Accounting module manages all financial transactions including vendor bills, customer
        invoices, payments, and reporting.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Core Features
      </Typography>

      <List dense>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Vendor Bills"
            secondary="Record bills with TDS deduction (configurable rates: 1%, 2%, 5%, 10%, 20%) and GST tracking."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Customer Invoices"
            secondary="Create and track invoices. Monitor payment status and aging."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Payments"
            secondary="Record vendor payments and customer receipts with invoice allocation."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Payment Batches"
            secondary="Group payments for batch processing with categories (Salary, Taxes, Projects, etc.)."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Journal Entries"
            secondary="Manual accounting entries with approval workflow."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Entity Ledger"
            secondary="Complete financial history by vendor or customer, including Journal Entry balances."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Chart of Accounts & Cost Centres"
            secondary="Account structure management and cost tracking by project or department."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Recurring Transactions"
            secondary="Set up repeating invoices and bills that generate automatically."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Data Health"
            secondary="Audit tools for missing GL entries, unmapped accounts, overdue items, and unapplied payments."
          />
        </ListItem>
      </List>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Reports
      </Typography>
      <List dense>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Trial Balance" secondary="Account balances for a period." />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Profit & Loss" secondary="Income and expenses summary." />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Balance Sheet" secondary="Assets, liabilities, and equity." />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Project Financial Reports"
            secondary="Budget vs. actual analysis per project."
          />
        </ListItem>
      </List>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Invoice to Payment Workflow
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Create Invoice/Bill',
            description:
              'Create a customer invoice or record a vendor bill with line items and taxes.',
          },
          {
            title: 'Post the Transaction',
            description:
              'Post to generate GL entries. For bills with TDS, select the applicable deduction rate.',
          },
          {
            title: 'Record Payment',
            description:
              'Record payment and allocate against the invoice/bill. Use Payment Batches for bulk processing.',
          },
        ]}
      />
    </Box>
  );
}
