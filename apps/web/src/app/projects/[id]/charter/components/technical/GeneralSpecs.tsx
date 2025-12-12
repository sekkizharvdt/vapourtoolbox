'use client';

import { Box, Typography, Grid, TextField, Chip, Divider } from '@mui/material';
import type { Project } from '@vapour/types';

interface GeneralSpecsViewProps {
  specs: Project['technicalSpecs'];
}

export function GeneralSpecsView({ specs }: GeneralSpecsViewProps) {
  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          General Specifications
        </Typography>
      </Grid>

      {specs?.toolsRequired && specs.toolsRequired.length > 0 && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Tools Required
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {specs.toolsRequired.map((tool, idx) => (
              <Chip key={idx} label={tool} size="small" variant="outlined" />
            ))}
          </Box>
        </Grid>
      )}

      {specs?.equipmentRequired && specs.equipmentRequired.length > 0 && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Equipment Required
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {specs.equipmentRequired.map((equipment, idx) => (
              <Chip key={idx} label={equipment} size="small" variant="outlined" />
            ))}
          </Box>
        </Grid>
      )}

      {specs?.facilitiesRequired && specs.facilitiesRequired.length > 0 && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Facilities Required
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {specs.facilitiesRequired.map((facility, idx) => (
              <Chip key={idx} label={facility} size="small" variant="outlined" />
            ))}
          </Box>
        </Grid>
      )}

      {specs?.technicalRequirements && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" color="text.secondary">
            Technical Requirements
          </Typography>
          <Typography variant="body1">{specs.technicalRequirements}</Typography>
        </Grid>
      )}

      {specs?.qualityStandards && specs.qualityStandards.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Quality Standards
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {specs.qualityStandards.map((standard, idx) => (
              <Chip key={idx} label={standard} size="small" color="primary" />
            ))}
          </Box>
        </Grid>
      )}

      {specs?.safetyRequirements && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" color="text.secondary">
            Safety Requirements
          </Typography>
          <Typography variant="body1">{specs.safetyRequirements}</Typography>
        </Grid>
      )}

      {specs?.environmentalConsiderations && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" color="text.secondary">
            Environmental Considerations
          </Typography>
          <Typography variant="body1">{specs.environmentalConsiderations}</Typography>
        </Grid>
      )}
    </>
  );
}

interface GeneralSpecsEditProps {
  toolsRequired: string;
  setToolsRequired: (value: string) => void;
  equipmentRequired: string;
  setEquipmentRequired: (value: string) => void;
  facilitiesRequired: string;
  setFacilitiesRequired: (value: string) => void;
  technicalRequirements: string;
  setTechnicalRequirements: (value: string) => void;
  qualityStandards: string;
  setQualityStandards: (value: string) => void;
  safetyRequirements: string;
  setSafetyRequirements: (value: string) => void;
  environmentalConsiderations: string;
  setEnvironmentalConsiderations: (value: string) => void;
}

export function GeneralSpecsEdit({
  toolsRequired,
  setToolsRequired,
  equipmentRequired,
  setEquipmentRequired,
  facilitiesRequired,
  setFacilitiesRequired,
  technicalRequirements,
  setTechnicalRequirements,
  qualityStandards,
  setQualityStandards,
  safetyRequirements,
  setSafetyRequirements,
  environmentalConsiderations,
  setEnvironmentalConsiderations,
}: GeneralSpecsEditProps) {
  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          General Specifications
        </Typography>
      </Grid>

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
    </>
  );
}
