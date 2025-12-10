'use client';

/**
 * Feedback Type Selector
 *
 * Toggle button group for selecting feedback type (bug, feature, general).
 */

import {
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Card,
  CardContent,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import FeedbackIcon from '@mui/icons-material/Feedback';
import type { FeedbackType, FeedbackTypeConfig } from './types';

interface FeedbackTypeSelectorProps {
  value: FeedbackType;
  onChange: (type: FeedbackType) => void;
}

export function getTypeConfig(type: FeedbackType): FeedbackTypeConfig {
  const configs: Record<FeedbackType, FeedbackTypeConfig> = {
    bug: {
      icon: <BugReportIcon />,
      label: 'Bug Report',
      color: 'error',
      description: 'Report an error or unexpected behavior',
    },
    feature: {
      icon: <LightbulbIcon />,
      label: 'Feature Request',
      color: 'warning',
      description: 'Suggest a new feature or improvement',
    },
    general: {
      icon: <FeedbackIcon />,
      label: 'General Feedback',
      color: 'info',
      description: 'Share your thoughts or suggestions',
    },
  };
  return configs[type];
}

export function FeedbackTypeSelector({ value, onChange }: FeedbackTypeSelectorProps) {
  const handleChange = (_: React.MouseEvent<HTMLElement>, newType: FeedbackType | null) => {
    if (newType) {
      onChange(newType);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          What would you like to share?
        </Typography>

        <ToggleButtonGroup value={value} exclusive onChange={handleChange} fullWidth sx={{ mb: 2 }}>
          {(['bug', 'feature', 'general'] as FeedbackType[]).map((type) => {
            const config = getTypeConfig(type);
            return (
              <ToggleButton
                key={type}
                value={type}
                sx={{
                  py: 2,
                  flexDirection: 'column',
                  gap: 0.5,
                  '&.Mui-selected': {
                    bgcolor: `${config.color}.light`,
                    color: `${config.color}.dark`,
                    '&:hover': {
                      bgcolor: `${config.color}.light`,
                    },
                  },
                }}
              >
                {config.icon}
                <Typography variant="body2" fontWeight={500}>
                  {config.label}
                </Typography>
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>

        <Alert severity={getTypeConfig(value).color} icon={false}>
          {getTypeConfig(value).description}
        </Alert>
      </CardContent>
    </Card>
  );
}
