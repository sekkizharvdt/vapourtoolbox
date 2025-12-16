/**
 * Project Service
 *
 * Provides utility functions for fetching and managing projects.
 */

import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Project } from '@vapour/types';

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
