'use client';

import {
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
} from '@mui/material';
import type { FlowArrangement } from '@/lib/thermal';

interface LMTDInputsProps {
  flowArrangement: FlowArrangement;
  hotInlet: string;
  hotOutlet: string;
  coldInlet: string;
  coldOutlet: string;
  overallHTC: string;
  heatDutyForArea: string;
  onFlowArrangementChange: (value: FlowArrangement) => void;
  onHotInletChange: (value: string) => void;
  onHotOutletChange: (value: string) => void;
  onColdInletChange: (value: string) => void;
  onColdOutletChange: (value: string) => void;
  onOverallHTCChange: (value: string) => void;
  onHeatDutyForAreaChange: (value: string) => void;
}

export function LMTDInputs({
  flowArrangement,
  hotInlet,
  hotOutlet,
  coldInlet,
  coldOutlet,
  overallHTC,
  heatDutyForArea,
  onFlowArrangementChange,
  onHotInletChange,
  onHotOutletChange,
  onColdInletChange,
  onColdOutletChange,
  onOverallHTCChange,
  onHeatDutyForAreaChange,
}: LMTDInputsProps) {
  return (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel>Flow Arrangement</InputLabel>
        <Select
          value={flowArrangement}
          label="Flow Arrangement"
          onChange={(e) => onFlowArrangementChange(e.target.value as FlowArrangement)}
        >
          <MenuItem value="COUNTER">Counter-Current</MenuItem>
          <MenuItem value="PARALLEL">Parallel Flow</MenuItem>
          <MenuItem value="CROSSFLOW">Crossflow</MenuItem>
        </Select>
      </FormControl>

      <Typography variant="subtitle2" color="text.secondary">
        Hot Side
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label="Inlet"
          value={hotInlet}
          onChange={(e) => onHotInletChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">°C</InputAdornment>,
          }}
        />
        <TextField
          label="Outlet"
          value={hotOutlet}
          onChange={(e) => onHotOutletChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">°C</InputAdornment>,
          }}
        />
      </Stack>

      <Typography variant="subtitle2" color="text.secondary">
        Cold Side
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label="Inlet"
          value={coldInlet}
          onChange={(e) => onColdInletChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">°C</InputAdornment>,
          }}
        />
        <TextField
          label="Outlet"
          value={coldOutlet}
          onChange={(e) => onColdOutletChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">°C</InputAdornment>,
          }}
        />
      </Stack>

      <Divider />

      <Typography variant="subtitle2">Heat Exchanger Sizing</Typography>

      <TextField
        label="Overall HTC (U)"
        value={overallHTC}
        onChange={(e) => onOverallHTCChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">W/(m²·K)</InputAdornment>,
        }}
      />

      <TextField
        label="Heat Duty (Q)"
        value={heatDutyForArea}
        onChange={(e) => onHeatDutyForAreaChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kW</InputAdornment>,
        }}
        helperText="Enter to calculate required area"
      />
    </Stack>
  );
}
