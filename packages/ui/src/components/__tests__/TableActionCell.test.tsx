import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableActionCell } from '../TableActionCell';

describe('TableActionCell', () => {
  it('renders actions correctly', () => {
    const handleEdit = jest.fn();
    const handleDelete = jest.fn();

    render(
      <table>
        <tbody>
          <tr>
            <td>
              <TableActionCell
                actions={[
                  { label: 'Edit', onClick: handleEdit, icon: <span>EditIcon</span> },
                  { label: 'Delete', onClick: handleDelete, icon: <span>DeleteIcon</span> },
                ]}
              />
            </td>
          </tr>
        </tbody>
      </table>
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('calls onClick handler when action is clicked', () => {
    const handleClick = jest.fn();
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <TableActionCell
                actions={[{ label: 'Action', onClick: handleClick, icon: <span>Icon</span> }]}
              />
            </td>
          </tr>
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Action' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not render hidden actions', () => {
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <TableActionCell
                actions={[
                  { label: 'Visible', onClick: () => {}, icon: <span>Icon</span>, show: true },
                  { label: 'Hidden', onClick: () => {}, icon: <span>Icon</span>, show: false },
                ]}
              />
            </td>
          </tr>
        </tbody>
      </table>
    );

    expect(screen.getByRole('button', { name: 'Visible' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hidden' })).not.toBeInTheDocument();
  });
});
