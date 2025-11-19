'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, Button, Typography, Box, Alert, CircularProgress } from '@mui/material';

interface SeedResult {
  success: boolean;
  materialsCreated: number;
  variantsCreated: number;
  details: {
    pipes?: { materialId: string; variants: number };
    fittings?: { materialId: string; variants: number };
    flanges?: { materialId: string; variants: number };
  };
}

export default function SeedMaterialsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!user) {
      setError('You must be logged in to seed materials');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Calling seedMaterialsHttp function...');

      // Get Firebase ID token
      const token = await user.getIdToken();

      // Call the HTTP endpoint
      const response = await fetch('https://seedmaterialshttp-697891123609.asia-south1.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dataType: 'all',
          deleteExisting: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as SeedResult;
      console.log('Seed result:', data);
      setResult(data);
    } catch (err) {
      console.error('Error seeding materials:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Seed Materials Database
      </Typography>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ASME Standards Materials Seeding
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            This will populate your Firestore database with:
          </Typography>

          <ul>
            <li>
              <Typography variant="body2">
                <strong>73 Pipe Variants</strong> - ASME B36.10-2022 (Carbon Steel Pipes)
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>68 Fitting Variants</strong> - ASME B16.9-2024 (Butt Weld Fittings)
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>54 Flange Variants</strong> - ASME B16.5-2025 (Weld Neck Flanges)
              </Typography>
            </li>
          </ul>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Total: <strong>195 material variants</strong> across 3 material types
          </Typography>

          <Box sx={{ mt: 3 }}>
            {!user ? (
              <Alert severity="warning">
                You must be logged in to seed materials. Please sign in first.
              </Alert>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSeed}
                disabled={loading}
                fullWidth
                size="large"
              >
                {loading ? (
                  <>
                    <CircularProgress size={24} sx={{ mr: 2 }} />
                    Seeding Materials...
                  </>
                ) : (
                  'Seed Materials Database'
                )}
              </Button>
            )}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Error:</strong> {error}
              </Typography>
            </Alert>
          )}

          {result && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                ✅ Seeding Completed Successfully!
              </Typography>

              <Typography variant="body2">
                <strong>Materials Created:</strong> {result.materialsCreated}
              </Typography>
              <Typography variant="body2">
                <strong>Variants Created:</strong> {result.variantsCreated}
              </Typography>

              {result.details.pipes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Pipes:</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    Material ID: {result.details.pipes.materialId}
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    Variants: {result.details.pipes.variants}
                  </Typography>
                </Box>
              )}

              {result.details.fittings && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Fittings:</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    Material ID: {result.details.fittings.materialId}
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    Variants: {result.details.fittings.variants}
                  </Typography>
                </Box>
              )}

              {result.details.flanges && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Flanges:</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    Material ID: {result.details.flanges.materialId}
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    Variants: {result.details.flanges.variants}
                  </Typography>
                </Box>
              )}

              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" href="/materials/catalog" sx={{ mr: 1 }}>
                  View Materials Catalog
                </Button>
                <Button
                  variant="outlined"
                  href="https://console.firebase.google.com/project/vapour-toolbox/firestore"
                  target="_blank"
                  rel="noopener"
                >
                  View in Firebase Console
                </Button>
              </Box>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Note:</strong> This operation will only create materials if they don&apos;t
          already exist. If materials are already seeded, you&apos;ll see a warning message.
        </Typography>
      </Alert>
    </Box>
  );
}
