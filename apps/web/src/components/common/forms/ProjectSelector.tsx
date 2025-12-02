'use client';

import { useState, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress, Chip, Box, ListSubheader } from '@mui/material';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'ProjectSelector' });

/**
 * Unified type for dropdown options (projects and standalone cost centres)
 */
interface ProjectOrCostCentre {
  id: string;
  code: string;
  name: string;
  type: 'PROJECT' | 'COST_CENTRE';
  status: string;
  category?: string; // For cost centres: ADMINISTRATION, OVERHEAD
}

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string | null, projectName?: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  onlyActive?: boolean;
  /** Include standalone cost centres (ADMINISTRATION, OVERHEAD) in addition to projects */
  includeCostCentres?: boolean;
}

/**
 * Autocomplete selector for Projects and Cost Centres
 * Features:
 * - Searchable by code and name
 * - Shows project status or cost centre category
 * - Can filter to active items only
 * - Optionally includes standalone cost centres (ADMINISTRATION, OVERHEAD)
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
  includeCostCentres = true,
}: ProjectSelectorProps) {
  const [options, setOptions] = useState<ProjectOrCostCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<ProjectOrCostCentre | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load projects and cost centres from Firestore
  useEffect(() => {
    const { db } = getFirebase();
    const projectsRef = collection(db, COLLECTIONS.PROJECTS);
    const costCentresRef = collection(db, COLLECTIONS.COST_CENTRES);

    setLoadError(null);

    // Store data from both collections
    let projectsData: ProjectOrCostCentre[] = [];
    let costCentresData: ProjectOrCostCentre[] = [];
    let projectsLoaded = false;
    let costCentresLoaded = false;

    const updateOptions = () => {
      if (projectsLoaded && (costCentresLoaded || !includeCostCentres)) {
        // Combine and sort: cost centres first (Administration, Overhead), then projects
        const sortedOptions = [
          ...costCentresData.sort((a, b) => a.name.localeCompare(b.name)),
          ...projectsData.sort((a, b) => a.code.localeCompare(b.code)),
        ];
        setOptions(sortedOptions);
        setLoading(false);
      }
    };

    // Build projects query
    const projectsQuery = onlyActive
      ? query(projectsRef, where('isActive', '==', true), orderBy('name', 'asc'))
      : query(projectsRef, orderBy('name', 'asc'));

    // Subscribe to projects
    const unsubscribeProjects = onSnapshot(
      projectsQuery,
      (snapshot) => {
        try {
          projectsData = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            projectsData.push({
              id: doc.id,
              code: data.code || '',
              name: data.name || '',
              type: 'PROJECT',
              status: data.status || 'PLANNING',
            });
          });
          projectsLoaded = true;
          setLoadError(null);
          updateOptions();
        } catch (error) {
          console.error('[ProjectSelector] Error processing projects snapshot:', error);
          setLoadError('Failed to load projects. Please try again.');
          setLoading(false);
        }
      },
      (error) => {
        console.error('[ProjectSelector] Projects query error:', error);
        // Try fallback without index
        if (error.code === 'failed-precondition' || error.message.includes('index')) {
          logger.warn('Projects primary query failed, trying fallback', {
            reason: 'missing index',
          });
          const fallbackQuery = query(projectsRef, orderBy('name', 'asc'));
          onSnapshot(fallbackQuery, (snapshot) => {
            projectsData = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (onlyActive && !data.isActive) return;
              projectsData.push({
                id: doc.id,
                code: data.code || '',
                name: data.name || '',
                type: 'PROJECT',
                status: data.status || 'PLANNING',
              });
            });
            projectsLoaded = true;
            updateOptions();
          });
        } else {
          setLoadError('Failed to load projects. Please try again.');
          setLoading(false);
        }
      }
    );

    // Subscribe to standalone cost centres (only if includeCostCentres is true)
    let unsubscribeCostCentres: (() => void) | null = null;

    if (includeCostCentres) {
      // Query cost centres that are NOT linked to a project (standalone)
      const costCentresQuery = query(costCentresRef, orderBy('code', 'asc'));

      unsubscribeCostCentres = onSnapshot(
        costCentresQuery,
        (snapshot) => {
          try {
            costCentresData = [];
            snapshot.forEach((doc) => {
              const data = doc.data();

              // Only include cost centres that are:
              // 1. Active (if onlyActive is true)
              // 2. Standalone (no projectId) - these are ADMINISTRATION, OVERHEAD types
              if (onlyActive && !data.isActive) return;
              if (data.projectId) return; // Skip project-linked cost centres (already shown via projects)

              costCentresData.push({
                id: doc.id,
                code: data.code || '',
                name: data.name || '',
                type: 'COST_CENTRE',
                status: data.isActive ? 'ACTIVE' : 'INACTIVE',
                category: data.category || 'OVERHEAD',
              });
            });
            costCentresLoaded = true;
            setLoadError(null);
            updateOptions();
          } catch (error) {
            console.error('[ProjectSelector] Error processing cost centres snapshot:', error);
            // Don't fail entirely, just skip cost centres
            costCentresLoaded = true;
            updateOptions();
          }
        },
        (error) => {
          console.error('[ProjectSelector] Cost centres query error:', error);
          // Don't fail entirely, just skip cost centres
          costCentresLoaded = true;
          updateOptions();
        }
      );
    }

    // Cleanup function
    return () => {
      unsubscribeProjects();
      if (unsubscribeCostCentres) {
        unsubscribeCostCentres();
      }
    };
  }, [onlyActive, includeCostCentres]);

  // Update selected option when value changes
  useEffect(() => {
    if (value) {
      const option = options.find((opt) => opt.id === value);
      setSelectedOption(option || null);
    } else {
      setSelectedOption(null);
    }
  }, [value, options]);

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
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

  const getCategoryColor = (
    category?: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (category) {
      case 'ADMINISTRATION':
        return 'secondary';
      case 'OVERHEAD':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getCategoryLabel = (category?: string): string => {
    switch (category) {
      case 'ADMINISTRATION':
        return 'Admin';
      case 'OVERHEAD':
        return 'Overhead';
      default:
        return 'Cost Centre';
    }
  };

  return (
    <Autocomplete
      value={selectedOption}
      onChange={(_, newValue) => {
        onChange(newValue?.id || null, newValue?.name);
      }}
      options={options}
      groupBy={(option) => (option.type === 'COST_CENTRE' ? 'Cost Centres' : 'Projects')}
      getOptionLabel={(option) => `${option.code} - ${option.name}`}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Box sx={{ width: '100%' }}>
            <Box>
              <strong>{option.code}</strong> - {option.name}
            </Box>
            <Box sx={{ fontSize: '0.85rem', mt: 0.5 }}>
              {option.type === 'COST_CENTRE' ? (
                <Chip
                  label={getCategoryLabel(option.category)}
                  size="small"
                  color={getCategoryColor(option.category)}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              ) : (
                <Chip
                  label={option.status}
                  size="small"
                  color={getStatusColor(option.status)}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Box>
        </li>
      )}
      renderGroup={(params) => (
        <li key={params.key}>
          <ListSubheader
            component="div"
            sx={{
              bgcolor: 'background.paper',
              fontWeight: 'bold',
              color: 'text.secondary',
              lineHeight: '32px',
            }}
          >
            {params.group}
          </ListSubheader>
          <ul style={{ padding: 0 }}>{params.children}</ul>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error || !!loadError}
          helperText={loadError || helperText}
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
