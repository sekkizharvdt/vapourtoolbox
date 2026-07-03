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
    const { container: withoutContext } = render(<StatusChip status="COMPLETED" />);
    const { container: withProjectContext } = render(
      <StatusChip status="COMPLETED" context="project" />
    );

    // base mapping: COMPLETED -> success; project context override -> info
    expect(withoutContext.querySelector('.MuiChip-colorSuccess')).toBeInTheDocument();
    expect(withProjectContext.querySelector('.MuiChip-colorInfo')).toBeInTheDocument();
  });
});
