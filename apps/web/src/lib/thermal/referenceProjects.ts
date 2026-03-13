/**
 * MED-TVC Reference Projects — As-Built Design Data
 *
 * Structured data extracted from real MED-TVC project datasheets
 * for engineering reference and calculator validation.
 */

export interface KeyValueRow {
  parameter: string;
  value: string;
  unit?: string;
}

export interface EquipmentSection {
  id: string;
  title: string;
  /** Optional description or note shown above the table */
  note?: string;
  /** Simple key-value table */
  rows?: KeyValueRow[];
  /** Multi-column comparison table */
  columns?: string[];
  columnRows?: Record<string, string[]>;
}

export interface ReferenceProject {
  id: string;
  name: string;
  location: string;
  /** Short subtitle shown on card */
  subtitle: string;
  /** Plant configuration summary */
  configuration: string;
  /** Key highlights for the card view */
  highlights: { label: string; value: string }[];
  overview: KeyValueRow[];
  equipment: EquipmentSection[];
  /** Derived performance data for calculator validation */
  derivedPerformance: KeyValueRow[];
  /** Derived engineering data — wetting rates, HTCs, specific loadings, etc. */
  derivedEngineering?: KeyValueRow[];
}

// ─── CAMPICHE ────────────────────────────────────────────────────────────────

