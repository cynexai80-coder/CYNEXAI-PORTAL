import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as tasksApi from '../tasks';
import { client } from '../../turso';
import { getCurrentUser } from '../../auth';

// Mock the turso client and auth
vi.mock('../../turso', () => ({
  client: {
    execute: vi.fn(),
  },
  isTursoConfigured: true,
  initTursoDB: vi.fn(),
}));

vi.mock('../../auth', () => ({
  getCurrentUser: vi.fn(),
}));

describe('Tasks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockReturnValue({ id: 'user_1', role: 'Sales/HR' });
  });

  describe('createTask', () => {
    it('creates a task and returns the new task ID', async () => {
      // Setup mock response
      (client!.execute as any).mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 1,
        lastInsertRowid: undefined,
      });

      const taskData = {
        title: 'Call Lead',
        description: 'Follow up with John',
        assignee_id: 'usr_venkatesh',
        priority: 'High',
        due_date: '2026-07-10',
        lead_id: 'lead_123',
        student_id: 'std_456',
      };

      const result = await tasksApi.createTask(taskData);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.startsWith('task_')).toBe(true);
      
      // Verify SQL was called correctly
      expect(client!.execute).toHaveBeenCalledTimes(1);
      const callArgs = (client!.execute as any).mock.calls[0][0];
      expect(callArgs.sql).toContain('INSERT INTO tasks');
      expect(callArgs.args).toEqual(expect.arrayContaining([
        result, // id
        'Call Lead',
        'Follow up with John',
        'usr_venkatesh',
        'To Do', // default status
        'High',
        '2026-07-10',
        null, // related_entity default
        'One-Time', // default task_type
        null, // default target_number
        0, // default current_number
        null, // default start_date
        null, // default tags
        null, // default created_by
        'lead_123',
        'std_456'
      ]));
    });
  });

  describe('getTasksForUser', () => {
    it('fetches tasks assigned to a specific user', async () => {
      const mockRows = [
        { id: 'task_1', title: 'Task 1', status: 'To Do', lead_id: 'lead_123', student_id: 'std_456' },
        { id: 'task_2', title: 'Task 2', status: 'In Progress', lead_id: null, student_id: null }
      ];
      
      (client!.execute as any).mockResolvedValueOnce({
        rows: mockRows,
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

      const result = await tasksApi.getTasksForUser('usr_venkatesh');
      
      expect(result).toEqual(mockRows);
      
      const callArgs = (client!.execute as any).mock.calls[0][0];
      expect(callArgs.sql).toContain('SELECT * FROM tasks WHERE assignee_id = ?');
      expect(callArgs.args).toEqual(['usr_venkatesh']);
    });
  });

  describe('updateTaskStatus', () => {
    it('updates the status of a task if user is authorized', async () => {
      // Mock getTaskById
      (client!.execute as any).mockResolvedValueOnce({
        rows: [{ assignee_id: 'user_1', created_by: 'user_2' }],
        columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });
      // Mock UPDATE
      (client!.execute as any).mockResolvedValueOnce({
        rows: [], columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const result = await tasksApi.updateTaskStatus('task_1', 'Done');
      
      expect(result.success).toBe(true);
      expect(client!.execute).toHaveBeenCalledTimes(2);
    });

    it('fails to update status if user is not authorized', async () => {
      // Mock getTaskById returning different assignee
      (client!.execute as any).mockResolvedValueOnce({
        rows: [{ assignee_id: 'user_3', created_by: 'user_2' }],
        columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const result = await tasksApi.updateTaskStatus('task_1', 'Done');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(client!.execute).toHaveBeenCalledTimes(1); // Didn't call UPDATE
    });
  });

  describe('updateTask', () => {
    it('updates all editable fields of a task', async () => {
      // Mock getTaskById
      (client!.execute as any).mockResolvedValueOnce({
        rows: [{ assignee_id: 'user_1', created_by: 'user_2' }],
        columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });
      // Mock UPDATE
      (client!.execute as any).mockResolvedValueOnce({
        rows: [], columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      await tasksApi.updateTask('task_1', {
        title: 'New Title',
        description: 'New Description',
        assignee_id: 'usr_2',
        priority: 'Urgent',
        status: 'In Progress',
        due_date: '2026-08-01',
        lead_id: 'lead_123',
        student_id: 'std_456'
      });
      
      const callArgs = (client!.execute as any).mock.calls[1][0];
      expect(callArgs.sql).toContain('UPDATE tasks SET');
      expect(callArgs.args).toEqual([
        'New Title',
        'New Description',
        'usr_2',
        'Urgent',
        'In Progress',
        '2026-08-01',
        'lead_123',
        'std_456',
        'task_1'
      ]);
    });
  });

  describe('deleteTask', () => {
    it('fails to delete if user is not authorized', async () => {
      (client!.execute as any).mockResolvedValueOnce({
        rows: [{ assignee_id: 'user_3', created_by: 'user_2' }],
        columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const result = await tasksApi.deleteTask('task_1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(client!.execute).toHaveBeenCalledTimes(1);
    });

    it('deletes task if user is authorized', async () => {
      (client!.execute as any).mockResolvedValueOnce({
        rows: [{ assignee_id: 'user_1', created_by: 'user_2' }],
        columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });
      (client!.execute as any).mockResolvedValueOnce({
        rows: [], columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const result = await tasksApi.deleteTask('task_1');
      expect(result.success).toBe(true);
      expect(client!.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Prod-Level Asana Features', () => {
    it('can add a comment to a task', async () => {
      (client!.execute as any).mockResolvedValueOnce({
        rows: [], columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const id = await tasksApi.addTaskComment('task_1', 'This is a comment');
      expect(id).toBeDefined();
      expect(client!.execute).toHaveBeenCalled();
    });

    it('can add a subtask to a task', async () => {
      (client!.execute as any).mockResolvedValueOnce({
        rows: [], columns: [], columnTypes: [], rowsAffected: 1, lastInsertRowid: undefined,
      });

      const id = await tasksApi.addSubtask('task_1', 'New subtask');
      expect(id).toBeDefined();
      expect(client!.execute).toHaveBeenCalled();
    });
  });

  describe('getAllTasks', () => {
    it('fetches all tasks', async () => {
      const mockRows = [
        { id: 'task_1', title: 'Task 1' },
      ];
      (client!.execute as any).mockResolvedValueOnce({
        rows: mockRows,
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

      const result = await tasksApi.getAllTasks();
      expect(result).toEqual(mockRows);
      
      const callArgs = (client!.execute as any).mock.calls[0][0];
      expect(callArgs.sql || callArgs).toContain('FROM tasks');
    });
  });

  describe('getTasksByCreator', () => {
    it('fetches tasks created by a specific user', async () => {
      const mockRows = [
        { id: 'task_1', title: 'Task 1' },
      ];
      (client!.execute as any).mockResolvedValueOnce({
        rows: mockRows,
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

      const result = await tasksApi.getTasksByCreator('usr_mgr');
      
      expect(result).toEqual(mockRows);
      const callArgs = (client!.execute as any).mock.calls[0][0];
      expect(callArgs.sql).toContain('SELECT * FROM tasks WHERE created_by = ? ORDER BY due_date ASC');
      expect(callArgs.args).toEqual(['usr_mgr']);
    });
  });
});
