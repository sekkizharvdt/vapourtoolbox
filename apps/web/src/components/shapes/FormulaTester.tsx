'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Chip,
  Stack,
  IconButton,
  Divider,
  Grid,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Science as TestIcon,
} from '@mui/icons-material';

interface VariableInput {
  name: string;
  value: string;
}

interface ConstantInput {
  name: string;
  value: string;
}

interface FormulaResult {
  result?: number;
  error?: string;
  variables?: string[];
  warnings?: string[];
}

export default function FormulaTester() {
  const [expression, setExpression] = useState('');
  const [variables, setVariables] = useState<VariableInput[]>([]);
  const [constants, setConstants] = useState<ConstantInput[]>([]);
  const [result, setResult] = useState<FormulaResult | null>(null);

  const handleAddVariable = () => {
    setVariables([...variables, { name: '', value: '' }]);
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const handleVariableChange = (index: number, field: 'name' | 'value', value: string) => {
    const updated = [...variables];
    const item = updated[index];
    if (item) {
      item[field] = value;
      setVariables(updated);
    }
  };

  const handleAddConstant = () => {
    setConstants([...constants, { name: '', value: '' }]);
  };

  const handleRemoveConstant = (index: number) => {
    setConstants(constants.filter((_, i) => i !== index));
  };

  const handleConstantChange = (index: number, field: 'name' | 'value', value: string) => {
    const updated = [...constants];
    const item = updated[index];
    if (item) {
      item[field] = value;
      setConstants(updated);
    }
  };

  const handleEvaluate = async () => {
    if (!expression) return;

    try {
      // Build variable map
      const variableMap: Record<string, number> = {};
      variables.forEach((v) => {
        if (v.name && v.value) {
          variableMap[v.name] = parseFloat(v.value);
        }
      });

      // Build constant array
      const constantArray = constants
        .filter((c) => c.name && c.value)
        .map((c) => ({
          name: c.name,
          value: parseFloat(c.value),
        }));

      // Call Cloud Function to evaluate
      const response = await fetch('/api/shapes/evaluate-formula', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expression,
          variables: variableMap,
          constants: constantArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          error: data.error || 'Formula evaluation failed',
        });
      } else {
        setResult({
          result: data.result,
          variables: data.variables || [],
          warnings: data.warnings || [],
        });
      }
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleExtractVariables = async () => {
    if (!expression) return;

    try {
      const response = await fetch('/api/shapes/extract-variables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expression,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          error: data.error || 'Variable extraction failed',
        });
      } else {
        // Auto-populate variables
        const extractedVars: string[] = data.variables || [];
        const newVariables = extractedVars.map((name: string) => ({
          name,
          value: '',
        }));
        setVariables(newVariables);

        setResult({
          variables: extractedVars,
        });
      }
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const loadExampleFormula = (formulaType: string) => {
    const examples: Record<string, { expression: string; variables: VariableInput[] }> = {
      cylinderVolume: {
        expression: 'pi * (D/2)^2 * L',
        variables: [
          { name: 'D', value: '1000' },
          { name: 'L', value: '3000' },
        ],
      },
      cylinderWeight: {
        expression: 'pi * ((D/2)^2 - ((D - 2*t)/2)^2) * L * density',
        variables: [
          { name: 'D', value: '1000' },
          { name: 't', value: '10' },
          { name: 'L', value: '3000' },
          { name: 'density', value: '7.85' },
        ],
      },
      plateWeight: {
        expression: 'L * W * t * density',
        variables: [
          { name: 'L', value: '2000' },
          { name: 'W', value: '1500' },
          { name: 't', value: '12' },
          { name: 'density', value: '7.85' },
        ],
      },
    };

    const example = examples[formulaType];
    if (example) {
      setExpression(example.expression);
      setVariables(example.variables);
      setConstants([]);
      setResult(null);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Formula Tester
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Test and validate mathematical formulas for shape calculations
        </Typography>

        {/* Quick Examples */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Examples:
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              label="Cylinder Volume"
              onClick={() => loadExampleFormula('cylinderVolume')}
              size="small"
            />
            <Chip
              label="Cylinder Weight"
              onClick={() => loadExampleFormula('cylinderWeight')}
              size="small"
            />
            <Chip
              label="Plate Weight"
              onClick={() => loadExampleFormula('plateWeight')}
              size="small"
            />
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Formula Expression */}
        <Box sx={{ mb: 3 }}>
          <TextField
            label="Formula Expression"
            fullWidth
            multiline
            rows={3}
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="e.g., pi * (D/2)^2 * L"
            helperText="Use operators: +, -, *, /, ^, sqrt(), sin(), cos(), etc."
          />
          <Button
            startIcon={<TestIcon />}
            onClick={handleExtractVariables}
            sx={{ mt: 1 }}
            size="small"
          >
            Extract Variables
          </Button>
        </Box>

        {/* Variables */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Variables
          </Typography>
          {variables.map((variable, index) => (
            <Grid container spacing={2} key={index} sx={{ mb: 1 }}>
              <Grid size={{ xs: 5 }}>
                <TextField
                  label="Name"
                  size="small"
                  fullWidth
                  value={variable.name}
                  onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
                  placeholder="D, L, t, etc."
                />
              </Grid>
              <Grid size={{ xs: 5 }}>
                <TextField
                  label="Value"
                  size="small"
                  fullWidth
                  type="number"
                  value={variable.value}
                  onChange={(e) => handleVariableChange(index, 'value', e.target.value)}
                  placeholder="1000"
                />
              </Grid>
              <Grid size={{ xs: 2 }}>
                <IconButton
                  onClick={() => handleRemoveVariable(index)}
                  color="error"
                  aria-label="Remove variable"
                >
                  <DeleteIcon />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Button startIcon={<AddIcon />} onClick={handleAddVariable} size="small">
            Add Variable
          </Button>
        </Box>

        {/* Constants */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Constants (Optional)
          </Typography>
          {constants.map((constant, index) => (
            <Grid container spacing={2} key={index} sx={{ mb: 1 }}>
              <Grid size={{ xs: 5 }}>
                <TextField
                  label="Name"
                  size="small"
                  fullWidth
                  value={constant.name}
                  onChange={(e) => handleConstantChange(index, 'name', e.target.value)}
                  placeholder="SF, K, etc."
                />
              </Grid>
              <Grid size={{ xs: 5 }}>
                <TextField
                  label="Value"
                  size="small"
                  fullWidth
                  type="number"
                  value={constant.value}
                  onChange={(e) => handleConstantChange(index, 'value', e.target.value)}
                  placeholder="1.5"
                />
              </Grid>
              <Grid size={{ xs: 2 }}>
                <IconButton
                  onClick={() => handleRemoveConstant(index)}
                  color="error"
                  aria-label="Remove constant"
                >
                  <DeleteIcon />
                </IconButton>
              </Grid>
            </Grid>
          ))}
          <Button startIcon={<AddIcon />} onClick={handleAddConstant} size="small">
            Add Constant
          </Button>
        </Box>

        {/* Evaluate Button */}
        <Button
          variant="contained"
          startIcon={<RunIcon />}
          onClick={handleEvaluate}
          disabled={!expression}
          fullWidth
        >
          Evaluate Formula
        </Button>

        {/* Results */}
        {result && (
          <Box sx={{ mt: 3 }}>
            {result.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {result.error}
              </Alert>
            )}

            {result.warnings && result.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {result.warnings.map((warning, index) => (
                  <div key={index}>{warning}</div>
                ))}
              </Alert>
            )}

            {result.result !== undefined && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="h6">Result: {result.result.toFixed(6)}</Typography>
              </Alert>
            )}

            {result.variables && result.variables.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Detected Variables:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {result.variables.map((variable) => (
                    <Chip key={variable} label={variable} size="small" color="primary" />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