const campiche: ReferenceProject = {
  id: 'campiche',
  name: 'Campiche',
  location: 'Chile',
  subtitle: '100 T/h Net, 4-Effect MED-TVC',
  configuration: '4-effect parallel feed MED-TVC',
  highlights: [
    { label: 'Capacity', value: '100 T/h' },
    { label: 'Effects', value: '4' },
    { label: 'GOR', value: '7.9' },
    { label: 'TBT', value: '53.3°C' },
  ],
  overview: [
    { parameter: 'Project', value: 'Campiche 240MW Coal Fired Power Project' },
    { parameter: 'Owner', value: 'Empresa Eléctrica Campiche S.A.' },
    { parameter: 'EPC', value: 'POSCO E&C' },
    { parameter: 'Process Designer', value: 'SWS (Saline Water Specialists), Job 11-886' },
    { parameter: 'Location', value: 'Campiche, Chile' },
    { parameter: 'Plant Type', value: 'MED-TVC (4-effect, parallel feed)' },
    { parameter: 'Net Production', value: '100,000 kg/h (100 T/h = 2,400 T/d)' },
    { parameter: 'GOR', value: '7.9' },
    { parameter: 'Number of Effects', value: '4' },
    { parameter: 'TBT', value: '53.3°C (estimated from Effect 1 vapour temp 52.6°C + BPE)' },
    { parameter: 'BBT', value: '40.2°C (estimated from Effect 4 vapour temp 40°C + BPE)' },
    { parameter: 'Seawater Inlet', value: '12–21°C' },
    { parameter: 'Brine TDS', value: '61,688 ppm' },
  ],
  equipment: [
    {
      id: 'utilities',
      title: 'Utility Requirements',
      rows: [
        {
          parameter: 'Medium Pressure Steam (TVC motive → DSH)',
          value: '345 kg/h at 14 bar, 260°C',
        },
        { parameter: 'Low Pressure Steam (TVC motive)', value: '12,500 kg/h at 3.5 bar, 160°C' },
        { parameter: 'Seawater', value: '550,000 kg/h' },
        { parameter: 'Instrument Air', value: '50 Nm³/h at 5.5–8 bar' },
      ],
    },
    {
      id: 'tvc',
      title: 'Thermocompressor (TVC)',
      rows: [
        { parameter: 'Manufacturer', value: 'Croll-Reynolds' },
        { parameter: 'Material', value: 'AISI 316L' },
        { parameter: 'Motive Steam Pressure', value: '4.5 bar abs' },
        { parameter: 'Motive Steam Temperature', value: '160°C' },
        { parameter: 'Motive Steam Flow', value: '12,500 kg/h' },
        { parameter: 'Suction Pressure', value: '0.072 bar abs' },
        { parameter: 'Suction Temperature', value: '39.5°C' },
        { parameter: 'Suction Flow (entrained vapour)', value: '12,904 kg/h' },
        { parameter: 'Discharge Pressure', value: '0.172 bar abs' },
        { parameter: 'Discharge Temperature', value: '93.6°C (before DSH)' },
        { parameter: 'Discharge Flow', value: '25,404 kg/h' },
        { parameter: 'Entrainment Ratio', value: '1.032' },
        { parameter: 'Compression Ratio', value: '2.39' },
        {
          parameter: 'Desuperheating',
          value: '680 kg/h distillate at 4.5 bar / 39.5°C → 60.1°C outlet',
        },
        { parameter: 'Dimensions', value: 'Dm=254mm, Ds=1067mm, Dd=1067mm, L=8204mm' },
        { parameter: 'Weight', value: '~1.6 ton' },
      ],
    },
    {
      id: 'evaporator',
      title: 'Evaporator',
      rows: [
        { parameter: 'Type', value: 'Shell & Tube, Horizontal Cylindrical' },
        { parameter: 'Number of Effects', value: '4' },
        { parameter: 'Heat Transfer Area', value: '4 × 1,459 m² = 5,836 m² total' },
        { parameter: 'Tubes per Effect', value: '3,100' },
        { parameter: 'Tube OD × Thk', value: '25.4 × 1.2 mm (alloy) + 25.4 × 0.5 mm (Ti)' },
        { parameter: 'Tube Length', value: '5,900 mm' },
        { parameter: 'Tube Pitch', value: '33.4 mm (triangular)' },
        { parameter: 'Tube Fixing', value: 'Grommet fixed' },
        { parameter: 'Vessel OD', value: '3,320 mm' },
        { parameter: 'Shell Material', value: 'SA 240 UNS S32304 (duplex stainless)' },
        { parameter: 'Design Pressure', value: '0.49 bar & FV (shell) / 8 bar FV (tube)' },
        { parameter: 'Fouling Factor', value: '0.00022 m²·°C/W' },
        { parameter: 'Weight (empty/operating/flooded)', value: '68 / 167 / 316 ton' },
      ],
    },
    {
      id: 'condenser',
      title: 'Final Condenser',
      rows: [
        { parameter: 'Type', value: 'One shell, 4-pass, divided water box' },
        { parameter: 'Design Surface', value: '454.6 m²' },
        { parameter: 'Heat Duty', value: '8,131 kW' },
        { parameter: 'LMTD', value: '9.01°C' },
        { parameter: 'HTC', value: '2,082.4 W/m²·K' },
        { parameter: 'Tubes', value: '250 tubes/pass × 4 passes = 1,000 tubes' },
        { parameter: 'Tube OD × Thk', value: '19.05 × 0.5 mm, SB338 Gr.2 (Ti)' },
        { parameter: 'Tube Length', value: '7,700 mm' },
        { parameter: 'Shell Material', value: 'SA 240 UNS S32304' },
        { parameter: 'SW Flow', value: '489,421 kg/h' },
        { parameter: 'SW In/Out Temp', value: '21°C / 36°C' },
        { parameter: 'Vapour In', value: '113,351 kg/h at 43.7°C' },
        { parameter: 'Fouling (shell/tube)', value: '0.0001 / 0.00018 m²·°C/W' },
        { parameter: 'Dimensions', value: 'ø1.6 × 9.68 m' },
      ],
    },
    {
      id: 'preheaters',
      title: 'Preheaters',
      note: 'SW flows through preheaters in reverse effect order (4th → 3rd → 2nd), each using vapour from its corresponding effect.',
      columns: ['Parameter', '2nd Cell PH', '3rd Cell PH', '4th Cell PH'],
      columnRows: {
        'Design Surface (m²)': ['62.48', '104.13', '124.96'],
        'Calculated Surface (m²)': ['47.66', '75.01', '83.89'],
        Overdesign: ['31%', '39%', '49%'],
        'Tubes/Pass': ['180', '150', '180'],
        'Tube OD × Thk (mm)': ['19.05 × 0.5', '19.05 × 0.5', '19.05 × 0.5'],
        'Tube Material': ['SB338 Gr2 (Ti)', 'SB338 Gr2 (Ti)', 'SB338 Gr2 (Ti)'],
        'Vapour Flow (kg/h)': ['975', '1,455.9', '1,572.3'],
        'SW Flow (kg/h)': ['133,333', '200,000', '266,667'],
        'SW Temp In → Out (°C)': ['43.9 → 48.2', '39.5 → 43.9', '36.0 → 39.5'],
        'Heat Duty (kW)': ['643.2', '964.4', '1,034.1'],
        'HTC (W/m²·K)': ['2,150.5', '2,048.5', '2,079.3'],
        'LMTD (°C)': ['6.28', '6.28', '5.93'],
      },
    },
    {
      id: 'demisters',
      title: 'Demisters',
      rows: [
        { parameter: 'Manufacturer', value: 'Costacurta' },
        { parameter: 'Type', value: 'Wire Mesh, Rectangular, Horizontal' },
        { parameter: 'Material', value: 'SS AISI 316' },
        { parameter: 'Pads per Effect', value: '26' },
        { parameter: 'Pad Dimensions', value: 'L=840 × W=470 × H=110 mm' },
        { parameter: 'Required Area', value: '8.48 m² per effect' },
        { parameter: 'Separation Efficiency', value: '> 99.9%' },
      ],
    },
    {
      id: 'effect-performance',
      title: 'Effect-wise Vapour Production',
      columns: ['Effect', 'Vapour (T/h)', 'Temp (°C)', 'Demister Velocity (m/s)'],
      columnRows: {
        '1': ['26.0', '52.6', '6.92'],
        '2': ['25.3', '48.2', '7.58'],
        '3': ['24.6', '43.9', '8.32'],
        '4': ['24.4', '40.0', '26.39'],
      },
    },
    {
      id: 'vacuum-ejectors',
      title: 'Vacuum Ejectors',
      note: '2-stage steam jet ejector train with intercondenser between stages. Motive steam at 15 bar / 260°C.',
      columns: ['Parameter', '1st Stage', '2nd Stage', 'Hogging'],
      columnRows: {
        Manufacturer: ['Croll Reynolds', 'Croll Reynolds', 'Croll Reynolds'],
        'Motive Steam (kg/h)': ['142.5', '199.5', '122'],
        'Motive Pressure': ['15 bar, 260°C', '15 bar, 260°C', '15 bar, 260°C'],
        'Suction Pressure (bar a)': ['0.072', '0.261', 'ATM ÷ 0.25'],
        'Discharge Pressure (bar a)': ['0.261', '1.127', 'ATM'],
        'Discharge Flow (kg/h)': ['229.7', '263.6', '247'],
      },
    },
    {
      id: 'intercondensers',
      title: 'Intercondenser & Aftercondenser',
      columns: ['Parameter', 'Intercondenser', 'Aftercondenser'],
      columnRows: {
        'Design Surface (m²)': ['7.18', '3.59'],
        'Tube OD × Thk': ['19.05 × 0.5 mm', '19.05 × 0.5 mm'],
        'Tube Material': ['SB338 Gr2 (Ti)', 'SB338 Gr2 (Ti)'],
        'Shell Vapour In (kg/h)': ['192', '198'],
        'Shell Temp In → Out (°C)': ['175 → 66', '187 → 103'],
        'Heat Duty (kW)': ['87.4', '98.7'],
        'HTC (W/m²·K)': ['2,170.6', '2,096.2'],
        'LMTD (°C)': ['17.2', '52.95'],
      },
    },
    {
      id: 'pumps',
      title: 'Pumps & Auxiliaries',
      note: 'All pumps: 2 × 100% (1 operating + 1 standby)',
      columns: ['Equipment', 'Motor (kW)', 'Flow', 'Head'],
      columnRows: {
        'Product Water Pump': ['37', '120 m³/h', '51.5 m'],
        'Brine Blowdown Pump': ['30', '170 m³/h', '36.5 m'],
        'Sea Water Transfer Pump': ['160', '550 m³/h', '60 m'],
        'Sump Pump': ['2.2', '10 m³/h', '15 mH'],
        'SW Self-Cleaning Filter': ['0.25', '550 m³/h', '—'],
      },
    },
  ],
  derivedPerformance: [
    { parameter: 'Total Evaporator Area', value: '5,836 m²' },
    { parameter: 'Area per Effect', value: '1,459 m²' },
    { parameter: 'Specific Area', value: '58.4 m²/(T/h)' },
    { parameter: 'GOR', value: '7.9' },
    { parameter: 'TVC Entrainment Ratio', value: '1.032' },
    { parameter: 'TVC Compression Ratio', value: '2.39' },
    { parameter: 'Condenser Heat Load', value: '8,131 kW' },
    { parameter: 'Total Preheater Duty', value: '2,641.7 kW' },
    { parameter: 'SW ΔT (Condenser)', value: '15°C' },
    { parameter: 'SW ΔT (Preheater Chain)', value: '12.2°C' },
    { parameter: 'Motive Steam Consumption', value: '12,500 kg/h' },
    { parameter: 'MP Steam (ejectors)', value: '345 kg/h' },
    { parameter: 'Total Installed Pump Power', value: '~459 kW' },
  ],
  derivedEngineering: [
    // Evaporator — derived from datasheet values
    {
      parameter: 'Evaporator Heat Flux',
      value: '~4.3 kW/m² (estimated from 25 T/h vapour × 2,400 kJ/kg ÷ 1,459 m²/effect)',
    },
    { parameter: 'Evaporator ΔT per Effect', value: '~3.2°C (52.6→40.0 over 4 effects)' },
    {
      parameter: 'Evaporator Tube Loading',
      value: '~8.1 kg/h per tube (25,000 kg/h vapour ÷ 3,100 tubes)',
    },
    {
      parameter: 'Evaporator Wetting Rate (Γ)',
      value: '~0.043 kg/m·s per side (est. 44 T/h feed ÷ 3,100 tubes ÷ 5.9m ÷ 2)',
    },
    { parameter: 'Tube Bundle Aspect Ratio', value: '1.75 (L/D = 5,900/3,320)' },

    // Condenser — from datasheet
    { parameter: 'Condenser Overall HTC', value: '2,082 W/m²·K' },
    { parameter: 'Condenser LMTD', value: '9.01°C' },
    { parameter: 'Condenser Heat Flux', value: '17.9 kW/m² (8,131 kW ÷ 454.6 m²)' },
    { parameter: 'Condenser SW Velocity', value: '2.27 m/s' },
    { parameter: 'Condenser Vapour Loading', value: '113.4 kg/h per tube (113,351 ÷ 1,000)' },

    // Preheaters — from datasheet
    { parameter: 'Preheater Average HTC', value: '2,093 W/m²·K (avg of 2,150 / 2,049 / 2,079)' },
    { parameter: 'Preheater Average LMTD', value: '6.16°C' },
    { parameter: 'Preheater Average Overdesign', value: '40% (range 31–49%)' },
    { parameter: 'Preheater SW Velocity', value: '1.58–1.79 m/s' },

    // Intercondenser/Aftercondenser — from datasheet
    { parameter: 'Intercondenser HTC', value: '2,171 W/m²·K' },
    { parameter: 'Aftercondenser HTC', value: '2,096 W/m²·K' },

    // System-level ratios
    { parameter: 'Specific Power Consumption', value: '~4.6 kWh/m³ (459 kW ÷ 100 m³/h)' },
    { parameter: 'Seawater Utilisation', value: '18.2% (100 T/h product ÷ 550 T/h intake)' },
    { parameter: 'Condenser to Evaporator Area Ratio', value: '7.8% (454.6 ÷ 5,836)' },
    { parameter: 'Total Preheater to Evaporator Area Ratio', value: '5.0% (291.6 ÷ 5,836)' },
  ],
};

