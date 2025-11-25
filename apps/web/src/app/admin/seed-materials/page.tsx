'use client';

import { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
} from '@mui/material';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebase } from '@/lib/firebase';

export default function SeedMaterialsPage() {
  const [dataType, setDataType] = useState<'pipes' | 'fittings' | 'flanges' | 'plates' | 'all'>(
    'plates'
  );
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    const { app } = getFirebase();
    if (!app) {
      setError('Firebase not initialized');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const functions = getFunctions(app);
      const seedMaterials = httpsCallable(functions, 'seedMaterials');

      console.log('Calling seedMaterials with:', { dataType, deleteExisting });

      const response = await seedMaterials({ dataType, deleteExisting });
      setResult(response.data);
      console.log('Seed materials result:', response.data);
    } catch (err: any) {
      console.error('Error seeding materials:', err);
      setError(err.message || 'Failed to seed materials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h4">Seed Materials Data</Typography>

          <Alert severity="warning">
            <Typography variant="body2">
              <strong>Admin Tool:</strong> This page allows you to seed material data into
              Firestore. Use with caution in production.
            </Typography>
          </Alert>

          <FormControl component="fieldset">
            <FormLabel component="legend">Select Data Type to Seed</FormLabel>
            <RadioGroup
              value={dataType}
              onChange={(e) =>
                setDataType(e.target.value as 'pipes' | 'fittings' | 'flanges' | 'plates' | 'all')
              }
            >
              <FormControlLabel
                value="plates"
                control={<Radio />}
                label="Plates Only (13 materials)"
              />
              <FormControlLabel value="pipes" control={<Radio />} label="Pipes Only" />
              <FormControlLabel value="fittings" control={<Radio />} label="Fittings Only" />
              <FormControlLabel value="flanges" control={<Radio />} label="Flanges Only" />
              <FormControlLabel value="all" control={<Radio />} label="All Materials" />
            </RadioGroup>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={deleteExisting}
                onChange={(e) => setDeleteExisting(e.target.checked)}
              />
            }
            label="Update existing materials if they already exist"
          />

          <Button
            variant="contained"
            size="large"
            onClick={handleSeed}
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Seeding...' : 'Seed Materials'}
          </Button>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {result && (
            <Alert severity="success">
              <Typography variant="h6" gutterBottom>
                Success!
              </Typography>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(result, null, 2)}
              </Typography>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
