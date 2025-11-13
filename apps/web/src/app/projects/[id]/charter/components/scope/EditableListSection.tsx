/**
 * Editable List Section Component
 *
 * Reusable component for displaying and editing a list of strings
 */

'use client';

import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { UseEditableListReturn } from './useEditableList';

interface EditableListSectionProps {
  title: string;
  placeholder: string;
  emptyMessage: string;
  hasManageAccess: boolean;
  loading: boolean;
  listHook: UseEditableListReturn;
  onSave: () => void;
}

export function EditableListSection({
  title,
  placeholder,
  emptyMessage,
  hasManageAccess,
  loading,
  listHook,
  onSave,
}: EditableListSectionProps) {
  const {
    items,
    newItem,
    editingIndex,
    editText,
    setNewItem,
    setEditText,
    handleAdd,
    handleEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleDelete,
  } = listHook;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {hasManageAccess && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={placeholder}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add
          </Button>
        </Box>
      )}

      {items.length === 0 ? (
        <Alert severity="info">{emptyMessage}</Alert>
      ) : (
        <List>
          {items.map((item, index) => (
            <ListItem key={index} divider>
              {editingIndex === index ? (
                <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                  />
                  <IconButton onClick={handleSaveEdit} color="primary">
                    <SaveIcon />
                  </IconButton>
                  <IconButton onClick={handleCancelEdit}>
                    <CancelIcon />
                  </IconButton>
                </Box>
              ) : (
                <>
                  <ListItemText primary={item} />
                  {hasManageAccess && (
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleEdit(index)} sx={{ mr: 1 }}>
                        <EditIcon />
                      </IconButton>
                      <IconButton edge="end" onClick={() => handleDelete(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </>
              )}
            </ListItem>
          ))}
        </List>
      )}

      {hasManageAccess && items.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={onSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      )}
    </Paper>
  );
}
