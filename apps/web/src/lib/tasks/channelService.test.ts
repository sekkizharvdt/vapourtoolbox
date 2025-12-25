/**
 * Channel Service Tests
 *
 * Tests for channel management and task grouping utilities:
 * - Default channel retrieval
 * - Task grouping by channel
 * - Workspace building utilities
 * - Unread count calculations
 * - Firebase operations (with mocking)
 */

import type { Timestamp } from 'firebase/firestore';
import type { TaskNotification, TaskChannel } from '@vapour/types';

// Mock Firebase
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: {},
    auth: {},
  })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROJECT_CHANNELS: 'projectChannels',
    TASK_NOTIFICATIONS: 'taskNotifications',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Import after mocks
import {
  getDefaultChannelsForProject,
  getPreSalesChannels,
  getAdminChannels,
  getProjectCustomChannels,
  createProjectChannel,
  groupTasksByChannel,
  groupTasksByProjectAndChannel,
  getTasksByProjectAndChannel,
  buildWorkspaces,
  getChannelUnreadCounts,
  subscribeToProjectTasks,
  subscribeToUserTasks,
} from './channelService';

// Helper to create test tasks
const mockTimestamp: Timestamp = {
  seconds: 1234567890,
  nanoseconds: 0,
  toDate: () => new Date(),
  toMillis: () => 1234567890000,
  isEqual: () => true,
  valueOf: () => '',
  toJSON: () => ({ seconds: 1234567890, nanoseconds: 0, type: 'Timestamp' }),
};

function createTestTask(overrides: Partial<TaskNotification> = {}): TaskNotification {
  return {
    id: 'task-1',
    type: 'actionable',
    category: 'PR_SUBMITTED',
    userId: 'user-1',
    title: 'Test Task',
    message: 'Test message',
    priority: 'MEDIUM',
    entityType: 'PURCHASE_REQUEST',
    entityId: 'pr-1',
    linkUrl: '/procurement/purchase-requests/pr-1',
    status: 'pending',
    read: false,
    autoCompletable: true,
    completionConfirmed: false,
    createdAt: mockTimestamp,
    ...overrides,
  };
}

