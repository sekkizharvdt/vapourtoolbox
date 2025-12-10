'use client';

/**
 * User Guide Component
 *
 * Comprehensive in-app documentation for users.
 * Covers all major features and workflows.
 *
 * This is the main entry point that composes all section components.
 */

import { useState } from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

import type { GuideSection } from './types';
import { GettingStartedSection } from './GettingStartedSection';
import { ProposalsSection } from './ProposalsSection';
import { ProcurementSection } from './ProcurementSection';
import { FlowSection } from './FlowSection';
import { DocumentsSection } from './DocumentsSection';
import { MaterialsSection } from './MaterialsSection';
import { AccountingSection } from './AccountingSection';
import { KeyboardShortcutsSection } from './KeyboardShortcutsSection';
import { TipsSection } from './TipsSection';

// Re-export types and helpers for external use
export type { GuideSection } from './types';
export { KeyboardShortcut, FeatureCard, StepGuide } from './helpers';

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
