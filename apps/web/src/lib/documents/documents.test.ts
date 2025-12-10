/**
 * Document Services Tests
 *
 * Tests for document-related services including:
 * - Comment service utilities
 * - Submission service utilities
 * - Link service utilities
 * - Work/Supply item utilities
 */

// ============================================================================
// Comment Service Tests
// ============================================================================

describe('Comment Service', () => {
  describe('Comment Number Generation', () => {
    // Test the pattern: C-001, C-002, etc.
    it('should format comment numbers with leading zeros', () => {
      const formatCommentNumber = (num: number): string => {
        return `C-${num.toString().padStart(3, '0')}`;
      };

      expect(formatCommentNumber(1)).toBe('C-001');
      expect(formatCommentNumber(5)).toBe('C-005');
      expect(formatCommentNumber(10)).toBe('C-010');
      expect(formatCommentNumber(100)).toBe('C-100');
      expect(formatCommentNumber(999)).toBe('C-999');
    });

    it('should parse comment numbers correctly', () => {
      const parseCommentNumber = (commentNumber: string): number | null => {
        const match = commentNumber.match(/C-(\d+)/);
        if (!match || !match[1]) return null;
        return parseInt(match[1], 10);
      };

      expect(parseCommentNumber('C-001')).toBe(1);
      expect(parseCommentNumber('C-010')).toBe(10);
      expect(parseCommentNumber('C-999')).toBe(999);
      expect(parseCommentNumber('invalid')).toBeNull();
      expect(parseCommentNumber('')).toBeNull();
    });

    it('should increment comment numbers correctly', () => {
      const incrementCommentNumber = (lastNumber: string): string => {
        const match = lastNumber.match(/C-(\d+)/);
        if (!match || !match[1]) return 'C-001';
        const nextNumber = parseInt(match[1], 10) + 1;
        return `C-${nextNumber.toString().padStart(3, '0')}`;
      };

      expect(incrementCommentNumber('C-001')).toBe('C-002');
      expect(incrementCommentNumber('C-009')).toBe('C-010');
      expect(incrementCommentNumber('C-099')).toBe('C-100');
      expect(incrementCommentNumber('C-999')).toBe('C-1000');
      expect(incrementCommentNumber('invalid')).toBe('C-001');
    });
  });

  describe('Comment Status Validation', () => {
    const VALID_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as const;
    type CommentStatus = (typeof VALID_STATUSES)[number];

    const isValidStatus = (status: string): status is CommentStatus => {
      return VALID_STATUSES.includes(status as CommentStatus);
    };

    it('should validate correct comment statuses', () => {
      expect(isValidStatus('OPEN')).toBe(true);
      expect(isValidStatus('UNDER_REVIEW')).toBe(true);
      expect(isValidStatus('RESOLVED')).toBe(true);
      expect(isValidStatus('CLOSED')).toBe(true);
    });

    it('should reject invalid comment statuses', () => {
      expect(isValidStatus('open')).toBe(false);
      expect(isValidStatus('PENDING')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus('INVALID')).toBe(false);
    });
  });

  describe('Comment Severity Validation', () => {
    const VALID_SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'COMMENT'] as const;
    type CommentSeverity = (typeof VALID_SEVERITIES)[number];

    const isValidSeverity = (severity: string): severity is CommentSeverity => {
      return VALID_SEVERITIES.includes(severity as CommentSeverity);
    };

    it('should validate correct severities', () => {
      expect(isValidSeverity('CRITICAL')).toBe(true);
      expect(isValidSeverity('MAJOR')).toBe(true);
      expect(isValidSeverity('MINOR')).toBe(true);
      expect(isValidSeverity('COMMENT')).toBe(true);
    });

    it('should reject invalid severities', () => {
      expect(isValidSeverity('critical')).toBe(false);
      expect(isValidSeverity('HIGH')).toBe(false);
      expect(isValidSeverity('')).toBe(false);
    });
  });

  describe('Comment Category Validation', () => {
    const VALID_CATEGORIES = [
      'TECHNICAL',
      'DIMENSIONAL',
      'MATERIAL',
      'PROCESS',
      'SAFETY',
      'DOCUMENTATION',
      'OTHER',
    ] as const;
    type CommentCategory = (typeof VALID_CATEGORIES)[number];

    const isValidCategory = (category: string): category is CommentCategory => {
      return VALID_CATEGORIES.includes(category as CommentCategory);
    };

    it('should validate correct categories', () => {
      VALID_CATEGORIES.forEach((category) => {
        expect(isValidCategory(category)).toBe(true);
      });
    });

    it('should reject invalid categories', () => {
      expect(isValidCategory('GENERAL')).toBe(false);
      expect(isValidCategory('technical')).toBe(false);
      expect(isValidCategory('')).toBe(false);
    });
  });

  describe('Comment Count Calculations', () => {
    interface CommentCounts {
      total: number;
      open: number;
      underReview: number;
      resolved: number;
      closed: number;
    }

    const calculateCompletionPercentage = (counts: CommentCounts): number => {
      if (counts.total === 0) return 100;
      return Math.round((counts.closed / counts.total) * 100);
    };

    const calculateProgressPercentage = (counts: CommentCounts): number => {
      if (counts.total === 0) return 100;
      return Math.round(((counts.resolved + counts.closed) / counts.total) * 100);
    };

    it('should calculate completion percentage correctly', () => {
      expect(
        calculateCompletionPercentage({
          total: 10,
          open: 0,
          underReview: 0,
          resolved: 0,
          closed: 10,
        })
      ).toBe(100);
      expect(
        calculateCompletionPercentage({
          total: 10,
          open: 5,
          underReview: 0,
          resolved: 0,
          closed: 5,
        })
      ).toBe(50);
      expect(
        calculateCompletionPercentage({
          total: 10,
          open: 10,
          underReview: 0,
          resolved: 0,
          closed: 0,
        })
      ).toBe(0);
      expect(
        calculateCompletionPercentage({ total: 0, open: 0, underReview: 0, resolved: 0, closed: 0 })
      ).toBe(100);
    });

    it('should calculate progress percentage correctly', () => {
      expect(
        calculateProgressPercentage({ total: 10, open: 0, underReview: 0, resolved: 5, closed: 5 })
      ).toBe(100);
      expect(
        calculateProgressPercentage({ total: 10, open: 5, underReview: 0, resolved: 3, closed: 2 })
      ).toBe(50);
      expect(
        calculateProgressPercentage({ total: 10, open: 10, underReview: 0, resolved: 0, closed: 0 })
      ).toBe(0);
    });
  });
});

