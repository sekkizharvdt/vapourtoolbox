'use client';

/**
 * Documents Section
 */

import { Box, Typography, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export function DocumentsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Documents module provides centralized document management with version control,
        approvals, and transmittals.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Document Features
      </Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Version Control"
            secondary="Track document revisions automatically. Each upload creates a new revision (R0, R1, R2...)."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Approval Workflows"
            secondary="Route documents through review and approval processes with clear audit trails."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Transmittals"
            secondary="Create formal document transmittals for external parties with acknowledgment tracking."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Comments & Annotations"
            secondary="Add comments to documents for review feedback. Comments can be resolved when addressed."
          />
        </ListItem>
      </List>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Uploading Documents
      </Typography>
      <Typography variant="body2" paragraph>
        Drag and drop files or click to browse. You can upload multiple files at once. Supported
        formats include PDF, Word, Excel, images, and CAD files.
      </Typography>
    </Box>
  );
}
