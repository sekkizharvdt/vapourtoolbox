/**
 * Fouling & Scaling Prediction Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import { Document } from '@react-pdf/renderer';
import type { FoulingScalingResult, ScalingPoint } from '@/lib/thermal/foulingScalingCalculator';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  ReportTable,
  KeyValueTable,
  TwoColumnLayout,
  PrimaryResultBanner,
  WarningsBox,
  NotesSection,
  ReportFooter,
} from '@/lib/pdf/reportComponents';

export interface FoulingScalingReportInputs {
  feedSalinity: string;
  calciumConcentration: string;
  sulfateConcentration: string;
  bicarbonateAlkalinity: string;
  magnesiumConcentration: string;
  pH: string;
  temperatureMin: string;
  temperatureMax: string;
  temperatureSteps: string;
  concentrationFactor: string;
  antiscalantDosed: boolean;
  antiscalantEfficiency: string;
}

interface FoulingScalingReportPDFProps {
  result: FoulingScalingResult;
  inputs: FoulingScalingReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const SCALANT_LABELS: Record<string, string> = {
  CaSO4: 'CaSO4',
  CaCO3: 'CaCO3',
  MgOH2: 'Mg(OH)2',
  none: 'None',
};

function statusLabel(status: ScalingPoint['CaSO4_status'] | ScalingPoint['CaCO3_status']): string {
  switch (status) {
    case 'safe':
      return 'Safe';
    case 'warning':
      return 'Warning';
    case 'critical':
      return 'Critical';
    case 'scaling':
      return 'Scaling';
    default:
      return String(status);
  }
}

export const FoulingScalingReportPDF = ({
  result,
  inputs,
  documentNumber = 'FSP-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: FoulingScalingReportPDFProps) => {
  const fmt = (value: number, decimals: number = 2) =>
    isNaN(value) ? '\u2014' : value.toFixed(decimals);

  // Primary banner
  const bannerItems = [
    { label: 'Max TBT (no antiscalant)', value: `${fmt(result.maxTBT_noAntiscalant, 1)} \u00B0C` },
    {
      label: 'Max TBT (with antiscalant)',
      value: `${fmt(result.maxTBT_withAntiscalant, 1)} \u00B0C`,
    },
    { label: 'Dominant Scalant', value: SCALANT_LABELS[result.dominantScalant] ?? 'Unknown' },
  ];

  // Scaling profile table rows
  const profileRows = result.scalingProfile.map((pt) => ({
    temp: `${fmt(pt.temperature, 1)}`,
    caso4SI: fmt(pt.CaSO4_saturationIndex, 4),
    caso4Status: statusLabel(pt.CaSO4_status),
    lsi: fmt(pt.LSI, 4),
    caco3Status: statusLabel(pt.CaCO3_status),
    mgRisk: pt.MgOH2_risk ? 'Yes' : 'No',
    fouling: pt.recommendedFouling.toExponential(2),
  }));

  // CaSO4 saturation analysis rows
  const saturationRows = result.scalingProfile.map((pt) => ({
    temp: `${fmt(pt.temperature, 1)}`,
    solubility: fmt(pt.CaSO4_solubility, 0),
    brineConc: fmt(pt.CaSO4_brineConcentration, 0),
    si: fmt(pt.CaSO4_saturationIndex, 4),
    status: statusLabel(pt.CaSO4_status),
  }));

  // Recommendations at key temperatures
  const keyTemps = [
    result.scalingProfile[0],
    result.scalingProfile[Math.floor(result.scalingProfile.length / 2)],
    result.scalingProfile[result.scalingProfile.length - 1],
  ].filter((pt): pt is ScalingPoint => pt !== undefined);

  const recommendationRows = [
    {
      param: 'Max TBT (without antiscalant)',
      value: `${fmt(result.maxTBT_noAntiscalant, 1)} \u00B0C`,
      note: 'CaSO4 SI < 0.8',
    },
    {
      param: 'Max TBT (with antiscalant)',
      value: `${fmt(result.maxTBT_withAntiscalant, 1)} \u00B0C`,
      note: inputs.antiscalantDosed ? `Efficiency: ${inputs.antiscalantEfficiency}%` : 'Not dosed',
    },
    ...keyTemps.map((pt) => ({
      param: `Fouling resistance at ${fmt(pt.temperature, 1)} \u00B0C`,
      value: `${pt.recommendedFouling.toExponential(2)} m\u00B2\u00B7K/W`,
      note: `CaSO4 SI = ${fmt(pt.CaSO4_saturationIndex, 3)}`,
    })),
  ];

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Fouling & Scaling Prediction Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner items={bannerItems} />

        {/* Input Parameters */}
        <TwoColumnLayout
          left={
            <ReportSection title="Water Chemistry">
              <KeyValueTable
                rows={[
                  { label: 'Feed Salinity', value: `${inputs.feedSalinity} ppm TDS` },
                  {
                    label: 'Calcium (Ca\u00B2\u207A)',
                    value: `${inputs.calciumConcentration} mg/L`,
                  },
                  {
                    label: 'Sulfate (SO4\u00B2\u207B)',
                    value: `${inputs.sulfateConcentration} mg/L`,
                  },
                  {
                    label: 'Bicarbonate Alkalinity',
                    value: `${inputs.bicarbonateAlkalinity} mg/L as CaCO3`,
                  },
                  {
                    label: 'Magnesium (Mg\u00B2\u207A)',
                    value: `${inputs.magnesiumConcentration} mg/L`,
                  },
                  { label: 'pH', value: inputs.pH },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Operating Parameters">
              <KeyValueTable
                rows={[
                  {
                    label: 'Temperature Range',
                    value: `${inputs.temperatureMin} \u2013 ${inputs.temperatureMax} \u00B0C`,
                  },
                  { label: 'Temperature Steps', value: inputs.temperatureSteps },
                  { label: 'Concentration Factor', value: inputs.concentrationFactor },
                  {
                    label: 'Brine TDS',
                    value: `${result.brineConcentration.toLocaleString()} ppm`,
                  },
                  {
                    label: 'Antiscalant',
                    value: inputs.antiscalantDosed
                      ? `Dosed (${inputs.antiscalantEfficiency}% efficiency)`
                      : 'Not dosed',
                  },
                ]}
              />
            </ReportSection>
          }
        />

        {/* Scaling Profile */}
        <ReportSection title="Scaling Profile">
          <ReportTable
            columns={[
              { key: 'temp', header: 'Temp (\u00B0C)', width: '11%', align: 'right' },
              { key: 'caso4SI', header: 'CaSO4 SI', width: '13%', align: 'right' },
              { key: 'caso4Status', header: 'CaSO4 Status', width: '14%', align: 'center' },
              { key: 'lsi', header: 'LSI', width: '13%', align: 'right' },
              { key: 'caco3Status', header: 'CaCO3 Status', width: '14%', align: 'center' },
              { key: 'mgRisk', header: 'Mg(OH)2 Risk', width: '14%', align: 'center' },
              { key: 'fouling', header: 'Fouling (m\u00B2K/W)', width: '21%', align: 'right' },
            ]}
            rows={profileRows}
          />
        </ReportSection>

        {/* CaSO4 Saturation Analysis */}
        <ReportSection title="CaSO4 Saturation Analysis">
          <ReportTable
            columns={[
              { key: 'temp', header: 'Temp (\u00B0C)', width: '15%', align: 'right' },
              {
                key: 'solubility',
                header: 'CaSO4 Solubility (mg/L)',
                width: '22%',
                align: 'right',
              },
              {
                key: 'brineConc',
                header: 'Brine CaSO4 (mg/L)',
                width: '22%',
                align: 'right',
              },
              { key: 'si', header: 'Saturation Index', width: '20%', align: 'right' },
              { key: 'status', header: 'Status', width: '21%', align: 'center' },
            ]}
            rows={saturationRows}
          />
        </ReportSection>

        {/* Recommendations */}
        <ReportSection title="Recommendations">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '40%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'note', header: 'Note', width: '30%' },
            ]}
            rows={recommendationRows}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Fouling & Scaling Prediction Calculator',
            'Models: Ostroff-Metler/Marshall-Slusher (CaSO4) | Langelier (CaCO3) | El-Dessouky & Ettouney (2002)',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
