'use client';

/**
 * Generic Material Creation Form
 *
 * Unified form that adapts based on material type and category selection.
 * Covers all material categories not handled by category-specific forms
 * (plates/new and pipes/new remain as custom forms).
 */

import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  FormControlLabel,
  Checkbox,
  Divider,
  Stack,
  Grid,
  InputLabel,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import {
  MaterialCategory as MC,
  MaterialType,
  Material,
  MATERIAL_CATEGORY_LABELS,
} from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { createMaterial } from '@/lib/materials/materialService';

// ── Category Defaults ──────────────────────────────────────────────────────

interface CategoryDefaults {
  standard: string;
  defaultGrade: string;
  density: string;
  form: string;
  baseUnit: string;
  materialType: MaterialType;
  grades?: string[];
}

const CATEGORY_DEFAULTS: Partial<Record<MC, CategoryDefaults>> = {
  // Fittings
  [MC.FITTINGS_BUTT_WELD]: {
    standard: 'ASME B16.9',
    defaultGrade: 'WPB',
    density: '7850',
    form: 'Butt Weld Fitting',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['WPB', 'WP304L', 'WP316L', 'WP11', 'WP22'],
  },
  [MC.FITTINGS_SOCKET_WELD]: {
    standard: 'ASME B16.11',
    defaultGrade: 'A105',
    density: '7850',
    form: 'Socket Weld Fitting',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['A105', 'A182 F304L', 'A182 F316L'],
  },
  [MC.FITTINGS_THREADED]: {
    standard: 'ASME B16.11',
    defaultGrade: 'A105',
    density: '7850',
    form: 'Threaded Fitting',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['A105', 'A182 F304L', 'A182 F316L'],
  },
  [MC.FITTINGS_FLANGED]: {
    standard: 'ASME B16.5',
    defaultGrade: 'A105',
    density: '7850',
    form: 'Flanged Fitting',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['A105', 'A182 F304L', 'A182 F316L'],
  },

  // Fasteners
  [MC.FASTENERS_BOLTS]: {
    standard: 'ASTM A193',
    defaultGrade: 'B7',
    density: '7850',
    form: 'Bolt',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['B7', 'B7M', 'B8', 'B8M', 'B16'],
  },
  [MC.FASTENERS_NUTS]: {
    standard: 'ASTM A194',
    defaultGrade: '2H',
    density: '7850',
    form: 'Nut',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['2H', '2HM', '8', '8M', '4', '7'],
  },
  [MC.FASTENERS_WASHERS]: {
    standard: 'ASME B18.21.1',
    defaultGrade: 'F436',
    density: '7850',
    form: 'Washer',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['F436', 'F844', 'A193 B7'],
  },
  [MC.FASTENERS_BOLT_NUT_WASHER_SETS]: {
    standard: 'ASTM A193/A194',
    defaultGrade: 'B7/2H',
    density: '7850',
    form: 'Bolt-Nut-Washer Set',
    baseUnit: 'set',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['B7/2H', 'B7M/2HM', 'B8/8', 'B8M/8M'],
  },
  [MC.FASTENERS_STUDS]: {
    standard: 'ASTM A193',
    defaultGrade: 'B7',
    density: '7850',
    form: 'Stud',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['B7', 'B7M', 'B8', 'B8M', 'B16'],
  },
  [MC.FASTENERS_SCREWS]: {
    standard: 'ASME B18.3',
    defaultGrade: 'A574',
    density: '7850',
    form: 'Screw',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['A574', 'A193 B8', 'A193 B8M'],
  },

  // Valves
  [MC.VALVE_GATE]: {
    standard: 'API 600',
    defaultGrade: 'WCB',
    density: '',
    form: 'Gate Valve',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['WCB', 'WC6', 'WC9', 'CF8', 'CF8M', 'CF3M'],
  },
  [MC.VALVE_GLOBE]: {
    standard: 'BS 1873',
    defaultGrade: 'WCB',
    density: '',
    form: 'Globe Valve',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['WCB', 'WC6', 'WC9', 'CF8', 'CF8M'],
  },
  [MC.VALVE_BALL]: {
    standard: 'API 6D',
    defaultGrade: 'WCB',
    density: '',
    form: 'Ball Valve',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['WCB', 'CF8M', 'A105', 'A182 F316'],
  },
  [MC.VALVE_BUTTERFLY]: {
    standard: 'API 609',
    defaultGrade: 'WCB',
    density: '',
    form: 'Butterfly Valve',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['WCB', 'CF8M', 'CI', 'DI'],
  },
  [MC.VALVE_CHECK]: {
    standard: 'BS 1868',
    defaultGrade: 'WCB',
    density: '',
    form: 'Check Valve',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['WCB', 'WC6', 'CF8M', 'CF3M'],
  },
  [MC.VALVE_OTHER]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Valve',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },

  // Pumps
  [MC.PUMP_CENTRIFUGAL]: {
    standard: 'API 610',
    defaultGrade: '',
    density: '',
    form: 'Centrifugal Pump',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },
  [MC.PUMP_POSITIVE_DISPLACEMENT]: {
    standard: 'API 674/675/676',
    defaultGrade: '',
    density: '',
    form: 'Positive Displacement Pump',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },

  // Instruments
  [MC.INSTRUMENT_PRESSURE_GAUGE]: {
    standard: 'ASME B40.100',
    defaultGrade: '',
    density: '',
    form: 'Pressure Gauge',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },
  [MC.INSTRUMENT_TEMPERATURE_SENSOR]: {
    standard: 'IEC 60751',
    defaultGrade: '',
    density: '',
    form: 'Temperature Sensor',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },
  [MC.INSTRUMENT_FLOW_METER]: {
    standard: 'ISO 5167',
    defaultGrade: '',
    density: '',
    form: 'Flow Meter',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },
  [MC.INSTRUMENT_LEVEL_TRANSMITTER]: {
    standard: 'IEC 61298',
    defaultGrade: '',
    density: '',
    form: 'Level Transmitter',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },
  [MC.INSTRUMENT_CONTROL_VALVE]: {
    standard: 'IEC 60534',
    defaultGrade: '',
    density: '',
    form: 'Control Valve',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },
  [MC.INSTRUMENT_OTHER]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Instrument',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },

  // Other components
  [MC.GASKETS]: {
    standard: 'ASME B16.20',
    defaultGrade: '',
    density: '',
    form: 'Gasket',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['SS 304', 'SS 316', 'Graphite', 'PTFE', 'Spiral Wound'],
  },
  [MC.MOTORS]: {
    standard: 'IEC 60034',
    defaultGrade: '',
    density: '',
    form: 'Motor',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },
  [MC.STRAINERS]: {
    standard: 'ASME B16.34',
    defaultGrade: 'WCB',
    density: '',
    form: 'Strainer',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
    grades: ['WCB', 'CF8M', 'CI'],
  },
  [MC.SEPARATORS]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Separator',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },
  [MC.ELECTRICAL]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Electrical Component',
    baseUnit: 'nos',
    materialType: 'BOUGHT_OUT_COMPONENT',
  },

  // Structural
  [MC.STRUCTURAL_SHAPES]: {
    standard: 'IS 2062',
    defaultGrade: 'E250',
    density: '7850',
    form: 'Structural Section',
    baseUnit: 'kg',
    materialType: 'RAW_MATERIAL',
    grades: ['E250', 'E350', 'E410', 'E450'],
  },
  [MC.BARS_AND_RODS]: {
    standard: 'ASTM A276',
    defaultGrade: '304',
    density: '7850',
    form: 'Bar/Rod',
    baseUnit: 'kg',
    materialType: 'RAW_MATERIAL',
    grades: ['304', '316', '316L', 'A36', 'A105'],
  },
  [MC.SHEETS]: {
    standard: 'ASTM A240',
    defaultGrade: '304',
    density: '7850',
    form: 'Sheet',
    baseUnit: 'kg',
    materialType: 'RAW_MATERIAL',
    grades: ['304', '304L', '316', '316L'],
  },

  // Consumables
  [MC.WELDING_CONSUMABLES]: {
    standard: 'AWS A5.1',
    defaultGrade: 'E7018',
    density: '',
    form: 'Welding Consumable',
    baseUnit: 'kg',
    materialType: 'CONSUMABLE',
    grades: ['E6013', 'E7018', 'E308L-16', 'E309L-16', 'ER70S-6', 'ER308L', 'ER316L'],
  },
  [MC.PAINTS_COATINGS]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Paint/Coating',
    baseUnit: 'liter',
    materialType: 'CONSUMABLE',
  },
  [MC.LUBRICANTS]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Lubricant',
    baseUnit: 'liter',
    materialType: 'CONSUMABLE',
  },
  [MC.CHEMICALS]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Chemical',
    baseUnit: 'kg',
    materialType: 'CONSUMABLE',
  },

  // Plastics
  [MC.PLASTICS]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Plastic Component',
    baseUnit: 'nos',
    materialType: 'RAW_MATERIAL',
  },
  [MC.RUBBER]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Rubber Component',
    baseUnit: 'nos',
    materialType: 'RAW_MATERIAL',
  },
  [MC.COMPOSITES]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: 'Composite',
    baseUnit: 'nos',
    materialType: 'RAW_MATERIAL',
  },

  // Other
  [MC.OTHER]: {
    standard: '',
    defaultGrade: '',
    density: '',
    form: '',
    baseUnit: 'nos',
    materialType: 'RAW_MATERIAL',
  },
};

