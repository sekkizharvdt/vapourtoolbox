/**
 * Siphon Sizing Calculator — Excel Export
 *
 * Generates downloadable Excel workbooks from siphon sizing results.
 * Uses exceljs for workbook creation.
 */

import ExcelJS from 'exceljs';
import type { SiphonSizingResult } from './siphonSizingCalculator';
import type { SiphonReportInputs } from '@/app/thermal/calculators/siphon-sizing/components/SiphonReportPDF';
import { FITTING_NAMES, type FittingType } from './pressureDropCalculator';
import {
  PRESSURE_UNIT_LABELS,
  FLUID_TYPE_LABELS,
  ELBOW_CONFIG_LABELS,
} from '@/app/thermal/calculators/siphon-sizing/components/types';

interface ExportMeta {
  documentNumber?: string;
  projectName?: string;
}

/**
 * Export a single siphon sizing result to Excel
 */
export async function exportSiphonToExcel(
  result: SiphonSizingResult,
  inputs: SiphonReportInputs,
  meta: ExportMeta = {}
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vapour Toolbox';
  workbook.created = new Date();

  const unitLabel = PRESSURE_UNIT_LABELS[inputs.pressureUnit] || inputs.pressureUnit;
  const fluidLabel = FLUID_TYPE_LABELS[inputs.fluidType] || inputs.fluidType;
  const elbowLabel = ELBOW_CONFIG_LABELS[inputs.elbowConfig] || inputs.elbowConfig;
  const scheduleLabel = `Sch ${inputs.pipeSchedule || '40'}`;

  // ── Summary Sheet ──
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: '', key: 'label', width: 30 },
    { header: '', key: 'value', width: 25 },
    { header: '', key: 'unit', width: 15 },
  ];

  const addSectionHeader = (ws: ExcelJS.Worksheet, title: string) => {
    const row = ws.addRow([title]);
    row.font = { bold: true, size: 11, color: { argb: 'FF1976D2' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' },
    };
    ws.mergeCells(row.number, 1, row.number, 3);
    return row;
  };

  const addDataRow = (
    ws: ExcelJS.Worksheet,
    label: string,
    value: string | number,
    unit?: string
  ) => {
    const row = ws.addRow([label, value, unit || '']);
    row.getCell(1).font = { bold: true };
    return row;
  };

  // Title
  if (meta.documentNumber || meta.projectName) {
    const titleRow = summary.addRow([meta.projectName || meta.documentNumber || 'Siphon Sizing']);
    titleRow.font = { bold: true, size: 14 };
    summary.mergeCells(titleRow.number, 1, titleRow.number, 3);
    summary.addRow([]);
  }

  // Result section
  addSectionHeader(summary, 'RESULT');
  addDataRow(
    summary,
    'Pipe Size',
    result.pipe.nps === 'CUSTOM'
      ? `Custom ID ${result.pipe.id_mm} mm`
      : `${result.pipe.nps}" ${scheduleLabel} (DN${result.pipe.dn})`
  );
  addDataRow(summary, 'Minimum Siphon Height', result.minimumHeight.toFixed(3), 'm');
  addDataRow(
    summary,
    'Velocity',
    `${result.velocity.toFixed(2)} (${result.velocityStatus})`,
    'm/s'
  );
  addDataRow(
    summary,
    'Flash Vapor',
    result.flashOccurs ? (result.flashVaporFraction * 100).toFixed(2) : '0',
    '%'
  );
  addDataRow(
    summary,
    'Holdup Volume',
    result.holdupVolumeLiters >= 1000
      ? (result.holdupVolumeLiters / 1000).toFixed(2)
      : result.holdupVolumeLiters.toFixed(1),
    result.holdupVolumeLiters >= 1000 ? 'm³' : 'L'
  );
  addDataRow(
    summary,
    'Total Pressure Drop',
    result.pressureDrop.totalPressureDropMbar.toFixed(1),
    'mbar'
  );
  summary.addRow([]);

  // Inputs section
  addSectionHeader(summary, 'INPUT PARAMETERS');
  addDataRow(summary, 'Upstream Pressure', inputs.upstreamPressure, unitLabel);
  addDataRow(summary, 'Downstream Pressure', inputs.downstreamPressure, unitLabel);
  addDataRow(summary, 'Pressure Difference', (result.pressureDiffBar * 1000).toFixed(1), 'mbar');
  addDataRow(summary, 'Fluid Type', fluidLabel);
  if (inputs.fluidType === 'seawater' || inputs.fluidType === 'brine') {
    addDataRow(summary, 'Salinity', inputs.salinity, 'ppm');
  }
  addDataRow(summary, 'Mass Flow Rate', inputs.flowRate, 'ton/hr');
  addDataRow(summary, 'Target Velocity', inputs.targetVelocity, 'm/s');
  addDataRow(summary, 'Pipe Schedule', scheduleLabel);
  addDataRow(summary, 'Elbow Configuration', elbowLabel);
  addDataRow(summary, 'Horizontal Distance', inputs.horizontalDistance, 'm');
  if (inputs.elbowConfig !== '2_elbows') {
    addDataRow(summary, 'Offset Distance', inputs.offsetDistance, 'm');
  }
  addDataRow(summary, 'Safety Factor', inputs.safetyFactor, '%');
  summary.addRow([]);

  // ── Detailed Sheet ──
  const detailed = workbook.addWorksheet('Detailed');
  detailed.columns = [
    { header: '', key: 'label', width: 35 },
    { header: '', key: 'value', width: 20 },
    { header: '', key: 'unit', width: 15 },
  ];

  // Pipe Selection
  addSectionHeader(detailed, 'PIPE SELECTION');
  addDataRow(detailed, 'NPS', result.pipe.nps);
  addDataRow(detailed, 'DN', result.pipe.dn);
  addDataRow(detailed, 'Schedule', result.pipe.schedule);
  addDataRow(detailed, 'Outer Diameter', result.pipe.od_mm.toFixed(1), 'mm');
  addDataRow(detailed, 'Inner Diameter', result.pipe.id_mm.toFixed(1), 'mm');
  addDataRow(detailed, 'Wall Thickness', result.pipe.wt_mm.toFixed(2), 'mm');
  addDataRow(detailed, 'Flow Area', result.pipe.area_mm2.toFixed(1), 'mm²');
  addDataRow(detailed, 'Velocity', result.velocity.toFixed(3), 'm/s');
  addDataRow(detailed, 'Velocity Status', result.velocityStatus);
  detailed.addRow([]);

  // Height Breakdown
  addSectionHeader(detailed, 'SIPHON HEIGHT BREAKDOWN');
  addDataRow(detailed, 'Static Head (ΔP / ρg)', result.staticHead.toFixed(3), 'm');
  addDataRow(detailed, 'Friction Losses (pipe + fittings)', result.frictionHead.toFixed(3), 'm');
  const safetyPct = (
    (result.safetyMargin / (result.staticHead + result.frictionHead)) *
    100
  ).toFixed(0);
  addDataRow(detailed, `Safety Margin (${safetyPct}%)`, result.safetyMargin.toFixed(3), 'm');
  const totalRow = addDataRow(
    detailed,
    'Minimum Siphon Height',
    result.minimumHeight.toFixed(3),
    'm'
  );
  totalRow.font = { bold: true };
  totalRow.border = {
    top: { style: 'medium' },
  };
  detailed.addRow([]);

  // Pressure Drop
  addSectionHeader(detailed, 'PRESSURE DROP DETAILS');
  addDataRow(detailed, 'Reynolds Number', result.pressureDrop.reynoldsNumber.toFixed(0));
  addDataRow(detailed, 'Flow Regime', result.pressureDrop.flowRegime);
  addDataRow(detailed, 'Friction Factor', result.pressureDrop.frictionFactor.toFixed(5));
  detailed.addRow([]);

  // Pressure drop table header
  const pdHeader = detailed.addRow(['Component', 'm H₂O', 'mbar']);
  pdHeader.font = { bold: true };
  pdHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F5F5' },
  };

  detailed.addRow([
    `Straight pipe (${result.totalPipeLength.toFixed(1)} m)`,
    result.pressureDrop.straightPipeLoss.toFixed(3),
    ((result.pressureDrop.straightPipeLoss * result.fluidDensity * 9.81) / 100).toFixed(1),
  ]);

  for (const f of result.pressureDrop.fittingsBreakdown) {
    detailed.addRow([
      `${FITTING_NAMES[f.type as FittingType]} x ${f.count} (K=${f.kFactor})`,
      f.loss.toFixed(3),
      ((f.loss * result.fluidDensity * 9.81) / 100).toFixed(1),
    ]);
  }

  const pdTotal = detailed.addRow([
    'Total',
    result.pressureDrop.totalPressureDropMH2O.toFixed(3),
    result.pressureDrop.totalPressureDropMbar.toFixed(1),
  ]);
  pdTotal.font = { bold: true };
  pdTotal.border = { top: { style: 'medium' } };
  detailed.addRow([]);

  // Flash Vapor
  addSectionHeader(detailed, 'FLASH VAPOR');
  addDataRow(detailed, 'Downstream Saturation Temp', result.downstreamSatTemp.toFixed(1), '°C');
  addDataRow(detailed, 'Flash Occurs', result.flashOccurs ? 'Yes' : 'No');
  if (result.flashOccurs) {
    addDataRow(detailed, 'Flash Vapor Fraction', (result.flashVaporFraction * 100).toFixed(2), '%');
    addDataRow(detailed, 'Vapor Flow', result.flashVaporFlow.toFixed(3), 'ton/hr');
    addDataRow(detailed, 'Liquid After Flash', result.liquidFlowAfterFlash.toFixed(3), 'ton/hr');
  }
  detailed.addRow([]);

  // Fluid Properties
  addSectionHeader(detailed, 'FLUID PROPERTIES & GEOMETRY');
  addDataRow(detailed, 'Fluid Temperature', result.fluidTemperature.toFixed(1), '°C');
  addDataRow(detailed, 'Density', result.fluidDensity.toFixed(2), 'kg/m³');
  addDataRow(detailed, 'Viscosity', (result.fluidViscosity * 1000).toFixed(3), 'mPa·s');
  if (result.upstreamSatTempPure !== result.fluidTemperature) {
    addDataRow(
      detailed,
      'BPE',
      (result.fluidTemperature - result.upstreamSatTempPure).toFixed(2),
      '°C'
    );
  }
  addDataRow(detailed, 'Elbows', result.elbowCount.toString());
  addDataRow(detailed, 'Total Pipe Length', result.totalPipeLength.toFixed(1), 'm');
  addDataRow(
    detailed,
    'Holdup Volume',
    result.holdupVolumeLiters >= 1000
      ? (result.holdupVolumeLiters / 1000).toFixed(2)
      : result.holdupVolumeLiters.toFixed(1),
    result.holdupVolumeLiters >= 1000 ? 'm³' : 'L'
  );

  // Generate blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Export batch siphon results to Excel (one row per siphon pair)
 */
