/**
 * Document Numbering Service
 *
 * Manages document numbering configuration and generation
 * Format: {PROJECT_CODE}-{DISCIPLINE}-{SEQUENCE}
 * Example: PRJ-001-01-005
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { DocumentNumberingConfig, DisciplineCode } from '@vapour/types';

// ============================================================================
// NUMBERING CONFIGURATION
// ============================================================================

/**
 * Initialize document numbering for a project
 */
export async function initializeProjectNumbering(
  projectId: string,
  projectCode: string,
  createdBy: string
): Promise<void> {
  const config: Omit<DocumentNumberingConfig, 'id'> = {
    projectId,
    separator: '-', // Fixed as per user requirement
    sequenceDigits: 3, // Fixed: 001, 002, 003...
    disciplines: [],
    sequenceCounters: {},
    createdBy,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = doc(db, 'projects', projectId, 'documentNumberingConfig', 'config');
  await setDoc(docRef, config);
}

/**
 * Get numbering configuration for a project
 */
export async function getNumberingConfig(
  projectId: string
): Promise<DocumentNumberingConfig | null> {
  const docRef = doc(db, 'projects', projectId, 'documentNumberingConfig', 'config');
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as DocumentNumberingConfig;
}

// ============================================================================
// DISCIPLINE CODE MANAGEMENT
// ============================================================================

/**
 * Add a discipline code to project
 */
export async function addDisciplineCode(
  projectId: string,
  discipline: Omit<DisciplineCode, 'createdAt'>
): Promise<void> {
  const config = await getNumberingConfig(projectId);

  if (!config) {
    throw new Error('Numbering config not initialized');
  }

  // Check if code already exists
  if (config.disciplines.some((d) => d.code === discipline.code)) {
    throw new Error(`Discipline code ${discipline.code} already exists`);
  }

  const newDiscipline: DisciplineCode = {
    ...discipline,
    createdAt: Timestamp.now(),
  };

  const updatedDisciplines = [...config.disciplines, newDiscipline];

  // Initialize counter for this discipline
  const updatedCounters = {
    ...config.sequenceCounters,
    [discipline.code]: 0,
  };

  const docRef = doc(db, 'projects', projectId, 'documentNumberingConfig', 'config');
  await updateDoc(docRef, {
    disciplines: updatedDisciplines,
    sequenceCounters: updatedCounters,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Update a discipline code
 */
export async function updateDisciplineCode(
  projectId: string,
  code: string,
  updates: Partial<Omit<DisciplineCode, 'code' | 'createdAt'>>
): Promise<void> {
  const config = await getNumberingConfig(projectId);

  if (!config) {
    throw new Error('Numbering config not initialized');
  }

  const updatedDisciplines = config.disciplines.map((d) =>
    d.code === code ? { ...d, ...updates } : d
  );

  const docRef = doc(db, 'projects', projectId, 'documentNumberingConfig', 'config');
  await updateDoc(docRef, {
    disciplines: updatedDisciplines,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete/deactivate a discipline code
 */
export async function deactivateDisciplineCode(
  projectId: string,
  code: string
): Promise<void> {
  await updateDisciplineCode(projectId, code, { isActive: false });
}

/**
 * Get all active discipline codes for a project
 */
export async function getActiveDisciplineCodes(
  projectId: string
): Promise<DisciplineCode[]> {
  const config = await getNumberingConfig(projectId);

  if (!config) {
    return [];
  }

  return config.disciplines.filter((d) => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

// ============================================================================
// DOCUMENT NUMBER GENERATION
// ============================================================================

/**
 * Generate next document number for a discipline
 * Uses transaction to ensure atomic counter increment
 */
export async function generateDocumentNumber(
  projectId: string,
  projectCode: string,
  disciplineCode: string,
  subCode?: string
): Promise<string> {
  const docRef = doc(db, 'projects', projectId, 'documentNumberingConfig', 'config');

  const documentNumber = await runTransaction(db, async (transaction) => {
    const configDoc = await transaction.get(docRef);

    if (!configDoc.exists()) {
      throw new Error('Numbering config not initialized');
    }

    const config = configDoc.data() as Omit<DocumentNumberingConfig, 'id'>;

    // Get current counter
    const currentCounter = config.sequenceCounters[disciplineCode] || 0;
    const nextCounter = currentCounter + 1;

    // Generate sequence with leading zeros
    const sequence = nextCounter.toString().padStart(config.sequenceDigits, '0');

    // Build document number
    let number = `${projectCode}${config.separator}${disciplineCode}${config.separator}${sequence}`;

    // Add sub-code if provided (for "00" discipline)
    if (subCode) {
      number += `${config.separator}${subCode}`;
    }

    // Update counter
    const updatedCounters = {
      ...config.sequenceCounters,
      [disciplineCode]: nextCounter,
    };

    transaction.update(docRef, {
      sequenceCounters: updatedCounters,
      updatedAt: Timestamp.now(),
    });

    return number;
  });

  return documentNumber;
}

/**
 * Validate document number format
 */
export function validateDocumentNumber(
  documentNumber: string,
  expectedFormat: {
    projectCode: string;
    separator: string;
    disciplineCode: string;
    sequenceDigits: number;
  }
): boolean {
  const { projectCode, separator, disciplineCode, sequenceDigits } = expectedFormat;

  // Basic pattern: PRJ-001-01-005 or PRJ-001-00-003-A
  const pattern = new RegExp(
    `^${projectCode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}` +
      `${separator}${disciplineCode}` +
      `${separator}\\d{${sequenceDigits}}` +
      `(?:${separator}[A-Za-z0-9]+)?$`
  );

  return pattern.test(documentNumber);
}

/**
 * Parse document number into components
 */
export function parseDocumentNumber(
  documentNumber: string,
  separator: string = '-'
): {
  projectCode: string;
  disciplineCode: string;
  sequence: string;
  subCode?: string;
} | null {
  const parts = documentNumber.split(separator);

  if (parts.length < 3) {
    return null;
  }

  return {
    projectCode: parts[0],
    disciplineCode: parts[1],
    sequence: parts[2],
    subCode: parts.length > 3 ? parts[3] : undefined,
  };
}

/**
 * Get next sequence number without committing
 * (for preview purposes)
 */
export async function getNextSequenceNumber(
  projectId: string,
  disciplineCode: string
): Promise<number> {
  const config = await getNumberingConfig(projectId);

  if (!config) {
    throw new Error('Numbering config not initialized');
  }

  const currentCounter = config.sequenceCounters[disciplineCode] || 0;
  return currentCounter + 1;
}

// ============================================================================
// PRE-DEFINED DISCIPLINE CODES (OPTIONAL HELPERS)
// ============================================================================

/**
 * Standard discipline codes template
 * User can customize these when setting up a project
 */
export const STANDARD_DISCIPLINE_CODES: Omit<DisciplineCode, 'createdBy' | 'createdAt'>[] = [
  {
    code: '00',
    name: 'Client Inputs',
    description: 'Documents received from client',
    isActive: true,
    sortOrder: 0,
    subCodes: [
      { subCode: 'A', name: 'Process Data', description: '', isActive: true },
      { subCode: 'B', name: 'Equipment List', description: '', isActive: true },
      { subCode: 'C', name: 'Site Information', description: '', isActive: true },
    ],
  },
  {
    code: '01',
    name: 'Process',
    description: 'Process engineering documents',
    isActive: true,
    sortOrder: 1,
  },
  {
    code: '02',
    name: 'Mechanical',
    description: 'Mechanical engineering documents',
    isActive: true,
    sortOrder: 2,
  },
  {
    code: '03',
    name: 'Structural',
    description: 'Structural engineering documents',
    isActive: true,
    sortOrder: 3,
  },
  {
    code: '04',
    name: 'Piping',
    description: 'Piping engineering documents',
    isActive: true,
    sortOrder: 4,
  },
  {
    code: '05',
    name: 'Electrical',
    description: 'Electrical engineering documents',
    isActive: true,
    sortOrder: 5,
  },
  {
    code: '06',
    name: 'Instrumentation',
    description: 'Instrumentation & control documents',
    isActive: true,
    sortOrder: 6,
  },
  {
    code: '07',
    name: 'Civil',
    description: 'Civil engineering documents',
    isActive: true,
    sortOrder: 7,
  },
  {
    code: '08',
    name: 'HVAC',
    description: 'HVAC engineering documents',
    isActive: true,
    sortOrder: 8,
  },
  {
    code: '09',
    name: 'Automation',
    description: 'Automation & control documents',
    isActive: true,
    sortOrder: 9,
  },
  {
    code: '10',
    name: 'Safety',
    description: 'Safety & fire protection documents',
    isActive: true,
    sortOrder: 10,
  },
];

/**
 * Initialize project with standard discipline codes
 */
export async function initializeWithStandardDisciplines(
  projectId: string,
  projectCode: string,
  selectedCodes: string[],
  createdBy: string
): Promise<void> {
  // Initialize numbering config
  await initializeProjectNumbering(projectId, projectCode, createdBy);

  // Add selected discipline codes
  const disciplinesToAdd = STANDARD_DISCIPLINE_CODES.filter((d) =>
    selectedCodes.includes(d.code)
  );

  for (const discipline of disciplinesToAdd) {
    await addDisciplineCode(projectId, {
      ...discipline,
      createdBy,
    });
  }
}
