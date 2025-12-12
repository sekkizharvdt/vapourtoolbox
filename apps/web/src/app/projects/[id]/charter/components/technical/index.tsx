'use client';

/**
 * Technical Tab Component
 *
 * Manages technical specifications for a project.
 * Split into subcomponents for better maintainability:
 * - ThermalDesalSpecs: Thermal desalination specific fields
 * - GeneralSpecs: General technical specifications
 * - SummaryCards: Summary statistics cards
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import type { Project, ProjectType, ProjectTechnicalSpecs, ThermalDesalSpecs } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

import { ThermalDesalSpecsView, ThermalDesalSpecsEdit } from './ThermalDesalSpecs';
import { GeneralSpecsView, GeneralSpecsEdit } from './GeneralSpecs';
import { SummaryCards } from './SummaryCards';

interface TechnicalTabProps {
  project: Project;
}

function getProjectTypeLabel(type: ProjectType): string {
  switch (type) {
    case 'THERMAL_DESALINATION':
      return 'Thermal Desalination';
    case 'MANUFACTURING':
      return 'Manufacturing';
    case 'CONSTRUCTION':
      return 'Construction';
    case 'OTHER':
      return 'Other';
    default:
      return type;
  }
}

export function TechnicalTab({ project }: TechnicalTabProps) {
  const { claims, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const userId = user?.uid || '';

  // Form state
  const [projectType, setProjectType] = useState<ProjectType>(
    project.technicalSpecs?.projectType || project.projectType || 'OTHER'
  );
  const [toolsRequired, setToolsRequired] = useState(
    project.technicalSpecs?.toolsRequired?.join(', ') || ''
  );
  const [equipmentRequired, setEquipmentRequired] = useState(
    project.technicalSpecs?.equipmentRequired?.join(', ') || ''
  );
  const [facilitiesRequired, setFacilitiesRequired] = useState(
    project.technicalSpecs?.facilitiesRequired?.join(', ') || ''
  );
  const [technicalRequirements, setTechnicalRequirements] = useState(
    project.technicalSpecs?.technicalRequirements || ''
  );
  const [qualityStandards, setQualityStandards] = useState(
    project.technicalSpecs?.qualityStandards?.join(', ') || ''
  );
  const [safetyRequirements, setSafetyRequirements] = useState(
    project.technicalSpecs?.safetyRequirements || ''
  );
  const [environmentalConsiderations, setEnvironmentalConsiderations] = useState(
    project.technicalSpecs?.environmentalConsiderations || ''
  );

  // Thermal Desal specific fields
  const [desalTechnology, setDesalTechnology] = useState<ThermalDesalSpecs['technology']>(
    project.technicalSpecs?.thermalDesalSpecs?.technology || 'RO'
  );
  const [capacityValue, setCapacityValue] = useState(
    project.technicalSpecs?.thermalDesalSpecs?.capacity?.value?.toString() || ''
  );
  const [capacityUnit, setCapacityUnit] = useState<'M3_PER_DAY' | 'GALLONS_PER_DAY'>(
    project.technicalSpecs?.thermalDesalSpecs?.capacity?.unit || 'M3_PER_DAY'
  );
  const [feedWaterSource, setFeedWaterSource] = useState(
    project.technicalSpecs?.thermalDesalSpecs?.feedWaterSource || ''
  );
  const [minTemp, setMinTemp] = useState(
    project.technicalSpecs?.thermalDesalSpecs?.operatingTemperature?.min?.toString() || ''
  );
  const [maxTemp, setMaxTemp] = useState(
    project.technicalSpecs?.thermalDesalSpecs?.operatingTemperature?.max?.toString() || ''
  );
  const [tempUnit, setTempUnit] = useState<'CELSIUS' | 'FAHRENHEIT'>(
    project.technicalSpecs?.thermalDesalSpecs?.operatingTemperature?.unit || 'CELSIUS'
  );
  const [energySource, setEnergySource] = useState(
    project.technicalSpecs?.thermalDesalSpecs?.energySource || ''
  );
  const [complianceStandards, setComplianceStandards] = useState(
    project.technicalSpecs?.thermalDesalSpecs?.complianceStandards?.join(', ') || ''
  );

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      // Build technical specs object
      const technicalSpecs: ProjectTechnicalSpecs = {
        projectType,
        toolsRequired: toolsRequired
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        equipmentRequired: equipmentRequired
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        facilitiesRequired: facilitiesRequired
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        technicalRequirements: technicalRequirements.trim() || undefined,
        qualityStandards: qualityStandards
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        safetyRequirements: safetyRequirements.trim() || undefined,
        environmentalConsiderations: environmentalConsiderations.trim() || undefined,
      };

      // Add type-specific specs
      if (projectType === 'THERMAL_DESALINATION') {
        if (!capacityValue || parseFloat(capacityValue) <= 0) {
          setError('Capacity is required for thermal desalination projects');
          setLoading(false);
          return;
        }

        technicalSpecs.thermalDesalSpecs = {
          technology: desalTechnology,
          capacity: {
            value: parseFloat(capacityValue),
            unit: capacityUnit,
          },
          feedWaterSource: feedWaterSource.trim(),
          energySource: energySource.trim(),
          complianceStandards: complianceStandards
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };

        if (minTemp && maxTemp) {
          technicalSpecs.thermalDesalSpecs.operatingTemperature = {
            min: parseFloat(minTemp),
            max: parseFloat(maxTemp),
            unit: tempUnit,
          };
        }
      }

      await updateDoc(projectRef, {
        projectType, // Update project-level projectType
        technicalSpecs,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      setEditMode(false);
    } catch (err) {
      console.error('[TechnicalTab] Error saving technical specs:', err);
      setError(err instanceof Error ? err.message : 'Failed to save technical specifications');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to project values
    setProjectType(project.technicalSpecs?.projectType || project.projectType || 'OTHER');
    setToolsRequired(project.technicalSpecs?.toolsRequired?.join(', ') || '');
    setEquipmentRequired(project.technicalSpecs?.equipmentRequired?.join(', ') || '');
    setFacilitiesRequired(project.technicalSpecs?.facilitiesRequired?.join(', ') || '');
    setTechnicalRequirements(project.technicalSpecs?.technicalRequirements || '');
    setQualityStandards(project.technicalSpecs?.qualityStandards?.join(', ') || '');
    setSafetyRequirements(project.technicalSpecs?.safetyRequirements || '');
    setEnvironmentalConsiderations(project.technicalSpecs?.environmentalConsiderations || '');
    setDesalTechnology(project.technicalSpecs?.thermalDesalSpecs?.technology || 'RO');
    setCapacityValue(project.technicalSpecs?.thermalDesalSpecs?.capacity?.value?.toString() || '');
    setCapacityUnit(project.technicalSpecs?.thermalDesalSpecs?.capacity?.unit || 'M3_PER_DAY');
    setFeedWaterSource(project.technicalSpecs?.thermalDesalSpecs?.feedWaterSource || '');
    setMinTemp(
      project.technicalSpecs?.thermalDesalSpecs?.operatingTemperature?.min?.toString() || ''
    );
    setMaxTemp(
      project.technicalSpecs?.thermalDesalSpecs?.operatingTemperature?.max?.toString() || ''
    );
    setTempUnit(project.technicalSpecs?.thermalDesalSpecs?.operatingTemperature?.unit || 'CELSIUS');
    setEnergySource(project.technicalSpecs?.thermalDesalSpecs?.energySource || '');
    setComplianceStandards(
      project.technicalSpecs?.thermalDesalSpecs?.complianceStandards?.join(', ') || ''
    );
    setEditMode(false);
    setError(null);
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Project Type Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Project Type & Specifications</Typography>
          {hasManageAccess && !editMode && (
            <Button size="small" startIcon={<EditIcon />} onClick={() => setEditMode(true)}>
              Edit
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {editMode ? (
          // Edit Mode
          <Grid container spacing={3}>
            {/* Project Type Selector */}
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth required>
                <InputLabel>Project Type</InputLabel>
                <Select
                  value={projectType}
                  label="Project Type"
                  onChange={(e) => setProjectType(e.target.value as ProjectType)}
                >
                  <MenuItem value="THERMAL_DESALINATION">Thermal Desalination</MenuItem>
                  <MenuItem value="MANUFACTURING">Manufacturing</MenuItem>
                  <MenuItem value="CONSTRUCTION">Construction</MenuItem>
                  <MenuItem value="OTHER">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Thermal Desalination Specific Fields */}
            {projectType === 'THERMAL_DESALINATION' && (
              <ThermalDesalSpecsEdit
                desalTechnology={desalTechnology}
                setDesalTechnology={setDesalTechnology}
                capacityValue={capacityValue}
                setCapacityValue={setCapacityValue}
                capacityUnit={capacityUnit}
                setCapacityUnit={setCapacityUnit}
                feedWaterSource={feedWaterSource}
                setFeedWaterSource={setFeedWaterSource}
                energySource={energySource}
                setEnergySource={setEnergySource}
                minTemp={minTemp}
                setMinTemp={setMinTemp}
                maxTemp={maxTemp}
                setMaxTemp={setMaxTemp}
                tempUnit={tempUnit}
                setTempUnit={setTempUnit}
                complianceStandards={complianceStandards}
                setComplianceStandards={setComplianceStandards}
              />
            )}

            {/* General Fields */}
            <GeneralSpecsEdit
              toolsRequired={toolsRequired}
              setToolsRequired={setToolsRequired}
              equipmentRequired={equipmentRequired}
              setEquipmentRequired={setEquipmentRequired}
              facilitiesRequired={facilitiesRequired}
              setFacilitiesRequired={setFacilitiesRequired}
              technicalRequirements={technicalRequirements}
              setTechnicalRequirements={setTechnicalRequirements}
              qualityStandards={qualityStandards}
              setQualityStandards={setQualityStandards}
              safetyRequirements={safetyRequirements}
              setSafetyRequirements={setSafetyRequirements}
              environmentalConsiderations={environmentalConsiderations}
              setEnvironmentalConsiderations={setEnvironmentalConsiderations}
            />

            {/* Action Buttons */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={handleCancel} disabled={loading}>
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        ) : (
          // View Mode
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary">
                Project Type
              </Typography>
              <Typography variant="h6" fontWeight="medium">
                {getProjectTypeLabel(projectType)}
              </Typography>
            </Grid>

            {/* Thermal Desalination View */}
            {projectType === 'THERMAL_DESALINATION' &&
              project.technicalSpecs?.thermalDesalSpecs && (
                <ThermalDesalSpecsView specs={project.technicalSpecs.thermalDesalSpecs} />
              )}

            {/* General Specifications View */}
            <GeneralSpecsView specs={project.technicalSpecs} />

            {!project.technicalSpecs && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="info">
                  Technical specifications are not set. Click &quot;Edit&quot; to add
                  specifications.
                </Alert>
              </Grid>
            )}
          </Grid>
        )}
      </Paper>

      {/* Summary Cards */}
      <SummaryCards specs={project.technicalSpecs} />
    </Box>
  );
}

// Re-export for backwards compatibility
export { TechnicalTab as default };
