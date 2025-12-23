/**
 * Document Requirement Service Tests
 *
 * Tests for managing document requirements in project charters.
 */

import type { DocumentRequirement, Project } from '@vapour/types';

// Mock crypto for ID generation
const mockRandomUUID = jest.fn(() => 'mock-uuid-1234567890');
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: mockRandomUUID },
});

// Mock firebase/firestore
const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockTimestampNow = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  Timestamp: {
    now: () => mockTimestampNow(),
  },
}));

jest.mock('../firebase', () => ({
  getFirebase: jest.fn(() => ({ db: {} })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROJECTS: 'projects',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

// Import after mocks
import {
  addDocumentRequirement,
  updateDocumentRequirement,
  deleteDocumentRequirement,
  linkDocumentToRequirement,
  updateRequirementFromDocumentStatus,
  findMatchingRequirements,
} from './documentRequirementService';

describe('Document Requirement Service', () => {
  const projectId = 'project-123';
  const userId = 'user-456';
  const mockTimestamp = { seconds: 1703318400, nanoseconds: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
    mockDoc.mockReturnValue({ id: 'mock-doc-ref' });
  });

  describe('addDocumentRequirement', () => {
    const newRequirementData = {
      name: 'Material Test Certificate',
      description: 'MTC for all raw materials',
      documentCategory: 'TECHNICAL',
      isRequired: true,
      dueDate: new Date('2024-03-01'),
    };

    it('should add a document requirement to project', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: [],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await addDocumentRequirement(projectId, newRequirementData, userId);

      expect(result).toMatch(/^DOC-/);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          updatedAt: mockTimestamp,
          updatedBy: userId,
        })
      );
    });

    it('should add requirement with NOT_SUBMITTED status', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: [],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addDocumentRequirement(projectId, newRequirementData, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.arrayContaining([
            expect.objectContaining({
              status: 'NOT_SUBMITTED',
              name: 'Material Test Certificate',
            }),
          ]),
        })
      );
    });

    it('should append to existing requirements', async () => {
      const existingReq: DocumentRequirement = {
        id: 'DOC-existing',
        name: 'Existing Doc',
        status: 'SUBMITTED',
        documentCategory: 'COMMERCIAL',
        isRequired: true,
      };

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: [existingReq],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addDocumentRequirement(projectId, newRequirementData, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.arrayContaining([
            expect.objectContaining({ id: 'DOC-existing' }),
            expect.objectContaining({ name: 'Material Test Certificate' }),
          ]),
        })
      );
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(addDocumentRequirement(projectId, newRequirementData, userId)).rejects.toThrow(
        'Failed to add document requirement'
      );
    });

    it('should handle undefined documentRequirements array', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        // No documentRequirements field
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addDocumentRequirement(projectId, newRequirementData, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.any(Array),
        })
      );
    });
  });

  describe('updateDocumentRequirement', () => {
    it('should update requirement by ID', async () => {
      const existingReq: DocumentRequirement = {
        id: 'DOC-001',
        name: 'Original Name',
        status: 'NOT_SUBMITTED',
        documentCategory: 'TECHNICAL',
        isRequired: true,
      };

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: [existingReq],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateDocumentRequirement(projectId, 'DOC-001', { name: 'Updated Name' }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.arrayContaining([
            expect.objectContaining({
              id: 'DOC-001',
              name: 'Updated Name',
            }),
          ]),
        })
      );
    });

    it('should not modify other requirements when updating one', async () => {
      const requirements: DocumentRequirement[] = [
        { id: 'DOC-001', name: 'Req 1', status: 'NOT_SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
        { id: 'DOC-002', name: 'Req 2', status: 'SUBMITTED', documentCategory: 'COMMERCIAL', isRequired: false },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateDocumentRequirement(projectId, 'DOC-001', { isRequired: false }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.arrayContaining([
            expect.objectContaining({ id: 'DOC-002', name: 'Req 2' }),
          ]),
        })
      );
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        updateDocumentRequirement(projectId, 'DOC-001', { name: 'Updated' }, userId)
      ).rejects.toThrow('Failed to update document requirement');
    });
  });

  describe('deleteDocumentRequirement', () => {
    it('should remove requirement by ID', async () => {
      const requirements: DocumentRequirement[] = [
        { id: 'DOC-001', name: 'Req 1', status: 'NOT_SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
        { id: 'DOC-002', name: 'Req 2', status: 'NOT_SUBMITTED', documentCategory: 'COMMERCIAL', isRequired: true },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await deleteDocumentRequirement(projectId, 'DOC-001', userId);

      const updateCall = mockUpdateDoc.mock.calls[0][1] as { documentRequirements: DocumentRequirement[] };
      expect(updateCall.documentRequirements).toHaveLength(1);
      expect(updateCall.documentRequirements[0]?.id).toBe('DOC-002');
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(deleteDocumentRequirement(projectId, 'DOC-001', userId)).rejects.toThrow(
        'Failed to delete document requirement'
      );
    });
  });

  describe('linkDocumentToRequirement', () => {
    const documentId = 'doc-789';
    const requirementId = 'DOC-001';

    it('should link document and update status to SUBMITTED', async () => {
      const requirements: DocumentRequirement[] = [
        { id: 'DOC-001', name: 'Req 1', status: 'NOT_SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await linkDocumentToRequirement(projectId, requirementId, documentId, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.arrayContaining([
            expect.objectContaining({
              id: 'DOC-001',
              linkedDocumentId: documentId,
              status: 'SUBMITTED',
              submittedDate: mockTimestamp,
            }),
          ]),
        })
      );
    });

    it('should not modify other requirements when linking', async () => {
      const requirements: DocumentRequirement[] = [
        { id: 'DOC-001', name: 'Req 1', status: 'NOT_SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
        { id: 'DOC-002', name: 'Req 2', status: 'NOT_SUBMITTED', documentCategory: 'COMMERCIAL', isRequired: true },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await linkDocumentToRequirement(projectId, 'DOC-001', documentId, userId);

      const updateCall = mockUpdateDoc.mock.calls[0][1] as { documentRequirements: DocumentRequirement[] };
      const req2 = updateCall.documentRequirements.find((r) => r.id === 'DOC-002');
      expect(req2?.status).toBe('NOT_SUBMITTED');
      expect(req2?.linkedDocumentId).toBeUndefined();
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        linkDocumentToRequirement(projectId, requirementId, documentId, userId)
      ).rejects.toThrow('Failed to link document to requirement');
    });
  });

  describe('updateRequirementFromDocumentStatus', () => {
    it('should update requirement to APPROVED status', async () => {
      const requirements: DocumentRequirement[] = [
        {
          id: 'DOC-001',
          name: 'Req 1',
          status: 'SUBMITTED',
          documentCategory: 'TECHNICAL',
          isRequired: true,
          linkedDocumentId: 'doc-123',
        },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateRequirementFromDocumentStatus(projectId, 'DOC-001', 'APPROVED', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.arrayContaining([
            expect.objectContaining({
              id: 'DOC-001',
              status: 'APPROVED',
            }),
          ]),
        })
      );
    });

    it('should update requirement to REJECTED status', async () => {
      const requirements: DocumentRequirement[] = [
        {
          id: 'DOC-001',
          name: 'Req 1',
          status: 'SUBMITTED',
          documentCategory: 'TECHNICAL',
          isRequired: true,
          linkedDocumentId: 'doc-123',
        },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateRequirementFromDocumentStatus(projectId, 'DOC-001', 'REJECTED', userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.arrayContaining([
            expect.objectContaining({
              id: 'DOC-001',
              status: 'REJECTED',
            }),
          ]),
        })
      );
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        updateRequirementFromDocumentStatus(projectId, 'DOC-001', 'APPROVED', userId)
      ).rejects.toThrow('Failed to update requirement status');
    });
  });

  describe('findMatchingRequirements', () => {
    it('should return requirements matching category and NOT_SUBMITTED status', async () => {
      const requirements: DocumentRequirement[] = [
        { id: 'DOC-001', name: 'Tech Doc 1', status: 'NOT_SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
        { id: 'DOC-002', name: 'Tech Doc 2', status: 'NOT_SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
        { id: 'DOC-003', name: 'Commercial Doc', status: 'NOT_SUBMITTED', documentCategory: 'COMMERCIAL', isRequired: true },
        { id: 'DOC-004', name: 'Submitted Tech', status: 'SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      const result = await findMatchingRequirements(projectId, 'TECHNICAL');

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual(['DOC-001', 'DOC-002']);
    });

    it('should exclude requirements with linkedDocumentId', async () => {
      const requirements: DocumentRequirement[] = [
        { id: 'DOC-001', name: 'Unlinked', status: 'NOT_SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
        {
          id: 'DOC-002',
          name: 'Linked',
          status: 'NOT_SUBMITTED',
          documentCategory: 'TECHNICAL',
          isRequired: true,
          linkedDocumentId: 'doc-existing',
        },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      const result = await findMatchingRequirements(projectId, 'TECHNICAL');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('DOC-001');
    });

    it('should return empty array when no matching requirements', async () => {
      const requirements: DocumentRequirement[] = [
        { id: 'DOC-001', name: 'Commercial Doc', status: 'NOT_SUBMITTED', documentCategory: 'COMMERCIAL', isRequired: true },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      const result = await findMatchingRequirements(projectId, 'TECHNICAL');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await findMatchingRequirements(projectId, 'TECHNICAL');

      expect(result).toHaveLength(0);
    });

    it('should handle undefined documentRequirements array', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        // No documentRequirements field
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      const result = await findMatchingRequirements(projectId, 'TECHNICAL');

      expect(result).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await findMatchingRequirements(projectId, 'TECHNICAL');

      expect(result).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent updates by re-reading project data', async () => {
      const requirements: DocumentRequirement[] = [
        { id: 'DOC-001', name: 'Req 1', status: 'NOT_SUBMITTED', documentCategory: 'TECHNICAL', isRequired: true },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: requirements,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      // Both operations should get fresh data
      await linkDocumentToRequirement(projectId, 'DOC-001', 'doc-1', userId);
      await updateRequirementFromDocumentStatus(projectId, 'DOC-001', 'APPROVED', userId);

      expect(mockGetDoc).toHaveBeenCalledTimes(2);
    });

    it('should handle special characters in requirement names', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        documentRequirements: [],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addDocumentRequirement(
        projectId,
        {
          name: 'Test Doc <script>alert("xss")</script>',
          documentCategory: 'TECHNICAL',
          isRequired: true,
        },
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          documentRequirements: expect.arrayContaining([
            expect.objectContaining({
              name: 'Test Doc <script>alert("xss")</script>',
            }),
          ]),
        })
      );
    });
  });
});
