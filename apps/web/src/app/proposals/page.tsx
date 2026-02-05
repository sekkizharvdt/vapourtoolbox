'use client';

/**
 * Proposals Module - Hub Dashboard
 *
 * Card-based navigation to proposal sub-modules
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
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';

export default function ProposalsPage() {
  const { claims } = useAuth();

  // Check permissions - user needs proposal view access
  const hasViewAccess = claims?.permissions ? canViewProposals(claims.permissions) : false;

  const modules: ModuleItem[] = [
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
      icon: <PriceChangeIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/pricing',
    },
    {
      id: 'generation',
      title: 'Proposal Generation',
      description: 'Preview and submit proposal documents',
      icon: <PdfIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/generation',
    },
    {
      id: 'all-proposals',
      title: 'All Proposals',
      description: 'View all proposals across all stages',
      icon: <ListIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/list',
    },
    {
      id: 'files',
      title: 'Files',
      description: 'Browse proposal-related documents',
      icon: <FolderIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/files',
    },
    {
      id: 'templates',
      title: 'Templates',
      description: 'Reusable proposal templates',
      icon: <TemplateIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/proposals/templates',
    },
  ];

  return (
    <ModuleLandingPage
      title="Proposals"
      description="Manage proposals from enquiry to final document generation"
      items={modules}
      newAction={{
        label: 'New Proposal',
        path: '/proposals/new',
      }}
      permissionDenied={!hasViewAccess}
    />
  );
}