// ============================================================================
// Submission Service Tests
// ============================================================================

describe('Submission Service', () => {
  describe('File ID Generation', () => {
    const generateFileId = (): string => {
      return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    };

    it('should generate unique file IDs', () => {
      const id1 = generateFileId();
      const id2 = generateFileId();

      expect(id1).toMatch(/^file_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^file_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should start with "file_" prefix', () => {
      const id = generateFileId();
      expect(id.startsWith('file_')).toBe(true);
    });
  });

  describe('Revision Parsing', () => {
    const parseRevisionNumber = (revision: string): number => {
      return parseInt(revision.replace('R', ''), 10) || 0;
    };

    it('should parse revision strings correctly', () => {
      expect(parseRevisionNumber('R0')).toBe(0);
      expect(parseRevisionNumber('R1')).toBe(1);
      expect(parseRevisionNumber('R10')).toBe(10);
      expect(parseRevisionNumber('R99')).toBe(99);
    });

    it('should handle invalid revision strings', () => {
      expect(parseRevisionNumber('')).toBe(0);
      expect(parseRevisionNumber('invalid')).toBe(0);
      expect(parseRevisionNumber('X1')).toBe(0);
    });
  });

  describe('Next Revision Calculation', () => {
    const getNextRevision = (current: string): string => {
      const currentNum = parseInt(current.replace('R', ''), 10) || 0;
      return `R${currentNum + 1}`;
    };

    it('should calculate next revision correctly', () => {
      expect(getNextRevision('R0')).toBe('R1');
      expect(getNextRevision('R1')).toBe('R2');
      expect(getNextRevision('R9')).toBe('R10');
      expect(getNextRevision('R99')).toBe('R100');
    });

    it('should handle invalid input gracefully', () => {
      expect(getNextRevision('')).toBe('R1');
      expect(getNextRevision('invalid')).toBe('R1');
    });
  });

  describe('File Type Validation', () => {
    const VALID_FILE_TYPES = ['PDF', 'NATIVE', 'MARKUPS', 'SUPPORTING'] as const;
    type SubmissionFileType = (typeof VALID_FILE_TYPES)[number];

    const isValidFileType = (type: string): type is SubmissionFileType => {
      return VALID_FILE_TYPES.includes(type as SubmissionFileType);
    };

    it('should validate correct file types', () => {
      expect(isValidFileType('PDF')).toBe(true);
      expect(isValidFileType('NATIVE')).toBe(true);
      expect(isValidFileType('MARKUPS')).toBe(true);
      expect(isValidFileType('SUPPORTING')).toBe(true);
    });

    it('should reject invalid file types', () => {
      expect(isValidFileType('pdf')).toBe(false);
      expect(isValidFileType('IMAGE')).toBe(false);
      expect(isValidFileType('')).toBe(false);
    });
  });

  describe('Client Status Validation', () => {
    const VALID_CLIENT_STATUSES = [
      'PENDING',
      'APPROVED',
      'APPROVED_WITH_COMMENTS',
      'REJECTED',
      'SUPERSEDED',
    ] as const;
    type ClientStatus = (typeof VALID_CLIENT_STATUSES)[number];

    const isValidClientStatus = (status: string): status is ClientStatus => {
      return VALID_CLIENT_STATUSES.includes(status as ClientStatus);
    };

    it('should validate correct client statuses', () => {
      VALID_CLIENT_STATUSES.forEach((status) => {
        expect(isValidClientStatus(status)).toBe(true);
      });
    });

    it('should reject invalid client statuses', () => {
      expect(isValidClientStatus('SUBMITTED')).toBe(false);
      expect(isValidClientStatus('pending')).toBe(false);
      expect(isValidClientStatus('')).toBe(false);
    });
  });

  describe('Storage Path Generation', () => {
    const generateStoragePath = (
      projectId: string,
      documentNumber: string,
      revision: string,
      fileType: string,
      fileName: string
    ): string => {
      const sanitizedDocNumber = documentNumber.replace(/\//g, '-');
      const timestamp = Date.now();
      return `projects/${projectId}/documents/${sanitizedDocNumber}/${revision}/${fileType.toLowerCase()}/${timestamp}_${fileName}`;
    };

    it('should generate valid storage paths', () => {
      const path = generateStoragePath('proj-123', 'DOC-001', 'R1', 'PDF', 'drawing.pdf');
      expect(path).toMatch(/^projects\/proj-123\/documents\/DOC-001\/R1\/pdf\/\d+_drawing\.pdf$/);
    });

    it('should sanitize document numbers with slashes', () => {
      const path = generateStoragePath('proj-123', 'DOC/001/A', 'R1', 'PDF', 'drawing.pdf');
      expect(path).toContain('DOC-001-A');
      expect(path).not.toContain('/DOC/001/A/');
    });
  });
});

// ============================================================================
// Link Service Tests
// ============================================================================

describe('Link Service', () => {
  describe('Link Type Validation', () => {
    const VALID_LINK_TYPES = [
      'REFERENCES',
      'SUPERSEDES',
      'SUPERSEDED_BY',
      'RELATED_TO',
      'ATTACHMENT_OF',
      'PARENT_OF',
      'CHILD_OF',
    ] as const;
    type LinkType = (typeof VALID_LINK_TYPES)[number];

    const isValidLinkType = (type: string): type is LinkType => {
      return VALID_LINK_TYPES.includes(type as LinkType);
    };

    it('should validate correct link types', () => {
      VALID_LINK_TYPES.forEach((type) => {
        expect(isValidLinkType(type)).toBe(true);
      });
    });

    it('should reject invalid link types', () => {
      expect(isValidLinkType('LINKS_TO')).toBe(false);
      expect(isValidLinkType('related_to')).toBe(false);
      expect(isValidLinkType('')).toBe(false);
    });
  });

  describe('Bidirectional Link Mapping', () => {
    const REVERSE_LINK_MAP: Record<string, string> = {
      SUPERSEDES: 'SUPERSEDED_BY',
      SUPERSEDED_BY: 'SUPERSEDES',
      PARENT_OF: 'CHILD_OF',
      CHILD_OF: 'PARENT_OF',
      REFERENCES: 'REFERENCES',
      RELATED_TO: 'RELATED_TO',
      ATTACHMENT_OF: 'ATTACHMENT_OF',
    };

    const getReverseLinkType = (type: string): string | null => {
      return REVERSE_LINK_MAP[type] || null;
    };

    it('should return correct reverse link types', () => {
      expect(getReverseLinkType('SUPERSEDES')).toBe('SUPERSEDED_BY');
      expect(getReverseLinkType('SUPERSEDED_BY')).toBe('SUPERSEDES');
      expect(getReverseLinkType('PARENT_OF')).toBe('CHILD_OF');
      expect(getReverseLinkType('CHILD_OF')).toBe('PARENT_OF');
    });

    it('should return same type for symmetric relationships', () => {
      expect(getReverseLinkType('REFERENCES')).toBe('REFERENCES');
      expect(getReverseLinkType('RELATED_TO')).toBe('RELATED_TO');
    });

    it('should return null for invalid types', () => {
      expect(getReverseLinkType('INVALID')).toBeNull();
      expect(getReverseLinkType('')).toBeNull();
    });
  });
});

// ============================================================================
// Work Item Service Tests
// ============================================================================

describe('Work Item Service', () => {
  describe('Work Item Number Generation', () => {
    const formatWorkItemNumber = (index: number): string => {
      return `W-${(index + 1).toString().padStart(3, '0')}`;
    };

    it('should format work item numbers with leading zeros', () => {
      expect(formatWorkItemNumber(0)).toBe('W-001');
      expect(formatWorkItemNumber(9)).toBe('W-010');
      expect(formatWorkItemNumber(99)).toBe('W-100');
      expect(formatWorkItemNumber(999)).toBe('W-1000');
    });
  });

  describe('Work Item Status Validation', () => {
    const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as const;
    type WorkItemStatus = (typeof VALID_STATUSES)[number];

    const isValidWorkItemStatus = (status: string): status is WorkItemStatus => {
      return VALID_STATUSES.includes(status as WorkItemStatus);
    };

    it('should validate correct work item statuses', () => {
      VALID_STATUSES.forEach((status) => {
        expect(isValidWorkItemStatus(status)).toBe(true);
      });
    });

    it('should reject invalid statuses', () => {
      expect(isValidWorkItemStatus('DONE')).toBe(false);
      expect(isValidWorkItemStatus('pending')).toBe(false);
    });
  });

  describe('Work Item Progress Calculation', () => {
    interface WorkItem {
      status: string;
      percentComplete?: number;
    }

    const calculateListProgress = (items: WorkItem[]): number => {
      if (items.length === 0) return 0;

      const completedCount = items.filter((item) => item.status === 'COMPLETED').length;
      return Math.round((completedCount / items.length) * 100);
    };

    it('should calculate progress based on completed items', () => {
      const items: WorkItem[] = [
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'IN_PROGRESS' },
        { status: 'PENDING' },
      ];
      expect(calculateListProgress(items)).toBe(50);
    });

    it('should return 0 for empty list', () => {
      expect(calculateListProgress([])).toBe(0);
    });

    it('should return 100 for all completed', () => {
      const items: WorkItem[] = [{ status: 'COMPLETED' }, { status: 'COMPLETED' }];
      expect(calculateListProgress(items)).toBe(100);
    });

    it('should return 0 for none completed', () => {
      const items: WorkItem[] = [{ status: 'PENDING' }, { status: 'IN_PROGRESS' }];
      expect(calculateListProgress(items)).toBe(0);
    });
  });
});

// ============================================================================
// Supply Item Service Tests
// ============================================================================

describe('Supply Item Service', () => {
  describe('Supply Item Number Generation', () => {
    const formatSupplyItemNumber = (index: number): string => {
      return `S-${(index + 1).toString().padStart(3, '0')}`;
    };

    it('should format supply item numbers with leading zeros', () => {
      expect(formatSupplyItemNumber(0)).toBe('S-001');
      expect(formatSupplyItemNumber(9)).toBe('S-010');
      expect(formatSupplyItemNumber(99)).toBe('S-100');
    });
  });

  describe('Supply Item Status Validation', () => {
    const VALID_STATUSES = ['PENDING', 'ORDERED', 'RECEIVED', 'INSTALLED', 'CANCELLED'] as const;
    type SupplyItemStatus = (typeof VALID_STATUSES)[number];

    const isValidSupplyItemStatus = (status: string): status is SupplyItemStatus => {
      return VALID_STATUSES.includes(status as SupplyItemStatus);
    };

    it('should validate correct supply item statuses', () => {
      VALID_STATUSES.forEach((status) => {
        expect(isValidSupplyItemStatus(status)).toBe(true);
      });
    });

    it('should reject invalid statuses', () => {
      expect(isValidSupplyItemStatus('DELIVERED')).toBe(false);
      expect(isValidSupplyItemStatus('pending')).toBe(false);
    });
  });

  describe('Supply List Value Calculation', () => {
    interface SupplyItem {
      quantity: number;
      unitPrice: number;
    }

    const calculateTotalValue = (items: SupplyItem[]): number => {
      return items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
    };

    it('should calculate total value correctly', () => {
      const items: SupplyItem[] = [
        { quantity: 10, unitPrice: 100 },
        { quantity: 5, unitPrice: 200 },
      ];
      expect(calculateTotalValue(items)).toBe(2000);
    });

    it('should return 0 for empty list', () => {
      expect(calculateTotalValue([])).toBe(0);
    });

    it('should handle zero quantities', () => {
      const items: SupplyItem[] = [
        { quantity: 0, unitPrice: 100 },
        { quantity: 5, unitPrice: 0 },
      ];
      expect(calculateTotalValue(items)).toBe(0);
    });

    it('should handle decimal values', () => {
      const items: SupplyItem[] = [{ quantity: 2.5, unitPrice: 10.5 }];
      expect(calculateTotalValue(items)).toBeCloseTo(26.25);
    });
  });
});

// ============================================================================
// Transmittal Service Tests
// ============================================================================

describe('Transmittal Service', () => {
  describe('Transmittal Number Generation', () => {
    const formatTransmittalNumber = (projectCode: string, sequence: number): string => {
      return `${projectCode}-TR-${sequence.toString().padStart(4, '0')}`;
    };

    it('should format transmittal numbers correctly', () => {
      expect(formatTransmittalNumber('PRJ-001', 1)).toBe('PRJ-001-TR-0001');
      expect(formatTransmittalNumber('PRJ-001', 10)).toBe('PRJ-001-TR-0010');
      expect(formatTransmittalNumber('PRJ-001', 100)).toBe('PRJ-001-TR-0100');
      expect(formatTransmittalNumber('PRJ-001', 9999)).toBe('PRJ-001-TR-9999');
    });
  });

  describe('Transmittal Status Validation', () => {
    const VALID_STATUSES = ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'CLOSED'] as const;
    type TransmittalStatus = (typeof VALID_STATUSES)[number];

    const isValidTransmittalStatus = (status: string): status is TransmittalStatus => {
      return VALID_STATUSES.includes(status as TransmittalStatus);
    };

    it('should validate correct transmittal statuses', () => {
      VALID_STATUSES.forEach((status) => {
        expect(isValidTransmittalStatus(status)).toBe(true);
      });
    });

    it('should reject invalid statuses', () => {
      expect(isValidTransmittalStatus('PENDING')).toBe(false);
      expect(isValidTransmittalStatus('draft')).toBe(false);
    });
  });

  describe('Purpose Code Validation', () => {
    const VALID_PURPOSES = [
      'FOR_APPROVAL',
      'FOR_INFORMATION',
      'FOR_REVIEW',
      'FOR_CONSTRUCTION',
      'AS_BUILT',
      'FOR_RECORD',
    ] as const;
    type TransmittalPurpose = (typeof VALID_PURPOSES)[number];

    const isValidPurpose = (purpose: string): purpose is TransmittalPurpose => {
      return VALID_PURPOSES.includes(purpose as TransmittalPurpose);
    };

    it('should validate correct purposes', () => {
      VALID_PURPOSES.forEach((purpose) => {
        expect(isValidPurpose(purpose)).toBe(true);
      });
    });

    it('should reject invalid purposes', () => {
      expect(isValidPurpose('FOR_REFERENCE')).toBe(false);
      expect(isValidPurpose('for_approval')).toBe(false);
    });
  });
});