export async function exportBatchSiphonToExcel(
  results: Array<{
    fromEffect: number;
    toEffect: number;
    result: SiphonSizingResult;
  }>,
  commonInputs: {
    fluidType: string;
    salinity: string;
    targetVelocity: string;
    pipeSchedule: string;
    elbowConfig: string;
    horizontalDistance: string;
    offsetDistance: string;
    safetyFactor: string;
    pressureUnit: string;
  },
  meta: ExportMeta = {}
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vapour Toolbox';
  workbook.created = new Date();

  const scheduleLabel = `Sch ${commonInputs.pipeSchedule || '40'}`;

  // ── Summary Sheet ──
  const summary = workbook.addWorksheet('Batch Summary');

  // Title
  if (meta.projectName || meta.documentNumber) {
    const titleRow = summary.addRow([meta.projectName || meta.documentNumber]);
    titleRow.font = { bold: true, size: 14 };
    summary.mergeCells(titleRow.number, 1, titleRow.number, 9);
    summary.addRow([]);
  }

  // Header row
  const headerRow = summary.addRow([
    'Siphon',
    'From → To',
    'Pipe Size',
    'Min Height (m)',
    'Velocity (m/s)',
    'Status',
    'Flash (%)',
    'ΔP (mbar)',
    'Holdup (L)',
  ]);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1976D2' },
  };
  headerRow.alignment = { horizontal: 'center' };

  // Column widths
  summary.getColumn(1).width = 10;
  summary.getColumn(2).width = 15;
  summary.getColumn(3).width = 20;
  summary.getColumn(4).width = 16;
  summary.getColumn(5).width = 16;
  summary.getColumn(6).width = 10;
  summary.getColumn(7).width = 12;
  summary.getColumn(8).width = 14;
  summary.getColumn(9).width = 14;

  // Data rows
  results.forEach(({ fromEffect, toEffect, result }, i) => {
    const pipeLabel =
      result.pipe.nps === 'CUSTOM'
        ? `Custom ID ${result.pipe.id_mm} mm`
        : `${result.pipe.nps}" ${scheduleLabel}`;

    const row = summary.addRow([
      `S-${i + 1}`,
      `E${fromEffect} → E${toEffect}`,
      pipeLabel,
      Number(result.minimumHeight.toFixed(3)),
      Number(result.velocity.toFixed(2)),
      result.velocityStatus,
      Number((result.flashVaporFraction * 100).toFixed(2)),
      Number(result.pressureDrop.totalPressureDropMbar.toFixed(1)),
      Number(result.holdupVolumeLiters.toFixed(1)),
    ]);

    // Color-code velocity status
    const statusCell = row.getCell(6);
    if (result.velocityStatus === 'OK') {
      statusCell.font = { color: { argb: 'FF2E7D32' } };
    } else if (result.velocityStatus === 'HIGH') {
      statusCell.font = { color: { argb: 'FFC62828' } };
    } else {
      statusCell.font = { color: { argb: 'FFE65100' } };
    }

    // Number formatting
    row.getCell(4).numFmt = '0.000';
    row.getCell(5).numFmt = '0.00';
    row.getCell(7).numFmt = '0.00';
    row.getCell(8).numFmt = '0.0';
    row.getCell(9).numFmt = '0.0';
  });

  // Common inputs section
  summary.addRow([]);
  summary.addRow([]);
  const inputsHeader = summary.addRow(['Common Input Parameters']);
  inputsHeader.font = { bold: true, size: 11, color: { argb: 'FF1976D2' } };
  summary.mergeCells(inputsHeader.number, 1, inputsHeader.number, 3);

  const addInput = (label: string, value: string) => {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  };

  const fluidLabel = FLUID_TYPE_LABELS[commonInputs.fluidType] || commonInputs.fluidType;
  const elbowLabel = ELBOW_CONFIG_LABELS[commonInputs.elbowConfig] || commonInputs.elbowConfig;

  addInput('Fluid Type', fluidLabel);
  if (commonInputs.fluidType !== 'distillate') {
    addInput('Salinity', `${commonInputs.salinity} ppm`);
  }
  addInput('Target Velocity', `${commonInputs.targetVelocity} m/s`);
  addInput('Pipe Schedule', scheduleLabel);
  addInput('Elbow Configuration', elbowLabel);
  addInput('Horizontal Distance', `${commonInputs.horizontalDistance} m`);
  if (commonInputs.elbowConfig !== '2_elbows') {
    addInput('Offset Distance', `${commonInputs.offsetDistance} m`);
  }
  addInput('Safety Factor', `${commonInputs.safetyFactor}%`);

  // Generate blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