// ─── CADAFE ──────────────────────────────────────────────────────────────────

const cadafe: ReferenceProject = {
  id: 'cadafe',
  name: 'CADAFE I',
  location: 'Venezuela',
  subtitle: '2 × 104.2 T/h, 6-Effect MED-TVC',
  configuration: '6-effect MED-TVC (4+2 split shell), 2 identical units',
  highlights: [
    { label: 'Capacity', value: '104.2 T/h × 2' },
    { label: 'Effects', value: '6 (4+2)' },
    { label: 'GOR', value: '10' },
    { label: 'TBT', value: '63°C' },
  ],
  overview: [
    { parameter: 'Project', value: 'CADAFE Plantacentro Desalination, Venezuela' },
    { parameter: 'Process Designer', value: 'SWS (Saline Water Specialists)' },
    { parameter: 'Plant Type', value: 'MED-TVC (6-effect, 2 identical units)' },
    { parameter: 'Design Total Capacity', value: '104,170 kg/h (104.2 T/h) per unit' },
    { parameter: 'Design Net Capacity', value: '94,700 kg/h (94.7 T/h) per unit' },
    { parameter: 'Number of Effects', value: '6 (split: 4 in large shell + 2 in small shell)' },
    { parameter: 'Number of Shells', value: '2 per unit' },
    { parameter: 'GOR', value: '10 (net distillate / steam to TVC)' },
    { parameter: 'TBT', value: '63°C (max 67°C any condition)' },
    { parameter: 'BBT', value: '45.4°C' },
    { parameter: 'Seawater Design Temp', value: '29.5°C (max 32°C)' },
    { parameter: 'Seawater TDS', value: '38,000 ppm' },
    { parameter: 'Seawater Flow', value: 'max 380 m³/h at 32°C' },
    { parameter: 'Min Continuous Production', value: '50%' },
    { parameter: 'Distillate Purity', value: 'TDS < 2 ppm' },
    { parameter: 'Plant Dimensions', value: 'L=33,700 × W=18,000 × H=9,000 mm' },
  ],
  equipment: [
    {
      id: 'tvc',
      title: 'Thermocompressor (TVC)',
      rows: [
        { parameter: 'Manufacturer', value: 'Korting Hannover AG' },
        { parameter: 'Type', value: 'Single-stage vacuum steam ejector, fixed nozzle' },
        { parameter: 'Material', value: '316L SS (all components)' },
        { parameter: 'Motive Steam Pressure', value: '9.5 bar abs (design), max 11 bar' },
        { parameter: 'Motive Steam Temperature', value: '180°C (design)' },
        { parameter: 'Motive Steam Flow', value: '9,470 kg/h' },
        { parameter: 'Suction Pressure', value: '0.134 bar abs' },
        { parameter: 'Suction Temperature', value: '51.9°C' },
        { parameter: 'Suction Flow', value: '12,382 kg/h' },
        { parameter: 'Discharge Pressure', value: '0.270 bar abs' },
        { parameter: 'Discharge Temperature', value: '91°C' },
        { parameter: 'Discharge Flow', value: '21,852 kg/h' },
        { parameter: 'Entrainment Ratio', value: '1.307' },
        { parameter: 'Compression Ratio', value: '2.01' },
        { parameter: 'Dimensions', value: 'Dm=8", Ds=36", Dd=36"' },
      ],
    },
    {
      id: 'desuperheater',
      title: 'Desuperheater',
      rows: [
        { parameter: 'Manufacturer', value: 'SWS' },
        { parameter: 'Steam Outlet Flow', value: '22,450 kg/h' },
        { parameter: 'Spray Water Flow', value: '598 kg/h' },
        { parameter: 'Design Pressure', value: 'Full Vacuum' },
        { parameter: 'Material', value: '316L SS body and spray nozzles' },
      ],
    },
    {
      id: 'evaporator',
      title: 'Evaporator',
      note: 'Split shell design: Effects 1–4 in large shell, Effects 5–6 in small shell. Total tubes per unit: 980 Ti + 24,898 Al = 25,878.',
      columns: ['Parameter', 'Effects 1–4 (Large)', 'Effects 5–6 (Small)'],
      columnRows: {
        'Vessel ID (mm)': ['3,500 / 3,300', '2,100 / 2,600'],
        'Cylindrical Length (mm)': ['30,700', '21,900'],
        'Shell Thickness (mm)': ['12', '12'],
        'Shell Material': ['C.S. + epoxy', 'C.S. + epoxy'],
        'Exchange Surface/Effect (m²)': ['1,850', '950'],
        'Tubes/Effect': ['5,143', '2,653'],
        'Tube OD (mm)': ['19.05 (Al + Ti top 3)', '19.05 (Al + Ti top 3)'],
        'Tube Thk (Al / Ti)': ['1.2 / 0.4 mm', '1.2 / 0.4 mm'],
        'Tube Length': ['6,040 mm', '6,040 mm'],
        'Tube Pitch': ['26 mm triangular', '26 mm triangular'],
        'Tube Fixing': ['Rubber grommets', 'Rubber grommets'],
        'Weight Empty (kg)': ['130,900 (whole unit)', 'Included'],
        'Weight Full (kg)': ['565,000', 'Included'],
      },
    },
    {
      id: 'condenser',
      title: 'Final Condenser',
      rows: [
        { parameter: 'Exchange Surface', value: '380–413 m²' },
        { parameter: 'Arrangement', value: '4 passes' },
        { parameter: 'Tubes/Pass', value: '256' },
        { parameter: 'Total Tubes', value: '1,024–1,160' },
        { parameter: 'Tube OD × Thk', value: '19.05 × 0.4–0.5 mm (Ti B338 Gr.2)' },
        { parameter: 'Tube Length', value: '6,040 mm' },
        { parameter: 'Shell Material', value: 'C.S. + epoxy (ebonite-lined waterboxes)' },
        { parameter: 'SW Flow', value: '360–480,000 kg/h' },
        { parameter: 'SW Inlet Temp', value: '29.5°C' },
        { parameter: 'SW Outlet Temp', value: '41.3–42°C' },
        { parameter: 'Fouling Factor', value: '0.00022 m²·°C/W' },
      ],
    },
    {
      id: 'preheaters',
      title: 'Preheaters',
      note: 'Only 2 preheaters (on effects 2 and 4), compared to Campiche which has 3.',
      columns: ['Parameter', 'PH Effect 4', 'PH Effect 2'],
      columnRows: {
        'Shell Diameter (mm)': ['590', '470'],
        Tubes: ['160', '90'],
        Passes: ['1', '1'],
        'Tube Length (mm)': ['6,040', '6,040'],
        'Tube Material': ['Ti B338 Gr.2', 'Ti B338 Gr.2'],
        'Exchange Surface (m²)': ['56.5', '31.8'],
        'SW Flow (kg/h)': ['234,400', '117,200'],
        'Vapour Flow (kg/h)': ['1,824', '1,183'],
        'SW Temp In → Out (°C)': ['43.6 → 48.3', '48.3 → 54.2'],
        'Vapour Temp (°C)': ['54.8', '61.6'],
        'SW Velocity (m/s)': ['1.6', '1.6'],
      },
    },
    {
      id: 'vacuum',
      title: 'Vacuum System',
      rows: [
        { parameter: 'Type', value: '2-stage steam ejector' },
        { parameter: 'NCG Load', value: '35 kg/h design (32 + 10% margin)' },
        { parameter: 'NCG Breakdown', value: 'O₂ 1.8 + N₂ 4.2 + CO₂ 20 + Air leakage 6 = 32 kg/h' },
        { parameter: '1st Stage Motive', value: '390 kg/h at 9 bar' },
        { parameter: '1st Stage Suction', value: '106 mbar, total 357 kg/h' },
        { parameter: '1st Stage Discharge', value: '320 mbar (CR=3)' },
        { parameter: 'Intercondenser', value: '10 m², 157 tubes × 18mm OD' },
        { parameter: '2nd Stage Motive', value: '200 kg/h at 9 bar' },
        { parameter: '2nd Stage Discharge', value: 'Atmospheric (CR=3)' },
        { parameter: 'Total Motive Steam', value: '590–850 kg/h' },
        { parameter: 'Hogging Ejector', value: '1,250 kg/h steam, 210 min to vacuum' },
      ],
    },
    {
      id: 'pumps',
      title: 'Pumps',
      note: 'All major pumps: 2 × 100% (1 operating + 1 standby). Voltage: 415V / 60Hz.',
      columns: ['Equipment', 'Flow (kg/h)', 'Head (mWC)', 'Motor (kW)'],
      columnRows: {
        'Brine Extraction': ['200,000', '25', '35'],
        'Distillate Extraction': ['70,000', '65', '35'],
        Remineralization: ['40,000', '55', '11'],
        'Antiscalant Dosing': ['7.5 l/h', '4.5 bar', '0.25'],
        'Antifoam Dosing': ['7.5 l/h', '4.5 bar', '0.25'],
        'Acid Cleaning': ['50,000', '35', '11'],
      },
    },
  ],
  derivedPerformance: [
    { parameter: 'Total Evaporator Area', value: '4×1,850 + 2×950 = 9,300 m²' },
    { parameter: 'Specific Area', value: '89.3 m²/(T/h)' },
    { parameter: 'GOR', value: '10' },
    { parameter: 'TVC Entrainment Ratio', value: '1.307' },
    { parameter: 'TVC Compression Ratio', value: '2.01' },
    { parameter: 'SW ΔT (Condenser)', value: '11.8°C' },
    { parameter: 'SW ΔT (Preheater Chain)', value: '10.6°C' },
    { parameter: 'Motive Steam (TVC)', value: '9,470 kg/h' },
    { parameter: 'Motive Steam (ejectors)', value: '590–850 kg/h' },
    { parameter: 'Distillate Split', value: '≥40 T/h pure + 64.2 T/h mix' },
  ],
  derivedEngineering: [
    // Evaporator — derived from datasheet values
    {
      parameter: 'Evaporator Heat Flux (Eff 1–4)',
      value: '~2.5 kW/m² (est. 17.4 T/h vapour × 2,380 kJ/kg ÷ 1,850 m²)',
    },
    {
      parameter: 'Evaporator Heat Flux (Eff 5–6)',
      value: '~4.3 kW/m² (est. from reduced area 950 m²)',
    },
    { parameter: 'Evaporator ΔT per Effect', value: '~2.9°C (63→45.4 over 6 effects)' },
    {
      parameter: 'Evaporator Tube Loading (Eff 1–4)',
      value: '~3.4 kg/h per tube (17,400 ÷ 5,143)',
    },
    {
      parameter: 'Evaporator Tube Loading (Eff 5–6)',
      value: '~6.6 kg/h per tube (17,400 ÷ 2,653)',
    },
    { parameter: 'Evaporator Wetting Rate (Γ, Eff 1–4)', value: '~0.028 kg/m·s per side (est.)' },
    {
      parameter: 'Vapour Duct Velocity (Eff 4→5)',
      value: '~60 m/s (800mm duct, 9.3 T/h at 130 mbar)',
    },

    // Condenser — from datasheet
    { parameter: 'Condenser Fouling Factor', value: '0.00022 m²·°C/W' },
    { parameter: 'Condenser SW Velocity', value: '1.6–1.76 m/s' },

    // Preheaters — from datasheet
    { parameter: 'Preheater SW Velocity', value: '1.6 m/s (both preheaters)' },
    { parameter: 'Preheater PH4 Area', value: '56.5 m²' },
    { parameter: 'Preheater PH2 Area', value: '31.8 m²' },

    // System-level ratios
    { parameter: 'Seawater Utilisation', value: '~27.4% (104.2 T/h ÷ 380 m³/h)' },
    { parameter: 'Condenser to Evaporator Area Ratio', value: '4.1–4.4% (380–413 ÷ 9,300)' },
    { parameter: 'NCG as % of Vapour', value: '~0.2% (35 kg/h NCG vs ~17,400 kg/h vapour/effect)' },
    { parameter: 'Tube Material Split (Ti/Al)', value: '3.8% Ti / 96.2% Al (980/24,898 tubes)' },
  ],
};

