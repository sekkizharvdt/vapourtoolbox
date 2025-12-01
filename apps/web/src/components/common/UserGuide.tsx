'use client';

/**
 * User Guide Component
 *
 * Comprehensive in-app documentation for users.
 * Covers all major features and workflows.
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Stack,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PeopleIcon from '@mui/icons-material/People';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SearchIcon from '@mui/icons-material/Search';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

/**
 * Guide section definition
 */
interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

/**
 * Keyboard shortcut display
 */
function KeyboardShortcut({ keys, description }: { keys: string; description: string }) {
  const keyParts = keys.split(' ').filter(Boolean);
  return (
    <TableRow>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          {keyParts.map((key, i) => (
            <Chip
              key={i}
              label={key}
              size="small"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                bgcolor: 'action.selected',
              }}
            />
          ))}
        </Stack>
      </TableCell>
      <TableCell>{description}</TableCell>
    </TableRow>
  );
}

/**
 * Feature card for highlighting key features
 */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {icon}
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

/**
 * Step-by-step guide component
 */
function StepGuide({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <List>
      {steps.map((step, index) => (
        <ListItem key={index} alignItems="flex-start">
          <ListItemIcon>
            <Chip
              label={index + 1}
              size="small"
              color="primary"
              sx={{ minWidth: 28, height: 28 }}
            />
          </ListItemIcon>
          <ListItemText
            primary={step.title}
            secondary={step.description}
            primaryTypographyProps={{ fontWeight: 500 }}
          />
        </ListItem>
      ))}
    </List>
  );
}

/**
 * Getting Started Section
 */
function GettingStartedSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Welcome to Vapour Toolbox! This guide will help you navigate the application and make the
        most of its features.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Quick Start
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
          icon={<DashboardIcon color="primary" />}
          title="Dashboard"
          description="View your tasks, approvals, and activity at a glance. Your daily focus items appear here."
        />
        <FeatureCard
          icon={<SearchIcon color="primary" />}
          title="Command Palette"
          description="Press ⌘K (or Ctrl+K) to quickly navigate anywhere or perform actions."
        />
        <FeatureCard
          icon={<KeyboardIcon color="primary" />}
          title="Keyboard Shortcuts"
          description="Press Shift+? to see all available keyboard shortcuts for faster navigation."
        />
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Pro Tip:</strong> Use the command palette (⌘K) to quickly search for anything -
          pages, projects, proposals, or actions.
        </Typography>
      </Alert>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Navigation
      </Typography>

      <Typography variant="body2" paragraph>
        The sidebar on the left provides access to all modules. You can collapse it by clicking the
        toggle button to get more screen space. Your sidebar preference is saved automatically.
      </Typography>

      <List dense>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Click any module icon to navigate" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Use keyboard shortcuts for quick access (G then D for Dashboard)" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="The notification bell shows unread notifications" />
        </ListItem>
      </List>
    </Box>
  );
}

/**
 * Proposals Section
 */
function ProposalsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Proposals module helps you create, manage, and track customer proposals from enquiry to
        award.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Creating a Proposal
      </Typography>

      <StepGuide
        steps={[
          {
            title: 'Start from an Enquiry or Create New',
            description:
              'You can create a proposal from an existing enquiry or start fresh. Enquiries capture initial customer requirements.',
          },
          {
            title: 'Fill in Proposal Details',
            description:
              'Enter customer information, project scope, timeline, and pricing. Use the rich text editor for detailed descriptions.',
          },
          {
            title: 'Add Line Items',
            description:
              'Break down your proposal into work items and supply items with quantities and rates.',
          },
          {
            title: 'Internal Review',
            description:
              'Submit for internal review before sending to the customer. Team members can add comments.',
          },
          {
            title: 'Submit to Customer',
            description:
              'Once approved internally, submit the proposal to the customer for their review.',
          },
        ]}
      />

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Proposal Statuses
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip label="Draft" color="default" size="small" />
        <Chip label="Internal Review" color="info" size="small" />
        <Chip label="Submitted" color="primary" size="small" />
        <Chip label="Under Negotiation" color="warning" size="small" />
        <Chip label="Awarded" color="success" size="small" />
        <Chip label="Lost" color="error" size="small" />
      </Stack>
    </Box>
  );
}

