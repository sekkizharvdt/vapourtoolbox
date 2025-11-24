/**
 * Document Numbering Service
 *
 * Manages document numbering configuration and generation
 * Supports hierarchical sub-code counters
 *
 * Formats:
 * - Without sub-code: {PROJECT_CODE}-{DISCIPLINE}-{SEQUENCE}
 *   Example: PRJ-001-01-005
 *
 * - With sub-code: {PROJECT_CODE}-{DISCIPLINE}-{SUBCODE}-{SEQUENCE}
 *   Example: PRJ-001-01-A-001
 *   Each sub-code has independent counter
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
 *
 * Formats:
 * - No sub-code:  PRJ-001-01-005 (uses "01" counter)
 * - With sub-code: PRJ-001-01-A-001 (uses "01-A" counter, independent from "01")
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

    // Determine counter key based on whether sub-code is provided
    // With sub-code: "01-A", "01-B" (separate counters)
    // Without sub-code: "01" (main discipline counter)
    const counterKey = subCode ? `${disciplineCode}-${subCode}` : disciplineCode;

    // Get current counter for this key
    const currentCounter = config.sequenceCounters[counterKey] || 0;
    const nextCounter = currentCounter + 1;

    // Generate sequence with leading zeros
    const sequence = nextCounter.toString().padStart(config.sequenceDigits, '0');

    // Build document number
    // Format: PROJECT-DISCIPLINE-[SUBCODE-]SEQUENCE
    let number = `${projectCode}${config.separator}${disciplineCode}`;

    if (subCode) {
      // With sub-code: PRJ-001-01-A-001
      number += `${config.separator}${subCode}${config.separator}${sequence}`;
    } else {
      // Without sub-code: PRJ-001-01-005
      number += `${config.separator}${sequence}`;
    }

    // Update counter for this specific key
    const updatedCounters = {
      ...config.sequenceCounters,
      [counterKey]: nextCounter,
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
 * Supports both formats:
 * - Without sub-code: PRJ-001-01-005
 * - With sub-code: PRJ-001-01-A-001
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

  // Escape separator for regex
  const escapedSep = separator.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const escapedProject = projectCode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // Pattern for:
  // Without sub-code: PRJ-001-01-005
  // With sub-code: PRJ-001-01-A-001
  const pattern = new RegExp(
    `^${escapedProject}${escapedSep}${disciplineCode}` +
      `(?:${escapedSep}[A-Za-z0-9]+)?` + // Optional sub-code
      `${escapedSep}\\d{${sequenceDigits}}$`
  );

  return pattern.test(documentNumber);
}

/**
 * Parse document number into components
 * Handles both formats:
 * - Without sub-code: PRJ-001-01-005 → { projectCode: "PRJ-001", disciplineCode: "01", sequence: "005" }
 * - With sub-code: PRJ-001-01-A-001 → { projectCode: "PRJ-001", disciplineCode: "01", subCode: "A", sequence: "001" }
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

  // Check if it has sub-code (4 parts) or not (3 parts)
  if (parts.length === 3) {
    // Format: PROJECT-DISCIPLINE-SEQUENCE
    return {
      projectCode: parts[0],
      disciplineCode: parts[1],
      sequence: parts[2],
    };
  } else if (parts.length === 4) {
    // Format: PROJECT-DISCIPLINE-SUBCODE-SEQUENCE
    return {
      projectCode: parts[0],
      disciplineCode: parts[1],
      subCode: parts[2],
      sequence: parts[3],
    };
  } else {
    // Invalid format
    return null;
  }
}

/**
 * Get next sequence number without committing
 * (for preview purposes)
 *
 * @param projectId Project ID
 * @param disciplineCode Discipline code (e.g., "01")
 * @param subCode Optional sub-code (e.g., "A") for hierarchical counter
 */
export async function getNextSequenceNumber(
  projectId: string,
  disciplineCode: string,
  subCode?: string
): Promise<number> {
  const config = await getNumberingConfig(projectId);

  if (!config) {
    throw new Error('Numbering config not initialized');
  }

  // Use hierarchical key if sub-code provided
  const counterKey = subCode ? `${disciplineCode}-${subCode}` : disciplineCode;
  const currentCounter = config.sequenceCounters[counterKey] || 0;
  return currentCounter + 1;
}

/**
 * Initialize counter for a sub-code
 * Call this when adding a new sub-code to a discipline
 */
export async function initializeSubCodeCounter(
  projectId: string,
  disciplineCode: string,
  subCode: string
): Promise<void> {
  const config = await getNumberingConfig(projectId);

  if (!config) {
    throw new Error('Numbering config not initialized');
  }

  const counterKey = `${disciplineCode}-${subCode}`;

  // Only initialize if counter doesn't exist
  if (config.sequenceCounters[counterKey] !== undefined) {
    return; // Counter already exists
  }

  const updatedCounters = {
    ...config.sequenceCounters,
    [counterKey]: 0,
  };

  const docRef = doc(db, 'projects', projectId, 'documentNumberingConfig', 'config');
  await updateDoc(docRef, {
    sequenceCounters: updatedCounters,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Batch initialize counters for multiple sub-codes
 */
export async function initializeSubCodeCounters(
  projectId: string,
  disciplineCode: string,
  subCodes: string[]
): Promise<void> {
  const config = await getNumberingConfig(projectId);

  if (!config) {
    throw new Error('Numbering config not initialized');
  }

  const updatedCounters = { ...config.sequenceCounters };

  // Initialize each sub-code counter if it doesn't exist
  for (const subCode of subCodes) {
    const counterKey = `${disciplineCode}-${subCode}`;
    if (updatedCounters[counterKey] === undefined) {
      updatedCounters[counterKey] = 0;
    }
  }

  const docRef = doc(db, 'projects', projectId, 'documentNumberingConfig', 'config');
  await updateDoc(docRef, {
    sequenceCounters: updatedCounters,
    updatedAt: Timestamp.now(),
  });
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
