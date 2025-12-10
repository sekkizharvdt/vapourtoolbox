'use client';

/**
 * User Guide Helper Components
 *
 * Reusable components for displaying guide content.
 */

import {
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TableRow,
  TableCell,
  Card,
  CardContent,
  Stack,
} from '@mui/material';

/**
 * Keyboard shortcut display
 */
export function KeyboardShortcut({ keys, description }: { keys: string; description: string }) {
  const keyParts = keys.split(' ').filter(Boolean);
  return (
    <TableRow>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          {keyParts.map((key, i) => (
            <Chip
              key={i}
              label={key}
              size="small"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                bgcolor: 'action.selected',
              }}
            />
          ))}
        </Stack>
      </TableCell>
      <TableCell>{description}</TableCell>
    </TableRow>
  );
}

/**
 * Feature card for highlighting key features
 */
export function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {icon}
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

/**
 * Step-by-step guide component
 */
export function StepGuide({ steps }: { steps: { title: string; description: string }[] }) {
  return (
    <List>
      {steps.map((step, index) => (
        <ListItem key={index} alignItems="flex-start">
          <ListItemIcon>
            <Chip
              label={index + 1}
              size="small"
              color="primary"
              sx={{ minWidth: 28, height: 28 }}
            />
          </ListItemIcon>
          <ListItemText
            primary={step.title}
            secondary={step.description}
            primaryTypographyProps={{ fontWeight: 500 }}
          />
        </ListItem>
      ))}
    </List>
  );
}
