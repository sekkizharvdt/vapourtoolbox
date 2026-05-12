'use client';

/**
 * Feedback Section
 *
 * User guide for the in-app feedback module — bugs, feature requests, status flow.
 */

import {
  Box,
  Typography,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import { FeatureCard, StepGuide } from './helpers';

export function FeedbackSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Feedback module is the single channel for reporting bugs, requesting features, or
        sending general comments to the development team. Submissions are visible to admins on the
        admin feedback dashboard and to the reporter on their own list — comments, status changes,
        and resolutions are tracked end-to-end.
      </Typography>

      {/* Categories */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        What to Submit
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <FeatureCard
          icon={<BugReportIcon color="error" />}
          title="Bug"
          description="Something is broken or behaves incorrectly. Include steps to reproduce, expected vs actual behaviour, console errors, and a screenshot if possible."
        />
        <FeatureCard
          icon={<LightbulbIcon color="warning" />}
          title="Feature"
          description="A new capability or enhancement you'd like to see. Include the use case and the expected impact (Critical / High / Medium / Low)."
        />
        <FeatureCard
          icon={<ChatBubbleIcon color="info" />}
          title="General"
          description="Anything that doesn't fit Bug or Feature — UX feedback, questions, data quality concerns, documentation gaps."
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Submitting */}
      <Typography variant="h6" gutterBottom>
        Submitting Feedback
      </Typography>
      <Typography variant="body2" paragraph>
        Navigate to <strong>Feedback</strong> from the main navigation or use the quick-feedback
        link in the footer. The form auto-fills your name, email, current page URL, and browser info
        so the team can reproduce the issue.
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Pick a Type',
            description: 'Bug, Feature, or General. The form shows different fields for each type.',
          },
          {
            title: 'Pick a Module (optional)',
            description:
              'Tag which module the feedback is about (Accounting, Procurement, HR, etc). This drives filtering on the admin dashboard.',
          },
          {
            title: 'Title + Description',
            description:
              'Keep the title short — one line summarising the issue or request. Use the description for context.',
          },
          {
            title: 'Bug-Specific Fields',
            description:
              'For bugs: Steps to Reproduce, Expected Behaviour, Actual Behaviour, Severity (Critical / High / Medium / Low), and Frequency (Always / Often / Sometimes / Rarely). Console errors are captured automatically when possible.',
          },
          {
            title: 'Feature-Specific Fields',
            description: 'For features: Impact (Critical / High / Medium / Low).',
          },
          {
            title: 'Attach Screenshots',
            description:
              'Drag-and-drop or click to upload. Screenshots are stored in Firebase Storage and linked to the feedback item.',
          },
          {
            title: 'Submit',
            description:
              'After submission you can find the item on the same page under "Your Submissions" and click through to its detail page to add comments or follow updates.',
          },
        ]}
      />

      <Divider sx={{ my: 3 }} />

      {/* Status Workflow */}
      <Typography variant="h6" gutterBottom>
        Status Workflow
      </Typography>
      <Typography variant="body2" paragraph>
        Every feedback item moves through a small set of statuses. The reporter can close from any
        non-terminal status; admins can transition through the full set.
      </Typography>

      <TableContainer sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Meaning</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Who Sets It</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>New</TableCell>
              <TableCell>Just submitted, not yet triaged</TableCell>
              <TableCell>Auto (on submission)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>In Progress</TableCell>
              <TableCell>Acknowledged and actively being worked on</TableCell>
              <TableCell>Admin</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Resolved</TableCell>
              <TableCell>Fix or feature shipped; awaiting reporter verification</TableCell>
              <TableCell>Admin</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Closed</TableCell>
              <TableCell>Reporter has verified and confirmed the fix / feature</TableCell>
              <TableCell>Reporter or Admin</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Won&apos;t Fix</TableCell>
              <TableCell>
                Intentional behaviour, duplicate, out of scope, or deferred indefinitely
              </TableCell>
              <TableCell>Admin</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
        <Typography variant="body2">
          <strong>Close-from-any-status (v1.6.0):</strong> the reporter can close their own feedback
          from any non-terminal status (New, In Progress, Resolved). Use this when the report is no
          longer relevant — a duplicate of another item, a misunderstanding on your end, or a change
          you no longer want.
        </Typography>
      </Alert>

      <Divider sx={{ my: 3 }} />

      {/* Tracking */}
      <Typography variant="h6" gutterBottom>
        Tracking Your Submissions
      </Typography>
      <Typography variant="body2" paragraph>
        The bottom of the Feedback page shows <strong>Your Submissions</strong> — every item you
        have ever submitted, with status chip, last update, and a quick action to open the detail
        page. In-progress items show a direct link to the detail page so you can follow the comment
        thread without losing your place.
      </Typography>
      <Typography variant="body2" paragraph>
        On the detail page you can: add comments (visible to the dev team), upload additional
        screenshots, see status transitions, and read the team&apos;s resolution notes once an item
        moves to Resolved.
      </Typography>

      <Divider sx={{ my: 3 }} />

      {/* Tips */}
      <Typography variant="h6" gutterBottom>
        Writing Good Feedback
      </Typography>
      <Alert severity="success" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Bugs:</strong> a clear repro is worth more than a long description. &ldquo;Click
          X, then Y, see Z &mdash; expected W&rdquo; is the gold standard. A screenshot of the
          actual broken state plus the URL is usually enough.
        </Typography>
      </Alert>
      <Alert severity="success" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Features:</strong> lead with the use case, not the implementation. &ldquo;I need
          to see month-over-month variance on the cost-centre page&rdquo; is more useful than
          &ldquo;add a sparkline column&rdquo;.
        </Typography>
      </Alert>
      <Alert severity="success" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Severity vs Impact:</strong> Severity (bugs) is how badly it breaks things —
          Critical = blocks work, Low = cosmetic. Impact (features) is the business value of doing
          it — Critical = unblocks a deal, Low = nice-to-have.
        </Typography>
      </Alert>
    </Box>
  );
}
