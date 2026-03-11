'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProjects, canManageProjects } from '@vapour/constants';

interface UseProjectPageResult {
  project: Project | null;
  projectId: string | null;
  loading: boolean;
  error: string | null;
  hasViewAccess: boolean;
}

/**
 * Hook to load project data for sub-module pages
 * Handles static export pathname parsing and permission checks
 */
export function useProjectPage(pathSegment: string): UseProjectPageResult {
  const pathname = usePathname();
  const { user, claims } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewProjects(claims.permissions) : false;
  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const regex = new RegExp(`/projects/([^/]+)/${pathSegment}`);
      const match = pathname.match(regex);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setProjectId(extractedId);
      }
    }
  }, [pathname, pathSegment]);

  // Load project data
  useEffect(() => {
    // Don't clear loading until projectId is extracted from the URL
    if (!projectId) return;
    if (!hasViewAccess) {
      setLoading(false);
      return;
    }

    const loadProject = async () => {
      try {
        const { db } = getFirebase();
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          setError('Project not found');
          return;
        }

        const projectData = projectSnap.data();

        // Team membership check: only PM, active team members, or admins can access
        const uid = user?.uid;
        if (!hasManageAccess && uid) {
          const isPM = projectData.projectManager?.userId === uid;
          const isTeamMember = projectData.team?.some(
            (m: { userId: string; isActive: boolean }) => m.userId === uid && m.isActive
          );
          if (!isPM && !isTeamMember) {
            setError('You do not have access to this project');
            return;
          }
        }

        setProject({
          id: projectSnap.id,
          ...projectData,
          createdAt: projectData.createdAt?.toDate?.() || new Date(),
          updatedAt: projectData.updatedAt?.toDate?.() || new Date(),
          dates: {
            ...projectData.dates,
            startDate: projectData.dates?.startDate?.toDate?.() || new Date(),
            endDate: projectData.dates?.endDate?.toDate?.(),
            actualStartDate: projectData.dates?.actualStartDate?.toDate?.(),
            actualEndDate: projectData.dates?.actualEndDate?.toDate?.(),
          },
        } as Project);
      } catch (err) {
        console.error(`[ProjectPage:${pathSegment}] Error loading project:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, hasViewAccess, hasManageAccess, user?.uid, pathSegment]);

  return {
    project,
    projectId,
    loading,
    error,
    hasViewAccess,
  };
}
