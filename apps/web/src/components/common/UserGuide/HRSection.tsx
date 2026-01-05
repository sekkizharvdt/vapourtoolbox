'use client';

/**
 * HR Module Section
 *
 * Documentation for Leave Management, On-Duty Requests, Comp-Off,
 * Holiday Management, and Travel Expenses features.
 */

import { Box, Typography, Alert, Divider, Chip } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupIcon from '@mui/icons-material/Group';
import WorkIcon from '@mui/icons-material/Work';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { FeatureCard, StepGuide } from './helpers';

export function HRSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The HR module helps you manage employee leave requests, on-duty work, compensatory leave
        (comp-off), holidays, and travel expense reports with multi-step approval workflows.
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
          description="Sick, Casual, Earned, Unpaid, Maternity, Paternity, and Comp-Off leave types with configurable entitlements."
        />
        <FeatureCard
          icon={<CheckCircleIcon color="success" />}
          title="Balance Tracking"
          description="View your entitled, used, pending, and available leave balance for each type."
        />
        <FeatureCard
          icon={<GroupIcon color="primary" />}
          title="2-Step Approval"
          description="Leave requests require approval from 2 designated approvers for accountability."
        />
      </Box>

      <Typography variant="subtitle2" gutterBottom>
        Applying for Leave
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Navigate to HR → Leaves → My Leaves',
            description: 'Click "New Leave Request" to open the leave application form.',
          },
          {
            title: 'Select Leave Type and Dates',
            description:
              'Choose the leave type and select start/end dates. Half-day options are available for most leave types.',
          },
          {
            title: 'Add Reason and Submit',
            description:
              'Provide a reason for your leave and submit. Both designated approvers will receive task notifications.',
          },
          {
            title: 'Track Approval Progress',
            description:
              'View the approval status showing who has approved and who is pending. Status shows "Partially Approved" after the first approval.',
          },
        ]}
      />

      <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
        <Typography variant="body2">
          <strong>2-Step Approval:</strong> Leave requests require 2 approvals to be fully approved.
          If you are one of the designated approvers, only 1 additional approval is needed. You
          cannot approve your own leave requests.
        </Typography>
      </Alert>

      <Typography variant="subtitle2" gutterBottom>
        Working Day Calculation
      </Typography>
      <Typography variant="body2" paragraph>
        When you apply for leave, the system automatically excludes:
      </Typography>
      <Box component="ul" sx={{ pl: 3, mt: 0, mb: 3 }}>
        <li>
          <Typography variant="body2">All Sundays</Typography>
        </li>
        <li>
          <Typography variant="body2">1st and 3rd Saturdays of each month</Typography>
        </li>
        <li>
          <Typography variant="body2">Declared company holidays</Typography>
        </li>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* On-Duty Requests & Comp-Off */}
      <Typography variant="h6" gutterBottom>
        On-Duty Requests & Comp-Off
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
          icon={<WorkIcon color="primary" />}
          title="On-Duty Requests"
          description="Apply to work on holidays and earn compensatory leave (comp-off) in return."
        />
        <FeatureCard
          icon={<CardGiftcardIcon color="success" />}
          title="Comp-Off Balance"
          description="Earned comp-offs are tracked separately. Use them like regular leave with the same approval workflow."
        />
      </Box>

      <Typography variant="subtitle2" gutterBottom>
        Applying for On-Duty
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Navigate to HR → On-Duty → New Request',
            description:
              'Select a holiday date you wish to work on (must be a Sunday, 1st/3rd Saturday, or company holiday).',
          },
          {
            title: 'Provide Business Reason',
            description:
              'Explain why you need to work on this holiday (e.g., urgent project deadline, client requirement).',
          },
          {
            title: 'Submit for Approval',
            description: 'Request goes through the same 2-step approval as leave requests.',
          },
          {
            title: 'Receive Comp-Off',
            description:
              'Upon final approval, 1 comp-off day is automatically added to your balance.',
          },
        ]}
      />

      <Alert severity="success" sx={{ mt: 2, mb: 3 }}>
        <Typography variant="body2">
          <strong>Using Comp-Off:</strong> To use your earned comp-off, create a leave request with
          type &quot;Compensatory Off&quot;. It follows the standard leave approval workflow.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Chip label="Max Balance: 20 days" size="small" variant="outlined" />
        <Chip label="Expires: 365 days from grant" size="small" variant="outlined" />
        <Chip label="Half-day allowed" size="small" variant="outlined" color="success" />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Holiday Management */}
      <Typography variant="h6" gutterBottom>
        Holiday Management
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
          icon={<CalendarMonthIcon color="primary" />}
          title="Company Holidays"
          description="View all declared holidays for the year including national and company-specific holidays."
        />
        <FeatureCard
          icon={<WorkIcon color="warning" />}
          title="Holiday Working (Admin)"
          description="Admins can declare a holiday as a working day, automatically granting comp-off to employees."
        />
      </Box>

      <Typography variant="subtitle2" gutterBottom>
        Viewing Holidays
      </Typography>
      <Typography variant="body2" paragraph>
        Navigate to <strong>HR → Holidays</strong> to see all company holidays for the current year.
        Holidays are automatically excluded from leave day calculations.
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Declaring a Working Day (Admin Only)
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Go to HR → Settings → Holidays',
            description: 'Find the holiday you want to convert to a working day.',
          },
          {
            title: 'Click "Declare Working Day"',
            description: 'Click the folder icon next to the holiday.',
          },
          {
            title: 'Select Scope',
            description:
              'Choose "All Users" for the entire organization or "Specific Users" to select individuals.',
          },
          {
            title: 'Confirm',
            description:
              'All selected employees receive 1 comp-off automatically. The holiday is treated as a working day.',
          },
        ]}
      />

      <Alert severity="warning" sx={{ mt: 2, mb: 3 }}>
        <Typography variant="body2">
          <strong>Note:</strong> You cannot create duplicate working day overrides for the same
          date. The system will show an error if comp-offs have already been granted for that date.
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
          title="AI Receipt Parsing"
          description="Upload receipts and let AI extract vendor, amount, and GST details automatically."
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
              'Fill in the trip purpose, travel dates, destinations, and optionally link to a project or cost centre.',
          },
          {
            title: 'Add Expense Items',
            description:
              'Add each expense with category, amount, vendor details, and GST information if applicable.',
          },
          {
            title: 'Upload Receipts',
            description:
              'Upload receipt images or PDFs. The system can auto-extract details using AI.',
          },
          {
            title: 'Submit for Approval',
            description:
              'Review the total and submit. Approvers receive a task notification in Flow.',
          },
        ]}
      />

      <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
        Expense Categories
      </Typography>
      <Box component="ul" sx={{ pl: 3, mt: 0 }}>
        <li>
          <Typography variant="body2">
            <strong>Travel</strong> - Flight, train, bus tickets for intercity travel
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Accommodation</strong> - Hotels, guest houses, lodging
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Local Conveyance</strong> - Auto, taxi, Uber, Ola, metro, parking
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Food</strong> - Meals and refreshments during travel
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