describe('channelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Default Channels Tests
  // ============================================================================

  describe('getDefaultChannelsForProject', () => {
    it('should return default project channels', () => {
      const channels = getDefaultChannelsForProject();

      expect(channels).toHaveLength(5);
      expect(channels.map((c) => c.id)).toEqual([
        'general',
        'procurement',
        'documents',
        'accounting',
        'approvals',
      ]);
    });

    it('should return channels with correct structure', () => {
      const channels = getDefaultChannelsForProject();

      channels.forEach((channel) => {
        expect(channel).toHaveProperty('id');
        expect(channel).toHaveProperty('name');
        expect(channel).toHaveProperty('icon');
        expect(channel).toHaveProperty('categories');
        expect(channel).toHaveProperty('isDefault');
      });
    });

    it('should return channels marked as default', () => {
      const channels = getDefaultChannelsForProject();

      channels.forEach((channel) => {
        expect(channel.isDefault).toBe(true);
      });
    });
  });

  describe('getPreSalesChannels', () => {
    it('should return pre-sales channels', () => {
      const channels = getPreSalesChannels();

      expect(channels).toHaveLength(2);
      expect(channels.map((c) => c.id)).toEqual(['enquiries', 'proposals']);
    });

    it('should include enquiries channel with correct categories', () => {
      const channels = getPreSalesChannels();
      const enquiriesChannel = channels.find((c) => c.id === 'enquiries');

      expect(enquiriesChannel).toBeDefined();
      expect(enquiriesChannel?.categories).toContain('ENQUIRY_ASSIGNED');
    });

    it('should include proposals channel with correct categories', () => {
      const channels = getPreSalesChannels();
      const proposalsChannel = channels.find((c) => c.id === 'proposals');

      expect(proposalsChannel).toBeDefined();
      expect(proposalsChannel?.categories).toContain('PROPOSAL_SUBMITTED');
    });
  });

  describe('getAdminChannels', () => {
    it('should return admin channels', () => {
      const channels = getAdminChannels();

      expect(channels).toHaveLength(3);
      expect(channels.map((c) => c.id)).toEqual(['accounting', 'feedback', 'approvals']);
    });

    it('should include accounting channel', () => {
      const channels = getAdminChannels();
      const accountingChannel = channels.find((c) => c.id === 'accounting');

      expect(accountingChannel).toBeDefined();
      expect(accountingChannel?.name).toBe('Accounting');
    });

    it('should include feedback channel', () => {
      const channels = getAdminChannels();
      const feedbackChannel = channels.find((c) => c.id === 'feedback');

      expect(feedbackChannel).toBeDefined();
      expect(feedbackChannel?.categories).toContain('FEEDBACK_RESOLUTION_CHECK');
    });
  });

  // ============================================================================
  // Task Grouping Tests
  // ============================================================================

  describe('groupTasksByChannel', () => {
    it('should group tasks by channel', () => {
      const tasks: TaskNotification[] = [
        createTestTask({ id: 'task-1', category: 'PR_SUBMITTED' }),
        createTestTask({ id: 'task-2', category: 'DOCUMENT_ASSIGNED' }),
        createTestTask({ id: 'task-3', category: 'INVOICE_SUBMITTED' }),
      ];

      const grouped = groupTasksByChannel(tasks);

      expect(grouped['procurement']).toHaveLength(1);
      expect(grouped['documents']).toHaveLength(1);
      expect(grouped['accounting']).toHaveLength(1);
    });

    it('should add approval tasks to approvals channel', () => {
      const tasks: TaskNotification[] = [
        createTestTask({ id: 'task-1', category: 'PR_SUBMITTED' }), // Approval category
        createTestTask({ id: 'task-2', category: 'PO_PENDING_APPROVAL' }), // Approval category
      ];

      const grouped = groupTasksByChannel(tasks);

      // Tasks should be in both their original channel and approvals
      expect(grouped['procurement']).toHaveLength(2);
      expect(grouped['approvals']).toHaveLength(2);
    });

    it('should handle empty task array', () => {
      const grouped = groupTasksByChannel([]);

      expect(Object.keys(grouped)).toHaveLength(0);
    });

    it('should handle multiple tasks in same channel', () => {
      const tasks: TaskNotification[] = [
        createTestTask({ id: 'task-1', category: 'PR_SUBMITTED' }),
        createTestTask({ id: 'task-2', category: 'PR_APPROVED' }),
        createTestTask({ id: 'task-3', category: 'PO_PENDING_APPROVAL' }),
      ];

      const grouped = groupTasksByChannel(tasks);

      expect(grouped['procurement']).toHaveLength(3);
    });
  });

  describe('groupTasksByProjectAndChannel', () => {
    it('should group tasks by project and channel', () => {
      const tasks: TaskNotification[] = [
        createTestTask({ id: 'task-1', projectId: 'proj-1', category: 'PR_SUBMITTED' }),
        createTestTask({ id: 'task-2', projectId: 'proj-1', category: 'DOCUMENT_ASSIGNED' }),
        createTestTask({ id: 'task-3', projectId: 'proj-2', category: 'PR_SUBMITTED' }),
      ];

      const grouped = groupTasksByProjectAndChannel(tasks);

      expect(grouped['proj-1']).toBeDefined();
      expect(grouped['proj-1']!['procurement']).toHaveLength(1);
      expect(grouped['proj-1']!['documents']).toHaveLength(1);
      expect(grouped['proj-2']!['procurement']).toHaveLength(1);
    });

    it('should put tasks without projectId in pre-sales', () => {
      const tasks: TaskNotification[] = [
        createTestTask({ id: 'task-1', projectId: undefined, category: 'ENQUIRY_ASSIGNED' }),
        createTestTask({ id: 'task-2', projectId: '', category: 'PROPOSAL_SUBMITTED' }),
      ];

      const grouped = groupTasksByProjectAndChannel(tasks);

      expect(grouped['pre-sales']).toBeDefined();
      expect(grouped['pre-sales']!['enquiries']).toHaveLength(1);
      expect(grouped['pre-sales']!['proposals']).toHaveLength(1);
    });

    it('should add approval tasks to approvals channel within project', () => {
      const tasks: TaskNotification[] = [
        createTestTask({ id: 'task-1', projectId: 'proj-1', category: 'PR_SUBMITTED' }),
      ];

      const grouped = groupTasksByProjectAndChannel(tasks);

      expect(grouped['proj-1']!['procurement']).toHaveLength(1);
      expect(grouped['proj-1']!['approvals']).toHaveLength(1);
    });

    it('should handle empty task array', () => {
      const grouped = groupTasksByProjectAndChannel([]);

      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });

  // ============================================================================
  // Workspace Building Tests
  // ============================================================================

  describe('buildWorkspaces', () => {
    it('should build workspaces from projects', () => {
      const projects = [
        { id: 'proj-1', name: 'Project Alpha', projectNumber: 'P001' },
        { id: 'proj-2', name: 'Project Beta' },
      ];
      const tasksByProject: Record<string, TaskNotification[]> = {
        'proj-1': [createTestTask({ read: false }), createTestTask({ read: true })],
        'proj-2': [createTestTask({ read: false })],
      };

      const workspaces = buildWorkspaces(projects, tasksByProject);

      expect(workspaces).toHaveLength(3); // 2 projects + pre-sales
    });

    it('should format project names with project number', () => {
      const projects = [{ id: 'proj-1', name: 'Project Alpha', projectNumber: 'P001' }];

      const workspaces = buildWorkspaces(projects, {});

      expect(workspaces[0]!.name).toBe('P001 - Project Alpha');
    });

    it('should use just project name when no project number', () => {
      const projects = [{ id: 'proj-1', name: 'Project Alpha' }];

      const workspaces = buildWorkspaces(projects, {});

      expect(workspaces[0]!.name).toBe('Project Alpha');
    });

    it('should calculate unread count for each workspace', () => {
      const projects = [{ id: 'proj-1', name: 'Project Alpha' }];
      const tasksByProject: Record<string, TaskNotification[]> = {
        'proj-1': [
          createTestTask({ id: 'task-1', read: false }),
          createTestTask({ id: 'task-2', read: false }),
          createTestTask({ id: 'task-3', read: true }),
        ],
      };

      const workspaces = buildWorkspaces(projects, tasksByProject);

      expect(workspaces[0]!.unreadCount).toBe(2);
    });

    it('should always include pre-sales workspace', () => {
      const projects: Array<{ id: string; name: string }> = [];

      const workspaces = buildWorkspaces(projects, {});

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0]!.id).toBe('pre-sales');
      expect(workspaces[0]!.type).toBe('pre-sales');
    });

    it('should set correct workspace types', () => {
      const projects = [{ id: 'proj-1', name: 'Project Alpha' }];

      const workspaces = buildWorkspaces(projects, {});

      expect(workspaces[0]!.type).toBe('project');
      expect(workspaces[1]!.type).toBe('pre-sales');
    });

    it('should include channels for each workspace', () => {
      const projects = [{ id: 'proj-1', name: 'Project Alpha' }];

      const workspaces = buildWorkspaces(projects, {});

      expect(workspaces[0]!.channels.length).toBeGreaterThan(0);
      expect(workspaces[1]!.channels.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Unread Count Tests
  // ============================================================================

  describe('getChannelUnreadCounts', () => {
    it('should count unread tasks per channel', () => {
      const tasks: TaskNotification[] = [
        createTestTask({ id: 'task-1', category: 'PR_SUBMITTED', read: false }),
        createTestTask({ id: 'task-2', category: 'PR_APPROVED', read: false }),
        createTestTask({ id: 'task-3', category: 'DOCUMENT_ASSIGNED', read: false }),
        createTestTask({ id: 'task-4', category: 'INVOICE_SUBMITTED', read: true }), // Read, should not count
      ];
      const channels: TaskChannel[] = [
        { id: 'procurement', name: 'Procurement', icon: '', categories: [], isDefault: true },
        { id: 'documents', name: 'Documents', icon: '', categories: [], isDefault: true },
        { id: 'accounting', name: 'Accounting', icon: '', categories: [], isDefault: true },
      ];

      const counts = getChannelUnreadCounts(tasks, channels);

      expect(counts['procurement']).toBe(2);
      expect(counts['documents']).toBe(1);
      expect(counts['accounting']).toBe(0);
    });

    it('should include approvals channel in counts', () => {
      const tasks: TaskNotification[] = [
        createTestTask({ id: 'task-1', category: 'PR_SUBMITTED', read: false }), // Approval category
      ];
      const channels: TaskChannel[] = [
        { id: 'procurement', name: 'Procurement', icon: '', categories: [], isDefault: true },
        { id: 'approvals', name: 'Approvals', icon: '', categories: [], isDefault: true },
      ];

      const counts = getChannelUnreadCounts(tasks, channels);

      expect(counts['procurement']).toBe(1);
      expect(counts['approvals']).toBe(1);
    });

    it('should initialize all channels with zero', () => {
      const channels: TaskChannel[] = [
        { id: 'procurement', name: 'Procurement', icon: '', categories: [], isDefault: true },
        { id: 'documents', name: 'Documents', icon: '', categories: [], isDefault: true },
      ];

      const counts = getChannelUnreadCounts([], channels);

      expect(counts['procurement']).toBe(0);
      expect(counts['documents']).toBe(0);
    });

    it('should handle empty channels array', () => {
      const tasks: TaskNotification[] = [createTestTask({ read: false })];

      const counts = getChannelUnreadCounts(tasks, []);

      expect(Object.keys(counts)).toHaveLength(0);
    });
  });

  // ============================================================================
  // Firebase Operations Tests
  // ============================================================================

  describe('getProjectCustomChannels', () => {
    it('should return custom channels for a project', async () => {
      mockQuery.mockReturnValue({});
      mockGetDocs.mockResolvedValue({
        forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
          fn({
            id: 'channel-1',
            data: () => ({ name: 'Custom Channel', description: 'Test', projectId: 'proj-1' }),
          });
        },
      });

      const channels = await getProjectCustomChannels('proj-1');

      expect(channels).toHaveLength(1);
      expect(channels[0]!.id).toBe('channel-1');
      expect(channels[0]!.name).toBe('Custom Channel');
    });

    it('should return empty array on error', async () => {
      mockQuery.mockReturnValue({});
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const channels = await getProjectCustomChannels('proj-1');

      expect(channels).toEqual([]);
    });

    it('should return empty array when no channels exist', async () => {
      mockQuery.mockReturnValue({});
      mockGetDocs.mockResolvedValue({
        forEach: () => {
          // No documents
        },
      });

      const channels = await getProjectCustomChannels('proj-1');

      expect(channels).toEqual([]);
    });
  });

  describe('createProjectChannel', () => {
    it('should create a custom channel', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-channel-id' });

      const channelId = await createProjectChannel(
        'proj-1',
        'New Channel',
        'Description',
        'user-1'
      );

      expect(channelId).toBe('new-channel-id');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockAddDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(
        createProjectChannel('proj-1', 'New Channel', 'Description', 'user-1')
      ).rejects.toThrow('Failed to create project channel');
    });

    it('should include correct channel data', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-channel-id' });

      await createProjectChannel('proj-1', 'New Channel', 'Description', 'user-1');

      const callArgs = mockAddDoc.mock.calls[0];
      const channelData = callArgs[1];

      expect(channelData.projectId).toBe('proj-1');
      expect(channelData.name).toBe('New Channel');
      expect(channelData.description).toBe('Description');
      expect(channelData.createdBy).toBe('user-1');
      expect(channelData.isDefault).toBe(false);
    });
  });

  describe('getTasksByProjectAndChannel', () => {
    it('should filter tasks by project and channel', async () => {
      mockQuery.mockReturnValue({});
      mockGetDocs.mockResolvedValue({
        forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
          fn({
            id: 'task-1',
            data: () => ({
              type: 'actionable',
              category: 'PR_SUBMITTED',
              userId: 'user-1',
              title: 'Test',
              message: 'Message',
              priority: 'MEDIUM',
              entityType: 'PURCHASE_REQUEST',
              entityId: 'pr-1',
              linkUrl: '/test',
              status: 'pending',
              read: false,
              projectId: 'proj-1',
              autoCompletable: true,
              completionConfirmed: false,
              createdAt: { seconds: 1234567890, nanoseconds: 0 },
            }),
          });
        },
      });

      const tasks = await getTasksByProjectAndChannel('user-1', 'proj-1', 'procurement');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.id).toBe('task-1');
    });

    it('should handle pre-sales project', async () => {
      mockQuery.mockReturnValue({});
      mockGetDocs.mockResolvedValue({
        forEach: () => {},
      });

      await getTasksByProjectAndChannel('user-1', 'pre-sales', 'enquiries');

      expect(mockWhere).toHaveBeenCalledWith('projectId', '==', '');
    });

    it('should throw error on failure', async () => {
      mockQuery.mockReturnValue({});
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(getTasksByProjectAndChannel('user-1', 'proj-1', 'procurement')).rejects.toThrow(
        'Failed to get tasks by project and channel'
      );
    });
  });

  describe('subscribeToProjectTasks', () => {
    it('should set up subscription for project tasks', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeToProjectTasks('user-1', 'proj-1', onUpdate);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(unsubscribeMock);
    });

    it('should handle pre-sales subscription', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      subscribeToProjectTasks('user-1', 'pre-sales', jest.fn());

      expect(mockWhere).toHaveBeenCalledWith('projectId', '==', '');
    });

    it('should call onUpdate with tasks when snapshot changes', () => {
      mockOnSnapshot.mockImplementation((_query, onSuccess) => {
        onSuccess({
          forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
            fn({
              id: 'task-1',
              data: () => ({
                type: 'actionable',
                category: 'PR_SUBMITTED',
                userId: 'user-1',
                title: 'Test',
                message: 'Message',
                priority: 'MEDIUM',
                entityType: 'PURCHASE_REQUEST',
                entityId: 'pr-1',
                linkUrl: '/test',
                status: 'pending',
                read: false,
                autoCompletable: true,
                completionConfirmed: false,
                createdAt: { seconds: 1234567890, nanoseconds: 0 },
              }),
            });
          },
        });
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeToProjectTasks('user-1', 'proj-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'task-1' })])
      );
    });
  });

  describe('subscribeToUserTasks', () => {
    it('should set up subscription for user tasks', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeToUserTasks('user-1', onUpdate);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(unsubscribeMock);
    });

    it('should filter by user and active status', () => {
      mockOnSnapshot.mockReturnValue(jest.fn());

      subscribeToUserTasks('user-1', jest.fn());

      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user-1');
      expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['pending', 'in_progress']);
    });

    it('should call onUpdate with tasks when snapshot changes', () => {
      mockOnSnapshot.mockImplementation((_query, onSuccess) => {
        onSuccess({
          forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
            fn({
              id: 'task-1',
              data: () => ({
                type: 'actionable',
                category: 'TASK_ASSIGNED',
                userId: 'user-1',
                title: 'User Task',
                message: 'Message',
                priority: 'MEDIUM',
                entityType: 'TASK',
                entityId: 't-1',
                linkUrl: '/tasks',
                status: 'pending',
                read: false,
                autoCompletable: false,
                completionConfirmed: false,
                createdAt: { seconds: 1234567890, nanoseconds: 0 },
              }),
            });
          },
        });
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeToUserTasks('user-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'task-1', title: 'User Task' })])
      );
    });
  });
});