/**
 * Procurement Section
 */
function ProcurementSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Procurement module streamlines your purchasing workflow from request to delivery.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Procurement Workflow
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Chip icon={<ArrowForwardIcon />} label="Purchase Request" />
        <Chip icon={<ArrowForwardIcon />} label="RFQ" />
        <Chip icon={<ArrowForwardIcon />} label="Vendor Offers" />
        <Chip icon={<ArrowForwardIcon />} label="Purchase Order" />
        <Chip label="Delivery" color="success" />
      </Box>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Purchase Requests (PR)
      </Typography>
      <Typography variant="body2" paragraph>
        Start by creating a Purchase Request for items you need. Include specifications, quantities,
        and required delivery dates. PRs require approval before proceeding.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Request for Quotation (RFQ)
      </Typography>
      <Typography variant="body2" paragraph>
        Send RFQs to multiple vendors to get competitive quotes. The system tracks all vendor
        responses in one place for easy comparison.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Offer Comparison
      </Typography>
      <Typography variant="body2" paragraph>
        Compare vendor offers side-by-side. The comparison view highlights price differences,
        delivery times, and terms to help you make the best decision.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Purchase Orders (PO)
      </Typography>
      <Typography variant="body2" paragraph>
        Create Purchase Orders to finalize procurement. POs can be created from approved RFQs or
        directly. Track delivery status and manage vendor communications.
      </Typography>
    </Box>
  );
}

/**
 * Flow Section
 */
function FlowSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Flow is your task management and communication hub. It combines project tasks, team
        messaging, and time tracking in one place.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Key Features
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
          icon={<AssignmentIcon color="primary" />}
          title="Task Management"
          description="Create, assign, and track tasks. Set priorities, due dates, and dependencies."
        />
        <FeatureCard
          icon={<PeopleIcon color="primary" />}
          title="Team Channels"
          description="Communicate with your team in project or topic-based channels."
        />
      </Box>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Mentions
      </Typography>
      <Typography variant="body2" paragraph>
        Use @username to mention team members in messages. They&apos;ll receive a notification and
        the mention will appear in their &quot;Today&apos;s Focus&quot; on the dashboard.
      </Typography>

      <Alert severity="info">
        <Typography variant="body2">
          Click the &quot;Unread Mentions&quot; card on your dashboard to quickly see all messages
          where you&apos;ve been mentioned.
        </Typography>
      </Alert>
    </Box>
  );
}

/**
 * Documents Section
 */
function DocumentsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Documents module provides centralized document management with version control,
        approvals, and transmittals.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Document Features
      </Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Version Control"
            secondary="Track document revisions automatically. Each upload creates a new revision (R0, R1, R2...)."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Approval Workflows"
            secondary="Route documents through review and approval processes with clear audit trails."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Transmittals"
            secondary="Create formal document transmittals for external parties with acknowledgment tracking."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Comments & Annotations"
            secondary="Add comments to documents for review feedback. Comments can be resolved when addressed."
          />
        </ListItem>
      </List>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Uploading Documents
      </Typography>
      <Typography variant="body2" paragraph>
        Drag and drop files or click to browse. You can upload multiple files at once. Supported
        formats include PDF, Word, Excel, images, and CAD files.
      </Typography>
    </Box>
  );
}

/**
 * Materials Section
 */
function MaterialsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Materials module helps you manage your inventory, track stock levels, and coordinate
        material requirements across projects.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Key Capabilities
      </Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Material Catalog"
            secondary="Maintain a centralized catalog of all materials with specifications, units, and pricing."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Stock Tracking"
            secondary="Monitor stock levels across locations. Receive alerts for low stock items."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Project Allocation"
            secondary="Allocate materials to specific projects and track consumption."
          />
        </ListItem>
      </List>
    </Box>
  );
}

/**
 * Accounting Section
 */
function AccountingSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Accounting module manages financial transactions, invoices, and cost tracking for your
        projects.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Features
      </Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Invoice Management"
            secondary="Create and track invoices. Monitor payment status and aging."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Cost Centers"
            secondary="Organize expenses by cost centers for better financial visibility."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Budget Tracking"
            secondary="Set project budgets and track actual vs. planned spending."
          />
        </ListItem>
      </List>
    </Box>
  );
}

