import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusChip } from '../StatusChip';

describe('StatusChip', () => {
  it('renders the raw status when no labels map is given', () => {
    render(<StatusChip status="APPROVED" />);
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('renders the mapped label when a labels map is given', () => {
    render(<StatusChip status="APPROVED" labels={{ APPROVED: 'Approved for Payment' }} />);
    expect(screen.getByText('Approved for Payment')).toBeInTheDocument();
  });

  it('falls back to the raw status when the labels map has no entry', () => {
    render(<StatusChip status="UNKNOWN_STATUS" labels={{ APPROVED: 'Approved' }} />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
  });

  it('applies context-specific color overrides via getStatusColor', () => {
    const { container: withoutContext } = render(<StatusChip status="PLANNING" />);
    const { container: withProjectContext } = render(
      <StatusChip status="PLANNING" context="project" />
    );

    // base mapping has no PLANNING entry -> default; project context overrides it -> primary
    expect(withoutContext.querySelector('.MuiChip-colorDefault')).toBeInTheDocument();
    expect(withProjectContext.querySelector('.MuiChip-colorPrimary')).toBeInTheDocument();
  });
});
