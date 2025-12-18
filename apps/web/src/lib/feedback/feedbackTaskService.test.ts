/**
 * Tests for feedbackTaskService
 *
 * Tests feedback task creation and management functions.
 */

import {
  createFeedbackResolutionTask,
  addFollowUpToFeedback,
  closeFeedbackFromTask,
  getFeedbackById,
} from './feedbackTaskService';

// Mock firebase/firestore
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
  arrayUnion: jest.fn((value) => value),
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock taskNotificationService
jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: jest.fn(),
}));

// Mock firebase typeHelpers
jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: jest.fn((id, data) => ({ id, ...data })),
}));

import { doc, updateDoc, getDoc, type Firestore } from 'firebase/firestore';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';

const mockDoc = doc as jest.Mock;
const mockUpdateDoc = updateDoc as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockCreateTaskNotification = createTaskNotification as jest.Mock;

describe('feedbackTaskService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue('feedbackDocRef');
  });

  describe('createFeedbackResolutionTask', () => {
    it('should create a task notification for feedback resolution', async () => {
      mockCreateTaskNotification.mockResolvedValue('task-123');

      const taskId = await createFeedbackResolutionTask(
        'feedback-1',
        'Login button not working',
        'user-123',
        'John Doe',
        'Admin User',
        'Fixed the button click handler'
      );

      expect(taskId).toBe('task-123');
      expect(mockCreateTaskNotification).toHaveBeenCalledWith({
        type: 'actionable',
        category: 'FEEDBACK_RESOLUTION_CHECK',
        userId: 'user-123',
        assignedBy: 'system',
        assignedByName: 'Admin User',
        title: 'Review Fix: Login button not working',
        message: expect.stringContaining('Fixed the button click handler'),
        entityType: 'FEEDBACK',
        entityId: 'feedback-1',
        linkUrl: '/feedback/feedback-1',
        priority: 'MEDIUM',
        autoCompletable: true,
        metadata: {
          feedbackTitle: 'Login button not working',
          reporterName: 'John Doe',
          resolvedByName: 'Admin User',
          resolutionNotes: 'Fixed the button click handler',
        },
      });
    });

    it('should create task without resolution notes', async () => {
      mockCreateTaskNotification.mockResolvedValue('task-456');

      const taskId = await createFeedbackResolutionTask(
        'feedback-2',
        'Page loading slowly',
        'user-456',
        'Jane Smith',
        'Dev Team'
      );

      expect(taskId).toBe('task-456');
      expect(mockCreateTaskNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Page loading slowly'),
          metadata: expect.objectContaining({
            resolutionNotes: undefined,
          }),
        })
      );
    });

    it('should throw error when task creation fails', async () => {
      const error = new Error('Task creation failed');
      mockCreateTaskNotification.mockRejectedValue(error);

      await expect(
        createFeedbackResolutionTask(
          'feedback-3',
          'Test feedback',
          'user-789',
          'Test User',
          'Admin'
        )
      ).rejects.toThrow('Task creation failed');
    });
  });

  describe('addFollowUpToFeedback', () => {
    it('should add follow-up comment and change status to in_progress', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'resolved',
          title: 'Test feedback',
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addFollowUpToFeedback(
        mockDb,
        'feedback-1',
        'Issue still occurs',
        'user-123',
        'John Doe'
      );

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'feedback', 'feedback-1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'feedbackDocRef',
        expect.objectContaining({
          status: 'in_progress',
          followUpComments: expect.objectContaining({
            userId: 'user-123',
            userName: 'John Doe',
            comment: 'Issue still occurs',
          }),
        })
      );
    });

    it('should throw error when feedback not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        addFollowUpToFeedback(mockDb, 'nonexistent', 'Comment', 'user-1', 'User')
      ).rejects.toThrow('Feedback not found');
    });

    it('should throw error when update fails', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'resolved' }),
      });
      const error = new Error('Update failed');
      mockUpdateDoc.mockRejectedValue(error);

      await expect(
        addFollowUpToFeedback(mockDb, 'feedback-1', 'Comment', 'user-1', 'User')
      ).rejects.toThrow('Update failed');
    });
  });

  describe('closeFeedbackFromTask', () => {
    it('should close feedback and update status', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'resolved',
          title: 'Test feedback',
        }),
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await closeFeedbackFromTask(mockDb, 'feedback-1', 'user-123', 'John Doe');

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'feedback', 'feedback-1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'feedbackDocRef',
        expect.objectContaining({
          status: 'closed',
          closedBy: 'user-123',
          closedByName: 'John Doe',
        })
      );
    });

    it('should throw error when feedback not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(closeFeedbackFromTask(mockDb, 'nonexistent', 'user-1', 'User')).rejects.toThrow(
        'Feedback not found'
      );
    });

    it('should throw error when update fails', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'resolved' }),
      });
      const error = new Error('Update failed');
      mockUpdateDoc.mockRejectedValue(error);

      await expect(closeFeedbackFromTask(mockDb, 'feedback-1', 'user-1', 'User')).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('getFeedbackById', () => {
    it('should return feedback document when found', async () => {
      const mockFeedback = {
        type: 'bug',
        status: 'new',
        title: 'Test bug',
        description: 'Test description',
        userName: 'Test User',
        userEmail: 'test@example.com',
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'feedback-1',
        data: () => mockFeedback,
      });

      const result = await getFeedbackById(mockDb, 'feedback-1');

      expect(result).toEqual({
        id: 'feedback-1',
        ...mockFeedback,
      });
      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'feedback', 'feedback-1');
    });

    it('should return null when feedback not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getFeedbackById(mockDb, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when query fails', async () => {
      const error = new Error('Query failed');
      mockGetDoc.mockRejectedValue(error);

      await expect(getFeedbackById(mockDb, 'feedback-1')).rejects.toThrow('Query failed');
    });
  });
});
