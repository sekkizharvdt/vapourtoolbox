'use client';

import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  IconButton,
  Paper,
  Chip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';

export interface ReceiptAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  storagePath: string;
  uploadedAt: Date;
}

interface ReceiptUploaderProps {
  /**
   * Current receipt (if any)
   */
  receipt: ReceiptAttachment | null;
  /**
   * Callback when receipt is uploaded or removed
   */
  onChange: (receipt: ReceiptAttachment | null) => void;
  /**
   * Storage path prefix (e.g., 'hr/travel-expenses/{reportId}/receipts/')
   */
  storagePath: string;
  /**
   * Whether upload is disabled
   */
  disabled?: boolean;
  /**
   * Maximum file size in MB
   */
  maxSizeMB?: number;
  /**
   * Compact mode for table rows
   */
  compact?: boolean;
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export function ReceiptUploader({
  receipt,
  onChange,
  storagePath,
  disabled = false,
  maxSizeMB = 5,
  compact = false,
}: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    const file = files[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only PDF, JPEG, and PNG files are allowed');
      return;
    }

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const { storage } = getFirebase();
      const fileName = `${Date.now()}_${file.name}`;
      const fullPath = `${storagePath}${fileName}`;
      const storageRef = ref(storage, fullPath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (err) => {
          console.error('Upload error:', err);
          setError('Failed to upload receipt');
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          const newReceipt: ReceiptAttachment = {
            id: fileName,
            name: file.name,
            url: downloadURL,
            size: file.size,
            type: file.type,
            storagePath: fullPath,
            uploadedAt: new Date(),
          };

          onChange(newReceipt);
          setUploading(false);
          setUploadProgress(0);

          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      );
    } catch (err) {
      console.error('Error uploading receipt:', err);
      setError('Failed to upload receipt');
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!receipt) return;

    try {
      const { storage } = getFirebase();
      const fileRef = ref(storage, receipt.storagePath);
      await deleteObject(fileRef);
      onChange(null);
    } catch (err) {
      console.error('Error deleting receipt:', err);
      // Even if delete fails (e.g., file already deleted), update UI
      onChange(null);
    }
  };

  const handlePreview = () => {
    if (receipt) {
      window.open(receipt.url, '_blank');
    }
  };

  // Compact mode for inline display
  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={disabled || uploading}
        />
        {receipt ? (
          <>
            <Chip
              icon={<ReceiptIcon fontSize="small" />}
              label={receipt.name}
              size="small"
              color="success"
              variant="outlined"
              onClick={handlePreview}
            />
            {!disabled && (
              <IconButton size="small" color="error" onClick={handleDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </>
        ) : uploading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
            <LinearProgress variant="determinate" value={uploadProgress} sx={{ flex: 1 }} />
            <Typography variant="caption">{Math.round(uploadProgress)}%</Typography>
          </Box>
        ) : !disabled ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary">
            No receipt
          </Typography>
        )}
        {error && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}
      </Box>
    );
  }

  // Full mode
  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {uploading && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Uploading... {Math.round(uploadProgress)}%
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {receipt ? (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon color="success" />
            <Box>
              <Typography variant="body2">{receipt.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(receipt.size)}
              </Typography>
            </Box>
          </Box>
          <Box>
            <IconButton onClick={handlePreview} title="Preview">
              <PreviewIcon />
            </IconButton>
            {!disabled && (
              <IconButton onClick={handleDelete} color="error" title="Delete">
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        </Paper>
      ) : (
        <Box
          sx={{ textAlign: 'center', py: 3, border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            No receipt uploaded
          </Typography>
          {!disabled && (
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Receipt
            </Button>
          )}
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
            PDF, JPG, PNG up to {maxSizeMB}MB
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default ReceiptUploader;
