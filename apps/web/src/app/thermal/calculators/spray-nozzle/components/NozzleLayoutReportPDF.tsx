/**
 * Nozzle Layout Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { NozzleLayoutResult, NozzleLayoutMatch } from '@/lib/thermal/sprayNozzleCalculator';
import { NOZZLE_CATEGORIES } from '@/lib/thermal/sprayNozzleCalculator';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  ReportTable,
  KeyValueTable,
  TwoColumnLayout,
  PrimaryResultBanner,
  NotesSection,
  ReportFooter,
} from '@/lib/pdf/reportComponents';

export interface NozzleLayoutReportInputs {
  category: string;
  totalFlow: string;
  operatingPressure: string;
  bundleLength: string;
  bundleWidth: string;
  sprayHeight: string;
  minOverlap: string;
  tolerance: string;
}

interface NozzleLayoutReportPDFProps {
  result: NozzleLayoutResult;
  inputs: NozzleLayoutReportInputs;
  selectedIdx?: number;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  full_cone_circular: 'Full Cone \u2014 Circular',
  full_cone_wide: 'Full Cone \u2014 Wide',
  full_cone_square: 'Full Cone \u2014 Square',
  hollow_cone_circular: 'Hollow Cone \u2014 Circular',
};

export const NozzleLayoutReportPDF = ({
  result,
  inputs,
  selectedIdx = 0,
  documentNumber = 'NOZZLE-LAYOUT-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: NozzleLayoutReportPDFProps) => {
  const config = NOZZLE_CATEGORIES[result.category];
  const best = result.matches[selectedIdx] ?? result.matches[0];

  const leftParams = [
    { label: 'Nozzle Type', value: CATEGORY_LABELS[inputs.category] || inputs.category },
    { label: 'Series', value: config.seriesName },
    { label: 'Total Required Flow', value: `${inputs.totalFlow} lpm` },
    { label: 'Operating Pressure', value: `${inputs.operatingPressure} bar` },
  ];

  const rightParams = [
    { label: 'Bundle Length', value: `${inputs.bundleLength} mm` },
    { label: 'Bundle Width', value: `${inputs.bundleWidth} mm` },
    { label: 'Spray Height', value: `${inputs.sprayHeight} mm` },
    { label: 'Min. Overlap', value: `${inputs.minOverlap}%` },
    { label: 'Flow Tolerance', value: `\u00B1${inputs.tolerance}%` },
  ];

  const columns = [
    { key: 'rank', header: '#', width: '5%' },
    { key: 'capacitySize', header: 'Capacity', width: '11%' },
    { key: 'connection', header: 'Conn.', width: '7%' },
    { key: 'layout', header: 'Layout', width: '10%', align: 'right' as const },
    { key: 'total', header: 'Total', width: '7%', align: 'right' as const },
    { key: 'flow', header: 'Flow (lpm)', width: '10%', align: 'right' as const },
    { key: 'deviation', header: 'Dev.', width: '8%', align: 'right' as const },
    { key: 'coverage', header: 'Cov. (mm)', width: '10%', align: 'right' as const },
    { key: 'pitch', header: 'Pitch (mm)', width: '12%', align: 'right' as const },
    { key: 'overlap', header: 'Overlap', width: '10%', align: 'right' as const },
    { key: 'waste', header: 'Overspray', width: '8%', align: 'right' as const },
  ];

  const rows = result.matches.map((m: NozzleLayoutMatch, idx: number) => ({
    rank: String(idx + 1),
    capacitySize: m.nozzle.capacitySize + (idx === selectedIdx ? ' *' : ''),
    connection: `${m.nozzle.inletConn}"`,
    layout: `${m.nozzlesAlongLength} \u00D7 ${m.rowsAcrossWidth}`,
    total: String(m.totalNozzles),
    flow: String(m.flowAtPressure),
    deviation: `${m.deviationPercent > 0 ? '+' : ''}${m.deviationPercent}%`,
    coverage: String(m.coverageDiameter),
    pitch: `${m.pitchAlongLength} / ${m.pitchAcrossWidth}`,
    overlap: `${m.actualOverlapLength}% / ${m.actualOverlapWidth}%`,
    waste: `${m.wastedFlowPercent}%`,
  }));

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="SPRAY NOZZLE LAYOUT"
          subtitle="CALCULATION REPORT"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        {best && (
          <PrimaryResultBanner
            items={[
              { label: 'Selected Nozzle', value: best.nozzle.capacitySize },
              {
                label: 'Layout',
                value: `${best.nozzlesAlongLength} \u00D7 ${best.rowsAcrossWidth} = ${best.totalNozzles}`,
              },
              { label: 'Flow / Nozzle', value: `${best.flowAtPressure} lpm` },
              { label: 'Coverage', value: `${best.coverageDiameter} mm \u00D8` },
            ]}
          />
        )}

        <ReportSection title="1. INPUT PARAMETERS">
          <TwoColumnLayout
            left={<KeyValueTable rows={leftParams} />}
            right={<KeyValueTable rows={rightParams} />}
          />
        </ReportSection>

        {best && (
          <ReportSection title="2. SELECTED LAYOUT DETAILS">
            <TwoColumnLayout
              left={
                <KeyValueTable
                  rows={[
                    { label: 'Capacity Size', value: best.nozzle.capacitySize },
                    { label: 'Inlet Connection', value: `${best.nozzle.inletConn}"` },
                    { label: 'Nozzles Along Length', value: String(best.nozzlesAlongLength) },
                    { label: 'Rows Across Width', value: String(best.rowsAcrossWidth) },
                    { label: 'Total Nozzles', value: String(best.totalNozzles) },
                  ]}
                />
              }
              right={
                <KeyValueTable
                  rows={[
                    { label: 'Flow at Pressure', value: `${best.flowAtPressure} lpm` },
                    { label: 'Required per Nozzle', value: `${best.requiredFlowPerNozzle} lpm` },
                    {
                      label: 'Deviation',
                      value: `${best.deviationPercent > 0 ? '+' : ''}${best.deviationPercent}%`,
                    },
                    { label: 'Spray Angle', value: `${best.sprayAngle}\u00B0` },
                    { label: 'Coverage Diameter', value: `${best.coverageDiameter} mm` },
                    {
                      label: 'Pitch (L / W)',
                      value: `${best.pitchAlongLength} / ${best.pitchAcrossWidth} mm`,
                    },
                    {
                      label: 'Overlap (L / W)',
                      value: `${best.actualOverlapLength}% / ${best.actualOverlapWidth}%`,
                    },
                    {
                      label: 'Total Coverage',
                      value: `${best.totalCoverageLength} \u00D7 ${best.totalCoverageWidth} mm`,
                    },
                    {
                      label: 'Overspray (wasted)',
                      value: `${best.wastedFlowLpm} lpm (${best.wastedFlowPercent}%)`,
                    },
                  ]}
                />
              }
            />
          </ReportSection>
        )}

        <ReportSection title="3. ALL MATCHING NOZZLES">
          {rows.length > 0 ? (
            <ReportTable columns={columns} rows={rows} />
          ) : (
            <KeyValueTable
              rows={[
                {
                  label: 'Result',
                  value: `No nozzles found within \u00B1${inputs.tolerance}% tolerance`,
                },
              ]}
            />
          )}
        </ReportSection>

        {notes && <NotesSection notes={notes} />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Spray Nozzle Layout Calculator',
            `Source: Spraying Systems Co. CAT75HYD (Metric) | Flow: Q = Q_rated \u00D7 (P/P_rated)^${config.flowExponent}`,
            `Coverage: 2 \u00D7 height \u00D7 tan(angle/2) | Min. overlap: ${result.minOverlap * 100}%`,
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
