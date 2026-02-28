/**
 * NCG Properties — Excel Export
 *
 * Exports calculation results to a two-sheet Excel workbook:
 *   • Summary   — key results, composition, conditions
 *   • Detailed  — full thermodynamic + transport properties, seawater dissolution info
 *
 * Uses ExcelJS following the siphonExcelExport pattern.
 */

import ExcelJS from 'exceljs';
import type { NCGResult, NCGInputMode } from './ncgCalculator';

interface ExportMeta {
  title?: string;
  projectName?: string;
}

const MODE_LABELS: Record<NCGInputMode, string> = {
  seawater: 'Seawater Feed',
  dry_ncg: 'Dry NCG Flow',
  wet_ncg: 'Wet NCG (Total) Flow',
};

// ── Style helpers ──────────────────────────────────────────────────────────────

function sectionHeader(ws: ExcelJS.Worksheet, row: number, label: string, cols: number) {
  const r = ws.getRow(row);
  r.getCell(1).value = label;
  r.getCell(1).font = { bold: true, color: { argb: 'FF1565C0' } };
  r.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE3F2FD' },
  };
  for (let c = 1; c <= cols; c++) {
    ws.getRow(row).getCell(c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' },
    };
  }
  ws.mergeCells(row, 1, row, cols);
  r.font = { bold: true, color: { argb: 'FF1565C0' } };
}

function dataRow(
  ws: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string | number,
  unit: string
) {
  ws.getRow(row).values = ['', label, value, unit];
  ws.getRow(row).getCell(2).font = { bold: false };
  ws.getRow(row).getCell(3).alignment = { horizontal: 'right' };
}

function totalRow(
  ws: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string | number,
  unit: string
) {
  ws.getRow(row).values = ['', label, value, unit];
  ws.getRow(row).font = { bold: true };
  ws.getRow(row).getCell(3).alignment = { horizontal: 'right' };
  ws.getRow(row).getCell(2).border = { top: { style: 'medium' } };
  ws.getRow(row).getCell(3).border = { top: { style: 'medium' } };
  ws.getRow(row).getCell(4).border = { top: { style: 'medium' } };
}

function fmt(value: number, decimals: number = 3): string {
  return value.toFixed(decimals);
}

// ── Main export ────────────────────────────────────────────────────────────────

export interface NCGReportInputs {
  mode: NCGInputMode;
  temperatureC: string;
  pressureBar: string;
  useSatPressure: boolean;
  seawaterFlowM3h?: string;
  seawaterTempC?: string;
  salinityGkg?: string;
  dryNcgFlowKgH?: string;
  wetNcgFlowKgH?: string;
}

