'use client';

/**
 * Proposals Module - Hub Dashboard
 *
 * Card-based navigation organized by workflow sections
 */

import {
  Inbox as InboxIcon,
  Calculate as CalculateIcon,
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
      description:
        'Enquiries flow into proposals — scope, delivery, pricing, and terms are edited within each proposal',
      items: [
        {
          id: 'enquiries',
          title: 'Enquiries',
          description: 'Manage incoming client enquiries and bid decisions',
          icon: <InboxIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/proposals/enquiries',
        },
        {
          id: 'estimation',
          title: 'Estimation (BOMs)',
          description: 'Cost estimation via Bill of Materials',
          icon: <CalculateIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/estimation',
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
          description: 'View and manage all proposals across all stages',
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
      permissionDenied={!hasViewAccess}
    />
  );
}
