'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getFirebase } from '@/lib/firebase';
import type { Material, MaterialPrice } from '@vapour/types';
import { MATERIAL_CATEGORY_LABELS, MaterialCategory } from '@vapour/types';
import { getMaterialById } from '@/lib/materials/materialService';
import { getMaterialPriceHistory } from '@/lib/materials/pricing';
import { formatMoney, formatDate } from '@/lib/utils/formatters';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  VENDOR_QUOTE: 'Vendor Quote',
  VENDOR_INVOICE: 'Vendor Bill',
  MARKET_RATE: 'Market Rate',
  HISTORICAL: 'Historical',
  ESTIMATED: 'Estimated',
  CONTRACT_RATE: 'Contract',
};

export default function MaterialDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { db } = getFirebase();

  const [material, setMaterial] = useState<Material | null>(null);
  const [priceHistory, setPriceHistory] = useState<MaterialPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/materials\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setMaterialId(extractedId);
      }
    }
  }, [pathname]);

  // Load material
  useEffect(() => {
    if (materialId) {
      loadMaterial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  const loadMaterial = async () => {
    if (!materialId) {
      setError('No material ID provided');
      setLoading(false);
      return;
    }

    if (!db) {
      setError('Firebase not initialized');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getMaterialById(db, materialId);

      if (!data) {
        setError('Material not found');
        return;
      }

      setMaterial(data);

      // Load price history in the background — non-blocking.
      getMaterialPriceHistory(db, materialId, { limitResults: 20 })
        .then(setPriceHistory)
        .catch((err) => {
          console.warn('Failed to load price history', err);
        });
    } catch (err) {
      console.error('Error loading material:', err);
      setError(err instanceof Error ? err.message : 'Failed to load material');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !material) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Material not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/materials')}
          sx={{ mt: 2 }}
        >
          Back to Materials
        </Button>
      </Container>
    );
  }

  // Determine category-specific breadcrumb
  const getCategoryPath = () => {
    const isPlate = [
      MaterialCategory.PLATES_CARBON_STEEL,
      MaterialCategory.PLATES_STAINLESS_STEEL,
      MaterialCategory.PLATES_DUPLEX_STEEL,
      MaterialCategory.PLATES_ALLOY_STEEL,
    ].includes(material.category);

    const isPipe = [
      MaterialCategory.PIPES_CARBON_STEEL,
      MaterialCategory.PIPES_STAINLESS_304L,
      MaterialCategory.PIPES_STAINLESS_316L,
      MaterialCategory.PIPES_ALLOY_STEEL,
    ].includes(material.category);

    if (isPlate) {
      return { path: '/materials/plates', label: 'Plates' };
    }
    if (isPipe) {
      return { path: '/materials/pipes', label: 'Pipes' };
    }
    // Future: Add other categories here
    return { path: '/materials', label: 'Materials' };
  };

  const categoryInfo = getCategoryPath();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Materials', href: '/materials', icon: <HomeIcon fontSize="small" /> },
          { label: categoryInfo.label, href: categoryInfo.path },
          { label: material.materialCode },
        ]}
      />

      {/* Header */}
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box sx={{ flex: 1 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(categoryInfo.path)}
            sx={{ mb: 2 }}
          >
            Back to {categoryInfo.label}
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            {material.isStandard ? (
              <StarIcon color="primary" fontSize="large" />
            ) : (
              <StarBorderIcon fontSize="large" sx={{ color: 'action.disabled' }} />
            )}
            <Typography variant="h4" component="h1">
              {material.name}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={material.customCode || material.materialCode} variant="outlined" />
            <Chip
              label={MATERIAL_CATEGORY_LABELS[material.category]}
              color="primary"
              variant="outlined"
            />
            <Chip
              label={material.materialType.replace('_', ' ')}
              color="secondary"
              variant="outlined"
            />
            {!material.isActive && <Chip label="Inactive" color="default" />}
            {material.isStandard && <Chip label="Standard" color="primary" />}
            {material.trackInventory && (
              <Chip label="Inventory Tracked" color="info" variant="outlined" />
            )}
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => router.push(`/materials/${materialId}/edit`)}
        >
          Edit
        </Button>
      </Box>

      <Stack spacing={3}>
        {/* Overview Card */}
        <Box>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Overview
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="body1" paragraph>
              {material.description}
            </Typography>

            <Table>
              <TableBody>
                <TableRow>
                  <TableCell component="th" width="200px">
                    Material Code
                  </TableCell>
                  <TableCell>{material.customCode || material.materialCode}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th">Category</TableCell>
                  <TableCell>{MATERIAL_CATEGORY_LABELS[material.category]}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th">Type</TableCell>
                  <TableCell>{material.materialType.replace('_', ' ')}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th">Base Unit</TableCell>
                  <TableCell>{material.baseUnit}</TableCell>
                </TableRow>
                {material.leadTimeDays && (
                  <TableRow>
                    <TableCell component="th">Lead Time</TableCell>
                    <TableCell>{material.leadTimeDays} days</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Box>

        {/* Pricing Card */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Price
              </Typography>
              {material.currentPrice ? (
                <>
                  <Typography variant="h4" color="primary" gutterBottom>
                    {formatMoney(material.currentPrice.pricePerUnit)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    per {material.currentPrice.unit}
                  </Typography>
                  {material.currentPrice.vendorName && (
                    <Typography variant="body2" color="text.secondary">
                      from {material.currentPrice.vendorName}
                    </Typography>
                  )}
                  {material.lastPriceUpdate && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 1 }}
                    >
                      Updated: {formatDate(material.lastPriceUpdate)}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No price information available
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Vendors Card */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preferred Vendors
              </Typography>
              {material.preferredVendors.length > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {material.preferredVendors.length} vendor
                  {material.preferredVendors.length !== 1 ? 's' : ''}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No preferred vendors
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Price History — quotes, invoices, and market rates that have been
              captured for this material. Each row links back to its source. */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Price History
              </Typography>
              {priceHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No prices recorded yet. Quotes and vendor invoices automatically appear here when
                  their item prices are accepted.
                </Typography>
              ) : (
                <Table size="small">
                  <TableBody>
                    {priceHistory.map((price) => {
                      const dateVal =
                        price.effectiveDate &&
                        typeof (price.effectiveDate as { toDate?: () => Date }).toDate ===
                          'function'
                          ? (price.effectiveDate as { toDate: () => Date }).toDate()
                          : null;
                      const quoteHref = price.sourceQuoteId
                        ? `/procurement/quotes/${price.sourceQuoteId}`
                        : null;
                      return (
                        <TableRow key={price.id}>
                          <TableCell sx={{ py: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {formatMoney(price.pricePerUnit)} / {price.unit}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {price.vendorName || '—'}
                              {dateVal ? ` · ${formatDate(dateVal)}` : ''}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1 }}>
                            <Chip
                              label={SOURCE_TYPE_LABELS[price.sourceType] || price.sourceType}
                              size="small"
                              variant="outlined"
                            />
                            {quoteHref && price.documentReference && (
                              <Typography
                                variant="caption"
                                component={Link}
                                href={quoteHref}
                                sx={{ display: 'block', mt: 0.5 }}
                              >
                                {price.documentReference}
                              </Typography>
                            )}
                            {!quoteHref && price.documentReference && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                                sx={{ mt: 0.5 }}
                              >
                                {price.documentReference}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Specification Card */}
        {(material.specification?.standard ||
          material.specification?.grade ||
          material.specification?.finish ||
          material.specification?.form ||
          material.specification?.schedule ||
          material.specification?.nominalSize) && (
          <Box>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                ASME/ASTM Specification
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table>
                <TableBody>
                  {material.specification?.standard && (
                    <TableRow>
                      <TableCell component="th" width="150px">
                        Standard
                      </TableCell>
                      <TableCell>{material.specification.standard}</TableCell>
                    </TableRow>
                  )}
                  {material.specification?.grade && (
                    <TableRow>
                      <TableCell component="th">Grade</TableCell>
                      <TableCell>{material.specification.grade}</TableCell>
                    </TableRow>
                  )}
                  {material.specification?.finish && (
                    <TableRow>
                      <TableCell component="th">Finish</TableCell>
                      <TableCell>{material.specification.finish}</TableCell>
                    </TableRow>
                  )}
                  {material.specification?.form && (
                    <TableRow>
                      <TableCell component="th">Form</TableCell>
                      <TableCell>{material.specification.form}</TableCell>
                    </TableRow>
                  )}
                  {material.specification?.schedule && (
                    <TableRow>
                      <TableCell component="th">Schedule</TableCell>
                      <TableCell>{material.specification.schedule}</TableCell>
                    </TableRow>
                  )}
                  {material.specification?.nominalSize && (
                    <TableRow>
                      <TableCell component="th">Nominal Size</TableCell>
                      <TableCell>{material.specification.nominalSize}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        )}

        {/* Material Properties Card */}
        {material.properties && (
          <Box>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Material Properties
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table>
                <TableBody>
                  {material.properties.density && (
                    <TableRow>
                      <TableCell component="th" width="150px">
                        Density
                      </TableCell>
                      <TableCell>
                        {material.properties.density} {material.properties.densityUnit || 'kg/m³'}
                      </TableCell>
                    </TableRow>
                  )}
                  {material.properties.tensileStrength && (
                    <TableRow>
                      <TableCell component="th">Tensile Strength</TableCell>
                      <TableCell>{material.properties.tensileStrength} MPa</TableCell>
                    </TableRow>
                  )}
                  {material.properties.yieldStrength && (
                    <TableRow>
                      <TableCell component="th">Yield Strength</TableCell>
                      <TableCell>{material.properties.yieldStrength} MPa</TableCell>
                    </TableRow>
                  )}
                  {material.properties.maxOperatingTemp && (
                    <TableRow>
                      <TableCell component="th">Max Operating Temp</TableCell>
                      <TableCell>{material.properties.maxOperatingTemp}°C</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        )}

        {/* Tags */}
        {material.tags && material.tags.length > 0 && (
          <Box>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                {material.tags.map((tag) => (
                  <Chip key={tag} label={tag} variant="outlined" />
                ))}
              </Box>
            </Paper>
          </Box>
        )}

        {/* Audit Info */}
        <Box>
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Stack direction="row" spacing={4}>
              <Typography variant="caption" color="text.secondary">
                Created: {formatDate(material.createdAt, 'datetime')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last Updated: {formatDate(material.updatedAt, 'datetime')}
              </Typography>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Container>
  );
}
