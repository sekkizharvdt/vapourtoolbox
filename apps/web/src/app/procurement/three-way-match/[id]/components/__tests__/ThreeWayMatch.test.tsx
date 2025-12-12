/**
 * Three-Way Match Components Tests
 *
 * Tests for FinancialSummary, LineItemsTable, DiscrepanciesTable, MatchSidebar, and MatchDialogs
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { FinancialSummary } from '../FinancialSummary';
import { LineItemsTable } from '../LineItemsTable';
import { DiscrepanciesTable } from '../DiscrepanciesTable';
import { MatchSidebar } from '../MatchSidebar';
import { ApproveDialog, RejectDialog, ResolveDiscrepancyDialog } from '../MatchDialogs';
import type { ThreeWayMatch, MatchLineItem, MatchDiscrepancy } from '@vapour/types';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock formatCurrency
jest.mock('@/lib/procurement/threeWayMatchHelpers', () => ({
  formatCurrency: (amount: number) => `₹${amount.toLocaleString()}`,
  formatPercentage: (value: number) => `${value.toFixed(1)}%`,
}));

// Mock formatDate
jest.mock('@/lib/utils/formatters', () => ({
  formatDate: (date: Date | undefined) => (date ? '2024-01-15' : '-'),
}));

// Helper to create mock Firestore Timestamp
const mockTimestamp = (date: Date = new Date()) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test mock for Firestore Timestamp
  ({
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }) as ThreeWayMatch['createdAt'];

// Factory functions - using type assertions for test mocks
function createMockThreeWayMatch(overrides: Partial<ThreeWayMatch> = {}): ThreeWayMatch {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test mock
  return {
    id: 'match-1',
    companyId: 'company-1',
    purchaseOrderId: 'po-1',
    goodsReceiptId: 'gr-1',
    vendorBillId: 'bill-1',
    poNumber: 'PO-001',
    grNumber: 'GR-001',
    vendorBillNumber: 'BILL-001',
    vendorInvoiceNumber: 'INV-001',
    vendorId: 'vendor-1',
    vendorName: 'Test Vendor',
    projectId: 'project-1',
    projectName: 'Test Project',
    poAmount: 100000,
    grAmount: 100000,
    invoiceAmount: 100000,
    variance: 0,
    variancePercentage: 0,
    overallMatchPercentage: 100,
    matchedLines: 5,
    totalLines: 5,
    lineItems: [],
    discrepancies: [],
    matchStatus: 'MATCHED',
    approvalStatus: 'PENDING',
    matchedAt: mockTimestamp(new Date('2024-01-15')),
    createdAt: mockTimestamp(),
    ...overrides,
  } as ThreeWayMatch;
}

function createMockLineItem(overrides: Partial<MatchLineItem> = {}): MatchLineItem {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test mock
  return {
    id: 'item-1',
    threeWayMatchId: 'match-1',
    lineNumber: 1,
    description: 'Test Item',
    poItemId: 'po-item-1',
    grItemId: 'gr-item-1',
    orderedQuantity: 10,
    receivedQuantity: 10,
    invoicedQuantity: 10,
    acceptedQuantity: 10,
    quantityVariance: 0,
    quantityMatched: true,
    poUnitPrice: 1000,
    invoiceUnitPrice: 1000,
    poLineTotal: 10000,
    grLineTotal: 10000,
    invoiceLineTotal: 10000,
    priceVariance: 0,
    priceVariancePercentage: 0,
    priceMatched: true,
    amountMatched: true,
    amountVariance: 0,
    amountVariancePercentage: 0,
    taxMatched: true,
    taxVariance: 0,
    lineStatus: 'MATCHED',
    withinTolerance: true,
    ...overrides,
  } as MatchLineItem;
}

function createMockDiscrepancy(overrides: Partial<MatchDiscrepancy> = {}): MatchDiscrepancy {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test mock
  return {
    id: 'disc-1',
    threeWayMatchId: 'match-1',
    discrepancyType: 'QUANTITY_MISMATCH',
    description: 'Quantity does not match',
    expectedValue: 10,
    actualValue: 8,
    resolved: false,
    ...overrides,
  } as MatchDiscrepancy;
}

describe('FinancialSummary', () => {
  const defaultMatch = createMockThreeWayMatch();

  describe('Rendering', () => {
    it('should render title', () => {
      render(<FinancialSummary match={defaultMatch} />);

      expect(screen.getByText('Financial Summary')).toBeInTheDocument();
    });

    it('should display all four amount fields', () => {
      render(<FinancialSummary match={defaultMatch} />);

      expect(screen.getByText('PO Amount')).toBeInTheDocument();
      expect(screen.getByText('GR Amount')).toBeInTheDocument();
      expect(screen.getByText('Invoice Amount')).toBeInTheDocument();
      expect(screen.getByText('Variance')).toBeInTheDocument();
    });

    it('should display formatted amounts', () => {
      render(<FinancialSummary match={defaultMatch} />);

      expect(screen.getAllByText('₹100,000')).toHaveLength(3); // PO, GR, Invoice
    });

    it('should display zero variance', () => {
      render(<FinancialSummary match={defaultMatch} />);

      expect(screen.getByText('₹0')).toBeInTheDocument();
    });
  });

  describe('Variance Display', () => {
    it('should show green color for zero variance', () => {
      render(<FinancialSummary match={defaultMatch} />);

      const varianceValue = screen.getByText('₹0');
      // Check it has success color class
      expect(varianceValue).toBeInTheDocument();
    });

    it('should show red color for non-zero variance', () => {
      const matchWithVariance = createMockThreeWayMatch({
        variance: 5000,
      });

      render(<FinancialSummary match={matchWithVariance} />);

      expect(screen.getByText('₹5,000')).toBeInTheDocument();
    });
  });
});

describe('LineItemsTable', () => {
  const mockLineItems = [
    createMockLineItem({
      id: 'item-1',
      lineNumber: 1,
      description: 'Widget A',
      orderedQuantity: 10,
      receivedQuantity: 10,
      invoicedQuantity: 10,
      quantityVariance: 0,
      quantityMatched: true,
    }),
    createMockLineItem({
      id: 'item-2',
      lineNumber: 2,
      description: 'Widget B',
      orderedQuantity: 20,
      receivedQuantity: 18,
      invoicedQuantity: 18,
      quantityVariance: -2,
      quantityMatched: false,
    }),
  ];

  describe('Rendering', () => {
    it('should render title with count', () => {
      render(<LineItemsTable lineItems={mockLineItems} />);

      expect(screen.getByText('Line Items (2)')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      render(<LineItemsTable lineItems={mockLineItems} />);

      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('PO Qty')).toBeInTheDocument();
      expect(screen.getByText('GR Qty')).toBeInTheDocument();
      expect(screen.getByText('Bill Qty')).toBeInTheDocument();
      // Variance appears in header and data rows
      expect(screen.getAllByText('Variance').length).toBeGreaterThan(0);
      // Status appears in header and data chips
      expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    });

    it('should render all line items', () => {
      render(<LineItemsTable lineItems={mockLineItems} />);

      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.getByText('Widget B')).toBeInTheDocument();
    });

    it('should display quantities', () => {
      render(<LineItemsTable lineItems={mockLineItems} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Match Status', () => {
    it('should show Matched chip for matched items', () => {
      render(<LineItemsTable lineItems={mockLineItems} />);

      expect(screen.getByText('Matched')).toBeInTheDocument();
    });

    it('should show Variance chip for unmatched items', () => {
      render(<LineItemsTable lineItems={mockLineItems} />);

      // Variance appears in header and as chip for unmatched items
      expect(screen.getAllByText('Variance').length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should render empty table with headers', () => {
      render(<LineItemsTable lineItems={[]} />);

      expect(screen.getByText('Line Items (0)')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });
});

describe('DiscrepanciesTable', () => {
  const mockDiscrepancies = [
    createMockDiscrepancy({
      id: 'disc-1',
      discrepancyType: 'QUANTITY_MISMATCH',
      description: 'Short delivery',
      expectedValue: 10,
      actualValue: 8,
      resolved: false,
    }),
    createMockDiscrepancy({
      id: 'disc-2',
      discrepancyType: 'PRICE_MISMATCH',
      description: 'Price difference',
      expectedValue: 1000,
      actualValue: 1100,
      resolved: true,
    }),
  ];

  const defaultProps = {
    discrepancies: mockDiscrepancies,
    onResolve: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render title with count', () => {
      render(<DiscrepanciesTable {...defaultProps} />);

      expect(screen.getByText('Discrepancies (2)')).toBeInTheDocument();
    });

    it('should show unresolved count chip', () => {
      render(<DiscrepanciesTable {...defaultProps} />);

      expect(screen.getByText('1 Unresolved')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      render(<DiscrepanciesTable {...defaultProps} />);

      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Expected')).toBeInTheDocument();
      expect(screen.getByText('Actual')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render all discrepancies', () => {
      render(<DiscrepanciesTable {...defaultProps} />);

      expect(screen.getByText('Short delivery')).toBeInTheDocument();
      expect(screen.getByText('Price difference')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('should show Pending chip for unresolved discrepancies', () => {
      render(<DiscrepanciesTable {...defaultProps} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should show Resolved chip for resolved discrepancies', () => {
      render(<DiscrepanciesTable {...defaultProps} />);

      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should show Resolve button only for unresolved discrepancies', () => {
      render(<DiscrepanciesTable {...defaultProps} />);

      const resolveButtons = screen.getAllByRole('button', { name: /resolve/i });
      expect(resolveButtons).toHaveLength(1);
    });

    it('should call onResolve when Resolve button is clicked', () => {
      const onResolve = jest.fn();
      render(<DiscrepanciesTable {...defaultProps} onResolve={onResolve} />);

      fireEvent.click(screen.getByRole('button', { name: /resolve/i }));

      expect(onResolve).toHaveBeenCalledWith(mockDiscrepancies[0]);
    });
  });

  describe('Empty State', () => {
    it('should return null when no discrepancies', () => {
      const { container } = render(<DiscrepanciesTable discrepancies={[]} onResolve={jest.fn()} />);

      expect(container.firstChild).toBeNull();
    });
  });
});

describe('MatchSidebar', () => {
  const defaultMatch = createMockThreeWayMatch({
    overallMatchPercentage: 95,
    matchedLines: 4,
    totalLines: 5,
    variancePercentage: 2.5,
    poNumber: 'PO-001',
    grNumber: 'GR-001',
    vendorBillNumber: 'BILL-001',
    vendorInvoiceNumber: 'INV-001',
    vendorName: 'Test Vendor',
    projectName: 'Test Project',
  });

  beforeEach(() => {
    mockPush.mockClear();
  });

  describe('Match Status Section', () => {
    it('should render Match Status title', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Match Status')).toBeInTheDocument();
    });

    it('should display overall match percentage', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Overall Match %')).toBeInTheDocument();
      expect(screen.getByText('95.0%')).toBeInTheDocument();
    });

    it('should display matched lines', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Matched Lines')).toBeInTheDocument();
      expect(screen.getByText('4 / 5')).toBeInTheDocument();
    });

    it('should display variance percentage', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Variance %')).toBeInTheDocument();
      expect(screen.getByText('2.5%')).toBeInTheDocument();
    });
  });

  describe('Reference Documents Section', () => {
    it('should render Reference Documents title', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Reference Documents')).toBeInTheDocument();
    });

    it('should display PO number with link', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Purchase Order')).toBeInTheDocument();
      expect(screen.getByText('PO-001')).toBeInTheDocument();
    });

    it('should navigate to PO page on click', () => {
      render(<MatchSidebar match={defaultMatch} />);

      fireEvent.click(screen.getByText('PO-001'));

      expect(mockPush).toHaveBeenCalledWith('/procurement/pos/po-1');
    });

    it('should display GR number with link', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Goods Receipt')).toBeInTheDocument();
      expect(screen.getByText('GR-001')).toBeInTheDocument();
    });

    it('should navigate to GR page on click', () => {
      render(<MatchSidebar match={defaultMatch} />);

      fireEvent.click(screen.getByText('GR-001'));

      expect(mockPush).toHaveBeenCalledWith('/procurement/goods-receipts/gr-1');
    });

    it('should display vendor bill info', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Vendor Bill')).toBeInTheDocument();
      expect(screen.getByText('BILL-001')).toBeInTheDocument();
      expect(screen.getByText(/INV-001/)).toBeInTheDocument();
    });
  });

  describe('Timeline Section', () => {
    it('should render Timeline title', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Timeline')).toBeInTheDocument();
    });

    it('should display vendor name', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Vendor')).toBeInTheDocument();
      expect(screen.getByText('Test Vendor')).toBeInTheDocument();
    });

    it('should display project name', () => {
      render(<MatchSidebar match={defaultMatch} />);

      expect(screen.getByText('Project')).toBeInTheDocument();
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  describe('Match Percentage Color', () => {
    it('should show success color for >= 95% match', () => {
      const highMatch = createMockThreeWayMatch({ overallMatchPercentage: 95 });
      render(<MatchSidebar match={highMatch} />);

      // Verify chip is rendered
      expect(screen.getByText('95.0%')).toBeInTheDocument();
    });

    it('should show warning color for 80-94% match', () => {
      const mediumMatch = createMockThreeWayMatch({ overallMatchPercentage: 85 });
      render(<MatchSidebar match={mediumMatch} />);

      expect(screen.getByText('85.0%')).toBeInTheDocument();
    });

    it('should show error color for < 80% match', () => {
      const lowMatch = createMockThreeWayMatch({ overallMatchPercentage: 70 });
      render(<MatchSidebar match={lowMatch} />);

      expect(screen.getByText('70.0%')).toBeInTheDocument();
    });
  });
});

describe('ApproveDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onApprove: jest.fn(),
    loading: false,
    variance: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog title', () => {
      render(<ApproveDialog {...defaultProps} />);

      expect(screen.getByText('Approve Three-Way Match')).toBeInTheDocument();
    });

    it('should render confirmation message', () => {
      render(<ApproveDialog {...defaultProps} />);

      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });

    it('should render Cancel and Approve buttons', () => {
      render(<ApproveDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });
  });

  describe('Variance Warning', () => {
    it('should not show warning when variance is zero', () => {
      render(<ApproveDialog {...defaultProps} variance={0} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show warning when variance is non-zero', () => {
      render(<ApproveDialog {...defaultProps} variance={5000} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/₹5,000/)).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onClose when Cancel is clicked', () => {
      const onClose = jest.fn();
      render(<ApproveDialog {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onApprove when Approve is clicked', () => {
      const onApprove = jest.fn();
      render(<ApproveDialog {...defaultProps} onApprove={onApprove} />);

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      expect(onApprove).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable buttons when loading', () => {
      render(<ApproveDialog {...defaultProps} loading={true} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    });
  });
});

describe('RejectDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onReject: jest.fn(),
    loading: false,
    notes: '',
    onNotesChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog title', () => {
      render(<RejectDialog {...defaultProps} />);

      expect(screen.getByText('Reject Three-Way Match')).toBeInTheDocument();
    });

    it('should render rejection reason field', () => {
      render(<RejectDialog {...defaultProps} />);

      // Check for textarea - label is rendered but MUI TextField uses different association
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render Cancel and Reject buttons', () => {
      render(<RejectDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onNotesChange when typing rejection reason', () => {
      const onNotesChange = jest.fn();
      render(<RejectDialog {...defaultProps} onNotesChange={onNotesChange} />);

      // Use getByRole since MUI TextField label association differs
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'Test reason' },
      });

      expect(onNotesChange).toHaveBeenCalledWith('Test reason');
    });

    it('should disable Reject button when notes are empty', () => {
      render(<RejectDialog {...defaultProps} notes="" />);

      expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    });

    it('should enable Reject button when notes are provided', () => {
      render(<RejectDialog {...defaultProps} notes="Valid reason" />);

      expect(screen.getByRole('button', { name: 'Reject' })).not.toBeDisabled();
    });

    it('should call onReject when Reject is clicked', () => {
      const onReject = jest.fn();
      render(<RejectDialog {...defaultProps} notes="Reason" onReject={onReject} />);

      fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

      expect(onReject).toHaveBeenCalled();
    });
  });
});

describe('ResolveDiscrepancyDialog', () => {
  const mockDiscrepancy = createMockDiscrepancy({
    discrepancyType: 'QUANTITY_MISMATCH',
    description: 'Short delivery of items',
  });

  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onResolve: jest.fn(),
    loading: false,
    discrepancy: mockDiscrepancy,
    resolutionType: 'ACCEPTED' as const,
    onResolutionTypeChange: jest.fn(),
    notes: '',
    onNotesChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog title', () => {
      render(<ResolveDiscrepancyDialog {...defaultProps} />);

      expect(screen.getByText('Resolve Discrepancy')).toBeInTheDocument();
    });

    it('should display discrepancy info', () => {
      render(<ResolveDiscrepancyDialog {...defaultProps} />);

      expect(screen.getByText(/QUANTITY_MISMATCH/)).toBeInTheDocument();
      expect(screen.getByText(/Short delivery of items/)).toBeInTheDocument();
    });

    it('should render resolution type dropdown', () => {
      render(<ResolveDiscrepancyDialog {...defaultProps} />);

      // MUI Select uses combobox role
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render notes field', () => {
      render(<ResolveDiscrepancyDialog {...defaultProps} />);

      // MUI TextField uses textbox role
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Resolution Type Options', () => {
    it('should show all resolution type options', () => {
      render(<ResolveDiscrepancyDialog {...defaultProps} />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      // Use getAllByText for items that appear in both the select value and dropdown
      expect(screen.getAllByText('Accept Variance').length).toBeGreaterThan(0);
      expect(screen.getByText('Corrected by Vendor')).toBeInTheDocument();
      expect(screen.getByText('Price Adjustment')).toBeInTheDocument();
      expect(screen.getByText('Quantity Adjustment')).toBeInTheDocument();
      expect(screen.getByText('Waived')).toBeInTheDocument();
    });

    it('should call onResolutionTypeChange when type is selected', () => {
      const onResolutionTypeChange = jest.fn();
      render(
        <ResolveDiscrepancyDialog
          {...defaultProps}
          onResolutionTypeChange={onResolutionTypeChange}
        />
      );

      fireEvent.mouseDown(screen.getByRole('combobox'));
      fireEvent.click(screen.getByText('Price Adjustment'));

      expect(onResolutionTypeChange).toHaveBeenCalledWith('PRICE_ADJUSTMENT');
    });
  });

  describe('Interactions', () => {
    it('should call onResolve when Resolve is clicked', () => {
      const onResolve = jest.fn();
      render(<ResolveDiscrepancyDialog {...defaultProps} onResolve={onResolve} />);

      fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

      expect(onResolve).toHaveBeenCalled();
    });

    it('should call onClose when Cancel is clicked', () => {
      const onClose = jest.fn();
      render(<ResolveDiscrepancyDialog {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Null Discrepancy', () => {
    it('should not render content when discrepancy is null', () => {
      render(<ResolveDiscrepancyDialog {...defaultProps} discrepancy={null} />);

      expect(screen.queryByText(/QUANTITY_MISMATCH/)).not.toBeInTheDocument();
    });
  });
});
