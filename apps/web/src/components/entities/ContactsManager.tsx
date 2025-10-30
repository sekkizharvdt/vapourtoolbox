'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Paper,
  Chip,
  Grid,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

export interface EntityContactData {
  id: string;
  name: string;
  designation?: string;
  email: string;
  phone: string;
  mobile?: string;
  isPrimary: boolean;
  notes?: string;
}

interface ContactsManagerProps {
  contacts: EntityContactData[];
  onChange: (contacts: EntityContactData[]) => void;
  disabled?: boolean;
}

export function ContactsManager({ contacts, onChange, disabled = false }: ContactsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state for adding/editing
  const [formName, setFormName] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const resetForm = () => {
    setFormName('');
    setFormDesignation('');
    setFormEmail('');
    setFormPhone('');
    setFormMobile('');
    setFormNotes('');
  };

  const loadContactToForm = (contact: EntityContactData) => {
    setFormName(contact.name);
    setFormDesignation(contact.designation || '');
    setFormEmail(contact.email);
    setFormPhone(contact.phone);
    setFormMobile(contact.mobile || '');
    setFormNotes(contact.notes || '');
  };

  const handleAdd = () => {
    if (!formName.trim() || !formEmail.trim() || !formPhone.trim()) {
      return;
    }

    const newContact: EntityContactData = {
      id: `temp-${Date.now()}`,
      name: formName.trim(),
      designation: formDesignation.trim() || undefined,
      email: formEmail.trim().toLowerCase(),
      phone: formPhone.trim(),
      mobile: formMobile.trim() || undefined,
      isPrimary: contacts.length === 0, // First contact is primary by default
      notes: formNotes.trim() || undefined,
    };

    onChange([...contacts, newContact]);
    resetForm();
    setAdding(false);
  };

  const handleEdit = (contactId: string) => {
    if (!formName.trim() || !formEmail.trim() || !formPhone.trim()) {
      return;
    }

    const updatedContacts = contacts.map(contact => {
      if (contact.id === contactId) {
        return {
          ...contact,
          name: formName.trim(),
          designation: formDesignation.trim() || undefined,
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.trim(),
          mobile: formMobile.trim() || undefined,
          notes: formNotes.trim() || undefined,
        };
      }
      return contact;
    });

    onChange(updatedContacts);
    resetForm();
    setEditingId(null);
  };

  const handleDelete = (contactId: string) => {
    const contactToDelete = contacts.find(c => c.id === contactId);
    const updatedContacts = contacts.filter(c => c.id !== contactId);

    // If deleting primary contact, make the first remaining contact primary
    if (contactToDelete?.isPrimary && updatedContacts.length > 0 && updatedContacts[0]) {
      updatedContacts[0].isPrimary = true;
    }

    onChange(updatedContacts);
  };

  const handleSetPrimary = (contactId: string) => {
    const updatedContacts = contacts.map(contact => ({
      ...contact,
      isPrimary: contact.id === contactId,
    }));
    onChange(updatedContacts);
  };

  const startEdit = (contact: EntityContactData) => {
    loadContactToForm(contact);
    setEditingId(contact.id);
    setAdding(false);
  };

  const cancelEdit = () => {
    resetForm();
    setEditingId(null);
    setAdding(false);
  };

  const startAdd = () => {
    resetForm();
    setAdding(true);
    setEditingId(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" color="primary">
          Contact Persons ({contacts.length})
        </Typography>
        {!adding && !editingId && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={startAdd}
            disabled={disabled}
          >
            Add Contact
          </Button>
        )}
      </Box>

      {/* Existing Contacts List */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: adding ? 2 : 0 }}>
        {contacts.map((contact) => (
          <Paper
            key={contact.id}
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: contact.isPrimary ? 'action.hover' : 'background.paper',
            }}
          >
            {editingId === contact.id ? (
              // Edit Form
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      fullWidth
                      size="small"
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Designation"
                      value={formDesignation}
                      onChange={(e) => setFormDesignation(e.target.value)}
                      fullWidth
                      size="small"
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                      fullWidth
                      size="small"
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Phone"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      required
                      fullWidth
                      size="small"
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Mobile"
                      value={formMobile}
                      onChange={(e) => setFormMobile(e.target.value)}
                      fullWidth
                      size="small"
                      disabled={disabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Notes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      disabled={disabled}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    startIcon={<CloseIcon />}
                    onClick={cancelEdit}
                    disabled={disabled}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckIcon />}
                    onClick={() => handleEdit(contact.id)}
                    disabled={disabled || !formName || !formEmail || !formPhone}
                  >
                    Save
                  </Button>
                </Box>
              </Box>
            ) : (
              // Contact Display
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {contact.name}
                      </Typography>
                      {contact.isPrimary && (
                        <Chip label="Primary" size="small" color="primary" />
                      )}
                    </Box>
                    {contact.designation && (
                      <Typography variant="body2" color="text.secondary">
                        {contact.designation}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {!contact.isPrimary && (
                      <Tooltip title="Set as Primary">
                        <IconButton
                          size="small"
                          onClick={() => handleSetPrimary(contact.id)}
                          disabled={disabled}
                        >
                          <StarBorderIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {contact.isPrimary && (
                      <Tooltip title="Primary Contact">
                        <IconButton size="small" disabled>
                          <StarIcon fontSize="small" color="primary" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit Contact">
                      <IconButton
                        size="small"
                        onClick={() => startEdit(contact)}
                        disabled={disabled}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Contact">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(contact.id)}
                        disabled={disabled}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Email:
                    </Typography>
                    <Typography variant="body2">
                      {contact.email}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Phone:
                    </Typography>
                    <Typography variant="body2">
                      {contact.phone}
                    </Typography>
                  </Grid>
                  {contact.mobile && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        Mobile:
                      </Typography>
                      <Typography variant="body2">
                        {contact.mobile}
                      </Typography>
                    </Grid>
                  )}
                  {contact.notes && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" color="text.secondary">
                        Notes:
                      </Typography>
                      <Typography variant="body2">
                        {contact.notes}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </Paper>
        ))}
      </Box>

      {/* Add Contact Form */}
      {adding && (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2">New Contact</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  disabled={disabled}
                  placeholder="Contact person name"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Designation"
                  value={formDesignation}
                  onChange={(e) => setFormDesignation(e.target.value)}
                  fullWidth
                  size="small"
                  disabled={disabled}
                  placeholder="Job title or role"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  disabled={disabled}
                  placeholder="contact@example.com"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  disabled={disabled}
                  placeholder="+91 XXXXXXXXXX"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Mobile"
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  fullWidth
                  size="small"
                  disabled={disabled}
                  placeholder="+91 XXXXXXXXXX"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  disabled={disabled}
                  placeholder="Additional notes about this contact"
                />
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                startIcon={<CloseIcon />}
                onClick={cancelEdit}
                disabled={disabled}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                disabled={disabled || !formName || !formEmail || !formPhone}
              >
                Add Contact
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {contacts.length === 0 && !adding && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary">
            No contacts added yet. Click &quot;Add Contact&quot; to add the first contact.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
