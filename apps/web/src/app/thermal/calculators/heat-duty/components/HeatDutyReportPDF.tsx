/**
 * Heat Duty Calculation Report — PDF Document
 */

import { Document } from '@react-pdf/renderer';
import type {
  SensibleHeatResult,
  LatentHeatResult,
  LMTDResult,
} from '@/lib/thermal/heatDutyCalculator';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  KeyValueTable,
  TwoColumnLayout,
  PrimaryResultBanner,
  WarningsBox,
  NotesSection,
  ReportFooter,
} from '@/lib/pdf/reportComponents';

type CalculationMode = 'sensible' | 'latent' | 'lmtd';

export interface HeatDutyReportInputs {
  mode: CalculationMode;
  // Sensible
  fluidType?: string;
  salinity?: string;
  massFlowRate?: string;
  inletTemp?: string;
  outletTemp?: string;
  // Latent
  latentFlowRate?: string;
  saturationTemp?: string;
  process?: string;
  // LMTD
  hotInlet?: string;
  hotOutlet?: string;
  coldInlet?: string;
  coldOutlet?: string;
  flowArrangement?: string;
  overallHTC?: string;
  heatDutyForArea?: string;
}

interface HeatDutyReportPDFProps {
  inputs: HeatDutyReportInputs;
  sensibleResult?: SensibleHeatResult | null;
  latentResult?: LatentHeatResult | null;
  lmtdResult?: LMTDResult | null;
  requiredArea?: number | null;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const fmt = (v: number | undefined | null, d = 2) =>
  v === undefined || v === null || isNaN(v) ? '—' : v.toFixed(d);

const FLUID_LABELS: Record<string, string> = {
  PURE_WATER: 'Pure Water',
  SEAWATER: 'Seawater',
  STEAM: 'Steam',
};

export const HeatDutyReportPDF = ({
  inputs,
  sensibleResult,
  latentResult,
  lmtdResult,
  requiredArea,
  documentNumber = 'HD-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: HeatDutyReportPDFProps) => {
  const bannerItems: { label: string; value: string }[] = [];

  if (sensibleResult) {
    bannerItems.push(
      { label: 'Heat Duty', value: `${fmt(sensibleResult.heatDuty, 1)} kW` },
      { label: 'Process', value: sensibleResult.isHeating ? 'Heating' : 'Cooling' }
    );
  }
  if (latentResult) {
    bannerItems.push(
      { label: 'Heat Duty', value: `${fmt(latentResult.heatDuty, 1)} kW` },
      { label: 'Process', value: latentResult.process }
    );
  }
  if (lmtdResult) {
    bannerItems.push(
      { label: 'LMTD', value: `${fmt(lmtdResult.correctedLMTD, 1)} \u00B0C` },
      { label: 'Correction Factor', value: fmt(lmtdResult.correctionFactor, 3) }
    );
    if (requiredArea != null) {
      bannerItems.push({ label: 'Required Area', value: `${fmt(requiredArea, 1)} m\u00B2` });
    }
  }

  const allWarnings = lmtdResult?.warnings ?? [];

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Heat Duty Calculation Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        {bannerItems.length > 0 && <PrimaryResultBanner items={bannerItems} />}

        {/* ── Sensible Heat ── */}
        {sensibleResult && (
          <TwoColumnLayout
            left={
              <ReportSection title="Sensible Heat — Input Parameters">
                <KeyValueTable
                  rows={[
                    {
                      label: 'Fluid Type',
                      value: FLUID_LABELS[inputs.fluidType ?? ''] ?? inputs.fluidType ?? '—',
                    },
                    ...(inputs.fluidType === 'SEAWATER'
                      ? [{ label: 'Salinity', value: `${inputs.salinity ?? '—'} mg/L` }]
                      : []),
                    { label: 'Mass Flow Rate', value: `${inputs.massFlowRate ?? '—'} ton/hr` },
                    { label: 'Inlet Temperature', value: `${inputs.inletTemp ?? '—'} \u00B0C` },
                    { label: 'Outlet Temperature', value: `${inputs.outletTemp ?? '—'} \u00B0C` },
                  ]}
                />
              </ReportSection>
            }
            right={
              <ReportSection title="Sensible Heat — Results">
                <KeyValueTable
                  rows={[
                    { label: 'Heat Duty', value: `${fmt(sensibleResult.heatDuty, 1)} kW` },
                    { label: 'Heat Duty', value: `${fmt(sensibleResult.heatDuty / 1000, 3)} MW` },
                    {
                      label: 'Specific Heat (Cp)',
                      value: `${fmt(sensibleResult.specificHeat, 4)} kJ/(kg\u00B7\u00B0C)`,
                    },
                    { label: '\u0394T', value: `${fmt(sensibleResult.deltaT, 1)} \u00B0C` },
                    { label: 'Mass Flow', value: `${fmt(sensibleResult.massFlowKgS, 3)} kg/s` },
                    { label: 'Process', value: sensibleResult.isHeating ? 'Heating' : 'Cooling' },
                  ]}
                />
              </ReportSection>
            }
          />
        )}

        {/* ── Latent Heat ── */}
        {latentResult && (
          <TwoColumnLayout
            left={
              <ReportSection title="Latent Heat — Input Parameters">
                <KeyValueTable
                  rows={[
                    { label: 'Process', value: inputs.process ?? '—' },
                    { label: 'Mass Flow Rate', value: `${inputs.latentFlowRate ?? '—'} ton/hr` },
                    {
                      label: 'Saturation Temperature',
                      value: `${inputs.saturationTemp ?? '—'} \u00B0C`,
                    },
                  ]}
                />
              </ReportSection>
            }
            right={
              <ReportSection title="Latent Heat — Results">
                <KeyValueTable
                  rows={[
                    { label: 'Heat Duty', value: `${fmt(latentResult.heatDuty, 1)} kW` },
                    { label: 'Heat Duty', value: `${fmt(latentResult.heatDuty / 1000, 3)} MW` },
                    {
                      label: 'Latent Heat (hfg)',
                      value: `${fmt(latentResult.latentHeat, 1)} kJ/kg`,
                    },
                    { label: 'Mass Flow', value: `${fmt(latentResult.massFlowKgS, 3)} kg/s` },
                  ]}
                />
              </ReportSection>
            }
          />
        )}

        {/* ── LMTD ── */}
        {lmtdResult && (
          <>
            <TwoColumnLayout
              left={
                <ReportSection title="LMTD — Temperature Profile">
                  <KeyValueTable
                    rows={[
                      { label: 'Hot Inlet', value: `${inputs.hotInlet ?? '—'} \u00B0C` },
                      { label: 'Hot Outlet', value: `${inputs.hotOutlet ?? '—'} \u00B0C` },
                      { label: 'Cold Inlet', value: `${inputs.coldInlet ?? '—'} \u00B0C` },
                      { label: 'Cold Outlet', value: `${inputs.coldOutlet ?? '—'} \u00B0C` },
                      { label: 'Flow Arrangement', value: inputs.flowArrangement ?? '—' },
                    ]}
                  />
                </ReportSection>
              }
              right={
                <ReportSection title="LMTD — Results">
                  <KeyValueTable
                    rows={[
                      { label: '\u0394T\u2081', value: `${fmt(lmtdResult.deltaT1, 1)} \u00B0C` },
                      { label: '\u0394T\u2082', value: `${fmt(lmtdResult.deltaT2, 1)} \u00B0C` },
                      { label: 'LMTD (uncorrected)', value: `${fmt(lmtdResult.lmtd, 2)} \u00B0C` },
                      {
                        label: 'Correction Factor (F)',
                        value: fmt(lmtdResult.correctionFactor, 3),
                      },
                      {
                        label: 'Corrected LMTD',
                        value: `${fmt(lmtdResult.correctedLMTD, 2)} \u00B0C`,
                      },
                    ]}
                  />
                </ReportSection>
              }
            />

            {requiredArea != null && (
              <ReportSection title="Heat Exchanger Area Estimate">
                <KeyValueTable
                  rows={[
                    { label: 'Heat Duty (Q)', value: `${inputs.heatDutyForArea ?? '—'} kW` },
                    {
                      label: 'Overall HTC (U)',
                      value: `${inputs.overallHTC ?? '—'} W/m\u00B2\u00B7K`,
                    },
                    {
                      label: 'Required Area (A = Q / U\u00D7LMTD)',
                      value: `${fmt(requiredArea, 1)} m\u00B2`,
                    },
                  ]}
                />
              </ReportSection>
            )}
          </>
        )}

        <WarningsBox warnings={allWarnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Heat Duty Calculator',
            'Sensible: Q = m\u0307 \u00D7 Cp \u00D7 \u0394T | Latent: Q = m\u0307 \u00D7 hfg | LMTD: (\u0394T\u2081 - \u0394T\u2082) / ln(\u0394T\u2081/\u0394T\u2082)',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
