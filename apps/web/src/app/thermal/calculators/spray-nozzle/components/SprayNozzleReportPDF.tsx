/**
 * Spray Nozzle Selection Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { SprayNozzleResult, NozzleMatch } from '@/lib/thermal/sprayNozzleCalculator';
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

export interface SprayNozzleReportInputs {
  category: string;
  requiredFlow: string;
  operatingPressure: string;
  numberOfNozzles: string;
  sprayDistance: string;
  tolerance: string;
}

interface SprayNozzleReportPDFProps {
  result: SprayNozzleResult;
  inputs: SprayNozzleReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  full_cone_circular: 'Full Cone — Circular',
  full_cone_wide: 'Full Cone — Wide',
  full_cone_square: 'Full Cone — Square',
  hollow_cone_circular: 'Hollow Cone — Circular',
};

export const SprayNozzleReportPDF = ({
  result,
  inputs,
  documentNumber = 'NOZZLE-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: SprayNozzleReportPDFProps) => {
  const config = NOZZLE_CATEGORIES[result.category];
  const best = result.matches[0];
  const hasCoverage = best?.coverage !== undefined;
  const distMm = parseFloat(inputs.sprayDistance);
  const hasDistance = !isNaN(distMm) && distMm > 0;

  const leftParams = [
    { label: 'Nozzle Type', value: CATEGORY_LABELS[inputs.category] || inputs.category },
    { label: 'Series', value: config.seriesName },
    { label: 'Total Required Flow', value: `${inputs.requiredFlow} lpm` },
    ...(result.numberOfNozzles > 1
      ? [{ label: 'Flow per Nozzle', value: `${result.flowPerNozzle} lpm` }]
      : []),
  ];

  const rightParams = [
    { label: 'Operating Pressure', value: `${inputs.operatingPressure} bar` },
    { label: 'Number of Nozzles', value: inputs.numberOfNozzles },
    ...(hasDistance ? [{ label: 'Spray Distance', value: `${inputs.sprayDistance} mm` }] : []),
    { label: 'Flow Tolerance', value: `\u00B1${inputs.tolerance}%` },
    { label: 'Flow Exponent (n)', value: String(config.flowExponent) },
    { label: 'Rated Pressure', value: `${config.ratedPressure} bar` },
  ];

  // Build results table columns
  const columns = [
    { key: 'rank', header: '#', width: '5%' },
    { key: 'capacitySize', header: 'Capacity', width: '12%' },
    { key: 'connection', header: 'Conn.', width: '8%' },
    { key: 'orificeDia', header: 'Orifice (mm)', width: '12%', align: 'right' as const },
    { key: 'freePass', header: 'Free Pass. (mm)', width: '13%', align: 'right' as const },
    { key: 'flow', header: 'Flow (lpm)', width: '12%', align: 'right' as const },
    { key: 'deviation', header: 'Deviation', width: '10%', align: 'right' as const },
    { key: 'angle', header: 'Angle', width: '8%', align: 'right' as const },
    ...(hasCoverage
      ? [{ key: 'coverage', header: 'Coverage (mm)', width: '12%', align: 'right' as const }]
      : []),
  ];

  const rows = result.matches.map((m: NozzleMatch, idx: number) => ({
    rank: String(idx + 1),
    capacitySize: m.nozzle.capacitySize + (idx === 0 ? ' *' : ''),
    connection: `${m.nozzle.inletConn}"`,
    orificeDia: String(m.nozzle.orificeDia),
    freePass: String(m.nozzle.maxFreePassage),
    flow: String(m.flowAtPressure),
    deviation: `${m.deviationPercent > 0 ? '+' : ''}${m.deviationPercent}%`,
    angle: `${m.sprayAngle}\u00B0`,
    ...(hasCoverage ? { coverage: m.coverage !== undefined ? String(m.coverage) : '-' } : {}),
  }));

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="SPRAY NOZZLE SELECTION"
          subtitle="CALCULATION REPORT"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        {best && (
          <PrimaryResultBanner
            items={[
              { label: 'Best Match', value: best.nozzle.capacitySize },
              { label: 'Flow at Pressure', value: `${best.flowAtPressure} lpm` },
              {
                label: 'Deviation',
                value: `${best.deviationPercent > 0 ? '+' : ''}${best.deviationPercent}%`,
              },
              { label: 'Spray Angle', value: `${best.sprayAngle}\u00B0` },
              ...(best.coverage !== undefined
                ? [{ label: 'Coverage', value: `${best.coverage} mm` }]
                : []),
            ]}
          />
        )}

        {/* 1. Input Parameters */}
        <ReportSection title="1. INPUT PARAMETERS">
          <TwoColumnLayout
            left={<KeyValueTable rows={leftParams} />}
            right={<KeyValueTable rows={rightParams} />}
          />
        </ReportSection>

        {/* 2. Matching Nozzles */}
        <ReportSection title="2. MATCHING NOZZLES">
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

        {/* 3. Best Match Details */}
        {best && (
          <ReportSection title="3. BEST MATCH DETAILS">
            <TwoColumnLayout
              left={
                <KeyValueTable
                  rows={[
                    { label: 'Capacity Size', value: best.nozzle.capacitySize },
                    { label: 'Inlet Connection', value: `${best.nozzle.inletConn}"` },
                    { label: 'Orifice Diameter', value: `${best.nozzle.orificeDia} mm` },
                    { label: 'Max Free Passage', value: `${best.nozzle.maxFreePassage} mm` },
                  ]}
                />
              }
              right={
                <KeyValueTable
                  rows={[
                    {
                      label: 'Rated Flow',
                      value: `${best.nozzle.ratedFlow} lpm @ ${config.ratedPressure} bar`,
                    },
                    { label: 'Flow at Operating Pressure', value: `${best.flowAtPressure} lpm` },
                    {
                      label: 'Deviation from Required',
                      value: `${best.deviationPercent > 0 ? '+' : ''}${best.deviationPercent}%`,
                    },
                    { label: 'Spray Angle', value: `${best.sprayAngle}\u00B0` },
                    ...(best.coverage !== undefined
                      ? [{ label: 'Coverage Diameter', value: `${best.coverage} mm` }]
                      : []),
                  ]}
                />
              }
            />
          </ReportSection>
        )}

        {notes && <NotesSection notes={notes} />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Spray Nozzle Selection Calculator',
            `Source: Spraying Systems Co. CAT75HYD (Metric) | Flow: Q = Q_rated \u00D7 (P/P_rated)^${config.flowExponent}`,
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
