import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from './DataTable';

describe('DataTable', () => {
  const mockData = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 25 },
  ];

  const columns = [
    { key: 'name', header: 'Name', editable: true },
    { key: 'age', header: 'Age', editable: false },
  ];

  it('renders data correctly', () => {
    render(
      <DataTable
        columns={columns}
        data={mockData}
        onSort={vi.fn()}
        onFilter={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('triggers sort by clicking headers', () => {
    const onSort = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={mockData}
        onSort={onSort}
        onFilter={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name');
  });



  it('triggers onEdit when editing a cell inline', () => {
    const onEdit = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={mockData}
        onSort={vi.fn()}
        onFilter={vi.fn()}
        onEdit={onEdit}
      />
    );
    
    // The requirement says "editing a cell inline". We'll assume the cell contains 
    // its text, and clicking it maybe turns it into an input, or it's just an input if editable.
    const cellText = screen.getByText('Alice');
    fireEvent.click(cellText);
    const cellInput = screen.getByDisplayValue('Alice');
    fireEvent.change(cellInput, { target: { value: 'Alicia' } });
    fireEvent.blur(cellInput); // Assuming blur triggers the edit
    
    expect(onEdit).toHaveBeenCalledWith(mockData[0], 'name', 'Alicia');
  });
});
