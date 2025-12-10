/**
 * EmptyState Component Tests
 *
 * Tests for the standardized empty state component including:
 * - Rendering variants (inline, table, card, paper)
 * - Title, message, and action props
 * - Custom sx props
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Table, TableBody, Button } from '@mui/material';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  describe('Required Props', () => {
    it('should render message', () => {
      render(<EmptyState message="No items found" />);

      expect(screen.getByText('No items found')).toBeInTheDocument();
    });
  });

  describe('Title', () => {
    it('should render title when provided', () => {
      render(<EmptyState message="No data available" title="Empty List" />);

      expect(screen.getByText('Empty List')).toBeInTheDocument();
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should not render title when not provided', () => {
      render(<EmptyState message="No items" />);

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });
  });

  describe('Action', () => {
    it('should render action button when provided', () => {
      render(<EmptyState message="No items found" action={<Button>Add Item</Button>} />);

      expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
    });

    it('should handle action click', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState message="No items" action={<Button onClick={handleClick}>Create</Button>} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should render custom ReactNode as action', () => {
      render(
        <EmptyState
          message="No items"
          action={<span data-testid="custom-action">Custom Action</span>}
        />
      );

      expect(screen.getByTestId('custom-action')).toBeInTheDocument();
    });

    it('should not render action container when not provided', () => {
      const { container } = render(<EmptyState message="No items" />);

      // Only the message text should be present, no action container
      expect(container.querySelectorAll('button')).toHaveLength(0);
    });
  });

  describe('Variant: inline (default)', () => {
    it('should render inline by default', () => {
      const { container } = render(<EmptyState message="No items" />);

      // Should not be wrapped in table, card, or paper elements
      expect(container.querySelector('tr')).not.toBeInTheDocument();
      expect(container.querySelector('.MuiCard-root')).not.toBeInTheDocument();
      expect(container.querySelector('.MuiPaper-root')).not.toBeInTheDocument();
    });

    it('should render inline variant explicitly', () => {
      const { container } = render(<EmptyState message="No items" variant="inline" />);

      expect(container.querySelector('tr')).not.toBeInTheDocument();
    });
  });

  describe('Variant: table', () => {
    it('should render as table row', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <EmptyState variant="table" message="No items in table" colSpan={5} />
          </TableBody>
        </Table>
      );

      expect(container.querySelector('tr')).toBeInTheDocument();
      expect(container.querySelector('td')).toBeInTheDocument();
      expect(screen.getByText('No items in table')).toBeInTheDocument();
    });

    it('should apply colSpan to table cell', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <EmptyState variant="table" message="No data" colSpan={8} />
          </TableBody>
        </Table>
      );

      const cell = container.querySelector('td');
      expect(cell).toHaveAttribute('colspan', '8');
    });

    it('should default colSpan to 1', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <EmptyState variant="table" message="No data" />
          </TableBody>
        </Table>
      );

      const cell = container.querySelector('td');
      expect(cell).toHaveAttribute('colspan', '1');
    });

    it('should render action in table cell', () => {
      render(
        <Table>
          <TableBody>
            <EmptyState
              variant="table"
              message="No items"
              colSpan={3}
              action={<Button>Add New</Button>}
            />
          </TableBody>
        </Table>
      );

      expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
    });
  });

  describe('Variant: card', () => {
    it('should render inside a Card', () => {
      const { container } = render(<EmptyState variant="card" message="No items in card" />);

      expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
      expect(screen.getByText('No items in card')).toBeInTheDocument();
    });

    it('should render with CardContent', () => {
      const { container } = render(
        <EmptyState variant="card" message="Empty card" title="No Data" />
      );

      expect(container.querySelector('.MuiCardContent-root')).toBeInTheDocument();
    });
  });

  describe('Variant: paper', () => {
    it('should render inside a Paper', () => {
      const { container } = render(<EmptyState variant="paper" message="No items in paper" />);

      expect(container.querySelector('.MuiPaper-root')).toBeInTheDocument();
      expect(screen.getByText('No items in paper')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom sx props', () => {
      const { container } = render(
        <EmptyState message="No items" sx={{ backgroundColor: 'blue', minHeight: 300 }} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Integration Scenarios', () => {
    it('should render complete empty state with all props', () => {
      const handleCreate = jest.fn();
      render(
        <EmptyState
          title="No Projects Found"
          message="You haven't created any projects yet. Start by creating your first project."
          action={
            <Button onClick={handleCreate} variant="contained">
              Create Project
            </Button>
          }
        />
      );

      expect(screen.getByText('No Projects Found')).toBeInTheDocument();
      expect(screen.getByText(/You haven't created any projects yet/)).toBeInTheDocument();

      const button = screen.getByRole('button', { name: 'Create Project' });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleCreate).toHaveBeenCalled();
    });

    it('should work in a data table context', () => {
      render(
        <Table>
          <TableBody>
            <EmptyState
              variant="table"
              title="No Orders"
              message="There are no orders matching your filters."
              colSpan={6}
              action={<Button size="small">Clear Filters</Button>}
            />
          </TableBody>
        </Table>
      );

      expect(screen.getByText('No Orders')).toBeInTheDocument();
      expect(screen.getByText('There are no orders matching your filters.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
    });

    it('should work as a card placeholder', () => {
      render(
        <EmptyState
          variant="card"
          title="Coming Soon"
          message="This feature is under development."
        />
      );

      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
      expect(screen.getByText('This feature is under development.')).toBeInTheDocument();
    });

    it('should work as a paper section placeholder', () => {
      render(
        <EmptyState
          variant="paper"
          message="No recent activity"
          action={<Button variant="text">View All Activity</Button>}
        />
      );

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'View All Activity' })).toBeInTheDocument();
    });
  });
});
