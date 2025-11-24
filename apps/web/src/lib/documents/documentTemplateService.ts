/**
 * Document Template Service
 *
 * Manages document templates (Word, Excel, AutoCAD, etc.)
 * for users to download and use
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type {
  DocumentTemplate,
  TemplateCategory,
  TemplateApplicability,
} from '@vapour/types';

/**
 * Create a new document template
 */
export async function createDocumentTemplate(
  data: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Timestamp.now();

  const templateData: Omit<DocumentTemplate, 'id'> = {
    ...data,
    downloadCount: 0,
    isActive: true,
    isLatest: true,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, 'documentTemplates'), templateData);

  return docRef.id;
}

/**
 * Get template by ID
 */
export async function getTemplateById(
  templateId: string
): Promise<DocumentTemplate | null> {
  const docRef = doc(db, 'documentTemplates', templateId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as DocumentTemplate;
}

/**
 * Get all templates with filters
 */
export async function getTemplates(filters?: {
  category?: TemplateCategory;
  applicability?: TemplateApplicability;
  projectId?: string;
  disciplineCodes?: string[];
  isActive?: boolean;
  onlyLatest?: boolean;
}): Promise<DocumentTemplate[]> {
  const constraints: QueryConstraint[] = [];

  if (filters?.category) {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters?.applicability) {
    constraints.push(where('applicability', '==', filters.applicability));
  }
  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }
  if (filters?.isActive !== undefined) {
    constraints.push(where('isActive', '==', filters.isActive));
  }
  if (filters?.onlyLatest !== undefined) {
    constraints.push(where('isLatest', '==', filters.onlyLatest));
  }
  if (filters?.isActive === undefined) {
    // By default, show only active templates
    constraints.push(where('isActive', '==', true));
  }

  constraints.push(where('isDeleted', '==', false));
  constraints.push(orderBy('templateName', 'asc'));

  const q = query(collection(db, 'documentTemplates'), ...constraints);

  const querySnapshot = await getDocs(q);

  let templates = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as DocumentTemplate[];

  // Filter by discipline codes if provided (array field)
  if (filters?.disciplineCodes && filters.disciplineCodes.length > 0) {
    templates = templates.filter((t) =>
      t.disciplineCodes?.some((dc) => filters.disciplineCodes!.includes(dc))
    );
  }

  return templates;
}

/**
 * Get templates for a project
 */
export async function getTemplatesForProject(
  projectId: string
): Promise<DocumentTemplate[]> {
  // Get company-wide and project-specific templates
  const companyWide = await getTemplates({
    applicability: 'COMPANY_WIDE',
    onlyLatest: true,
  });

  const projectSpecific = await getTemplates({
    applicability: 'PROJECT_SPECIFIC',
    projectId,
    onlyLatest: true,
  });

  return [...companyWide, ...projectSpecific];
}

/**
 * Get templates for a discipline
 */
export async function getTemplatesForDiscipline(
  disciplineCode: string,
  projectId?: string
): Promise<DocumentTemplate[]> {
  const allTemplates = projectId
    ? await getTemplatesForProject(projectId)
    : await getTemplates({ onlyLatest: true });

  return allTemplates.filter(
    (t) =>
      t.applicability === 'COMPANY_WIDE' ||
      (t.disciplineCodes && t.disciplineCodes.includes(disciplineCode))
  );
}

/**
 * Update template
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<DocumentTemplate, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'documentTemplates', templateId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Track template download
 */
export async function trackTemplateDownload(
  templateId: string,
  downloadedBy: string
): Promise<void> {
  const template = await getTemplateById(templateId);

  if (!template) {
    throw new Error('Template not found');
  }

  await updateTemplate(templateId, {
    downloadCount: template.downloadCount + 1,
    lastDownloadedAt: Timestamp.now(),
    lastDownloadedBy: downloadedBy,
  });
}

/**
 * Deactivate template
 */
export async function deactivateTemplate(templateId: string): Promise<void> {
  await updateTemplate(templateId, {
    isActive: false,
  });
}

/**
 * Activate template
 */
export async function activateTemplate(templateId: string): Promise<void> {
  await updateTemplate(templateId, {
    isActive: true,
  });
}

/**
 * Soft delete template
 */
export async function deleteTemplate(
  templateId: string,
  deletedBy: string
): Promise<void> {
  await updateTemplate(templateId, {
    isDeleted: true,
    deletedBy,
    deletedAt: Timestamp.now(),
  });
}

/**
 * Create new version of template
 */
export async function createTemplateVersion(
  previousTemplateId: string,
  newFileData: {
    fileName: string;
    fileUrl: string;
    storageRef: string;
    fileSize: number;
    mimeType: string;
    fileExtension: string;
  },
  newVersion: string,
  revisionNotes: string,
  createdBy: string,
  createdByName: string
): Promise<string> {
  const previousTemplate = await getTemplateById(previousTemplateId);

  if (!previousTemplate) {
    throw new Error('Previous template not found');
  }

  // Mark previous version as not latest
  await updateTemplate(previousTemplateId, {
    isLatest: false,
  });

  // Create new version
  const newTemplate: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
    ...previousTemplate,
    ...newFileData,
    version: newVersion,
    isLatest: true,
    revisionHistory: [
      ...(previousTemplate.revisionHistory || []),
      {
        version: previousTemplate.version,
        revisionNotes,
        revisedBy: createdBy,
        revisedByName: createdByName,
        revisedAt: Timestamp.now(),
        previousFileUrl: previousTemplate.fileUrl,
      },
    ],
    createdBy,
    createdByName,
    downloadCount: 0,
  };

  return await createDocumentTemplate(newTemplate);
}

/**
 * Get template statistics
 */
export async function getTemplateStatistics(): Promise<{
  total: number;
  byCategory: Record<TemplateCategory, number>;
  byApplicability: Record<TemplateApplicability, number>;
  totalDownloads: number;
  mostDownloaded: DocumentTemplate[];
}> {
  const templates = await getTemplates({ onlyLatest: true });

  const byCategory: Record<string, number> = {};
  const byApplicability: Record<string, number> = {};
  let totalDownloads = 0;

  templates.forEach((template) => {
    byCategory[template.category] = (byCategory[template.category] || 0) + 1;
    byApplicability[template.applicability] =
      (byApplicability[template.applicability] || 0) + 1;
    totalDownloads += template.downloadCount;
  });

  const mostDownloaded = templates
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, 10);

  return {
    total: templates.length,
    byCategory: byCategory as Record<TemplateCategory, number>,
    byApplicability: byApplicability as Record<TemplateApplicability, number>,
    totalDownloads,
    mostDownloaded,
  };
}
