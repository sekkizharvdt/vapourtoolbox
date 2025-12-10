'use client';

/**
 * Tips Section
 */

import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

export function TipsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Here are some tips to help you work more efficiently with Vapour Toolbox.
      </Typography>

      <List>
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Use the Command Palette for Everything"
            secondary="Press ⌘K to quickly search for pages, create new items, or perform actions without navigating through menus."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Check Your Dashboard Daily"
            secondary="The 'Today's Focus' section shows tasks due today, pending approvals, and mentions requiring your attention."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Use Mentions for Quick Communication"
            secondary="@mention colleagues in tasks and documents to notify them directly. It's faster than email."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Collapse the Sidebar"
            secondary="When you need more screen space, collapse the sidebar. It will remember your preference."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Use Filters and Search"
            secondary="Every list view has filtering and search capabilities. Use them to find items quickly."
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemIcon>
            <LightbulbIcon color="warning" />
          </ListItemIcon>
          <ListItemText
            primary="Enable Browser Notifications"
            secondary="Allow notifications to stay informed about important updates even when you're on another tab."
          />
        </ListItem>
      </List>
    </Box>
  );
}