// ── Material Type → Categories mapping ──────────────────────────────────────

const TYPE_CATEGORIES: Record<MaterialType, MC[]> = {
  RAW_MATERIAL: [
    MC.FITTINGS_BUTT_WELD,
    MC.FITTINGS_SOCKET_WELD,
    MC.FITTINGS_THREADED,
    MC.FITTINGS_FLANGED,
    MC.STRUCTURAL_SHAPES,
    MC.BARS_AND_RODS,
    MC.SHEETS,
    MC.PLASTICS,
    MC.RUBBER,
    MC.COMPOSITES,
    MC.OTHER,
  ],
  BOUGHT_OUT_COMPONENT: [
    MC.FASTENERS_BOLTS,
    MC.FASTENERS_NUTS,
    MC.FASTENERS_WASHERS,
    MC.FASTENERS_BOLT_NUT_WASHER_SETS,
    MC.FASTENERS_STUDS,
    MC.FASTENERS_SCREWS,
    MC.VALVE_GATE,
    MC.VALVE_GLOBE,
    MC.VALVE_BALL,
    MC.VALVE_BUTTERFLY,
    MC.VALVE_CHECK,
    MC.VALVE_OTHER,
    MC.PUMP_CENTRIFUGAL,
    MC.PUMP_POSITIVE_DISPLACEMENT,
    MC.INSTRUMENT_PRESSURE_GAUGE,
    MC.INSTRUMENT_TEMPERATURE_SENSOR,
    MC.INSTRUMENT_FLOW_METER,
    MC.INSTRUMENT_LEVEL_TRANSMITTER,
    MC.INSTRUMENT_CONTROL_VALVE,
    MC.INSTRUMENT_OTHER,
    MC.GASKETS,
    MC.MOTORS,
    MC.STRAINERS,
    MC.SEPARATORS,
    MC.ELECTRICAL,
  ],
  CONSUMABLE: [MC.WELDING_CONSUMABLES, MC.PAINTS_COATINGS, MC.LUBRICANTS, MC.CHEMICALS],
  // EQUIPMENT — valves, pumps, instruments, motors. Not surfaced on this
  // legacy form (the AI quote parser auto-creates them, and the picker's
  // inline-create flow handles manual entry); empty array keeps the
  // existing TYPE → category cascade clean if a user does land here.
  EQUIPMENT: [],
};

