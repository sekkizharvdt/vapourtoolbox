import { render, screen } from '@testing-library/react';
import { LoadingState } from '../LoadingState';
import { EmptyState } from '../EmptyState';

describe('LoadingState', () => {
  it('renders loading message', () => {
    render(<LoadingState message="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('renders circular progress', () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector('.MuiCircularProgress-root')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders empty message', () => {
    render(<EmptyState message="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    render(<EmptyState message="Empty" action={<button>Create Item</button>} />);
    expect(screen.getByText('Create Item')).toBeInTheDocument();
  });

  it('renders in table row when variant is table', () => {
    render(
      <table>
        <tbody>
          <EmptyState variant="table" message="Table Empty" colSpan={5} />
        </tbody>
      </table>
    );
    expect(screen.getByText('Table Empty')).toBeInTheDocument();
    expect(screen.getByRole('cell')).toHaveAttribute('colspan', '5');
  });
});
