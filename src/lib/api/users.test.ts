import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUsers, saveUser, patchUser } from './users';
import { client } from '../turso';

vi.mock('../turso', () => ({
  client: {
    execute: vi.fn()
  }
}));

describe('Users API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should fetch users from database', async () => {
      const mockRows = [{ id: '1', name: 'John Doe', role: 'Teacher', salary: 50000 }];
      (client!.execute as any).mockResolvedValueOnce({ rows: mockRows } as any);
      
      const result = await getUsers();
      
      expect(client!.execute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('FROM users u LEFT JOIN students s')
      }));
      expect(result[0]).toMatchObject({ id: '1', name: 'John Doe', role: 'Teacher', salary: 50000 });
    });

    it('should construct query with WHERE and ORDER BY when params provided', async () => {
      (client!.execute as any).mockResolvedValueOnce({ rows: [] } as any);
      
      await getUsers({ role: 'Admin' }, 'name', 'DESC');
      
      expect(client!.execute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('WHERE u.role = ?'),
        args: ['Admin']
      }));
    });
  });

  describe('saveUser', () => {
    it('should insert a new user if id is empty', async () => {
      (client!.execute as any).mockResolvedValueOnce({ rows: [] } as any);
      
      const user = { id: '', name: 'New User', email: 'test@test.com', phone: '123', role: 'Sales', salary: 40000, password: 'pw' };
      await saveUser(user);
      
      // Should generate an id and insert
      expect(client!.execute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INSERT INTO users')
      }));
    });
  });

  describe('patchUser', () => {
    it('should update only specific fields of a user', async () => {
      (client!.execute as any).mockResolvedValueOnce({ rows: [] } as any);
      
      await patchUser('usr_123', { name: 'Updated Name', salary: 60000 });
      
      expect(client!.execute).toHaveBeenCalledWith({
        sql: 'UPDATE users SET name = ?, salary = ? WHERE id = ?',
        args: ['Updated Name', 60000, 'usr_123']
      });
    });
  });
});