export async function exportNCGToExcel(
  result: NCGResult,
  inputs: NCGReportInputs,
  meta: ExportMeta = {}
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vapour Toolbox';
  workbook.created = new Date();

  // ── Sheet 1: Summary ─────────────────────────────────────────────────────────
  const ws1 = workbook.addWorksheet('Summary');
  ws1.columns = [
    { key: 'indent', width: 3 },
    { key: 'label', width: 38 },
    { key: 'value', width: 22 },
    { key: 'unit', width: 18 },
  ];

  let r = 1;

  // Title
  if (meta.title || meta.projectName) {
    ws1.getRow(r).getCell(2).value = meta.title ?? 'NCG Properties Calculation';
    ws1.getRow(r).getCell(2).font = { bold: true, size: 13, color: { argb: 'FF1565C0' } };
    ws1.mergeCells(r, 2, r, 4);
    r++;
    if (meta.projectName) {
      ws1.getRow(r).getCell(2).value = meta.projectName;
      ws1.getRow(r).getCell(2).font = { italic: true };
      ws1.mergeCells(r, 2, r, 4);
      r++;
    }
    r++;
  }

  // ── RESULT ──────────────────────────────────────────────────────────────────
  sectionHeader(ws1, r, 'RESULT', 4);
  r++;
  dataRow(ws1, r++, 'Temperature', fmt(result.temperatureC, 1), '°C');
  dataRow(ws1, r++, 'Total Pressure', fmt(result.totalPressureBar, 5), 'bar abs');
  dataRow(ws1, r++, 'Saturation Pressure P_sat(T)', fmt(result.satPressureBar, 5), 'bar');
  dataRow(
    ws1,
    r++,
    'Water Vapour Partial Pressure',
    fmt(result.waterVapourPartialPressureBar, 5),
    'bar'
  );
  dataRow(ws1, r++, 'NCG Partial Pressure', fmt(result.ncgPartialPressureBar, 5), 'bar');
  r++;

  // ── COMPOSITION ──────────────────────────────────────────────────────────────
  sectionHeader(ws1, r, 'COMPOSITION', 4);
  r++;
  // Table header
  ws1.getRow(r).values = ['', 'Component', 'Mole Frac.', 'Mass Frac.'];
  ws1.getRow(r).font = { bold: true };
  ws1.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
  r++;
  ws1.getRow(r).values = [
    '',
    'Water Vapour (H₂O)',
    fmt(result.waterVapourMoleFrac, 4),
    fmt(result.waterVapourMassFrac, 4),
  ];
  r++;
  ws1.getRow(r).values = [
    '',
    'NCG (Dry Air)',
    fmt(result.ncgMoleFrac, 4),
    fmt(result.ncgMassFrac, 4),
  ];
  r++;
  ws1.getRow(r).values = ['', 'Mixture Molar Mass', fmt(result.mixMolarMass, 3) + ' g/mol', ''];
  ws1.getRow(r).font = { bold: true };
  r++;
  r++;

  // ── KEY PROPERTIES ────────────────────────────────────────────────────────────
  sectionHeader(ws1, r, 'KEY PROPERTIES', 4);
  r++;
  dataRow(ws1, r++, 'Density (ρ)', fmt(result.density, 5), 'kg/m³');
  dataRow(ws1, r++, 'Specific Volume (v)', fmt(result.specificVolume, 4), 'm³/kg');
  dataRow(ws1, r++, 'Specific Enthalpy (h_mix)', fmt(result.specificEnthalpy, 2), 'kJ/kg');
  dataRow(ws1, r++, '  └ Vapour enthalpy (h_g)', fmt(result.vaporEnthalpy, 2), 'kJ/kg');
  dataRow(ws1, r++, '  └ Air enthalpy (Cp·T)', fmt(result.airEnthalpy, 2), 'kJ/kg');
  dataRow(ws1, r++, 'Specific Heat (Cp)', fmt(result.cpMix, 4), 'kJ/(kg·K)');
  dataRow(ws1, r++, 'Specific Heat (Cv)', fmt(result.cvMix, 4), 'kJ/(kg·K)');
  dataRow(ws1, r++, 'Heat Ratio γ (Cp/Cv)', fmt(result.gammaMix, 4), '—');
  r++;

  // ── TRANSPORT PROPERTIES ──────────────────────────────────────────────────────
  sectionHeader(ws1, r, 'TRANSPORT PROPERTIES', 4);
  r++;
  dataRow(ws1, r++, 'Dynamic Viscosity (μ)', fmt(result.dynamicViscosityPas * 1e6, 3), 'μPa·s');
  dataRow(
    ws1,
    r++,
    'Thermal Conductivity (λ)',
    fmt(result.thermalConductivityWmK * 1000, 3),
    'mW/(m·K)'
  );
  dataRow(
    ws1,
    r++,
    'Prandtl Number (Pr)',
    fmt((result.cpMix * 1000 * result.dynamicViscosityPas) / result.thermalConductivityWmK, 3),
    '—'
  );
  r++;

  // ── FLOW BREAKDOWN (conditional) ─────────────────────────────────────────────
  if (result.totalFlowKgH !== null) {
    sectionHeader(ws1, r, 'FLOW BREAKDOWN', 4);
    r++;
    dataRow(ws1, r++, 'Dry NCG (Air)', fmt(result.dryNcgFlowKgH ?? 0, 4), 'kg/h');
    dataRow(ws1, r++, 'Water Vapour', fmt(result.waterVapourFlowKgH ?? 0, 4), 'kg/h');
    totalRow(ws1, r++, 'Total (Wet)', fmt(result.totalFlowKgH, 4), 'kg/h');
    dataRow(ws1, r++, 'Volumetric Flow at T, P', fmt(result.volumetricFlowM3h ?? 0, 3), 'm³/h');
    r++;
  }

  // ── INPUT PARAMETERS ──────────────────────────────────────────────────────────
  sectionHeader(ws1, r, 'INPUT PARAMETERS', 4);
  r++;
  dataRow(ws1, r++, 'Input Mode', MODE_LABELS[inputs.mode], '');
  dataRow(ws1, r++, 'Temperature', inputs.temperatureC, '°C');
  dataRow(
    ws1,
    r++,
    inputs.useSatPressure ? 'NCG Partial Pressure (above P_sat)' : 'Total System Pressure',
    inputs.pressureBar,
    'bar'
  );
  if (inputs.mode === 'seawater') {
    dataRow(ws1, r++, 'Seawater Flow', inputs.seawaterFlowM3h ?? '', 'm³/h');
    dataRow(ws1, r++, 'Seawater Inlet Temperature', inputs.seawaterTempC ?? '', '°C');
    dataRow(ws1, r++, 'Salinity', inputs.salinityGkg ?? '', 'g/kg');
  }
  if (inputs.mode === 'dry_ncg') {
    dataRow(ws1, r++, 'Dry NCG Flow', inputs.dryNcgFlowKgH ?? '', 'kg/h');
  }
  if (inputs.mode === 'wet_ncg') {
    dataRow(ws1, r++, 'Total (Wet) Gas Flow', inputs.wetNcgFlowKgH ?? '', 'kg/h');
  }

  // ── Sheet 2: Detailed ────────────────────────────────────────────────────────
  const ws2 = workbook.addWorksheet('Detailed');
  ws2.columns = [
    { key: 'indent', width: 3 },
    { key: 'label', width: 45 },
    { key: 'value', width: 22 },
    { key: 'unit', width: 18 },
  ];

  let r2 = 1;

  sectionHeader(ws2, r2, 'CONDITIONS & COMPOSITION', 4);
  r2++;
  dataRow(ws2, r2++, 'Temperature', fmt(result.temperatureC, 2), '°C');
  dataRow(ws2, r2++, 'Total Pressure', fmt(result.totalPressureBar, 6), 'bar abs');
  dataRow(ws2, r2++, 'P_sat at T (IAPWS-IF97)', fmt(result.satPressureBar, 6), 'bar');
  dataRow(
    ws2,
    r2++,
    'Water Vapour Partial Pressure',
    fmt(result.waterVapourPartialPressureBar, 6),
    'bar'
  );
  dataRow(ws2, r2++, 'NCG Partial Pressure', fmt(result.ncgPartialPressureBar, 6), 'bar');
  r2++;
  dataRow(ws2, r2++, 'Water Vapour Mole Fraction (y_w)', fmt(result.waterVapourMoleFrac, 6), '—');
  dataRow(ws2, r2++, 'NCG Mole Fraction (y_NCG)', fmt(result.ncgMoleFrac, 6), '—');
  dataRow(ws2, r2++, 'Water Vapour Mass Fraction (x_w)', fmt(result.waterVapourMassFrac, 6), '—');
  dataRow(ws2, r2++, 'NCG Mass Fraction (x_NCG)', fmt(result.ncgMassFrac, 6), '—');
  dataRow(ws2, r2++, 'Mixture Molar Mass (M_mix)', fmt(result.mixMolarMass, 4), 'g/mol');
  r2++;

  sectionHeader(ws2, r2, 'THERMODYNAMIC PROPERTIES (Ideal Gas)', 4);
  r2++;
  dataRow(ws2, r2++, 'Density (ρ = PM/RT)', fmt(result.density, 6), 'kg/m³');
  dataRow(ws2, r2++, 'Specific Volume (v = 1/ρ)', fmt(result.specificVolume, 6), 'm³/kg');
  r2++;
  dataRow(ws2, r2++, 'Specific Enthalpy h_mix', fmt(result.specificEnthalpy, 4), 'kJ/kg');
  dataRow(ws2, r2++, '  h_g (water vapour at sat., IAPWS)', fmt(result.vaporEnthalpy, 4), 'kJ/kg');
  dataRow(ws2, r2++, '  h_air (Cp_air × T_C)', fmt(result.airEnthalpy, 4), 'kJ/kg');
  r2++;
  dataRow(ws2, r2++, 'Specific Heat Cp_mix', fmt(result.cpMix, 6), 'kJ/(kg·K)');
  dataRow(ws2, r2++, 'Specific Heat Cv_mix', fmt(result.cvMix, 6), 'kJ/(kg·K)');
  dataRow(ws2, r2++, 'Heat Capacity Ratio γ (Cp/Cv)', fmt(result.gammaMix, 6), '—');
  r2++;

  sectionHeader(ws2, r2, 'TRANSPORT PROPERTIES', 4);
  r2++;
  dataRow(
    ws2,
    r2++,
    'Dynamic Viscosity μ (Wilke 1950)',
    fmt(result.dynamicViscosityPas * 1e6, 4),
    'μPa·s'
  );
  dataRow(
    ws2,
    r2++,
    'Dynamic Viscosity μ (raw)',
    result.dynamicViscosityPas.toExponential(5),
    'Pa·s'
  );
  dataRow(
    ws2,
    r2++,
    'Thermal Conductivity λ (Wassiljewa–M.S.)',
    fmt(result.thermalConductivityWmK * 1000, 4),
    'mW/(m·K)'
  );
  dataRow(
    ws2,
    r2++,
    'Thermal Conductivity λ (raw)',
    result.thermalConductivityWmK.toExponential(5),
    'W/(m·K)'
  );
  dataRow(
    ws2,
    r2++,
    'Prandtl Number Pr = μ·Cp/λ',
    fmt((result.cpMix * 1000 * result.dynamicViscosityPas) / result.thermalConductivityWmK, 4),
    '—'
  );
  r2++;

  // Seawater dissolution (conditional)
  if (result.seawaterInfo) {
    sectionHeader(
      ws2,
      r2,
      `DISSOLVED GAS CONTENT — Weiss (1970) at ${fmt(result.seawaterInfo.gasTempC, 1)} °C, ${result.seawaterInfo.salinityGkg} g/kg${result.seawaterInfo.extrapolated ? ' [EXTRAPOLATED]' : ''}`,
      4
    );
    r2++;
    // Table header
    ws2.getRow(r2).values = ['', 'Gas', 'mL(STP)/L', 'mg/L'];
    ws2.getRow(r2).font = { bold: true };
    ws2.getRow(r2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    r2++;
    ws2.getRow(r2).values = [
      '',
      'O₂',
      result.seawaterInfo.o2MlL.toExponential(4),
      fmt(result.seawaterInfo.o2MgL, 4),
    ];
    r2++;
    ws2.getRow(r2).values = [
      '',
      'N₂',
      result.seawaterInfo.n2MlL.toExponential(4),
      fmt(result.seawaterInfo.n2MgL, 4),
    ];
    r2++;
    ws2.getRow(r2).values = [
      '',
      'Total',
      (result.seawaterInfo.o2MlL + result.seawaterInfo.n2MlL).toExponential(4),
      fmt(result.seawaterInfo.totalGasMgL, 4),
    ];
    ws2.getRow(r2).font = { bold: true };
    r2++;
    r2++;
  }

  // References
  sectionHeader(ws2, r2, 'REFERENCES & METHOD', 4);
  r2++;
  ws2.getRow(r2).values = [
    '',
    'NCG Composition',
    'Dry air: N₂ 78.09% · O₂ 20.95% · Ar 0.93% (M=28.97 g/mol)',
    '',
  ];
  r2++;
  ws2.getRow(r2).values = ['', 'Density', 'Ideal Gas Law: ρ = PM/(RT)', ''];
  r2++;
  ws2.getRow(r2).values = ['', 'Enthalpy', 'Mass-weighted: x_w·h_g(T) + x_NCG·Cp_air·T_C', ''];
  r2++;
  ws2.getRow(r2).values = ['', 'Viscosity', 'Wilke (1950) — J. Chem. Phys. 18(4), 517', ''];
  r2++;
  ws2.getRow(r2).values = ['', 'Conductivity', 'Wassiljewa (1904) + Mason & Saxena (1958)', ''];
  r2++;
  ws2.getRow(r2).values = ['', 'Steam Properties', 'IAPWS-IF97 (h_g at saturation)', ''];
  r2++;
  ws2.getRow(r2).values = [
    '',
    'Dissolved Gas',
    'Weiss R.F. (1970) — Deep-Sea Research 17, 721-735',
    '',
  ];
  r2++;
  ws2.getRow(r2).values = ['', 'Generated', new Date().toISOString(), ''];

  // ── Write workbook ─────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
