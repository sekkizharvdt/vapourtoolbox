/**
 * Project Service
 *
 * Provides utility functions for fetching and managing projects.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  documentId,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { canManageProjects } from '@vapour/constants';
import { createLogger } from '@vapour/logger';
import type { Project, User } from '@vapour/types';

const logger = createLogger({ context: 'projectService' });

/**
 * Get all projects accessible by the current user
 */
export async function getProjects(): Promise<Project[]> {
  const { db } = getFirebase();

  try {
    const q = query(collection(db, COLLECTIONS.PROJECTS), orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    const projects: Project[] = [];

    snapshot.forEach((doc) => {
      projects.push({
        id: doc.id,
        ...doc.data(),
      } as Project);
    });

    return projects;
  } catch (error) {
    logger.error('getProjects failed', { error });
    return [];
  }
}

/**
 * Get projects with a specific status
 */
export async function getProjectsByStatus(status: string): Promise<Project[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const projects: Project[] = [];

    snapshot.forEach((doc) => {
      projects.push({
        id: doc.id,
        ...doc.data(),
      } as Project);
    });

    return projects;
  } catch (error) {
    logger.error('getProjectsByStatus failed', { status, error });
    return [];
  }
}

/**
 * Get active projects (not completed or cancelled)
 */
export async function getActiveProjects(): Promise<Project[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('status', 'in', ['PLANNING', 'IN_PROGRESS', 'ON_HOLD']),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const projects: Project[] = [];

    snapshot.forEach((doc) => {
      projects.push({
        id: doc.id,
        ...doc.data(),
      } as Project);
    });

    return projects;
  } catch (error) {
    logger.error('getActiveProjects failed', { error });
    return [];
  }
}

/**
 * PE-6: Get projects scoped to user access.
 * Users with MANAGE_PROJECTS see all projects.
 * Others see only projects in their assignedProjects array.
 */
export async function getProjectsForUser(userId: string, permissions: number): Promise<Project[]> {
  // Users with MANAGE_PROJECTS permission see all projects
  if (canManageProjects(permissions)) {
    return getProjects();
  }

  const { db } = getFirebase();

  try {
    // Read user doc to get assignedProjects
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    if (!userDoc.exists()) {
      logger.warn('User document not found for project access check', { userId });
      return [];
    }

    const userData = userDoc.data() as User;
    const assignedProjectIds = userData.assignedProjects || [];

    if (assignedProjectIds.length === 0) {
      return [];
    }

    // Firestore 'in' queries support max 30 items; chunk if needed
    const projects: Project[] = [];
    const chunks: string[][] = [];
    for (let i = 0; i < assignedProjectIds.length; i += 30) {
      chunks.push(assignedProjectIds.slice(i, i + 30));
    }

    for (const chunk of chunks) {
      const q = query(
        collection(db, COLLECTIONS.PROJECTS),
        where(documentId(), 'in', chunk),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => {
        projects.push({ id: d.id, ...d.data() } as Project);
      });
    }

    // Sort by createdAt desc (chunks may interleave)
    projects.sort((a, b) => {
      const aTime = a.createdAt?.seconds ?? 0;
      const bTime = b.createdAt?.seconds ?? 0;
      return bTime - aTime;
    });

    return projects;
  } catch (error) {
    logger.error('getProjectsForUser failed', { userId, error });
    return [];
  }
}
