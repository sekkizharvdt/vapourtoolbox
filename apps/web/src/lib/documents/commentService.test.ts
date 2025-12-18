/**
 * Document Comment Service Tests
 *
 * Tests for document comment operations:
 * - Creating comments with auto-numbering
 * - Resolving comments (Level 1 workflow)
 * - PM approval/rejection (Level 2 workflow)
 * - Comment status transitions
 * - Submission count updates
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import {
  createComment,
  resolveComment,
  approveCommentResolution,
  rejectCommentResolution,
  markCommentUnderReview,
  getDocumentComments,
  getSubmissionComments,
  type CreateCommentRequest,
  type ResolveCommentRequest,
  type ApproveResolutionRequest,
  type RejectResolutionRequest,
} from './commentService';

// Mock Firebase
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: jest.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn(),
  orderBy: jest.fn(),
  increment: jest.fn((n) => ({ _increment: n })),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1702800000,
      nanoseconds: 0,
      toDate: () => new Date('2024-12-17'),
    })),
  },
}));

jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => ({ id, ...(data as object) }) as T,
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const mockDb = {} as never;

// Helper to create mock snapshot with forEach
function createMockSnapshot(docs: Array<{ id: string; data: () => unknown }>) {
  return {
    docs,
    empty: docs.length === 0,
    forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
      docs.forEach(callback);
    },
  };
}

describe('createComment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'comment-1' });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should create comment with auto-generated number (first comment)', async () => {
    // No existing comments
    mockGetDocs.mockResolvedValue(createMockSnapshot([]));

    const request: CreateCommentRequest = {
      projectId: 'proj-1',
      masterDocumentId: 'doc-1',
      submissionId: 'sub-1',
      commentText: 'Please revise the pressure calculations',
      severity: 'MAJOR',
      category: 'TECHNICAL',
      pageNumber: 5,
      section: 'Section 3.2',
      commentedBy: 'user-1',
      commentedByName: 'John Reviewer',
    };

    const result = await createComment(mockDb, request);

    expect(result).toBe('comment-1');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        commentNumber: 'C-001',
        commentText: 'Please revise the pressure calculations',
        severity: 'MAJOR',
        category: 'TECHNICAL',
        status: 'OPEN',
        pmApproved: false,
        clientAccepted: false,
      })
    );
  });

  it('should increment comment number from existing comments', async () => {
    // Existing comment with C-005
    mockGetDocs.mockResolvedValue(
      createMockSnapshot([
        {
          id: 'existing-1',
          data: () => ({ commentNumber: 'C-005' }),
        },
      ])
    );

    const request: CreateCommentRequest = {
      projectId: 'proj-1',
      masterDocumentId: 'doc-1',
      submissionId: 'sub-1',
      commentText: 'Check material specifications',
      severity: 'MINOR',
      category: 'TECHNICAL',
      commentedBy: 'user-1',
      commentedByName: 'Jane Reviewer',
    };

    await createComment(mockDb, request);

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        commentNumber: 'C-006',
      })
    );
  });

  it('should update submission comment counts', async () => {
    mockGetDocs.mockResolvedValue(createMockSnapshot([]));

    const request: CreateCommentRequest = {
      projectId: 'proj-1',
      masterDocumentId: 'doc-1',
      submissionId: 'sub-1',
      commentText: 'Review required',
      severity: 'CRITICAL',
      category: 'SAFETY',
      commentedBy: 'user-1',
      commentedByName: 'Safety Officer',
    };

    await createComment(mockDb, request);

    // Should update submission counts (increment comment count and open count)
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        commentCount: expect.objectContaining({ _increment: 1 }),
        openCommentCount: expect.objectContaining({ _increment: 1 }),
      })
    );
  });

  it('should include optional location fields when provided', async () => {
    mockGetDocs.mockResolvedValue(createMockSnapshot([]));

    const request: CreateCommentRequest = {
      projectId: 'proj-1',
      masterDocumentId: 'doc-1',
      submissionId: 'sub-1',
      commentText: 'Check line item 5',
      severity: 'MINOR',
      category: 'COMMERCIAL',
      pageNumber: 12,
      section: 'BOQ Section',
      lineItem: 'LI-005',
      commentedBy: 'user-1',
      commentedByName: 'Quantity Surveyor',
    };

    await createComment(mockDb, request);

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageNumber: 12,
        section: 'BOQ Section',
        lineItem: 'LI-005',
      })
    );
  });
});

describe('resolveComment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should resolve comment and update status', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ status: 'OPEN' }),
    });

    const request: ResolveCommentRequest = {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      resolutionText: 'Calculations revised per AS 4041',
      resolvedBy: 'user-2',
      resolvedByName: 'Engineer Smith',
    };

    await resolveComment(mockDb, request);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'RESOLVED',
        resolutionText: 'Calculations revised per AS 4041',
        resolvedBy: 'user-2',
        resolvedByName: 'Engineer Smith',
        resolvedAt: expect.anything(),
      })
    );
  });

  it('should decrement open count when resolving OPEN comment', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ status: 'OPEN' }),
    });

    const request: ResolveCommentRequest = {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      resolutionText: 'Fixed',
      resolvedBy: 'user-2',
      resolvedByName: 'Engineer',
    };

    await resolveComment(mockDb, request);

    // Should decrement open count and increment resolved count
    expect(mockUpdateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        openCommentCount: expect.objectContaining({ _increment: -1 }),
        resolvedCommentCount: expect.objectContaining({ _increment: 1 }),
      })
    );
  });
});

describe('approveCommentResolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should approve resolution and close comment', async () => {
    const request: ApproveResolutionRequest = {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      pmApprovedBy: 'pm-1',
      pmApprovedByName: 'Project Manager',
      pmRemarks: 'Resolution acceptable',
    };

    await approveCommentResolution(mockDb, request);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'CLOSED',
        pmApproved: true,
        pmApprovedBy: 'pm-1',
        pmApprovedByName: 'Project Manager',
        pmRemarks: 'Resolution acceptable',
        pmApprovedAt: expect.anything(),
      })
    );
  });

  it('should update submission counts on approval', async () => {
    const request: ApproveResolutionRequest = {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      pmApprovedBy: 'pm-1',
      pmApprovedByName: 'Project Manager',
    };

    await approveCommentResolution(mockDb, request);

    // Should decrement resolved count and increment closed count
    expect(mockUpdateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        resolvedCommentCount: expect.objectContaining({ _increment: -1 }),
        closedCommentCount: expect.objectContaining({ _increment: 1 }),
      })
    );
  });
});

describe('rejectCommentResolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should reject resolution and send back to under review', async () => {
    const request: RejectResolutionRequest = {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      pmRemarks: 'Resolution does not address root cause',
    };

    await rejectCommentResolution(mockDb, request);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'UNDER_REVIEW',
        pmRemarks: 'Resolution does not address root cause',
      })
    );
  });

  it('should decrement resolved count on rejection', async () => {
    const request: RejectResolutionRequest = {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      pmRemarks: 'Need more detail',
    };

    await rejectCommentResolution(mockDb, request);

    expect(mockUpdateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        resolvedCommentCount: expect.objectContaining({ _increment: -1 }),
      })
    );
  });
});

describe('markCommentUnderReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should update status to UNDER_REVIEW', async () => {
    await markCommentUnderReview(mockDb, 'proj-1', 'sub-1', 'comment-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'UNDER_REVIEW',
        updatedAt: expect.anything(),
      })
    );
  });

  it('should decrement open count', async () => {
    await markCommentUnderReview(mockDb, 'proj-1', 'sub-1', 'comment-1');

    expect(mockUpdateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        openCommentCount: expect.objectContaining({ _increment: -1 }),
      })
    );
  });
});

describe('getDocumentComments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all comments for document', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        data: () => ({
          commentNumber: 'C-001',
          commentText: 'First comment',
          status: 'OPEN',
        }),
      },
      {
        id: 'comment-2',
        data: () => ({
          commentNumber: 'C-002',
          commentText: 'Second comment',
          status: 'RESOLVED',
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockComments));

    const result = await getDocumentComments(mockDb, 'proj-1', 'doc-1');

    expect(result).toHaveLength(2);
    expect(result[0]!.commentNumber).toBe('C-001');
    expect(result[1]!.commentNumber).toBe('C-002');
  });

  it('should filter by status when provided', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        data: () => ({
          commentNumber: 'C-001',
          status: 'OPEN',
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockComments));

    const result = await getDocumentComments(mockDb, 'proj-1', 'doc-1', 'OPEN');

    expect(result).toHaveLength(1);
    expect(mockGetDocs).toHaveBeenCalled();
  });

  it('should return empty array when no comments exist', async () => {
    mockGetDocs.mockResolvedValue(createMockSnapshot([]));

    const result = await getDocumentComments(mockDb, 'proj-1', 'doc-1');

    expect(result).toHaveLength(0);
  });
});

describe('getSubmissionComments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return comments for specific submission', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        data: () => ({
          commentNumber: 'C-001',
          submissionId: 'sub-1',
          status: 'CLOSED',
        }),
      },
      {
        id: 'comment-2',
        data: () => ({
          commentNumber: 'C-002',
          submissionId: 'sub-1',
          status: 'OPEN',
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockComments));

    const result = await getSubmissionComments(mockDb, 'proj-1', 'sub-1');

    expect(result).toHaveLength(2);
  });
});

describe('Comment Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'new-comment' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue(createMockSnapshot([]));
  });

  it('should support full lifecycle: OPEN → UNDER_REVIEW → RESOLVED → CLOSED', async () => {
    // 1. Create comment (OPEN)
    await createComment(mockDb, {
      projectId: 'proj-1',
      masterDocumentId: 'doc-1',
      submissionId: 'sub-1',
      commentText: 'Issue found',
      severity: 'MAJOR',
      category: 'TECHNICAL',
      commentedBy: 'reviewer-1',
      commentedByName: 'Reviewer',
    });

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'OPEN' })
    );

    // 2. Mark under review
    await markCommentUnderReview(mockDb, 'proj-1', 'sub-1', 'new-comment');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'UNDER_REVIEW' })
    );

    // 3. Resolve comment
    mockGetDoc.mockResolvedValue({
      data: () => ({ status: 'UNDER_REVIEW' }),
    });

    await resolveComment(mockDb, {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'new-comment',
      resolutionText: 'Fixed the issue',
      resolvedBy: 'engineer-1',
      resolvedByName: 'Engineer',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'RESOLVED' })
    );

    // 4. PM approves
    await approveCommentResolution(mockDb, {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'new-comment',
      pmApprovedBy: 'pm-1',
      pmApprovedByName: 'PM',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'CLOSED', pmApproved: true })
    );
  });

  it('should support rejection flow: RESOLVED → UNDER_REVIEW → RESOLVED → CLOSED', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ status: 'OPEN' }),
    });

    // 1. Resolve
    await resolveComment(mockDb, {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      resolutionText: 'Initial fix',
      resolvedBy: 'eng-1',
      resolvedByName: 'Engineer',
    });

    // 2. PM rejects
    await rejectCommentResolution(mockDb, {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      pmRemarks: 'Incomplete resolution',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'UNDER_REVIEW' })
    );

    // 3. Re-resolve
    mockGetDoc.mockResolvedValue({
      data: () => ({ status: 'UNDER_REVIEW' }),
    });

    await resolveComment(mockDb, {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      resolutionText: 'Updated fix addressing all concerns',
      resolvedBy: 'eng-1',
      resolvedByName: 'Engineer',
    });

    // 4. PM approves
    await approveCommentResolution(mockDb, {
      projectId: 'proj-1',
      submissionId: 'sub-1',
      commentId: 'comment-1',
      pmApprovedBy: 'pm-1',
      pmApprovedByName: 'PM',
      pmRemarks: 'Now acceptable',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'CLOSED' })
    );
  });
});
