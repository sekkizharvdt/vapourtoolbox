'use client';

import { useState, useEffect } from 'react';
import { Autocomplete, TextField, Box, Typography, Chip, CircularProgress } from '@mui/material';
import type { Material } from '@vapour/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';

interface MaterialDropdownProps {
  allowedCategories?: string[];
  value: Material | null;
  onChange: (material: Material | null) => void;
  disabled?: boolean;
}

export default function MaterialDropdown({
  allowedCategories,
  value,
  onChange,
  disabled = false,
}: MaterialDropdownProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch materials from Firestore
  useEffect(() => {
    const fetchMaterials = async () => {
      setLoading(true);
      setError(null);

      try {
        const { db } = getFirebase();
        let materialsQuery = query(collection(db, 'materials'));

        // Filter by allowed categories if specified
        if (allowedCategories && allowedCategories.length > 0) {
          materialsQuery = query(
            collection(db, 'materials'),
            where('category', 'in', allowedCategories)
          );
        }

        const snapshot = await getDocs(materialsQuery);
        const fetchedMaterials = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Material[];

        // Sort by name
        fetchedMaterials.sort((a, b) => a.name.localeCompare(b.name));

        setMaterials(fetchedMaterials);

        // Reset selection if current material is not in allowed categories
        if (
          value &&
          allowedCategories &&
          allowedCategories.length > 0 &&
          !allowedCategories.includes(value.category)
        ) {
          onChange(null);
        }
      } catch (err) {
        console.error('Error fetching materials:', err);
        setError('Failed to load materials');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, [allowedCategories, value, onChange]);

  // Helper to format price
  const formatPrice = (material: Material): string | null => {
    if (!material.currentPrice) return null;
    const { amount } = material.currentPrice.pricePerUnit;
    const { currency } = material.currentPrice;
    return `${currency === 'INR' ? '₹' : currency}${amount.toFixed(2)}/kg`;
  };

  // Helper to get material grade
  const getGrade = (material: Material): string | null => {
    if (material.specification?.grade) return material.specification.grade;
    return null;
  };

  // Group materials by category
  const groupedMaterials = materials.reduce(
    (acc, material) => {
      const group = material.category || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(material);
      return acc;
    },
    {} as Record<string, Material[]>
  );

  const hasGroups = Object.keys(groupedMaterials).length > 1;

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      options={materials}
      getOptionLabel={(option) => option.name}
      groupBy={hasGroups ? (option) => option.category || 'Other' : undefined}
      disabled={disabled || loading}
      disableClearable={false}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Material"
          placeholder="Select a material..."
          error={!!error}
          helperText={
            error ||
            (value
              ? `Density: ${value.properties?.density || 'N/A'} kg/m³${formatPrice(value) ? ` • ${formatPrice(value)}` : ''}`
              : `Choose from ${materials.length} available materials`)
          }
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
      renderOption={(props, option) => {
        const price = formatPrice(option);
        const grade = getGrade(option);

        return (
          <Box
            component="li"
            {...props}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Typography variant="body1" fontWeight="medium" sx={{ flex: 1 }}>
                {option.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {grade && <Chip label={grade} size="small" variant="outlined" color="primary" />}
                {price && <Chip label={price} size="small" color="success" />}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
              {option.properties?.density && (
                <Typography variant="caption" color="text.secondary">
                  Density: {option.properties.density} kg/m³
                </Typography>
              )}
              {option.category && (
                <Typography variant="caption" color="text.secondary">
                  {option.category}
                </Typography>
              )}
            </Box>
            {option.description && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {option.description}
              </Typography>
            )}
          </Box>
        );
      }}
      filterOptions={(options, state) => {
        const searchTerm = state.inputValue.toLowerCase();
        if (!searchTerm) return options;

        return options.filter((option) => {
          // Search in name
          if (option.name.toLowerCase().includes(searchTerm)) return true;
          // Search in description
          if (option.description?.toLowerCase().includes(searchTerm)) return true;
          // Search in category
          if (option.category?.toLowerCase().includes(searchTerm)) return true;
          // Search in grade
          if (option.specification?.grade?.toLowerCase().includes(searchTerm)) return true;
          return false;
        });
      }}
    />
  );
}
