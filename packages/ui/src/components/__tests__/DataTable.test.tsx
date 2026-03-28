import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../DataTable';

interface TestRow {
  id: string;
  name: string;
  amount: number;
  status: string;
}

const testRows: TestRow[] = [
  { id: '1', name: 'Alpha', amount: 100, status: 'ACTIVE' },
  { id: '2', name: 'Beta', amount: 200, status: 'DRAFT' },
  { id: '3', name: 'Charlie', amount: 300, status: 'ACTIVE' },
];

const testColumns: DataTableColumn<TestRow>[] = [
  { key: 'name', label: 'Name' },
  { key: 'amount', label: 'Amount', align: 'right' },
  { key: 'status', label: 'Status' },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={testColumns} rows={testRows} getRowKey={(r) => r.id} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders row data', () => {
    render(<DataTable columns={testColumns} rows={testRows} getRowKey={(r) => r.id} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('shows empty message when no rows', () => {
    render(
      <DataTable
        columns={testColumns}
        rows={[]}
        getRowKey={(r) => r.id}
        emptyMessage="Nothing here"
      />
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('uses format function for cell values', () => {
    const columnsWithFormat: DataTableColumn<TestRow>[] = [
      { key: 'amount', label: 'Amount', format: (v) => `$${v}` },
    ];

    render(<DataTable columns={columnsWithFormat} rows={testRows} getRowKey={(r) => r.id} />);

    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('uses render function for custom cells', () => {
    const columnsWithRender: DataTableColumn<TestRow>[] = [
      {
        key: 'status',
        label: 'Status',
        render: (row) => <span data-testid="status-chip">{row.status}</span>,
      },
    ];

    render(<DataTable columns={columnsWithRender} rows={testRows} getRowKey={(r) => r.id} />);

    expect(screen.getAllByTestId('status-chip')).toHaveLength(3);
  });

  it('renders actions column when renderActions is provided', () => {
    render(
      <DataTable
        columns={testColumns}
        rows={testRows}
        getRowKey={(r) => r.id}
        renderActions={(row) => <button>Edit {row.name}</button>}
      />
    );

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Edit Alpha')).toBeInTheDocument();
  });

  it('hides columns with hidden flag', () => {
    const columnsWithHidden: DataTableColumn<TestRow>[] = [
      { key: 'name', label: 'Name' },
      { key: 'amount', label: 'Amount', hidden: true },
    ];

    render(<DataTable columns={columnsWithHidden} rows={testRows} getRowKey={(r) => r.id} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.queryByText('Amount')).not.toBeInTheDocument();
  });

  it('paginates rows', () => {
    const manyRows: TestRow[] = Array.from({ length: 60 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
      amount: i * 10,
      status: 'ACTIVE',
    }));

    render(
      <DataTable
        columns={testColumns}
        rows={manyRows}
        getRowKey={(r) => r.id}
        defaultRowsPerPage={25}
      />
    );

    // Should show first 25 items
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 24')).toBeInTheDocument();
    expect(screen.queryByText('Item 25')).not.toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const handleClick = jest.fn();

    render(
      <DataTable
        columns={testColumns}
        rows={testRows}
        getRowKey={(r) => r.id}
        onRowClick={handleClick}
      />
    );

    fireEvent.click(screen.getByText('Alpha'));
    expect(handleClick).toHaveBeenCalledWith(testRows[0]);
  });

  it('disables pagination when pagination=false', () => {
    render(
      <DataTable columns={testColumns} rows={testRows} getRowKey={(r) => r.id} pagination={false} />
    );

    expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
  });
});
