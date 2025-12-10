'use client';

/**
 * Materials Section
 */

import { Box, Typography, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export function MaterialsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Materials module helps you manage your inventory, track stock levels, and coordinate
        material requirements across projects.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Key Capabilities
      </Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Material Catalog"
            secondary="Maintain a centralized catalog of all materials with specifications, units, and pricing."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Stock Tracking"
            secondary="Monitor stock levels across locations. Receive alerts for low stock items."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Project Allocation"
            secondary="Allocate materials to specific projects and track consumption."
          />
        </ListItem>
      </List>
    </Box>
  );
}
