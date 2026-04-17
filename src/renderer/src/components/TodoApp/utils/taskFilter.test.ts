import { describe, it, expect } from 'vitest';
import { filterTasksByList, getTaskCountForList } from './taskFilter';
import { TodoTask } from '../../../../../shared/types';

const mockTasks: TodoTask[] = [
  {
    id: '1',
    listId: 'my-day',
    title: 'Task 1',
    status: 'todo',
    priority: 'medium',
    isImportant: false,
    inMyDay: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: '2',
    listId: 'tasks',
    title: 'Task 2',
    status: 'completed',
    priority: 'high',
    isImportant: true,
    inMyDay: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: '3',
    listId: 'tasks',
    title: 'Task 3',
    status: 'todo',
    priority: 'low',
    isImportant: false,
    inMyDay: false,
    dueDate: '2024-12-31',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
];

describe('taskFilter utils', () => {
  describe('filterTasksByList', () => {
    it('should filter tasks for "my-day" list', () => {
      const result = filterTasksByList(mockTasks, 'my-day', false);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter tasks for "important" list', () => {
      const result = filterTasksByList(mockTasks, 'important', true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('should filter tasks for "planned" list', () => {
      const result = filterTasksByList(mockTasks, 'planned', false);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('3');
    });

    it('should filter completed tasks when showCompleted is false', () => {
      const result = filterTasksByList(mockTasks, 'important', false);
      expect(result.length).toBe(0);
    });
  });

  describe('getTaskCountForList', () => {
    it('should return correct count for "my-day" list', () => {
      const count = getTaskCountForList(mockTasks, 'my-day', false);
      expect(count).toBe(1);
    });

    it('should return 0 when no tasks match', () => {
      const count = getTaskCountForList(mockTasks, 'non-existent', false);
      expect(count).toBe(0);
    });
  });
});
