'use client';

/**
 * Procurement Module - Main Dashboard
 *
 * Card-based navigation to procurement workflows organized by workflow stage
 */

import {
  Description as DescriptionIcon,
  RequestQuote as RequestQuoteIcon,
  ShoppingCart as ShoppingCartIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  LocalShipping as LocalShippingIcon,
  Receipt as ReceiptIcon,
  CompareArrows as CompareArrowsIcon,
  Edit as EditIcon,
  Folder as FolderIcon,
  HealthAndSafety as DataHealthIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProcurement } from '@vapour/constants';
import { ModuleLandingPage, type ModuleSection } from '@/components/modules';

export default function ProcurementPage() {
  const { claims } = useAuth();

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewProcurement(claims.permissions) : false;

  const sections: ModuleSection[] = [
    {
      id: 'requisition',
      title: 'Requisition & Approval',
      description: 'Create purchase requests and get engineering approval',
      items: [
        {
          id: 'purchase-requests',
          title: 'Purchase Requests',
          description: 'Create and manage purchase requests with approval workflow',
          icon: <DescriptionIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/purchase-requests',
        },
        {
          id: 'engineering-approval',
          title: 'Engineering Approval',
          description: 'Review and approve purchase requests from engineering perspective',
          icon: <CheckCircleIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/engineering-approval',
        },
      ],
    },
    {
      id: 'sourcing',
      title: 'Sourcing',
      description: 'Vendor engagement, quotations, and purchase orders',
      items: [
        {
          id: 'rfqs',
          title: 'RFQs (Requests for Quotation)',
          description: 'Issue RFQs to vendors, receive and compare quotations',
          icon: <RequestQuoteIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/rfqs',
        },
        {
          id: 'pos',
          title: 'Purchase Orders',
          description: 'Create, approve, and track purchase orders with vendors',
          icon: <ShoppingCartIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/pos',
        },
        {
          id: 'amendments',
          title: 'PO Amendments',
          description: 'Create and manage amendments to approved purchase orders',
          icon: <EditIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/amendments',
        },
      ],
    },
    {
      id: 'receiving',
      title: 'Receiving & Verification',
      description: 'Track shipments, receive goods, and verify completion',
      items: [
        {
          id: 'packing-lists',
          title: 'Packing Lists',
          description: 'Manage packing lists for shipments and deliveries',
          icon: <ReceiptIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/packing-lists',
        },
        {
          id: 'goods-receipts',
          title: 'Goods Receipts',
          description: 'Record received goods, verify quality, and inspect items',
          icon: <LocalShippingIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/goods-receipts',
        },
        {
          id: 'work-completion',
          title: 'Work Completion',
          description: 'Issue work completion certificates for service POs',
          icon: <AssignmentIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/work-completion',
        },
      ],
    },
    {
      id: 'payment',
      title: 'Payment Processing',
      description: 'Reconciliation before payment approval',
      items: [
        {
          id: 'three-way-match',
          title: 'Three-Way Match',
          description: 'Match POs, goods receipts, and vendor bills for payment approval',
          icon: <CompareArrowsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/three-way-match',
        },
      ],
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Supporting documentation and files',
      items: [
        {
          id: 'files',
          title: 'Files',
          description: 'Browse and manage procurement-related documents',
          icon: <FolderIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/files',
        },
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics & Monitoring',
      description: 'Track procurement health and identify issues',
      items: [
        {
          id: 'data-health',
          title: 'Data Health',
          description: 'Monitor procurement data quality and identify stale or incomplete items',
          icon: <DataHealthIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/procurement/data-health',
        },
      ],
    },
  ];

  return (
    <ModuleLandingPage
      title="Procurement"
      description="End-to-end procurement workflow: from purchase requests to goods receipt"
      sections={sections}
      newAction={{
        label: 'New PR',
        path: '/procurement/purchase-requests/new',
      }}
      permissionDenied={!hasViewAccess}
    />
  );
}