// ============================================================================
// Master Document Service Tests
// ============================================================================

describe('Master Document Service', () => {
  describe('Document Status Validation', () => {
    const VALID_STATUSES = [
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
      'SUPERSEDED',
      'CANCELLED',
    ] as const;
    type DocumentStatus = (typeof VALID_STATUSES)[number];

    const isValidDocumentStatus = (status: string): status is DocumentStatus => {
      return VALID_STATUSES.includes(status as DocumentStatus);
    };

    it('should validate correct document statuses', () => {
      VALID_STATUSES.forEach((status) => {
        expect(isValidDocumentStatus(status)).toBe(true);
      });
    });

    it('should reject invalid statuses', () => {
      expect(isValidDocumentStatus('PENDING')).toBe(false);
      expect(isValidDocumentStatus('draft')).toBe(false);
      expect(isValidDocumentStatus('')).toBe(false);
    });
  });

  describe('Document Type Validation', () => {
    const VALID_TYPES = [
      'DRAWING',
      'SPECIFICATION',
      'CALCULATION',
      'REPORT',
      'MANUAL',
      'PROCEDURE',
      'DATASHEET',
      'OTHER',
    ] as const;
    type DocumentType = (typeof VALID_TYPES)[number];

    const isValidDocumentType = (type: string): type is DocumentType => {
      return VALID_TYPES.includes(type as DocumentType);
    };

    it('should validate correct document types', () => {
      VALID_TYPES.forEach((type) => {
        expect(isValidDocumentType(type)).toBe(true);
      });
    });

    it('should reject invalid types', () => {
      expect(isValidDocumentType('DOCUMENT')).toBe(false);
      expect(isValidDocumentType('drawing')).toBe(false);
    });
  });

  describe('Discipline Code Mapping', () => {
    const DISCIPLINE_CODES: Record<string, string> = {
      '01': 'Process',
      '02': 'Mechanical',
      '03': 'Piping',
      '04': 'Structural',
      '05': 'Electrical',
      '06': 'Instrumentation',
      '07': 'Civil',
      '08': 'HVAC',
      '09': 'Fire & Safety',
      '10': 'Project Management',
    };

    const getDisciplineName = (code: string): string | null => {
      return DISCIPLINE_CODES[code] || null;
    };

    it('should return correct discipline names', () => {
      expect(getDisciplineName('01')).toBe('Process');
      expect(getDisciplineName('02')).toBe('Mechanical');
      expect(getDisciplineName('05')).toBe('Electrical');
    });

    it('should return null for invalid codes', () => {
      expect(getDisciplineName('00')).toBeNull();
      expect(getDisciplineName('99')).toBeNull();
      expect(getDisciplineName('')).toBeNull();
    });
  });
});