// ─── MORON ───────────────────────────────────────────────────────────────────

const moron: ReferenceProject = {
  id: 'moron',
  name: 'MORON',
  location: 'Venezuela',
  subtitle: 'MED-TVC (Figueras Project)',
  configuration: 'MED-TVC — construction drawings available',
  highlights: [
    { label: 'Status', value: 'As Built' },
    { label: 'Designer', value: 'SWS' },
    { label: 'Shell Material', value: 'Duplex SS' },
    { label: 'Data', value: 'Drawings' },
  ],
  overview: [
    { parameter: 'Project', value: 'MORON Desalination Plant (Figueras Project)' },
    { parameter: 'Process Designer', value: 'SWS (Saline Water Specialists)' },
    { parameter: 'Document System', value: 'CCFM-F-30-230 series' },
    { parameter: 'Document Status', value: 'AS BUILT' },
  ],
  equipment: [
    {
      id: 'evaporator',
      title: 'Evaporator (from GP-1017 Drawing)',
      rows: [
        { parameter: 'Design Code', value: 'ASME VIII Div.1 (2007 Edition)' },
        { parameter: 'Design Pressure (Shell)', value: '0.49 bar / Full Vacuum' },
        { parameter: 'Operating Pressure', value: '0.14 bar (0.16 bar MAWP)' },
        { parameter: 'Design Temperature', value: '66.5°C / 53.5°C (in/out)' },
        { parameter: 'Product Weight', value: '53,000 kg' },
        { parameter: 'Shell Material', value: 'SA 240 UNS S32304' },
        { parameter: 'Tubes Material', value: 'SA 240 UNS S32304a' },
        { parameter: 'Insulation Thickness', value: '60 mm (120 mm)' },
      ],
    },
    {
      id: 'documents',
      title: 'Document Inventory',
      note: 'Engineering construction drawings in PDF format. Parts A & B contain equipment design data.',
      columns: ['Part', 'Content', 'Files', 'Relevance'],
      columnRows: {
        A: ['Equipment GP sheets (evaporator, material lists)', '11 PDFs', 'HIGH'],
        B: ['Equipment GPs (continued)', '10 PDFs', 'HIGH'],
        C: ['Structural supports', '7 PDFs', 'LOW'],
        D: ['Piping layouts & details', '18 PDFs', 'MEDIUM'],
        E: ['General piping layouts', '5 PDFs', 'MEDIUM'],
        F: ['Instrumentation & electrical', '5 PDFs', 'LOW'],
        G: ['Instrumentation & electrical (cont.)', '11 PDFs', 'LOW'],
        H: ['Structural assembly details', '17 PDFs', 'LOW'],
      },
    },
  ],
  derivedPerformance: [
    { parameter: 'TBT (from design temp)', value: '~66.5°C' },
    { parameter: 'Shell Material', value: 'SA 240 UNS S32304 (duplex, same as Campiche)' },
    { parameter: 'Design Pressure', value: '0.49 bar & FV (same as Campiche)' },
  ],
};

