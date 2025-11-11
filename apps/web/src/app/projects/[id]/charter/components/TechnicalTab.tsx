'use client';

import { useState } from 'react';

import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import type { Project, ProjectType, ProjectTechnicalSpecs, ThermalDesalSpecs } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

interface TechnicalTabProps {
  project: Project;
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

  const getProjectTypeLabel = (type: ProjectType): string => {
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
              <>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                    Thermal Desalination Specifications
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth required>
                    <InputLabel>Technology</InputLabel>
                    <Select
                      value={desalTechnology}
                      label="Technology"
                      onChange={(e) =>
                        setDesalTechnology(e.target.value as ThermalDesalSpecs['technology'])
                      }
                    >
                      <MenuItem value="MSF">MSF (Multi-Stage Flash)</MenuItem>
                      <MenuItem value="MED">MED (Multi-Effect Distillation)</MenuItem>
                      <MenuItem value="RO">RO (Reverse Osmosis)</MenuItem>
                      <MenuItem value="HYBRID">Hybrid</MenuItem>
                      <MenuItem value="OTHER">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Capacity"
                    type="number"
                    value={capacityValue}
                    onChange={(e) => setCapacityValue(e.target.value)}
                    required
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControl fullWidth required>
                    <InputLabel>Unit</InputLabel>
                    <Select
                      value={capacityUnit}
                      label="Unit"
                      onChange={(e) =>
                        setCapacityUnit(e.target.value as 'M3_PER_DAY' | 'GALLONS_PER_DAY')
                      }
                    >
                      <MenuItem value="M3_PER_DAY">m³/day</MenuItem>
                      <MenuItem value="GALLONS_PER_DAY">gallons/day</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Feed Water Source"
                    value={feedWaterSource}
                    onChange={(e) => setFeedWaterSource(e.target.value)}
                    placeholder="e.g., Seawater, Brackish water"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Energy Source"
                    value={energySource}
                    onChange={(e) => setEnergySource(e.target.value)}
                    placeholder="e.g., Solar, Natural gas, Grid electricity"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Min Operating Temp"
                    type="number"
                    value={minTemp}
                    onChange={(e) => setMinTemp(e.target.value)}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Max Operating Temp"
                    type="number"
                    value={maxTemp}
                    onChange={(e) => setMaxTemp(e.target.value)}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Temp Unit</InputLabel>
                    <Select
                      value={tempUnit}
                      label="Temp Unit"
                      onChange={(e) => setTempUnit(e.target.value as 'CELSIUS' | 'FAHRENHEIT')}
                    >
                      <MenuItem value="CELSIUS">°C</MenuItem>
                      <MenuItem value="FAHRENHEIT">°F</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Compliance Standards"
                    value={complianceStandards}
                    onChange={(e) => setComplianceStandards(e.target.value)}
                    placeholder="Comma-separated list (e.g., ISO 9001, WHO Guidelines)"
                    helperText="Enter standards separated by commas"
                  />
                </Grid>
              </>
            )}

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                General Specifications
              </Typography>
            </Grid>

            {/* General Fields */}
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Tools Required"
                value={toolsRequired}
                onChange={(e) => setToolsRequired(e.target.value)}
                placeholder="Comma-separated list"
                helperText="e.g., Welding machine, Lathe, CNC"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Equipment Required"
                value={equipmentRequired}
                onChange={(e) => setEquipmentRequired(e.target.value)}
                placeholder="Comma-separated list"
                helperText="e.g., Crane, Forklift, Compressor"
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Facilities Required"
                value={facilitiesRequired}
                onChange={(e) => setFacilitiesRequired(e.target.value)}
                placeholder="Comma-separated list"
                helperText="e.g., Workshop, Storage, Lab"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Technical Requirements"
                value={technicalRequirements}
                onChange={(e) => setTechnicalRequirements(e.target.value)}
                multiline
                rows={3}
                placeholder="Detailed technical requirements for this project"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Quality Standards"
                value={qualityStandards}
                onChange={(e) => setQualityStandards(e.target.value)}
                placeholder="Comma-separated list (e.g., ISO 9001, AS9100)"
                helperText="Enter quality standards separated by commas"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Safety Requirements"
                value={safetyRequirements}
                onChange={(e) => setSafetyRequirements(e.target.value)}
                multiline
                rows={2}
                placeholder="Safety protocols and requirements"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Environmental Considerations"
                value={environmentalConsiderations}
                onChange={(e) => setEnvironmentalConsiderations(e.target.value)}
                multiline
                rows={2}
                placeholder="Environmental impact and mitigation measures"
              />
            </Grid>

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
                <>
                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                      Thermal Desalination Specifications
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Technology
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {project.technicalSpecs.thermalDesalSpecs.technology}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Capacity
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {project.technicalSpecs.thermalDesalSpecs.capacity.value}{' '}
                      {project.technicalSpecs.thermalDesalSpecs.capacity.unit === 'M3_PER_DAY'
                        ? 'm³/day'
                        : 'gallons/day'}
                    </Typography>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Feed Water Source
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {project.technicalSpecs.thermalDesalSpecs.feedWaterSource || 'Not specified'}
                    </Typography>
                  </Grid>

                  {project.technicalSpecs.thermalDesalSpecs.energySource && (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Energy Source
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {project.technicalSpecs.thermalDesalSpecs.energySource}
                      </Typography>
                    </Grid>
                  )}

                  {project.technicalSpecs.thermalDesalSpecs.operatingTemperature && (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Operating Temperature
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {project.technicalSpecs.thermalDesalSpecs.operatingTemperature.min}°{' '}
                        {project.technicalSpecs.thermalDesalSpecs.operatingTemperature.unit ===
                        'CELSIUS'
                          ? 'C'
                          : 'F'}{' '}
                        to {project.technicalSpecs.thermalDesalSpecs.operatingTemperature.max}°{' '}
                        {project.technicalSpecs.thermalDesalSpecs.operatingTemperature.unit ===
                        'CELSIUS'
                          ? 'C'
                          : 'F'}
                      </Typography>
                    </Grid>
                  )}

                  {project.technicalSpecs.thermalDesalSpecs.complianceStandards &&
                    project.technicalSpecs.thermalDesalSpecs.complianceStandards.length > 0 && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Compliance Standards
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {project.technicalSpecs.thermalDesalSpecs.complianceStandards.map(
                            (standard, idx) => (
                              <Chip key={idx} label={standard} size="small" />
                            )
                          )}
                        </Box>
                      </Grid>
                    )}
                </>
              )}

            {/* General Specifications View */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                General Specifications
              </Typography>
            </Grid>

            {project.technicalSpecs?.toolsRequired &&
              project.technicalSpecs.toolsRequired.length > 0 && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Tools Required
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {project.technicalSpecs.toolsRequired.map((tool, idx) => (
                      <Chip key={idx} label={tool} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              )}

            {project.technicalSpecs?.equipmentRequired &&
              project.technicalSpecs.equipmentRequired.length > 0 && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Equipment Required
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {project.technicalSpecs.equipmentRequired.map((equipment, idx) => (
                      <Chip key={idx} label={equipment} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              )}

            {project.technicalSpecs?.facilitiesRequired &&
              project.technicalSpecs.facilitiesRequired.length > 0 && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Facilities Required
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {project.technicalSpecs.facilitiesRequired.map((facility, idx) => (
                      <Chip key={idx} label={facility} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Grid>
              )}

            {project.technicalSpecs?.technicalRequirements && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary">
                  Technical Requirements
                </Typography>
                <Typography variant="body1">
                  {project.technicalSpecs.technicalRequirements}
                </Typography>
              </Grid>
            )}

            {project.technicalSpecs?.qualityStandards &&
              project.technicalSpecs.qualityStandards.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Quality Standards
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {project.technicalSpecs.qualityStandards.map((standard, idx) => (
                      <Chip key={idx} label={standard} size="small" color="primary" />
                    ))}
                  </Box>
                </Grid>
              )}

            {project.technicalSpecs?.safetyRequirements && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary">
                  Safety Requirements
                </Typography>
                <Typography variant="body1">{project.technicalSpecs.safetyRequirements}</Typography>
              </Grid>
            )}

            {project.technicalSpecs?.environmentalConsiderations && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary">
                  Environmental Considerations
                </Typography>
                <Typography variant="body1">
                  {project.technicalSpecs.environmentalConsiderations}
                </Typography>
              </Grid>
            )}

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
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tools
              </Typography>
              <Typography variant="h3">
                {project.technicalSpecs?.toolsRequired?.length || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tools required
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Equipment
              </Typography>
              <Typography variant="h3">
                {project.technicalSpecs?.equipmentRequired?.length || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Equipment required
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Facilities
              </Typography>
              <Typography variant="h3">
                {project.technicalSpecs?.facilitiesRequired?.length || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Facilities required
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