/**
 * Keyboard Shortcuts Section
 */
function KeyboardShortcutsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Keyboard shortcuts help you navigate faster. Press <strong>Shift + ?</strong> anywhere to
        see the shortcuts help dialog.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Navigation Shortcuts
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="40%">Shortcut</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <KeyboardShortcut keys="⌘ K" description="Open command palette" />
            <KeyboardShortcut keys="G D" description="Go to Dashboard" />
            <KeyboardShortcut keys="G F" description="Go to Flow" />
            <KeyboardShortcut keys="G P" description="Go to Procurement" />
            <KeyboardShortcut keys="G R" description="Go to Proposals" />
            <KeyboardShortcut keys="G O" description="Go to Documents" />
            <KeyboardShortcut keys="G M" description="Go to Materials" />
            <KeyboardShortcut keys="G A" description="Go to Accounting" />
            <KeyboardShortcut keys="Shift ?" description="Show keyboard shortcuts help" />
            <KeyboardShortcut keys="Esc" description="Close dialogs and panels" />
          </TableBody>
        </Table>
      </TableContainer>

      <Alert severity="info">
        <Typography variant="body2">
          <strong>Sequence shortcuts:</strong> For shortcuts like &quot;G D&quot;, press G first,
          then D within 1 second.
        </Typography>
      </Alert>
    </Box>
  );
}

/**
 * Tips Section
 */
function TipsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Here are some tips to help you work more efficiently with Vapour Toolbox.
      </Typography>

      <List>
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Use the Command Palette for Everything"
            secondary="Press ⌘K to quickly search for pages, create new items, or perform actions without navigating through menus."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Check Your Dashboard Daily"
            secondary="The 'Today's Focus' section shows tasks due today, pending approvals, and mentions requiring your attention."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Use Mentions for Quick Communication"
            secondary="@mention colleagues in tasks and documents to notify them directly. It's faster than email."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Collapse the Sidebar"
            secondary="When you need more screen space, collapse the sidebar. It will remember your preference."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Use Filters and Search"
            secondary="Every list view has filtering and search capabilities. Use them to find items quickly."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Enable Browser Notifications"
            secondary="Allow notifications to stay informed about important updates even when you're on another tab."
          />
        </ListItem>
      </List>
    </Box>
  );
}

/**
 * Main User Guide Component
 */
export function UserGuide() {
  const [expanded, setExpanded] = useState<string | false>('getting-started');

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const sections: GuideSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <DashboardIcon />,
      content: <GettingStartedSection />,
    },
    {
      id: 'proposals',
      title: 'Proposals & Enquiries',
      icon: <DescriptionIcon />,
      content: <ProposalsSection />,
    },
    {
      id: 'procurement',
      title: 'Procurement',
      icon: <ShoppingCartIcon />,
      content: <ProcurementSection />,
    },
    {
      id: 'flow',
      title: 'Flow (Tasks & Messaging)',
      icon: <AssignmentIcon />,
      content: <FlowSection />,
    },
    {
      id: 'documents',
      title: 'Documents',
      icon: <DescriptionIcon />,
      content: <DocumentsSection />,
    },
    {
      id: 'materials',
      title: 'Materials & Inventory',
      icon: <InventoryIcon />,
      content: <MaterialsSection />,
    },
    {
      id: 'accounting',
      title: 'Accounting',
      icon: <AccountBalanceIcon />,
      content: <AccountingSection />,
    },
    {
      id: 'shortcuts',
      title: 'Keyboard Shortcuts',
      icon: <KeyboardIcon />,
      content: <KeyboardShortcutsSection />,
    },
    {
      id: 'tips',
      title: 'Tips & Best Practices',
      icon: <LightbulbIcon />,
      content: <TipsSection />,
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        User Guide
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Learn how to use Vapour Toolbox effectively. Click on any section below to expand it.
      </Typography>

      <Box sx={{ mt: 3 }}>
        {sections.map((section) => (
          <Accordion
            key={section.id}
            expanded={expanded === section.id}
            onChange={handleChange(section.id)}
            sx={{
              '&:before': { display: 'none' },
              mb: 1,
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: expanded === section.id ? 'action.selected' : 'transparent',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {section.icon}
                <Typography fontWeight={500}>{section.title}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 2 }}>{section.content}</AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
}
