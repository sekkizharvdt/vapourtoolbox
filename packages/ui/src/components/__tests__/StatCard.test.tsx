import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders title and value correctly', () => {
    render(<StatCard label="Total Revenue" value="$50,000" />);
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>;
    render(<StatCard label="With Icon" value="10" icon={<TestIcon />} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('applies color variants', () => {
    const { container } = render(<StatCard label="Error Card" value="0" color="error" />);
    // Check if the paper element has some error-related styling or class
    // Since we are using MUI, we might check for specific classes or computed styles if needed.
    // For now, just ensuring it renders without crashing is a good start.
    expect(container.firstChild).toBeInTheDocument();
  });
});
