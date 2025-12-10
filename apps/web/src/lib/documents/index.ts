/**
 * Documents Module
 *
 * Handles document management including document CRUD, numbering,
 * submissions, transmittals, comments, and work/supply lists.
 *
 * Note: Some services have overlapping exports. Import directly from
 * specific service files to avoid naming conflicts.
 */

// Core document services
export * from './documentService';
export * from './documentNumberingService';
export * from './documentTemplateService';
export * from './documentSubmissionService';
export * from './masterDocumentService';

// Submission workflow
export * from './submissionService';
export * from './transmittalService';

// Comments and resolution
export * from './commentResolutionService';
export * from './crsService';

// Linked documents
export * from './linkService';

// Work/Supply lists (services only, avoid duplicates with item services)
export * from './workListService';
export * from './supplyListService';

// Note: commentService, workItemService, supplyItemService excluded to avoid duplicate exports
// Import directly: import { createComment } from './commentService'