// ─── CROSS-PROJECT COMPARISON ────────────────────────────────────────────────

export const crossProjectComparison = {
  columns: ['Parameter', 'Campiche', 'CADAFE', 'MORON'],
  rows: [
    ['Capacity (T/h net)', '100', '94.7', 'TBD'],
    ['Effects', '4', '6 (4+2 split shell)', 'TBD'],
    ['GOR', '7.9', '10', 'TBD'],
    ['TBT (°C)', '~53.3', '63 (max 67)', '~66.5'],
    ['BBT (°C)', '~40.2', '45.4', 'TBD'],
    ['SW Inlet (°C)', '12–21', '29.5 (max 32)', 'TBD'],
    ['Shell Material', 'Duplex SS (S32304)', 'C.S. + epoxy', 'Duplex SS (S32304)'],
    ['Evap Tube OD (mm)', '25.4', '19.05', 'TBD'],
    ['TVC Manufacturer', 'Croll-Reynolds', 'Korting Hannover', 'TBD'],
    ['TVC Motive Steam', '12,500 kg/h @ 4.5 bar', '9,470 kg/h @ 9.5 bar', 'TBD'],
    ['TVC Entrainment Ratio', '1.032', '1.307', 'TBD'],
    ['TVC Compression Ratio', '2.39', '2.01', 'TBD'],
    ['Area/Effect (m²)', '1,459', '1,850 / 950', 'TBD'],
    ['Total Area (m²)', '5,836', '9,300', 'TBD'],
    ['Specific Area (m²/T/h)', '58.4', '89.3', 'TBD'],
    ['Condenser Area (m²)', '454.6', '380–413', 'TBD'],
  ],
};

export const REFERENCE_PROJECTS: ReferenceProject[] = [campiche, cadafe, moron];
