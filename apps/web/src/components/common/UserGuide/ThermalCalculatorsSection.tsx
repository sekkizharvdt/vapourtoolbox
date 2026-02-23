'use client';

/**
 * Thermal Calculators Section
 *
 * User guide for thermal engineering calculators — siphon sizing, etc.
 */

import {
  Box,
  Typography,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import BatchPredictionIcon from '@mui/icons-material/BatchPrediction';
import TableChartIcon from '@mui/icons-material/TableChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SaveIcon from '@mui/icons-material/Save';
import { FeatureCard, StepGuide } from './helpers';

export function ThermalCalculatorsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Thermal Calculators provide engineering tools for MED (Multi-Effect Distillation) thermal
        desalination plant design. The Siphon Sizing Calculator is the primary tool, used to size
        inter-effect siphon pipes, determine minimum U-bend heights, and analyse pressure drop and
        flash vapor.
      </Typography>

      {/* Key Features */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Key Features
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <FeatureCard
          icon={<CalculateIcon color="primary" />}
          title="Single Siphon Mode"
          description="Size one siphon between two effects. Enter pressures, fluid properties, and geometry to get pipe size, minimum height, and detailed pressure drop analysis."
        />
        <FeatureCard
          icon={<BatchPredictionIcon color="primary" />}
          title="Batch Mode"
          description="Size all siphons across an entire MED train at once. Define your effect pressures and flows, override pipe sizes per siphon, and download per-siphon PDF reports."
        />
        <FeatureCard
          icon={<TableChartIcon color="primary" />}
          title="Excel Export"
          description="Download results as a styled Excel workbook with Summary and Detailed sheets. Available for both single and batch modes."
        />
        <FeatureCard
          icon={<PictureAsPdfIcon color="primary" />}
          title="PDF Report"
          description="Generate a formal engineering report with company logo, siphon diagram, input parameters, and full calculation breakdown. Available for both single and batch modes."
        />
        <FeatureCard
          icon={<SaveIcon color="primary" />}
          title="Save & Load"
          description="Save calculation inputs for later. Load any saved calculation to instantly restore all parameters. Works in both single and batch modes. Personal to each user."
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Single Siphon Mode */}
      <Typography variant="h6" gutterBottom>
        Using Single Siphon Mode
      </Typography>
      <Typography variant="body2" paragraph>
        Navigate to <strong>Thermal &rarr; Calculators &rarr; Siphon Sizing</strong>. The left panel
        contains input parameters; the right panel shows the siphon diagram and results.
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Set Effect Pressures',
            description:
              'Choose your pressure unit (mbar, bar, or kPa absolute), then enter the upstream and downstream effect pressures. The pressure difference is displayed automatically.',
          },
          {
            title: 'Configure Fluid Properties',
            description:
              'Select the fluid type (Seawater, Brine, or Distillate). For seawater and brine, enter the salinity in ppm. Saturation temperature and density are calculated from the upstream pressure.',
          },
          {
            title: 'Set Flow & Velocity',
            description:
              'Enter the mass flow rate (ton/hr) and target velocity (m/s). Choose the pipe schedule (Sch 10, 40, or 80). The calculator selects the pipe size that best matches your target velocity.',
          },
          {
            title: 'Configure Pipe Geometry',
            description:
              'Select the elbow configuration (2, 3, or 4 elbows) based on physical routing. Enter the horizontal distance between nozzle centres. For 3 or 4 elbow configs, also enter the lateral offset distance.',
          },
          {
            title: 'Set Safety Factor',
            description:
              'The safety factor (default 20%) is applied to the sum of static head and friction losses. A minimum of 20% is recommended.',
          },
          {
            title: 'Review Results',
            description:
              'Results appear on the right: selected pipe size, minimum siphon height, velocity status, flash vapor percentage, pressure drop breakdown, and holdup volume.',
          },
        ]}
      />

      <Divider sx={{ my: 3 }} />

      {/* Input Parameters Reference */}
      <Typography variant="h6" gutterBottom>
        Input Parameters Reference
      </Typography>

      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
        Effect Pressures
      </Typography>
      <Typography variant="body2" paragraph>
        The upstream effect has higher pressure; the downstream effect has lower pressure. The
        pressure difference drives the siphon flow. All pressures are absolute.
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Fluid Properties
      </Typography>
      <Typography variant="body2" paragraph>
        Seawater and brine use Sharqawy correlations for density, viscosity, and enthalpy (salinity
        range: 0&ndash;120,000 ppm). Distillate uses IAPWS-IF97 pure water properties. Boiling Point
        Elevation (BPE) is applied for saline fluids.
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Flow & Velocity
      </Typography>
      <Typography variant="body2" paragraph>
        Target velocity should be between 0.05 m/s (minimum, to prevent settling) and 1.0 m/s
        (maximum, to prevent erosion). The pipe schedule determines available pipe sizes &mdash; Sch
        40 (Standard) is the default.
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        Pipe Geometry &mdash; Elbow Configurations
      </Typography>
      <TableContainer sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Configuration</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>When to Use</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>2 Elbows (Same Plane)</TableCell>
              <TableCell>
                Simple U-pipe &mdash; nozzles are directly opposite in the same vertical plane
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>3 Elbows (Different Plane)</TableCell>
              <TableCell>
                Nozzles are offset laterally &mdash; pipe routes through a different plane
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>4 Elbows (Routing Around)</TableCell>
              <TableCell>Pipe must route around an adjacent siphon or obstruction</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle2" gutterBottom>
        Safety Factor
      </Typography>
      <Typography variant="body2" paragraph>
        Applied as a percentage of (static head + friction losses). The minimum recommended value is
        20%, ensuring reliable operation under transient conditions and measurement uncertainty.
      </Typography>

      <Divider sx={{ my: 3 }} />

      {/* Understanding Results */}
      <Typography variant="h6" gutterBottom>
        Understanding Results
      </Typography>

      <TableContainer sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Pipe Size</TableCell>
              <TableCell>
                Selected pipe from the chosen schedule that best matches the target velocity
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Min. Siphon Height</TableCell>
              <TableCell>
                Required U-bend depth below the nozzles = static head + friction + safety margin
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Velocity</TableCell>
              <TableCell>
                Actual fluid velocity in the pipe, with status: OK (green), LOW (yellow), HIGH (red)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Flash Vapor</TableCell>
              <TableCell>
                Percentage of fluid that flashes to steam at the downstream pressure
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Total Pressure Drop</TableCell>
              <TableCell>Friction-based pressure drop through the siphon (mbar)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Holdup Volume</TableCell>
              <TableCell>
                Internal volume of liquid in the siphon pipe (litres, or m&sup3; if large)
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" paragraph>
        The <strong>Height Breakdown</strong> table shows each component: static head (from pressure
        difference), friction losses (pipe + fittings), and safety margin. The{' '}
        <strong>Pressure Drop Details</strong> section itemises losses for each fitting (entrance,
        elbows, exit) with Reynolds number and flow regime.
      </Typography>

      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Flash Vapor:</strong> If the inlet temperature exceeds the downstream saturation
          temperature, partial flashing occurs. Flash fractions above 5% may cause two-phase flow
          issues &mdash; consider subcooling the fluid.
        </Typography>
      </Alert>

      <Divider sx={{ my: 3 }} />

      {/* Batch Mode */}
      <Typography variant="h6" gutterBottom>
        Batch Mode (All Effects)
      </Typography>
      <Typography variant="body2" paragraph>
        Batch mode sizes every siphon across an entire MED train. Navigate to{' '}
        <strong>Siphon Sizing &rarr; Batch Mode (All Effects)</strong> from the calculator header.
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Set Common Parameters',
            description:
              'The left panel has shared inputs applied to every siphon: pressure unit, fluid type, salinity, target velocity, pipe schedule, elbow configuration, distances, and safety factor.',
          },
          {
            title: 'Define Effects',
            description:
              'In the Effect Input Table, enter each effect\'s operating pressure and the flow rate to the next effect. Use "Add Effect" to add rows. Pressures must decrease from E1 to the last effect.',
          },
          {
            title: 'Review Results',
            description:
              'The results table shows each siphon: pipe size, minimum height, velocity, status, flash %, pressure drop, and holdup volume. A totals row summarises the entire train.',
          },
          {
            title: 'Override Pipe Size',
            description:
              'The Pipe Size column has a dropdown for each siphon. By default, the calculator auto-selects the best match for your target velocity. Use the dropdown to override with a different standard size (e.g., choose 6" instead of 5" for availability). Velocity status updates to reflect the actual velocity in the chosen pipe. Select "Auto" to revert.',
          },
          {
            title: 'Download Per-Siphon Reports',
            description:
              'Each siphon row has a download icon in the Report column. Click it to open the PDF Report dialog for that specific siphon, with the same detail level as single mode: pipe selection, height breakdown, pressure drop, flash vapor, and fluid properties.',
          },
          {
            title: 'Save & Export',
            description:
              'Click Save to store the full batch configuration (effect data, common parameters, and any pipe overrides) for later use. Click Load Saved in the header to restore a previous batch. Click the Excel button to download a summary workbook.',
          },
        ]}
      />

      <Divider sx={{ my: 3 }} />

      {/* Exporting */}
      <Typography variant="h6" gutterBottom>
        Exporting Results
      </Typography>

      <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
        Excel Export
      </Typography>
      <Typography variant="body2" paragraph>
        Click the <strong>Excel</strong> button (table icon) in the results section. Single mode
        generates a workbook with Summary and Detailed sheets. Batch mode generates a workbook with
        common parameters and a results table for all siphons.
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        PDF Report
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Single mode:</strong> Click <strong>PDF Report</strong> to open the report dialog.
        Enter a document number (default: SIPHON-001), revision, optional project name, and notes.
        The generated PDF includes the company logo, siphon diagram, all input parameters, pipe
        selection, height breakdown, pressure drop details, flash vapor analysis, and fluid
        properties.
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Batch mode:</strong> Each siphon row has a download icon in the Report column. Click
        it to generate a detailed PDF for that specific siphon with the same content as single mode.
      </Typography>

      <Divider sx={{ my: 3 }} />

      {/* Save & Load */}
      <Typography variant="h6" gutterBottom>
        Save & Load Calculations
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Save:</strong> After running a calculation, click <strong>Save</strong> and enter a
        descriptive name (e.g., &ldquo;MED Unit 1 &mdash; S-101/102&rdquo;). All input values are
        stored. In batch mode, the saved data includes effect pressures, flows, common parameters,
        and any pipe size overrides. Saved calculations are personal to your account.
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Load:</strong> Click <strong>Load Saved</strong> in the page header to browse your
        saved calculations. Click any entry to restore all its inputs. The calculator re-runs with
        the loaded values. Single mode and batch mode saves are kept separate.
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Delete:</strong> Click the delete icon next to any saved calculation in the load
        dialog to remove it from your list.
      </Typography>

      <Divider sx={{ my: 3 }} />

      {/* Tips & Warnings */}
      <Typography variant="h6" gutterBottom>
        Tips & Warnings
      </Typography>

      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Velocity too high (&gt; 1.0 m/s):</strong> Risk of pipe erosion and excessive
          noise. Increase pipe size or reduce flow rate.
        </Typography>
      </Alert>
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Velocity too low (&lt; 0.05 m/s):</strong> Risk of settling and blockages.
          Decrease pipe size or increase flow rate.
        </Typography>
      </Alert>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Custom pipe required:</strong> If the calculated pipe exceeds 24&quot; (the
          largest standard size), you will be prompted to enter custom plate-formed pipe dimensions.
        </Typography>
      </Alert>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Pipe size override:</strong> In batch mode, you can override the auto-selected
          pipe size for any siphon using the dropdown in the Pipe Size column. Use this when a
          specific pipe size is more readily available or when you want to standardise across
          siphons. Velocity status still applies to the chosen pipe.
        </Typography>
      </Alert>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Safety factor:</strong> Keep at 20% or above unless specific design justification
          exists. This margin accounts for transient conditions and measurement uncertainty.
        </Typography>
      </Alert>

      <Divider sx={{ my: 3 }} />

      {/* Calculation Methodology */}
      <Typography variant="h6" gutterBottom>
        Calculation Methodology
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Pipe Sizing:</strong> Mass flow is converted to volumetric flow using fluid density.
        The pipe with actual velocity closest to the target is selected from ASME B36.10 standard
        sizes (1/2&quot; to 48&quot;) in the chosen schedule.
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Pressure Drop (Darcy-Weisbach):</strong> Reynolds number determines the flow regime.
        Friction factor uses 64/Re for laminar flow or the Colebrook-White equation for turbulent
        flow (roughness = 0.046 mm for carbon steel). Losses are calculated for straight pipe,
        entrance (K=0.5), elbows (K=0.9 each), and exit (K=1.0).
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Siphon Height (Iterative):</strong> The minimum height is solved iteratively because
        pipe length depends on height, and friction depends on pipe length. The solution converges
        when height change is below 0.01 m between iterations.
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Flash Vapor:</strong> If the fluid temperature at upstream pressure exceeds the
        saturation temperature at downstream pressure, partial flashing occurs. The flash fraction
        is calculated from an enthalpy balance between inlet conditions and downstream equilibrium.
      </Typography>
    </Box>
  );
}
