/**
 * ContactsManager Component Tests
 *
 * Tests for the ContactsManager component used to manage entity contacts.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ContactsManager } from '../ContactsManager';
import { createMockContactData } from './test-utils';

// Mock crypto.randomUUID for consistent ID generation
const mockRandomUUID = jest.fn(() => 'test-uuid-12345678');
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: mockRandomUUID },
});

describe('ContactsManager', () => {
  const defaultOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with empty contacts list', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      expect(screen.getByText('Contact Persons (0)')).toBeInTheDocument();
      expect(
        screen.getByText(/No contacts added yet. Click "Add Contact" to add the first contact./i)
      ).toBeInTheDocument();
    });

    it('should render contacts count correctly', () => {
      const contacts = [
        createMockContactData({ id: '1', isPrimary: true }),
        createMockContactData({ id: '2' }),
      ];
      render(<ContactsManager contacts={contacts} onChange={defaultOnChange} />);

      expect(screen.getByText('Contact Persons (2)')).toBeInTheDocument();
    });

    it('should display Add Contact button when not editing or adding', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
    });

    it('should display contact details correctly', () => {
      const contact = createMockContactData({
        name: 'Jane Smith',
        designation: 'Director',
        email: 'jane@example.com',
        phone: '+91 1234567890',
        mobile: '+91 9876543210',
        notes: 'Important contact',
        isPrimary: true,
      });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Director')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('+91 1234567890')).toBeInTheDocument();
      expect(screen.getByText('+91 9876543210')).toBeInTheDocument();
      expect(screen.getByText('Important contact')).toBeInTheDocument();
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });

    it('should not display optional fields when not provided', () => {
      const contact = createMockContactData({
        name: 'Minimal Contact',
        email: 'minimal@example.com',
        phone: '+91 1234567890',
        designation: undefined,
        mobile: undefined,
        notes: undefined,
        isPrimary: false,
      });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      expect(screen.queryByText('Designation:')).not.toBeInTheDocument();
      expect(screen.queryByText('Mobile:')).not.toBeInTheDocument();
      expect(screen.queryByText('Notes:')).not.toBeInTheDocument();
    });

    it('should show primary badge for primary contact', () => {
      const primaryContact = createMockContactData({ isPrimary: true });
      render(<ContactsManager contacts={[primaryContact]} onChange={defaultOnChange} />);

      expect(screen.getByText('Primary')).toBeInTheDocument();
    });

    it('should show Set as Primary button for non-primary contacts', () => {
      const nonPrimaryContact = createMockContactData({ isPrimary: false });
      render(<ContactsManager contacts={[nonPrimaryContact]} onChange={defaultOnChange} />);

      expect(screen.getByRole('button', { name: /set as primary contact/i })).toBeInTheDocument();
    });
  });

  describe('Adding Contacts', () => {
    it('should show add form when Add Contact is clicked', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      expect(screen.getByText('New Contact')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/contact person name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/contact@example.com/i)).toBeInTheDocument();
      // There are 2 phone placeholders (phone and mobile)
      expect(screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/)).toHaveLength(2);
    });

    it('should hide header Add Contact button when in add mode', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      // Before clicking, there's only the header "Add Contact" button
      expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      // After clicking, the header button is gone, but the form's "Add Contact" submit button exists
      // The header button is conditionally rendered (!adding && !editingId)
      // Form submit button has text "Add Contact" but it's disabled initially
      const addContactButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent === 'Add Contact');
      // Should only have one - the submit button in the form
      expect(addContactButtons).toHaveLength(1);
    });

    it('should add a new contact with all fields', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      // Open add form
      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      // Fill in form fields using placeholders (unique in add form)
      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'New Contact' },
      });
      fireEvent.change(screen.getByPlaceholderText(/job title or role/i), {
        target: { value: 'Engineer' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: 'NEW@EXAMPLE.COM' },
      }); // Test uppercase conversion
      // There are two phone placeholders, use the first one (Phone)
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '+91 1111111111' } });
      fireEvent.change(phonePlaceholders[1]!, { target: { value: '+91 2222222222' } }); // Mobile
      fireEvent.change(screen.getByPlaceholderText(/additional notes about this contact/i), {
        target: { value: 'Test notes' },
      });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /^add contact$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.stringContaining('temp-'),
          name: 'New Contact',
          designation: 'Engineer',
          email: 'new@example.com', // Should be lowercase
          phone: '+91 1111111111',
          mobile: '+91 2222222222',
          notes: 'Test notes',
          isPrimary: true, // First contact should be primary
        }),
      ]);
    });

    it('should auto-set first contact as primary', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'First Contact' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: 'first@example.com' },
      });
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '+91 1111111111' } });

      fireEvent.click(screen.getByRole('button', { name: /^add contact$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          isPrimary: true,
        }),
      ]);
    });

    it('should not auto-set subsequent contacts as primary', () => {
      const existingContact = createMockContactData({ id: '1', isPrimary: true });
      render(<ContactsManager contacts={[existingContact]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'Second Contact' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: 'second@example.com' },
      });
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '+91 2222222222' } });

      fireEvent.click(screen.getByRole('button', { name: /^add contact$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        existingContact,
        expect.objectContaining({
          isPrimary: false,
        }),
      ]);
    });

    it('should not add contact without required name field', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: 'test@example.com' },
      });
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '+91 1111111111' } });

      // The Add Contact button should be disabled
      const addButton = screen.getByRole('button', { name: /^add contact$/i });
      expect(addButton).toBeDisabled();
    });

    it('should not add contact without required email field', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'Test' },
      });
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '+91 1111111111' } });

      const addButton = screen.getByRole('button', { name: /^add contact$/i });
      expect(addButton).toBeDisabled();
    });

    it('should not add contact without required phone field', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: 'test@example.com' },
      });

      const addButton = screen.getByRole('button', { name: /^add contact$/i });
      expect(addButton).toBeDisabled();
    });

    it('should cancel adding contact and reset form', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'Cancelled Contact' },
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByText('New Contact')).not.toBeInTheDocument();
      expect(defaultOnChange).not.toHaveBeenCalled();
    });

    it('should convert email to lowercase', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: 'UPPERCASE@EXAMPLE.COM' },
      });
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '+91 1111111111' } });

      fireEvent.click(screen.getByRole('button', { name: /^add contact$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          email: 'uppercase@example.com',
        }),
      ]);
    });

    it('should trim whitespace from all fields', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: '  Trimmed Name  ' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: '  trimmed@example.com  ' },
      });
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '  +91 1111111111  ' } });

      fireEvent.click(screen.getByRole('button', { name: /^add contact$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Trimmed Name',
          email: 'trimmed@example.com',
          phone: '+91 1111111111',
        }),
      ]);
    });

    it('should set undefined for empty optional fields', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: 'test@example.com' },
      });
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '+91 1111111111' } });
      // Leave optional fields empty

      fireEvent.click(screen.getByRole('button', { name: /^add contact$/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          designation: undefined,
          mobile: undefined,
          notes: undefined,
        }),
      ]);
    });
  });

  describe('Editing Contacts', () => {
    it('should show edit form when Edit button is clicked', () => {
      const contact = createMockContactData({ name: 'Original Name' });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit contact/i }));

      expect(screen.getByDisplayValue('Original Name')).toBeInTheDocument();
    });

    it('should load contact data into edit form', () => {
      const contact = createMockContactData({
        name: 'Edit Me',
        designation: 'Manager',
        email: 'edit@example.com',
        phone: '+91 1111111111',
        mobile: '+91 2222222222',
        notes: 'Edit notes',
      });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit contact/i }));

      expect(screen.getByDisplayValue('Edit Me')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Manager')).toBeInTheDocument();
      expect(screen.getByDisplayValue('edit@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+91 1111111111')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+91 2222222222')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Edit notes')).toBeInTheDocument();
    });

    it('should save edited contact', () => {
      const contact = createMockContactData({ id: 'edit-1', name: 'Original', isPrimary: true });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit contact/i }));
      fireEvent.change(screen.getByDisplayValue('Original'), { target: { value: 'Updated Name' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'edit-1',
          name: 'Updated Name',
          isPrimary: true, // Should preserve isPrimary
        }),
      ]);
    });

    it('should cancel edit and restore original data', () => {
      const contact = createMockContactData({ name: 'Original' });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit contact/i }));
      fireEvent.change(screen.getByDisplayValue('Original'), {
        target: { value: 'Should Not Save' },
      });
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultOnChange).not.toHaveBeenCalled();
      expect(screen.getByText('Original')).toBeInTheDocument();
    });

    it('should disable Save button when required fields are empty during edit', () => {
      const contact = createMockContactData();
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit contact/i }));

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: '' } });

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });

  describe('Deleting Contacts', () => {
    it('should delete a contact', () => {
      const contacts = [
        createMockContactData({ id: '1', name: 'First', isPrimary: true }),
        createMockContactData({ id: '2', name: 'Second' }),
      ];
      render(<ContactsManager contacts={contacts} onChange={defaultOnChange} />);

      const deleteButtons = screen.getAllByRole('button', { name: /delete contact/i });
      fireEvent.click(deleteButtons[1]!); // Delete second contact

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1', name: 'First' }),
      ]);
    });

    it('should reassign primary when primary contact is deleted', () => {
      const contacts = [
        createMockContactData({ id: '1', name: 'Primary', isPrimary: true }),
        createMockContactData({ id: '2', name: 'Second', isPrimary: false }),
      ];
      render(<ContactsManager contacts={contacts} onChange={defaultOnChange} />);

      const deleteButtons = screen.getAllByRole('button', { name: /delete contact/i });
      fireEvent.click(deleteButtons[0]!); // Delete primary contact

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: '2',
          name: 'Second',
          isPrimary: true, // Should become primary
        }),
      ]);
    });

    it('should allow deleting last contact', () => {
      const contacts = [createMockContactData({ id: '1', isPrimary: true })];
      render(<ContactsManager contacts={contacts} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /delete contact/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Setting Primary Contact', () => {
    it('should set a different contact as primary', () => {
      const contacts = [
        createMockContactData({ id: '1', name: 'First', isPrimary: true }),
        createMockContactData({ id: '2', name: 'Second', isPrimary: false }),
      ];
      render(<ContactsManager contacts={contacts} onChange={defaultOnChange} />);

      // Find and click "Set as Primary" button (only available for non-primary)
      fireEvent.click(screen.getByRole('button', { name: /set as primary contact/i }));

      expect(defaultOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1', isPrimary: false }),
        expect.objectContaining({ id: '2', isPrimary: true }),
      ]);
    });

    it('should not show Set as Primary for already primary contact', () => {
      const contact = createMockContactData({ isPrimary: true });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      // Should not find "Set as Primary" button, only "Primary Contact" tooltip
      expect(
        screen.queryByRole('button', { name: /set as primary contact/i })
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /primary contact/i })).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should disable all buttons when disabled prop is true', () => {
      const contact = createMockContactData();
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} disabled={true} />);

      expect(screen.getByRole('button', { name: /add contact/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /edit contact/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /delete contact/i })).toBeDisabled();
    });

    it('should disable form fields when disabled prop is true during edit', () => {
      const contact = createMockContactData();
      const { rerender } = render(
        <ContactsManager contacts={[contact]} onChange={defaultOnChange} disabled={false} />
      );

      // Start editing
      fireEvent.click(screen.getByRole('button', { name: /edit contact/i }));

      // Re-render with disabled=true
      rerender(<ContactsManager contacts={[contact]} onChange={defaultOnChange} disabled={true} />);

      expect(screen.getByLabelText(/name/i)).toBeDisabled();
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
    });
  });

  describe('Form State Management', () => {
    it('should switch from edit mode to add mode when clicking Add Contact', () => {
      const contact = createMockContactData({ name: 'Existing' });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      // Start editing
      fireEvent.click(screen.getByRole('button', { name: /edit contact/i }));
      expect(screen.getByDisplayValue('Existing')).toBeInTheDocument();

      // Cancel and add new
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      // Form should be empty (not showing edit data)
      expect(screen.queryByDisplayValue('Existing')).not.toBeInTheDocument();
      expect(screen.getByText('New Contact')).toBeInTheDocument();
    });

    it('should close add form after successful add', () => {
      render(<ContactsManager contacts={[]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }));

      fireEvent.change(screen.getByPlaceholderText(/contact person name/i), {
        target: { value: 'New' },
      });
      fireEvent.change(screen.getByPlaceholderText(/contact@example.com/i), {
        target: { value: 'new@test.com' },
      });
      const phonePlaceholders = screen.getAllByPlaceholderText(/^\+91 XXXXXXXXXX$/);
      fireEvent.change(phonePlaceholders[0]!, { target: { value: '+91 1111111111' } });

      fireEvent.click(screen.getByRole('button', { name: /^add contact$/i }));

      // Form should be closed
      expect(screen.queryByText('New Contact')).not.toBeInTheDocument();
    });

    it('should close edit form after successful save', () => {
      const contact = createMockContactData({ name: 'Original' });
      render(<ContactsManager contacts={[contact]} onChange={defaultOnChange} />);

      fireEvent.click(screen.getByRole('button', { name: /edit contact/i }));
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Should exit edit mode (no Save button visible)
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });
  });
});
