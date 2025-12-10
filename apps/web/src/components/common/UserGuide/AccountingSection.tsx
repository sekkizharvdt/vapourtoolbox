'use client';

/**
 * Accounting Section
 */

import { Box, Typography, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export function AccountingSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Accounting module manages financial transactions, invoices, and cost tracking for your
        projects.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Features
      </Typography>

      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Invoice Management"
            secondary="Create and track invoices. Monitor payment status and aging."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Cost Centers"
            secondary="Organize expenses by cost centers for better financial visibility."
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Budget Tracking"
            secondary="Set project budgets and track actual vs. planned spending."
          />
        </ListItem>
      </List>
    </Box>
  );
}
