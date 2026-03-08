/**
 * Vacuum System Design Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { VacuumSystemResult, TrainConfig } from '@/lib/thermal/vacuumSystemCalculator';
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

export interface VacuumSystemReportInputs {
  suctionPressure: string;
  suctionTemperature: string;
  dischargePressure: string;
  ncgMode: string;
  dryNcgFlow: string;
  systemVolume: string;
  connectionCount: string;
  seawaterFlow: string;
  seawaterTemp: string;
  salinity: string;
  motivePressure: string;
  coolingWaterTemp: string;
  interCondenserApproach: string;
  sealWaterTemp: string;
  trainConfig: string;
  designMargin: string;
}

interface VacuumSystemReportPDFProps {
  result: VacuumSystemResult;
  inputs: VacuumSystemReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const TRAIN_LABELS: Record<TrainConfig, string> = {
  single_ejector: 'Single-Stage Ejector',
  two_stage_ejector: 'Two-Stage Ejector',
  lrvp_only: 'LRVP Only',
  hybrid: 'Hybrid (Ejector + LRVP)',
};

const NCG_MODE_LABELS: Record<string, string> = {
  manual: 'Manual \u2014 Known NCG Flow',
  hei_leakage: 'HEI \u2014 Air Leakage',
  seawater: 'Seawater \u2014 Dissolved Gas',
};

export const VacuumSystemReportPDF = ({
  result,
  inputs,
  documentNumber = 'VAC-SYS-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: VacuumSystemReportPDFProps) => {
  const leftParams = [
    { label: 'Suction Pressure', value: `${inputs.suctionPressure} mbar abs` },
    { label: 'Suction Temperature', value: `${inputs.suctionTemperature} \u00B0C` },
    { label: 'Discharge Pressure', value: `${inputs.dischargePressure} mbar abs` },
    { label: 'NCG Method', value: NCG_MODE_LABELS[inputs.ncgMode] || inputs.ncgMode },
  ];

  const rightParams = [
    {
      label: 'Train Configuration',
      value: TRAIN_LABELS[inputs.trainConfig as TrainConfig] || inputs.trainConfig,
    },
    ...(inputs.trainConfig !== 'lrvp_only'
      ? [{ label: 'Motive Steam Pressure', value: `${inputs.motivePressure} bar` }]
      : []),
    ...(inputs.trainConfig === 'lrvp_only' || inputs.trainConfig === 'hybrid'
      ? [{ label: 'Seal Water Temperature', value: `${inputs.sealWaterTemp} \u00B0C` }]
      : []),
    { label: 'Design Margin', value: `${inputs.designMargin}%` },
  ];

  // Stage details table
  const stageColumns = [
    { key: 'stage', header: '#', width: '5%' },
    { key: 'type', header: 'Type', width: '15%' },
    { key: 'pressure', header: 'Pressure (mbar)', width: '18%' },
    { key: 'cr', header: 'CR', width: '7%', align: 'right' as const },
    { key: 'suction', header: 'Suction (kg/h)', width: '13%', align: 'right' as const },
    { key: 'volume', header: 'Volume (m\u00B3/h)', width: '13%', align: 'right' as const },
    { key: 'keyResult', header: 'Key Result', width: '29%' },
  ];

  const stageRows = result.stages.map((s) => {
    let keyResult = '';
    if (s.type === 'ejector') {
      keyResult = `Ra=${s.entrainmentRatio}, Steam=${s.motiveSteamKgH} kg/h`;
    } else if (s.type === 'lrvp') {
      keyResult = `${s.lrvpModel}, ${s.lrvpPowerKW} kW`;
    } else {
      keyResult = `Q=${s.condenserDutyKW} kW, CW=${s.coolingWaterM3h} m\u00B3/h`;
    }

    return {
      stage: String(s.stageNumber),
      type: s.type === 'ejector' ? 'Ejector' : s.type === 'lrvp' ? 'LRVP' : 'Inter-Condenser',
      pressure:
        s.type === 'inter_condenser'
          ? String(s.suctionPressureMbar)
          : `${s.suctionPressureMbar} \u2192 ${s.dischargePressureMbar}`,
      cr: s.type === 'inter_condenser' ? '\u2014' : String(s.compressionRatio),
      suction: String(Math.round(s.totalSuctionKgH * 10) / 10),
      volume: s.suctionVolumeM3h > 0 ? String(s.suctionVolumeM3h) : '\u2014',
      keyResult,
    };
  });

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="VACUUM SYSTEM DESIGN"
          subtitle="CALCULATION REPORT"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Configuration', value: TRAIN_LABELS[result.trainConfig] },
            { label: 'Dry NCG', value: `${result.totalDryNcgKgH} kg/h` },
            { label: 'Design Volume', value: `${result.designSuctionVolumeM3h} m\u00B3/h` },
            ...(result.totalMotiveSteamKgH > 0
              ? [{ label: 'Motive Steam', value: `${result.totalMotiveSteamKgH} kg/h` }]
              : []),
            ...(result.totalPowerKW > 0
              ? [{ label: 'LRVP Power', value: `${result.totalPowerKW} kW` }]
              : []),
          ]}
        />

        <ReportSection title="1. INPUT PARAMETERS">
          <TwoColumnLayout
            left={<KeyValueTable rows={leftParams} />}
            right={<KeyValueTable rows={rightParams} />}
          />
        </ReportSection>

        <ReportSection title="2. GAS LOAD ANALYSIS">
          <KeyValueTable
            rows={[
              { label: 'Air Leakage', value: `${result.airLeakageKgH} kg/h` },
              ...(result.dissolvedGasKgH > 0
                ? [{ label: 'Dissolved Gas Release', value: `${result.dissolvedGasKgH} kg/h` }]
                : []),
              { label: 'Total Dry NCG', value: `${result.totalDryNcgKgH} kg/h` },
              { label: 'Water Vapour (at suction)', value: `${result.vapourWithNcgKgH} kg/h` },
              { label: 'Total Suction Flow', value: `${result.totalSuctionFlowKgH} kg/h` },
              { label: 'Suction Volume', value: `${result.totalSuctionVolumeM3h} m\u00B3/h` },
              {
                label: `Design Volume (+${result.designMargin * 100}%)`,
                value: `${result.designSuctionVolumeM3h} m\u00B3/h`,
              },
              {
                label: 'Sat. Pressure at Suction Temp',
                value: `${result.satPressureAtSuctionMbar} mbar`,
              },
            ]}
          />
        </ReportSection>

        <ReportSection title="3. STAGE DETAILS">
          <ReportTable columns={stageColumns} rows={stageRows} />
        </ReportSection>

        {notes && <NotesSection notes={notes} />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Vacuum System Design Calculator',
            'References: HEI Standards, Huang 1999 (ejector), Ryans & Roper 1986 (LRVP), Weiss 1970 (dissolved gas)',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
