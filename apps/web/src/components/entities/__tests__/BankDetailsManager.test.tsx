/**
 * BankDetailsManager Component Tests
 *
 * Tests for the BankDetailsManager component used to manage entity bank details.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BankDetailsManager } from '../BankDetailsManager';
import { createMockBankDetailsData } from './test-utils';

// Mock crypto.randomUUID for consistent ID generation
const mockRandomUUID = jest.fn(() => 'test-uuid-12345678');
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: mockRandomUUID },
});

describe('BankDetailsManager', () => {
  const defaultOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with empty bank details list', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      expect(screen.getByText('Bank Details (0)')).toBeInTheDocument();
      expect(
        screen.getByText(
          /No bank accounts added yet. Click "Add Bank Account" to add bank details./i
        )
      ).toBeInTheDocument();
    });

    it('should render bank details count correctly', () => {
      const bankDetails = [
        createMockBankDetailsData({ id: '1' }),
        createMockBankDetailsData({ id: '2' }),
      ];
      render(<BankDetailsManager bankDetails={bankDetails} onChange={defaultOnChange} />);

      expect(screen.getByText('Bank Details (2)')).toBeInTheDocument();
    });

    it('should display Add Bank Account button when not editing or adding', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      expect(screen.getByRole('button', { name: /add bank account/i })).toBeInTheDocument();
    });

    it('should display bank details correctly', () => {
      const bankDetail = createMockBankDetailsData({
        bankName: 'HDFC Bank',
        accountNumber: '9876543210',
        accountName: 'Test Company Ltd',
        ifscCode: 'HDFC0001234',
        swiftCode: 'HDFCINBB',
        branchName: 'Corporate Branch',
      });
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      expect(screen.getByText('HDFC Bank')).toBeInTheDocument();
      expect(screen.getByText('Test Company Ltd')).toBeInTheDocument();
      expect(screen.getByText('9876543210')).toBeInTheDocument();
      expect(screen.getByText('HDFC0001234')).toBeInTheDocument();
      expect(screen.getByText('HDFCINBB')).toBeInTheDocument();
      expect(screen.getByText('Corporate Branch')).toBeInTheDocument();
    });

    it('should not display optional fields when not provided', () => {
      const bankDetail = createMockBankDetailsData({
        bankName: 'Test Bank',
        accountNumber: '1234567890',
        accountName: 'Test Account',
        ifscCode: undefined,
        swiftCode: undefined,
        iban: undefined,
        branchName: undefined,
        branchAddress: undefined,
      });
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      expect(screen.queryByText('IFSC Code:')).not.toBeInTheDocument();
      expect(screen.queryByText('SWIFT Code:')).not.toBeInTheDocument();
      expect(screen.queryByText('IBAN:')).not.toBeInTheDocument();
      expect(screen.queryByText('Branch:')).not.toBeInTheDocument();
    });

    it('should display multiple bank accounts', () => {
      const bankDetails = [
        createMockBankDetailsData({ id: '1', bankName: 'First Bank' }),
        createMockBankDetailsData({ id: '2', bankName: 'Second Bank' }),
        createMockBankDetailsData({ id: '3', bankName: 'Third Bank' }),
      ];
      render(<BankDetailsManager bankDetails={bankDetails} onChange={defaultOnChange} />);

      expect(screen.getByText('First Bank')).toBeInTheDocument();
      expect(screen.getByText('Second Bank')).toBeInTheDocument();
      expect(screen.getByText('Third Bank')).toBeInTheDocument();
    });
  });

  describe('Adding Bank Details', () => {
    it('should show add form when Add Bank Account is clicked', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      expect(screen.getByText('New Bank Account')).toBeInTheDocument();
      expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/account number/i)).toBeInTheDocument();
    });

    it('should hide Add Bank Account button when in add mode', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      // Only the form's Add Bank Account button should be visible
      const addButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.toLowerCase().includes('add bank account'));
      expect(addButtons).toHaveLength(1); // Only the form submit button
    });

    it('should add new bank details with all fields', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      // Fill in form fields
      fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'New Bank' } });
      fireEvent.change(screen.getByLabelText(/account name/i), {
        target: { value: 'New Account' },
      });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '0000000001' },
      });
      fireEvent.change(screen.getByLabelText(/ifsc code/i), { target: { value: 'newb0001234' } }); // Test uppercase
      fireEvent.change(screen.getByLabelText(/swift code/i), { target: { value: 'newbnkxx' } });
      fireEvent.change(screen.getByLabelText(/iban/i), { target: { value: 'gb00test1234' } });
      fireEvent.change(screen.getByLabelText(/branch name/i), { target: { value: 'Main Branch' } });
      fireEvent.change(screen.getByLabelText(/branch address/i), {
        target: { value: '123 Main St' },
      });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /^add bank account$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.stringContaining('bank-'),
          bankName: 'New Bank',
          accountName: 'New Account',
          accountNumber: '0000000001',
          ifscCode: 'NEWB0001234', // Should be uppercase
          swiftCode: 'NEWBNKXX',
          iban: 'GB00TEST1234',
          branchName: 'Main Branch',
          branchAddress: '123 Main St',
        }),
      ]);
    });

    it('should convert IFSC code to uppercase', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'Test Bank' } });
      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '1234567890' },
      });
      fireEvent.change(screen.getByLabelText(/ifsc code/i), { target: { value: 'sbin0001234' } });

      fireEvent.click(screen.getByRole('button', { name: /^add bank account$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          ifscCode: 'SBIN0001234',
        }),
      ]);
    });

    it('should convert SWIFT code to uppercase', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'Test Bank' } });
      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '1234567890' },
      });
      fireEvent.change(screen.getByLabelText(/swift code/i), { target: { value: 'sbininbb' } });

      fireEvent.click(screen.getByRole('button', { name: /^add bank account$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          swiftCode: 'SBININBB',
        }),
      ]);
    });

    it('should convert IBAN to uppercase', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'Test Bank' } });
      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '1234567890' },
      });
      fireEvent.change(screen.getByLabelText(/iban/i), {
        target: { value: 'de89370400440532013000' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^add bank account$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          iban: 'DE89370400440532013000',
        }),
      ]);
    });

    it('should not add bank details without required bankName field', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '1234567890' },
      });

      const addButton = screen.getByRole('button', { name: /^add bank account$/i });
      expect(addButton).toBeDisabled();
    });

    it('should not add bank details without required accountNumber field', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'Test Bank' } });
      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Test' } });

      const addButton = screen.getByRole('button', { name: /^add bank account$/i });
      expect(addButton).toBeDisabled();
    });

    it('should not add bank details without required accountName field', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'Test Bank' } });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '1234567890' },
      });

      const addButton = screen.getByRole('button', { name: /^add bank account$/i });
      expect(addButton).toBeDisabled();
    });

    it('should cancel adding bank details and reset form', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), {
        target: { value: 'Should Not Save' },
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByText('New Bank Account')).not.toBeInTheDocument();
      expect(defaultOnChange).not.toHaveBeenCalled();
    });

    it('should trim whitespace from all fields', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), {
        target: { value: '  Trimmed Bank  ' },
      });
      fireEvent.change(screen.getByLabelText(/account name/i), {
        target: { value: '  Trimmed Account  ' },
      });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '  1234567890  ' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^add bank account$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          bankName: 'Trimmed Bank',
          accountName: 'Trimmed Account',
          accountNumber: '1234567890',
        }),
      ]);
    });

    it('should set undefined for empty optional fields', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'Test Bank' } });
      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '1234567890' },
      });
      // Leave optional fields empty

      fireEvent.click(screen.getByRole('button', { name: /^add bank account$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          ifscCode: undefined,
          swiftCode: undefined,
          iban: undefined,
          branchName: undefined,
          branchAddress: undefined,
        }),
      ]);
    });
  });

  describe('Editing Bank Details', () => {
    it('should show edit form when Edit button is clicked', () => {
      const bankDetail = createMockBankDetailsData({ bankName: 'Original Bank' });
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit bank details/i }));

      expect(screen.getByDisplayValue('Original Bank')).toBeInTheDocument();
    });

    it('should load bank details data into edit form', () => {
      const bankDetail = createMockBankDetailsData({
        bankName: 'Edit Bank',
        accountNumber: '9999999999',
        accountName: 'Edit Account',
        ifscCode: 'EDIT0001234',
        branchName: 'Edit Branch',
      });
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit bank details/i }));

      expect(screen.getByDisplayValue('Edit Bank')).toBeInTheDocument();
      expect(screen.getByDisplayValue('9999999999')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Edit Account')).toBeInTheDocument();
      expect(screen.getByDisplayValue('EDIT0001234')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Edit Branch')).toBeInTheDocument();
    });

    it('should save edited bank details', () => {
      const bankDetail = createMockBankDetailsData({ id: 'edit-1', bankName: 'Original' });
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit bank details/i }));
      fireEvent.change(screen.getByDisplayValue('Original'), { target: { value: 'Updated Bank' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'edit-1',
          bankName: 'Updated Bank',
        }),
      ]);
    });

    it('should cancel edit and restore original data', () => {
      const bankDetail = createMockBankDetailsData({ bankName: 'Original' });
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit bank details/i }));
      fireEvent.change(screen.getByDisplayValue('Original'), {
        target: { value: 'Should Not Save' },
      });
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultOnChange).not.toHaveBeenCalled();
      expect(screen.getByText('Original')).toBeInTheDocument();
    });

    it('should disable Save button when required fields are empty during edit', () => {
      const bankDetail = createMockBankDetailsData();
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit bank details/i }));

      const bankNameInput = screen.getByLabelText(/bank name/i);
      fireEvent.change(bankNameInput, { target: { value: '' } });

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });

  describe('Deleting Bank Details', () => {
    it('should delete bank details', () => {
      const bankDetails = [
        createMockBankDetailsData({ id: '1', bankName: 'First Bank' }),
        createMockBankDetailsData({ id: '2', bankName: 'Second Bank' }),
      ];
      render(<BankDetailsManager bankDetails={bankDetails} onChange={defaultOnChange} />);

      const deleteButtons = screen.getAllByRole('button', { name: /delete bank details/i });
      fireEvent.click(deleteButtons[1]!); // Delete second bank

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1', bankName: 'First Bank' }),
      ]);
    });

    it('should allow deleting last bank details', () => {
      const bankDetails = [createMockBankDetailsData({ id: '1' })];
      render(<BankDetailsManager bankDetails={bankDetails} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /delete bank details/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([]);
    });

    it('should delete from a list of multiple banks correctly', () => {
      const bankDetails = [
        createMockBankDetailsData({ id: '1', bankName: 'Keep This' }),
        createMockBankDetailsData({ id: '2', bankName: 'Delete This' }),
        createMockBankDetailsData({ id: '3', bankName: 'Also Keep' }),
      ];
      render(<BankDetailsManager bankDetails={bankDetails} onChange={defaultOnChange} />);

      const deleteButtons = screen.getAllByRole('button', { name: /delete bank details/i });
      fireEvent.click(deleteButtons[1]!); // Delete middle bank

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1', bankName: 'Keep This' }),
        expect.objectContaining({ id: '3', bankName: 'Also Keep' }),
      ]);
    });
  });

  describe('Disabled State', () => {
    it('should disable all buttons when disabled prop is true', () => {
      const bankDetail = createMockBankDetailsData();
      render(
        <BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} disabled={true} />
      );

      expect(screen.getByRole('button', { name: /add bank account/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /edit bank details/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /delete bank details/i })).toBeDisabled();
    });

    it('should disable form fields when disabled prop is true during edit', () => {
      const bankDetail = createMockBankDetailsData();
      const { rerender } = render(
        <BankDetailsManager
          bankDetails={[bankDetail]}
          onChange={defaultOnChange}
          disabled={false}
        />
      );

      // Start editing
      fireEvent.click(screen.getByRole('button', { name: /edit bank details/i }));

      // Re-render with disabled=true
      rerender(
        <BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} disabled={true} />
      );

      expect(screen.getByLabelText(/bank name/i)).toBeDisabled();
      expect(screen.getByLabelText(/account number/i)).toBeDisabled();
    });

    it('should disable Add Bank Account button in header when disabled', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} disabled={true} />);

      expect(screen.getByRole('button', { name: /add bank account/i })).toBeDisabled();
    });
  });

  describe('Form State Management', () => {
    it('should close add form after successful add', () => {
      render(<BankDetailsManager bankDetails={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'New' } });
      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Account' } });
      fireEvent.change(screen.getByLabelText(/account number/i), {
        target: { value: '1234567890' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^add bank account$/i }));

      expect(screen.queryByText('New Bank Account')).not.toBeInTheDocument();
    });

    it('should close edit form after successful save', () => {
      const bankDetail = createMockBankDetailsData({ bankName: 'Original' });
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit bank details/i }));
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });

    it('should switch from edit mode to add mode correctly', () => {
      const bankDetail = createMockBankDetailsData({ bankName: 'Existing' });
      render(<BankDetailsManager bankDetails={[bankDetail]} onChange={defaultOnChange} />);

      // Start editing
      fireEvent.click(screen.getByRole('button', { name: /edit bank details/i }));
      expect(screen.getByDisplayValue('Existing')).toBeInTheDocument();

      // Cancel and add new
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      fireEvent.click(screen.getByRole('button', { name: /add bank account/i }));

      // Form should be empty
      expect(screen.getByText('New Bank Account')).toBeInTheDocument();
      expect(screen.getByLabelText(/bank name/i)).toHaveValue('');
    });

    it('should not allow editing multiple banks simultaneously', () => {
      const bankDetails = [
        createMockBankDetailsData({ id: '1', bankName: 'First' }),
        createMockBankDetailsData({ id: '2', bankName: 'Second' }),
      ];
      render(<BankDetailsManager bankDetails={bankDetails} onChange={defaultOnChange} />);

      // Start editing first
      const editButtons = screen.getAllByRole('button', { name: /edit bank details/i });
      fireEvent.click(editButtons[0]!);

      // First should be in edit mode, second should still show display
      expect(screen.getByDisplayValue('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });
  });
});
