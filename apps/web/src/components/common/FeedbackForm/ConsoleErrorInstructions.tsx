'use client';

/**
 * Console Error Instructions
 *
 * Expandable instructions showing users how to capture console errors.
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export function ConsoleErrorInstructions() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="info" fontSize="small" />
          <Typography variant="body2" fontWeight={500}>
            How to get console error messages
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label={expanded ? 'Collapse instructions' : 'Expand instructions'}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <List dense sx={{ mt: 1 }}>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Chip label="1" size="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Open Developer Tools"
              secondary={
                <>
                  <strong>Windows/Linux:</strong> Press F12 or Ctrl+Shift+I
                  <br />
                  <strong>Mac:</strong> Press ⌘+Option+I
                </>
              }
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Chip label="2" size="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary='Click the "Console" tab'
              secondary="Look for red error messages"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Chip label="3" size="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Right-click on the error message"
              secondary='Select "Copy" or "Copy message" and paste it below'
            />
          </ListItem>
        </List>
      </Collapse>
    </Paper>
  );
}
