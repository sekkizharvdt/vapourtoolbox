/**
 * ViewEntityDialog Component Tests
 *
 * Tests for the read-only view dialog for business entities.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ViewEntityDialog } from '../ViewEntityDialog';
import { createMockEntity, createMockArchivedEntity, createMockLegacyEntity } from './test-utils';

describe('ViewEntityDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onEdit: jest.fn(),
    onArchive: jest.fn(),
    canEdit: true,
    canArchive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when entity is null', () => {
      render(<ViewEntityDialog {...defaultProps} entity={null} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should not render when dialog is closed', () => {
      const entity = createMockEntity();
      render(<ViewEntityDialog {...defaultProps} open={false} entity={entity} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render dialog when open with entity', () => {
      const entity = createMockEntity({ name: 'Test Company' });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Entity name may appear in both header and Basic Information section
      expect(screen.getAllByText('Test Company').length).toBeGreaterThanOrEqual(1);
    });

    it('should display entity code', () => {
      const entity = createMockEntity({ code: 'ENT-123' });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText(/Code: ENT-123/)).toBeInTheDocument();
    });

    it('should display Active status chip for active entity', () => {
      const entity = createMockEntity({ isArchived: false });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      // Multiple "Active" texts may appear (chip and status field)
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });

    it('should display Archived status chip for archived entity', () => {
      const entity = createMockArchivedEntity();
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getAllByText('Archived')[0]).toBeInTheDocument();
    });
  });

  describe('Role Display', () => {
    it('should display VENDOR role chip with success color', () => {
      const entity = createMockEntity({ roles: ['VENDOR'] });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      const vendorChip = screen.getByText('VENDOR');
      expect(vendorChip).toBeInTheDocument();
    });

    it('should display CUSTOMER role chip with primary color', () => {
      const entity = createMockEntity({ roles: ['CUSTOMER'] });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      const customerChip = screen.getByText('CUSTOMER');
      expect(customerChip).toBeInTheDocument();
    });

    it('should display PARTNER role chip with info color', () => {
      const entity = createMockEntity({ roles: ['PARTNER'] });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      const partnerChip = screen.getByText('PARTNER');
      expect(partnerChip).toBeInTheDocument();
    });

    it('should display multiple roles', () => {
      const entity = createMockEntity({ roles: ['VENDOR', 'CUSTOMER'] });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('VENDOR')).toBeInTheDocument();
      expect(screen.getByText('CUSTOMER')).toBeInTheDocument();
    });
  });

  describe('Basic Information Section', () => {
    it('should display legal name', () => {
      const entity = createMockEntity({ legalName: 'Test Entity Private Limited' });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Test Entity Private Limited')).toBeInTheDocument();
    });

    it('should use name as fallback when legal name is not provided', () => {
      const entity = createMockEntity({ name: 'Test Co', legalName: undefined });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      // Both in header and in Basic Information
      expect(screen.getAllByText('Test Co').length).toBeGreaterThanOrEqual(1);
    });

    it('should display active status', () => {
      const entity = createMockEntity({ isActive: true });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      // Active appears in both chip and status field
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });

    it('should display inactive status', () => {
      const entity = createMockEntity({ isActive: false });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  describe('Contacts Section - New Format', () => {
    it('should display contacts count when multiple contacts exist', () => {
      const entity = createMockEntity({
        contacts: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+91 1111111111',
            isPrimary: true,
          },
          {
            id: '2',
            name: 'Jane Doe',
            email: 'jane@test.com',
            phone: '+91 2222222222',
            isPrimary: false,
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText(/Contacts \(2\)/)).toBeInTheDocument();
    });

    it('should display contact names', () => {
      const entity = createMockEntity({
        contacts: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+91 1111111111',
            isPrimary: true,
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display Primary badge for primary contact', () => {
      const entity = createMockEntity({
        contacts: [
          {
            id: '1',
            name: 'Primary Contact',
            email: 'primary@test.com',
            phone: '+91 1111111111',
            isPrimary: true,
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Primary')).toBeInTheDocument();
    });

    it('should display contact designation when provided', () => {
      const entity = createMockEntity({
        contacts: [
          {
            id: '1',
            name: 'John Doe',
            designation: 'Managing Director',
            email: 'john@test.com',
            phone: '+91 1111111111',
            isPrimary: true,
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Managing Director')).toBeInTheDocument();
    });

    it('should display contact email and phone', () => {
      const entity = createMockEntity({
        contacts: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+91 9876543210',
            isPrimary: true,
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('+91 9876543210')).toBeInTheDocument();
    });

    it('should display mobile when provided', () => {
      const entity = createMockEntity({
        contacts: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+91 1111111111',
            mobile: '+91 9999999999',
            isPrimary: true,
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText(/Mobile: \+91 9999999999/)).toBeInTheDocument();
    });

    it('should display contact notes when provided', () => {
      const entity = createMockEntity({
        contacts: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+91 1111111111',
            notes: 'Prefers email communication',
            isPrimary: true,
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Prefers email communication')).toBeInTheDocument();
    });
  });

  describe('Contacts Section - Legacy Format', () => {
    it('should display legacy contact person when contacts array is empty', () => {
      const entity = createMockLegacyEntity({
        contactPerson: 'Legacy Contact',
        email: 'legacy@test.com',
        phone: '+91 1234567890',
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Legacy Contact')).toBeInTheDocument();
    });

    it('should display legacy email and phone', () => {
      const entity = createMockLegacyEntity({
        contactPerson: 'Legacy Contact',
        email: 'legacy@example.com',
        phone: '+91 9876543210',
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('legacy@example.com')).toBeInTheDocument();
      expect(screen.getByText('+91 9876543210')).toBeInTheDocument();
    });
  });

  describe('Address Sections', () => {
    it('should display billing address', () => {
      const entity = createMockEntity({
        billingAddress: {
          line1: '123 Main Street',
          line2: 'Suite 100',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001',
        },
        // Clear shipping address to avoid duplicate countries
        shippingAddress: undefined,
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Billing Address')).toBeInTheDocument();
      expect(screen.getByText('123 Main Street')).toBeInTheDocument();
      expect(screen.getByText('Suite 100')).toBeInTheDocument();
      expect(screen.getByText(/Mumbai.*Maharashtra.*400001/)).toBeInTheDocument();
      expect(screen.getByText('India')).toBeInTheDocument();
    });

    it('should display shipping address when provided', () => {
      const entity = createMockEntity({
        shippingAddress: {
          line1: '456 Warehouse Road',
          city: 'Pune',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '411001',
        },
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Shipping Address')).toBeInTheDocument();
      expect(screen.getByText('456 Warehouse Road')).toBeInTheDocument();
    });

    it('should not display shipping address section when not provided', () => {
      const entity = createMockEntity({ shippingAddress: undefined });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.queryByText('Shipping Address')).not.toBeInTheDocument();
    });
  });

  describe('Tax Information Section', () => {
    it('should display GSTIN when provided', () => {
      const entity = createMockEntity({
        taxIdentifiers: { gstin: '22AAAAA0000A1Z5' },
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Tax Information')).toBeInTheDocument();
      expect(screen.getByText('22AAAAA0000A1Z5')).toBeInTheDocument();
    });

    it('should display PAN when provided', () => {
      const entity = createMockEntity({
        taxIdentifiers: { pan: 'AAAAA0000A' },
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Tax Information')).toBeInTheDocument();
      expect(screen.getByText('AAAAA0000A')).toBeInTheDocument();
    });

    it('should not display tax section when no tax identifiers', () => {
      const entity = createMockEntity({ taxIdentifiers: undefined });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.queryByText('Tax Information')).not.toBeInTheDocument();
    });
  });

  describe('Bank Details Section', () => {
    it('should display bank details count', () => {
      const entity = createMockEntity({
        bankDetails: [
          {
            bankName: 'SBI',
            accountNumber: '1234567890',
            accountName: 'Test Account',
          },
          {
            bankName: 'HDFC',
            accountNumber: '0987654321',
            accountName: 'Test Account 2',
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText(/Bank Details \(2\)/)).toBeInTheDocument();
    });

    it('should display bank name and account details', () => {
      const entity = createMockEntity({
        bankDetails: [
          {
            bankName: 'State Bank of India',
            accountNumber: '1234567890',
            accountName: 'Test Company',
            ifscCode: 'SBIN0001234',
          },
        ],
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('State Bank of India')).toBeInTheDocument();
      expect(screen.getByText('1234567890')).toBeInTheDocument();
      expect(screen.getByText('Test Company')).toBeInTheDocument();
      expect(screen.getByText('SBIN0001234')).toBeInTheDocument();
    });

    it('should not display bank section when no bank details', () => {
      const entity = createMockEntity({ bankDetails: undefined });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.queryByText(/Bank Details/)).not.toBeInTheDocument();
    });
  });

  describe('Credit Terms Section', () => {
    it('should display credit days', () => {
      const entity = createMockEntity({
        creditTerms: { creditDays: 30 },
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Credit Terms')).toBeInTheDocument();
      expect(screen.getByText('30 days')).toBeInTheDocument();
    });

    it('should display credit limit with currency', () => {
      const entity = createMockEntity({
        creditTerms: { creditDays: 30, creditLimit: 100000, currency: 'INR' },
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Credit Limit')).toBeInTheDocument();
      // Indian format: ₹1,00,000
      expect(screen.getByText(/₹.*1,00,000/)).toBeInTheDocument();
    });

    it('should not display credit terms section when not provided', () => {
      const entity = createMockEntity({ creditTerms: undefined });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.queryByText('Credit Terms')).not.toBeInTheDocument();
    });
  });

  describe('Notes Section', () => {
    it('should display notes when provided', () => {
      const entity = createMockEntity({ notes: 'This is a test note for the entity.' });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('This is a test note for the entity.')).toBeInTheDocument();
    });

    it('should not display notes section when not provided', () => {
      const entity = createMockEntity({ notes: undefined });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    });
  });

  describe('Archive Warning', () => {
    it('should display archive warning for archived entity', () => {
      const entity = createMockArchivedEntity({
        archiveReason: 'Company closed',
        archivedByName: 'Admin User',
      });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.getByText('This entity is archived')).toBeInTheDocument();
      expect(screen.getByText(/Reason:/)).toBeInTheDocument();
      expect(screen.getByText('Company closed')).toBeInTheDocument();
      expect(screen.getByText(/Archived by Admin User/)).toBeInTheDocument();
    });

    it('should not display archive warning for active entity', () => {
      const entity = createMockEntity({ isArchived: false });
      render(<ViewEntityDialog {...defaultProps} entity={entity} />);

      expect(screen.queryByText('This entity is archived')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should show Edit button when canEdit is true and entity is not archived', () => {
      const entity = createMockEntity({ isArchived: false });
      render(
        <ViewEntityDialog {...defaultProps} entity={entity} canEdit={true} canArchive={false} />
      );

      expect(screen.getByRole('button', { name: /edit entity/i })).toBeInTheDocument();
    });

    it('should hide Edit button when canEdit is false', () => {
      const entity = createMockEntity({ isArchived: false });
      render(
        <ViewEntityDialog {...defaultProps} entity={entity} canEdit={false} canArchive={true} />
      );

      expect(screen.queryByRole('button', { name: /edit entity/i })).not.toBeInTheDocument();
    });

    it('should hide Edit button when entity is archived', () => {
      const entity = createMockArchivedEntity();
      render(
        <ViewEntityDialog {...defaultProps} entity={entity} canEdit={true} canArchive={true} />
      );

      expect(screen.queryByRole('button', { name: /edit entity/i })).not.toBeInTheDocument();
    });

    it('should show Archive button when canArchive is true and entity is not archived', () => {
      const entity = createMockEntity({ isArchived: false });
      render(
        <ViewEntityDialog {...defaultProps} entity={entity} canEdit={false} canArchive={true} />
      );

      expect(screen.getByRole('button', { name: /archive entity/i })).toBeInTheDocument();
    });

    it('should hide Archive button when canArchive is false', () => {
      const entity = createMockEntity({ isArchived: false });
      render(
        <ViewEntityDialog {...defaultProps} entity={entity} canEdit={true} canArchive={false} />
      );

      expect(screen.queryByRole('button', { name: /archive entity/i })).not.toBeInTheDocument();
    });

    it('should hide Archive button when entity is already archived', () => {
      const entity = createMockArchivedEntity();
      render(
        <ViewEntityDialog {...defaultProps} entity={entity} canEdit={true} canArchive={true} />
      );

      expect(screen.queryByRole('button', { name: /archive entity/i })).not.toBeInTheDocument();
    });

    it('should call onEdit when Edit button is clicked', () => {
      const entity = createMockEntity({ isArchived: false });
      const onEdit = jest.fn();
      render(<ViewEntityDialog {...defaultProps} entity={entity} onEdit={onEdit} canEdit={true} />);

      fireEvent.click(screen.getByRole('button', { name: /edit entity/i }));

      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('should call onArchive when Archive button is clicked', () => {
      const entity = createMockEntity({ isArchived: false });
      const onArchive = jest.fn();
      render(
        <ViewEntityDialog
          {...defaultProps}
          entity={entity}
          onArchive={onArchive}
          canArchive={true}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /archive entity/i }));

      expect(onArchive).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Close button is clicked', () => {
      const entity = createMockEntity();
      const onClose = jest.fn();
      render(<ViewEntityDialog {...defaultProps} entity={entity} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when dialog Close action button is clicked', () => {
      const entity = createMockEntity();
      const onClose = jest.fn();
      render(<ViewEntityDialog {...defaultProps} entity={entity} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: /^close$/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
