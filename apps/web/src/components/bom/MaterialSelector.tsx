'use client';

import { Autocomplete, TextField, Box, Typography, Chip, CircularProgress } from '@mui/material';
import { useState, useEffect } from 'react';
import { getFirebase } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { Material, MaterialCategory } from '@vapour/types';
import { MATERIAL_CATEGORY_LABELS } from '@vapour/types';

interface MaterialSelectorProps {
  value: string | null;
  onChange: (materialId: string | null, material: Material | null) => void;
  categories?: MaterialCategory[];
  materialType?: 'RAW_MATERIAL' | 'BOUGHT_OUT_COMPONENT' | 'CONSUMABLE';
  label?: string;
  required?: boolean;
  disabled?: boolean;
  entityId: string;
}

export default function MaterialSelector({
  value,
  onChange,
  categories,
  materialType = 'BOUGHT_OUT_COMPONENT',
  label = 'Select Material',
  required = false,
  disabled = false,
  entityId,
}: MaterialSelectorProps) {
  const { db } = getFirebase();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, materialType, entityId]);

  const loadMaterials = async () => {
    if (!db || !entityId) return;

    try {
      setLoading(true);
      const materialsRef = collection(db, COLLECTIONS.MATERIALS);

      let q = query(
        materialsRef,
        where('entityId', '==', entityId),
        where('materialType', '==', materialType),
        where('isActive', '==', true)
      );

      // If categories are specified, filter by them
      if (categories && categories.length > 0) {
        q = query(
          materialsRef,
          where('entityId', '==', entityId),
          where('materialType', '==', materialType),
          where('category', 'in', categories.slice(0, 10)), // Firestore 'in' limit is 10
          where('isActive', '==', true)
        );
      }

      q = query(q, orderBy('code', 'asc'), firestoreLimit(100));

      const snapshot = await getDocs(q);
      const materialsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Material[];

      setMaterials(materialsData);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterial = materials.find((m) => m.id === value) || null;

  return (
    <Autocomplete
      value={selectedMaterial}
      onChange={(_event, newValue) => {
        onChange(newValue?.id || null, newValue);
      }}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      options={materials}
      getOptionLabel={(option) => `${option.materialCode} - ${option.name}`}
      loading={loading}
      disabled={disabled}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1" fontWeight="medium">
                {option.materialCode}
              </Typography>
              <Chip
                label={MATERIAL_CATEGORY_LABELS[option.category]}
                size="small"
                variant="outlined"
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {option.name}
            </Typography>
            {option.currentPrice && (
              <Typography variant="caption" color="primary">
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: option.currentPrice.pricePerUnit.currency,
                }).format(option.currentPrice.pricePerUnit.amount)}
                {' / '}
                {option.currentPrice.unit}
              </Typography>
            )}
          </Box>
        </li>
      )}
      noOptionsText={
        loading
          ? 'Loading materials...'
          : materials.length === 0
            ? 'No materials found. Add materials first.'
            : 'No matching materials'
      }
    />
  );
}