// Categories handled by their own /new pages (plates, pipes)
const EXCLUDED_CATEGORIES = new Set([
  MC.PLATES_CARBON_STEEL,
  MC.PLATES_STAINLESS_STEEL,
  MC.PLATES_DUPLEX_STEEL,
  MC.PLATES_ALLOY_STEEL,
  MC.PIPES_CARBON_STEEL,
  MC.PIPES_STAINLESS_304L,
  MC.PIPES_STAINLESS_316L,
  MC.PIPES_ALLOY_STEEL,
  MC.FLANGES,
  MC.FLANGES_WELD_NECK,
  MC.FLANGES_SLIP_ON,
  MC.FLANGES_BLIND,
]);

export default function NewMaterialPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { db } = getFirebase();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '' as MC | '',
    materialType: 'BOUGHT_OUT_COMPONENT' as MaterialType,
    customCode: '',
    standard: '',
    grade: '',
    finish: '',
    form: '',
    density: '',
    densityUnit: 'kg/m3' as 'kg/m3' | 'g/cm3',
    baseUnit: 'nos',
    tags: [] as string[],
    isStandard: false,
    trackInventory: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleMaterialTypeChange = (materialType: MaterialType) => {
    setFormData((prev) => ({
      ...prev,
      materialType,
      category: '' as MC | '',
      standard: '',
      grade: '',
      form: '',
      density: '',
      baseUnit: materialType === 'CONSUMABLE' ? 'kg' : 'nos',
      name: '',
    }));
  };

  const handleCategoryChange = (category: MC) => {
    const defaults = CATEGORY_DEFAULTS[category];
    if (defaults) {
      const autoName = [defaults.standard, defaults.defaultGrade, defaults.form]
        .filter(Boolean)
        .join(' ');
      setFormData((prev) => ({
        ...prev,
        category,
        materialType: defaults.materialType,
        standard: defaults.standard,
        grade: defaults.defaultGrade,
        density: defaults.density,
        form: defaults.form,
        baseUnit: defaults.baseUnit,
        name: autoName,
      }));
    } else {
      handleChange('category', category);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleDeleteTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleSpecChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      const autoName = [updated.standard, updated.grade, updated.form].filter(Boolean).join(' ');
      return { ...updated, name: autoName || prev.name };
    });
    setError(null);
  };

  const availableCategories =
    TYPE_CATEGORIES[formData.materialType]?.filter((cat) => !EXCLUDED_CATEGORIES.has(cat)) || [];

  const currentDefaults = formData.category
    ? CATEGORY_DEFAULTS[formData.category as MC]
    : undefined;

  const handleSubmit = async () => {
    if (!db || !user) return;

    try {
      setLoading(true);
      setError(null);

      const materialData: Omit<
        Material,
        'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
      > = {
        materialCode: formData.customCode || '',
        name: formData.name,
        description: formData.description,
        category: formData.category as MC,
        materialType: formData.materialType,
        ...(formData.customCode && { customCode: formData.customCode }),
        specification: {
          ...(formData.standard && { standard: formData.standard }),
          ...(formData.grade && { grade: formData.grade }),
          ...(formData.finish && { finish: formData.finish }),
          ...(formData.form && { form: formData.form }),
        },
        properties: {
          ...(formData.density && { density: parseFloat(formData.density) }),
          densityUnit: formData.densityUnit,
        },
        baseUnit: formData.baseUnit,
        tags: formData.tags,
        isStandard: formData.isStandard,
        trackInventory: formData.trackInventory,
        hasVariants: false,
        preferredVendors: [],
        priceHistory: [],
        certifications: [],
        isActive: true,
      };

      const created = await createMaterial(db, materialData, user.uid);
      router.push(`/materials/${created.id}`);
    } catch (err) {
      console.error('Error creating material:', err);
      setError(err instanceof Error ? err.message : 'Failed to create material');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Materials', href: '/materials', icon: <HomeIcon fontSize="small" /> },
          { label: 'New Material' },
        ]}
      />

      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/materials')}>
          Back
        </Button>
        <Box>
          <Typography variant="h4" component="h1">
            New Material
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add a new material, component, or consumable to the database
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Material Type Selection */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Material Type
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <FormControl fullWidth required>
            <InputLabel>Material Type</InputLabel>
            <Select
              value={formData.materialType}
              label="Material Type"
              onChange={(e) => handleMaterialTypeChange(e.target.value as MaterialType)}
            >
              <MenuItem value="RAW_MATERIAL">
                Raw Material (Fittings, Structural Steel, Bars, Sheets)
              </MenuItem>
              <MenuItem value="BOUGHT_OUT_COMPONENT">
                Bought-Out Component (Valves, Pumps, Instruments, Fasteners)
              </MenuItem>
              <MenuItem value="CONSUMABLE">
                Consumable (Welding, Paints, Lubricants, Chemicals)
              </MenuItem>
            </Select>
          </FormControl>

          {/* Category Selection */}
          <FormControl fullWidth required>
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              label="Category"
              onChange={(e) => handleCategoryChange(e.target.value as MC)}
            >
              {availableCategories.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {MATERIAL_CATEGORY_LABELS[cat]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Basic Information */}
          {formData.category && (
            <>
              <Box>
                <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Box>

              <TextField
                fullWidth
                required
                label="Material Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Auto-generated from specification"
                helperText="Auto-generated from standard, grade, and form. You can edit if needed."
              />

              <TextField
                fullWidth
                label="Custom Code"
                value={formData.customCode}
                onChange={(e) => handleChange('customCode', e.target.value)}
                placeholder="Optional internal reference code"
                helperText="Optional short code for internal reference"
              />

              <TextField
                fullWidth
                required
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe this material, its applications, and key properties..."
                helperText="Minimum 10 characters"
              />

              {/* Specification */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
                  Specification
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Standard"
                    value={formData.standard}
                    onChange={(e) => handleSpecChange('standard', e.target.value)}
                    placeholder="e.g., API 600, ASTM A193"
                    helperText="ASME/ASTM/API/ISO standard"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  {currentDefaults?.grades && currentDefaults.grades.length > 0 ? (
                    <FormControl fullWidth>
                      <InputLabel>Grade</InputLabel>
                      <Select
                        value={formData.grade}
                        label="Grade"
                        onChange={(e) => handleSpecChange('grade', e.target.value)}
                      >
                        {currentDefaults.grades.map((g) => (
                          <MenuItem key={g} value={g}>
                            {g}
                          </MenuItem>
                        ))}
                      </Select>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Or enter custom grade"
                        value={
                          currentDefaults.grades.includes(formData.grade) ? '' : formData.grade
                        }
                        onChange={(e) => handleSpecChange('grade', e.target.value)}
                        sx={{ mt: 1 }}
                      />
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      label="Grade / Model"
                      value={formData.grade}
                      onChange={(e) => handleSpecChange('grade', e.target.value)}
                      placeholder="e.g., B7, WCB, or model number"
                    />
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Form / Type"
                    value={formData.form}
                    onChange={(e) => handleSpecChange('form', e.target.value)}
                    helperText="Auto-filled from category"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Finish"
                    value={formData.finish}
                    onChange={(e) => handleSpecChange('finish', e.target.value)}
                    placeholder="Optional"
                  />
                </Grid>
              </Grid>

              {/* Properties */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
                  Properties
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Density"
                    value={formData.density}
                    onChange={(e) => handleChange('density', e.target.value)}
                    placeholder="e.g., 7850"
                    helperText="Optional — for weight calculations"
                    InputProps={{
                      endAdornment: (
                        <Select
                          value={formData.densityUnit}
                          onChange={(e) => handleChange('densityUnit', e.target.value)}
                          variant="standard"
                          sx={{ ml: 1 }}
                        >
                          <MenuItem value="kg/m3">kg/m&sup3;</MenuItem>
                          <MenuItem value="g/cm3">g/cm&sup3;</MenuItem>
                        </Select>
                      ),
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Base Unit"
                    value={formData.baseUnit}
                    onChange={(e) => handleChange('baseUnit', e.target.value)}
                    helperText="Unit for pricing and quantity"
                  />
                </Grid>
              </Grid>

              {/* Organization */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
                  Organization
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Box>

              <TextField
                fullWidth
                label="Add Tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Type and press Enter to add tags"
                helperText="Tags help with searching and organization"
              />
              {formData.tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleDeleteTag(tag)}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}

              <Stack direction="row" spacing={3}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isStandard}
                      onChange={(e) => handleChange('isStandard', e.target.checked)}
                    />
                  }
                  label="Mark as Standard Material"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.trackInventory}
                      onChange={(e) => handleChange('trackInventory', e.target.checked)}
                    />
                  }
                  label="Enable Inventory Tracking"
                />
              </Stack>

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => router.push('/materials')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleSubmit}
                  disabled={
                    loading ||
                    !formData.name ||
                    !formData.description ||
                    !formData.category ||
                    !formData.baseUnit
                  }
                >
                  {loading ? 'Creating...' : 'Create Material'}
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
