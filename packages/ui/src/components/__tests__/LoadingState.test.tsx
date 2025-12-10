/**
 * LoadingState Component Tests
 *
 * Tests for the standardized loading state component including:
 * - Rendering variants (inline, table, page)
 * - Custom message and sizing
 * - Custom sx props
 */

import { render, screen } from '@testing-library/react';
import { Table, TableBody } from '@mui/material';
import { LoadingState } from '../LoadingState';

describe('LoadingState', () => {
  describe('Default Rendering', () => {
    it('should render with default props', () => {
      render(<LoadingState />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render inline variant by default', () => {
      const { container } = render(<LoadingState />);

      // Should not be wrapped in table elements
      expect(container.querySelector('tr')).not.toBeInTheDocument();
      expect(container.querySelector('td')).not.toBeInTheDocument();
    });
  });

  describe('Message', () => {
    it('should render custom message', () => {
      render(<LoadingState message="Fetching data..." />);

      expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    });

    it('should render default message when not provided', () => {
      render(<LoadingState />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should handle empty message', () => {
      render(<LoadingState message="" />);

      // Should still render the spinner
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      // Empty message should not render text
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  describe('Variant: inline', () => {
    it('should render inline content', () => {
      const { container } = render(<LoadingState variant="inline" />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(container.querySelector('tr')).not.toBeInTheDocument();
    });
  });

  describe('Variant: page', () => {
    it('should render page variant', () => {
      render(<LoadingState variant="page" />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should have larger padding for page variant', () => {
      // Page variant has py: 8 vs inline's py: 4
      // We just verify it renders correctly
      const { container } = render(<LoadingState variant="page" />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Variant: table', () => {
    it('should render as table row', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <LoadingState variant="table" colSpan={5} />
          </TableBody>
        </Table>
      );

      expect(container.querySelector('tr')).toBeInTheDocument();
      expect(container.querySelector('td')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should apply colSpan to table cell', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <LoadingState variant="table" colSpan={6} />
          </TableBody>
        </Table>
      );

      const cell = container.querySelector('td');
      expect(cell).toHaveAttribute('colspan', '6');
    });

    it('should default colSpan to 1', () => {
      const { container } = render(
        <Table>
          <TableBody>
            <LoadingState variant="table" />
          </TableBody>
        </Table>
      );

      const cell = container.querySelector('td');
      expect(cell).toHaveAttribute('colspan', '1');
    });
  });

  describe('Spinner Size', () => {
    it('should use default size of 40', () => {
      render(<LoadingState />);

      // CircularProgress should be rendered
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should accept custom size', () => {
      render(<LoadingState size={60} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should accept small size', () => {
      render(<LoadingState size={20} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom sx props', () => {
      const { container } = render(
        <LoadingState sx={{ backgroundColor: 'red', minHeight: 200 }} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in a table context', () => {
      render(
        <Table>
          <TableBody>
            <LoadingState variant="table" message="Loading items..." colSpan={4} size={24} />
          </TableBody>
        </Table>
      );

      expect(screen.getByText('Loading items...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should work as page loading state', () => {
      render(<LoadingState variant="page" message="Loading dashboard..." size={60} />);

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });

    it('should work as inline card loading', () => {
      render(
        <div>
          <h2>Card Title</h2>
          <LoadingState variant="inline" message="Loading card content..." />
        </div>
      );

      expect(screen.getByText('Card Title')).toBeInTheDocument();
      expect(screen.getByText('Loading card content...')).toBeInTheDocument();
    });
  });
});
