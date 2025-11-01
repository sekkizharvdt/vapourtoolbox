'use client';

import { useState, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress, Chip } from '@mui/material';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project } from '@vapour/types';

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  onlyActive?: boolean;
}

/**
 * Autocomplete selector for Projects
 * Features:
 * - Searchable by code and name
 * - Shows project status
 * - Can filter to active projects only
 */
export function ProjectSelector({
  value,
  onChange,
  label = 'Project / Cost Centre',
  required = false,
  disabled = false,
  error = false,
  helperText,
  onlyActive = true,
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Load projects from Firestore
  useEffect(() => {
    const { db } = getFirebase();
    const projectsRef = collection(db, COLLECTIONS.PROJECTS);

    // Build query
    let q = query(projectsRef, orderBy('name', 'asc'));
    if (onlyActive) {
      q = query(projectsRef, where('isActive', '==', true), orderBy('name', 'asc'));
    }

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData: Project[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        projectsData.push({
          id: doc.id,
          code: data.code,
          name: data.name,
          description: data.description,
          status: data.status || 'PLANNING',
          priority: data.priority || 'MEDIUM',
          client: data.client || {
            entityId: data.clientEntityId || '',
            entityName: data.clientEntity || '',
            contactPerson: '',
            contactEmail: '',
            contactPhone: '',
          },
          projectManager: data.projectManager || {
            userId: '',
            userName: '',
          },
          team: data.team || [],
          dates: data.dates || {
            startDate: data.startDate,
            endDate: data.endDate,
          },
          budget: data.budget,
          tags: data.tags || [],
          category: data.category,
          location: data.location,
          ownerId: data.ownerId || data.createdBy || '',
          visibility: data.visibility || 'team',
          lastActivityAt: data.lastActivityAt,
          lastActivityBy: data.lastActivityBy,
          progress: data.progress,
          isActive: data.isActive ?? true,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy || '',
          updatedAt: data.updatedAt?.toDate() || new Date(),
          updatedBy: data.updatedBy,
        } as Project);
      });

      setProjects(projectsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [onlyActive]);

  // Update selected project when value changes
  useEffect(() => {
    if (value) {
      const project = projects.find((proj) => proj.id === value);
      setSelectedProject(project || null);
    } else {
      setSelectedProject(null);
    }
  }, [value, projects]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'ON_HOLD':
        return 'warning';
      case 'COMPLETED':
        return 'info';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Autocomplete
      value={selectedProject}
      onChange={(_, newValue) => {
        onChange(newValue?.id || null);
      }}
      options={projects}
      getOptionLabel={(option) => `${option.code} - ${option.name}`}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <div style={{ width: '100%' }}>
            <div>
              <strong>{option.code}</strong> - {option.name}
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
              <Chip
                label={option.status}
                size="small"
                color={getStatusColor(option.status) as any}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </div>
          </div>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      loading={loading}
      disabled={disabled}
      isOptionEqualToValue={(option, value) => option.id === value.id}
    />
  );
}
