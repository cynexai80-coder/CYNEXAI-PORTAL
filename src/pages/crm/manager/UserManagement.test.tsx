import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from './UserManagement';
import { getUsers, patchUser } from '../../../lib/api/users';
import { getCurrentUser } from '../../../lib/auth';

vi.mock('../../../lib/api/users', () => ({
  getUsers: vi.fn(),
  saveUser: vi.fn(),
  patchUser: vi.fn(),
  getFilterOptions: vi.fn(() => Promise.resolve({ courses: [], batches: [] })),
  getCourseCurriculum: vi.fn(() => Promise.resolve({})),
  getPendingStudents: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../../lib/auth', () => ({
  getCurrentUser: vi.fn(),
  getUserPermissions: vi.fn(() => ({})),
  updateCurrentUserSession: vi.fn(),
}));

vi.mock('../../../lib/crypto', () => ({
  decryptPassword: vi.fn((pwd) => pwd),
}));

describe('UserManagement', () => {
  const mockUsers = [
    { id: '1', name: 'Alice Staff', email: 'alice@test.com', password_encrypted: 'pass1', role: 'Manager', salary: 50000 },
    { id: '2', name: 'Bob Student', email: 'bob@test.com', password_encrypted: 'pass2', role: 'Student', salary: 0 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockReturnValue({ id: 'u1', name: 'CEO User', role: 'CEO' });
    (getUsers as any).mockResolvedValue(mockUsers);
  });

  it('renders a data table with correct columns and data', async () => {
    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Alice Staff')).toBeInTheDocument();
    });

    // It should render DataTable headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
  });

  it('fetches users with sortBy and sortDir state', async () => {
    render(<UserManagement />);
    
    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith(expect.objectContaining({
        role: expect.objectContaining({ _neq: 'Student' })
      }), '', 'asc');
    });

    // Click to sort by Name
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith(
        expect.anything(),
        'name',
        'asc'
      );
    });
  });

  it('calls patchUser on edit and updates optimistically', async () => {
    (patchUser as any).mockResolvedValue({});
    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Alice Staff')).toBeInTheDocument();
    });

    const nameCell = screen.getByText('Alice Staff');
    fireEvent.click(nameCell);
    
    const input = screen.getByDisplayValue('Alice Staff');
    fireEvent.change(input, { target: { value: 'Alice Modified' } });
    fireEvent.blur(input);

    expect(patchUser).toHaveBeenCalledWith('1', { name: 'Alice Modified' });
    
    await waitFor(() => {
      expect(screen.getByText('Alice Modified')).toBeInTheDocument();
    });
  });
});
