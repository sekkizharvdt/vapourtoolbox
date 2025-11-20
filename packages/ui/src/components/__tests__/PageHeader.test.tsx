import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('renders title and subtitle', () => {
    render(<PageHeader title="My Page" subtitle="Page description" />);
    expect(screen.getByText('My Page')).toBeInTheDocument();
    expect(screen.getByText('Page description')).toBeInTheDocument();
  });

  it('renders action element', () => {
    render(<PageHeader title="Page with Action" action={<button>Create New</button>} />);
    expect(screen.getByText('Create New')).toBeInTheDocument();
  });
});
