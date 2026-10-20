import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';

vi.mock('../../lib/api/manager', () => ({ checkTeacherAssignment: vi.fn().mockResolvedValue(false) }));
vi.mock('../../lib/api/reports', () => ({ logOfficeAttendance: vi.fn().mockResolvedValue(undefined) }));

const login = (role: string, permissions_json?: string) =>
  localStorage.setItem('erp_session_token', JSON.stringify({ id: `u_${role}`, name: role, email: `${role}@x.test`, role, permissions_json }));

const renderAt = (url: string, pattern: string, allowedRoles?: string[]) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={pattern} element={<RequireAuth allowedRoles={allowedRoles}><div>PAGE CONTENT</div></RequireAuth>} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('RequireAuth', () => {
  beforeEach(() => localStorage.clear());

  it('sends a visitor to the login page', async () => {
    renderAt('/manager', '/manager', ['Manager', 'CEO']);
    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument();
  });

  it('opens a page for a role on its list', async () => {
    login('Manager');
    renderAt('/manager/users', '/manager/users', ['Manager', 'CEO']);
    expect(await screen.findByText('PAGE CONTENT')).toBeInTheDocument();
  });

  it('refuses another role\'s page that the module map used to let through (Teacher on the CEO dashboard)', async () => {
    login('Teacher');
    renderAt('/ceo/dashboard', '/ceo/dashboard', ['CEO']);
    expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
    expect(screen.queryByText('PAGE CONTENT')).not.toBeInTheDocument();
  });

  it('keeps a module that is off closed when the URL has a trailing slash or other capitalisation', async () => {
    login('Manager'); // no certificates module by default
    for (const url of ['/manager/certificates', '/manager/certificates/', '/Manager/Certificates']) {
      const { unmount } = renderAt(url, '/manager/certificates', ['Manager', 'CEO']);
      expect(await screen.findByText('Access Restricted'), url).toBeInTheDocument();
      expect(screen.queryByText('PAGE CONTENT')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('refuses a Student on a staff-only page and lets the CEO through', async () => {
    login('Student');
    const first = renderAt('/chat', '/chat', ['CEO', 'Manager', 'Sales/HR', 'DM', 'Teacher']);
    expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
    first.unmount();
    localStorage.clear(); login('CEO');
    renderAt('/chat', '/chat', ['CEO', 'Manager', 'Sales/HR', 'DM', 'Teacher']);
    expect(await screen.findByText('PAGE CONTENT')).toBeInTheDocument();
  });
});
