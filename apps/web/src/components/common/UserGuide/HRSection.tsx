'use client';

/**
 * HR Module Section
 *
 * Documentation for Leave Management and Travel Expenses features.
 */

import { Box, Typography, Alert, Divider } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { FeatureCard, StepGuide } from './helpers';

export function HRSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The HR module helps you manage employee leave requests and travel expense reports with
        streamlined approval workflows.
      </Typography>

      {/* Leave Management */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Leave Management
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <FeatureCard
          icon={<EventIcon color="primary" />}
          title="Leave Types"
          description="Sick, Casual, Earned, Unpaid, Maternity, and Paternity leave types with configurable entitlements."
        />
        <FeatureCard
          icon={<CheckCircleIcon color="success" />}
          title="Balance Tracking"
          description="View your entitled, used, pending, and available leave balance for each type."
        />
      </Box>

      <Typography variant="subtitle2" gutterBottom>
        Applying for Leave
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Navigate to HR → Leaves',
            description: 'Click "New Leave Request" to open the leave application form.',
          },
          {
            title: 'Select Leave Type and Dates',
            description:
              'Choose the leave type and select start/end dates. Half-day options are available.',
          },
          {
            title: 'Add Reason and Submit',
            description:
              'Provide a reason for your leave and submit. Your manager will receive a notification.',
          },
          {
            title: 'Track Status',
            description:
              'View your request status in the leave list. You can cancel pending requests if needed.',
          },
        ]}
      />

      <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
        <Typography variant="body2">
          <strong>Tip:</strong> Check your leave balance before applying. Leave that exceeds your
          balance may be marked as unpaid or rejected.
        </Typography>
      </Alert>

      <Divider sx={{ my: 3 }} />

      {/* Travel Expenses */}
      <Typography variant="h6" gutterBottom>
        Travel Expenses
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <FeatureCard
          icon={<ReceiptLongIcon color="primary" />}
          title="Expense Reports"
          description="Create detailed expense reports with itemized expenses, receipts, and GST tracking."
        />
        <FeatureCard
          icon={<CheckCircleIcon color="success" />}
          title="Receipt Upload"
          description="Upload scanned receipts for each expense item. Supports images and PDF files."
        />
      </Box>

      <Typography variant="subtitle2" gutterBottom>
        Creating an Expense Report
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Navigate to HR → Travel Expenses',
            description: 'Click "New Report" to start a new travel expense report.',
          },
          {
            title: 'Enter Trip Details',
            description:
              'Fill in the trip purpose, travel dates, and destinations (from/to locations).',
          },
          {
            title: 'Add Expense Items',
            description:
              'Add each expense with category (Accommodation, Meals, Transport, etc.), amount, and vendor.',
          },
          {
            title: 'Upload Receipts',
            description: 'Attach receipt photos or scanned documents for each expense item.',
          },
          {
            title: 'Submit for Approval',
            description:
              'Review the total and submit. Your manager will approve and process reimbursement.',
          },
        ]}
      />

      <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
        Expense Categories
      </Typography>
      <Typography variant="body2" paragraph>
        Supported expense categories include:
      </Typography>
      <Box component="ul" sx={{ pl: 3, mt: 0 }}>
        <li>
          <Typography variant="body2">
            <strong>Accommodation</strong> - Hotels, guest houses, lodging
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Meals</strong> - Food and beverages during travel
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Transportation</strong> - Local transport, taxis, auto-rickshaws
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Fuel</strong> - Petrol/diesel for personal vehicle use
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Airfare</strong> - Flight tickets
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Other</strong> - Miscellaneous expenses with description
          </Typography>
        </li>
      </Box>

      <Alert severity="success" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>PDF Export:</strong> You can download a professional PDF report of your expense
          claim for records or manual submission.
        </Typography>
      </Alert>
    </Box>
  );
}