// ============================================================================
// CRS Service Tests (Comment Resolution Summary)
// ============================================================================

describe('CRS Service', () => {
  describe('CRS Number Generation', () => {
    const formatCRSNumber = (projectCode: string, sequence: number): string => {
      return `${projectCode}-CRS-${sequence.toString().padStart(3, '0')}`;
    };

    it('should format CRS numbers correctly', () => {
      expect(formatCRSNumber('PRJ-001', 1)).toBe('PRJ-001-CRS-001');
      expect(formatCRSNumber('PRJ-001', 10)).toBe('PRJ-001-CRS-010');
      expect(formatCRSNumber('PRJ-001', 100)).toBe('PRJ-001-CRS-100');
    });
  });

  describe('CRS Status Validation', () => {
    const VALID_STATUSES = ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'] as const;
    type CRSStatus = (typeof VALID_STATUSES)[number];

    const isValidCRSStatus = (status: string): status is CRSStatus => {
      return VALID_STATUSES.includes(status as CRSStatus);
    };

    it('should validate correct CRS statuses', () => {
      VALID_STATUSES.forEach((status) => {
        expect(isValidCRSStatus(status)).toBe(true);
      });
    });

    it('should reject invalid statuses', () => {
      expect(isValidCRSStatus('APPROVED')).toBe(false);
      expect(isValidCRSStatus('draft')).toBe(false);
    });
  });
});
