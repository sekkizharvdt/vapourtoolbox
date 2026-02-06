'use client';

/**
 * Proposals Module - Hub Dashboard
 *
 * Card-based navigation organized by workflow sections
 */

import {
  Inbox as InboxIcon,
  GridView as GridViewIcon,
  Calculate as CalculateIcon,
  PriceChange as PriceChangeIcon,
  PictureAsPdf as PdfIcon,
  List as ListIcon,
  Folder as FolderIcon,
  BookmarkAdd as TemplateIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProposals } from '@vapour/constants';
import { ModuleLandingPage, type ModuleSection } from '@/components/modules';

export default function ProposalsPage() {
  const { claims } = useAuth();

  // Check permissions - user needs proposal view access
  const hasViewAccess = claims?.permissions ? canViewProposals(claims.permissions) : false;

  const sections: ModuleSection[] = [
    {
      id: 'workflow',
      title: 'Proposal Workflow',
      description: 'Follow the proposal creation process from enquiry to submission',
      items: [
        {
          id: 'enquiries',
          title: 'Enquiries',
          description: 'Manage incoming client enquiries and RFQs',
          icon: <InboxIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/proposals/enquiries',
        },
        {
          id: 'scope-matrix',
          title: 'Scope Matrix',
          description: 'Define scope of services, supply, and exclusions',
          icon: <GridViewIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/proposals/scope-matrix',
        },
        {
          id: 'estimation',
          title: 'Estimation (BOMs)',
          description: 'Cost estimation via Bill of Materials',
          icon: <CalculateIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/estimation',
        },
        {
          id: 'pricing',
          title: 'Pricing',
          description: 'Configure margins and final pricing',
          icon: <PriceChangeIcon sx={{ fontSize: 48, color: 'success.main' }} />,
          path: '/proposals/pricing',
        },
        {
          id: 'generation',
          title: 'Proposal Generation',
          description: 'Preview and submit proposal documents',
          icon: <PdfIcon sx={{ fontSize: 48, color: 'error.main' }} />,
          path: '/proposals/generation',
        },
      ],
    },
    {
      id: 'management',
      title: 'Management & Tools',
      description: 'View all proposals, templates, and related documents',
      items: [
        {
          id: 'all-proposals',
          title: 'All Proposals',
          description: 'View all proposals across all stages',
          icon: <ListIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/proposals/list',
        },
        {
          id: 'templates',
          title: 'Templates',
          description: 'Reusable proposal templates for quick creation',
          icon: <TemplateIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/proposals/templates',
        },
        {
          id: 'files',
          title: 'Files',
          description: 'Browse proposal-related documents and attachments',
          icon: <FolderIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/proposals/files',
        },
      ],
    },
  ];

  return (
    <ModuleLandingPage
      title="Proposals"
      description="Manage proposals from enquiry to final document generation"
      sections={sections}
      newAction={{
        label: 'New Proposal',
        path: '/proposals/new',
      }}
      permissionDenied={!hasViewAccess}
    />
  );
}
