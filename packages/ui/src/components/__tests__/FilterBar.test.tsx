import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '../FilterBar';

describe('FilterBar', () => {
  it('renders children content', () => {
    render(
      <FilterBar>
        <input data-testid="filter-input" />
      </FilterBar>
    );
    expect(screen.getByTestId('filter-input')).toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', () => {
    const handleClear = jest.fn();
    render(
      <FilterBar onClear={handleClear}>
        <div>Filter Content</div>
      </FilterBar>
    );

    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('does not render clear button if onClear is not provided', () => {
    render(
      <FilterBar>
        <div>Filter Content</div>
      </FilterBar>
    );
    expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument();
  });
});
