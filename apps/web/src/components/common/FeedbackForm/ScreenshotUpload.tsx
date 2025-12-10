'use client';

/**
 * Screenshot Upload Component
 *
 * Handles file upload, drag & drop, and clipboard paste for screenshots.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { Box, Typography, Paper, IconButton, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';

interface ScreenshotUploadProps {
  screenshots: string[];
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
  isUploading: boolean;
}

export function ScreenshotUpload({
  screenshots,
  onAdd,
  onRemove,
  isUploading,
}: ScreenshotUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isPasteActive, setIsPasteActive] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAdd(file);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onAdd(file);
      }
    },
    [onAdd]
  );

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  // Handle paste from clipboard
  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            onAdd(file);
            event.preventDefault();
            break;
          }
        }
      }
    },
    [onAdd]
  );

  // Listen for paste events when the drop zone is focused or active
  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      // Only handle paste if drop zone is focused or user has interacted with it
      if (isPasteActive || document.activeElement === dropZoneRef.current) {
        handlePaste(event);
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste, isPasteActive]);

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="screenshot-upload"
      />

      <Paper
        ref={dropZoneRef}
        variant="outlined"
        tabIndex={0}
        onFocus={() => setIsPasteActive(true)}
        onBlur={() => setIsPasteActive(false)}
        sx={{
          p: 3,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: isPasteActive ? 'primary.main' : 'divider',
          bgcolor: isPasteActive ? 'action.selected' : 'action.hover',
          cursor: 'pointer',
          transition: 'all 0.2s',
          outline: 'none',
          '&:hover': {
            borderColor: 'primary.main',
          },
          '&:focus': {
            borderColor: 'primary.main',
            bgcolor: 'action.selected',
          },
        }}
        onClick={() => {
          fileInputRef.current?.click();
          setIsPasteActive(true);
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {isUploading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Uploading...
            </Typography>
          </Box>
        ) : (
          <>
            <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Drag and drop, click to select, or <strong>paste from clipboard (Ctrl+V)</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supports PNG, JPG, GIF (max 5MB)
            </Typography>
            {isPasteActive && (
              <Typography variant="caption" color="primary" display="block" sx={{ mt: 1 }}>
                Ready to paste! Press Ctrl+V (or ⌘V on Mac)
              </Typography>
            )}
          </>
        )}
      </Paper>

      {screenshots.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          {screenshots.map((url, index) => (
            <Paper
              key={index}
              variant="outlined"
              sx={{
                position: 'relative',
                width: 100,
                height: 100,
                overflow: 'hidden',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Screenshot ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <IconButton
                size="small"
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  bgcolor: 'background.paper',
                  '&:hover': { bgcolor: 'error.light', color: 'white' },
                }}
                onClick={() => onRemove(index)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}
