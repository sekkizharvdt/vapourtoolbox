/**
 * Chemical Dosing & CIP Report — PDF Document
 *
 * Renders a multi-section report covering antiscalant, anti-foam, and acid CIP.
 * Only sections with results are included.
 */

import { Document } from '@react-pdf/renderer';
import type { DosingResult, CIPResult, AcidType } from '@/lib/thermal/chemicalDosingCalculator';
import { CHEMICAL_PRODUCTS, ACID_PRODUCTS } from '@/lib/thermal/chemicalDosingCalculator';
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

export interface DosingReportInputs {
  feedFlow: string;
  dose: string;
  density: string;
  storageDays: string;
  linePressure: string;
  neatConc: string;
  workingConc: string;
}

export interface CIPReportInputs {
  acidType: AcidType;
  hxArea: string;
  specificVolume: string;
  pipingHoldup: string;
  cleaningConc: string;
  recircFlow: string;
  cleaningDuration: string;
  numRinses: string;
  cleaningsPerYear: string;
}

interface ChemicalDosingReportPDFProps {
  antiscalantResult?: DosingResult | null;
  antifoamResult?: DosingResult | null;
  cipResult?: CIPResult | null;
  antiscalantInputs?: DosingReportInputs;
  antifoamInputs?: DosingReportInputs;
  cipInputs?: CIPReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const fmt = (v: number | undefined, d = 3) => (v === undefined || isNaN(v) ? '—' : v.toFixed(d));

function buildDosingRows(result: DosingResult) {
  const rows = [
    { param: 'Dosing Flow', value: fmt(result.chemicalFlowLh, 4), unit: 'L/h' },
    { param: 'Dosing Flow', value: fmt(result.chemicalFlowMlMin, 2), unit: 'mL/min' },
    { param: 'Active Chemical Rate', value: fmt(result.activeChemicalGh, 2), unit: 'g/h' },
    { param: 'Daily Consumption', value: fmt(result.dailyConsumptionKg, 2), unit: 'kg/day' },
    { param: 'Monthly Consumption', value: fmt(result.monthlyConsumptionKg, 1), unit: 'kg/month' },
    { param: 'Annual Consumption', value: fmt(result.annualConsumptionKg, 0), unit: 'kg/year' },
  ];

  if (result.dosingLine) {
    rows.push({
      param: 'Dosing Tubing',
      value: `${result.dosingLine.tubingOD} mm OD / ${result.dosingLine.tubingID} mm ID @ ${result.dosingLine.velocity} m/s`,
      unit: '',
    });
  }

  if (result.pumpPressure) {
    rows.push({
      param: 'Required Pump Pressure',
      value: fmt(result.pumpPressure.requiredDischargePressure, 1),
      unit: 'bar(g)',
    });
  }

  if (result.storageTank) {
    rows.push({
      param: 'Bulk Storage Tank',
      value: `${result.storageTank.volumeLitres.toFixed(0)} L`,
      unit:
        result.storageTank.type === 'cylindrical'
          ? `D=${((result.storageTank.diameter ?? 0) * 1000).toFixed(0)} mm, H=${(result.storageTank.height * 1000).toFixed(0)} mm`
          : `${(result.storageTank.height * 1000).toFixed(0)} mm H`,
    });
  }

  return rows;
}

export const ChemicalDosingReportPDF = ({
  antiscalantResult,
  antifoamResult,
  cipResult,
  antiscalantInputs,
  antifoamInputs,
  cipInputs,
  documentNumber = 'CHD-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: ChemicalDosingReportPDFProps) => {
  // Collect all warnings
  const allWarnings: string[] = [];
  if (antiscalantResult?.warnings) allWarnings.push(...antiscalantResult.warnings);
  if (antifoamResult?.warnings) allWarnings.push(...antifoamResult.warnings);
  if (cipResult?.warnings) allWarnings.push(...cipResult.warnings);

  // Build primary banner
  const bannerItems: { label: string; value: string }[] = [];
  if (antiscalantResult) {
    bannerItems.push({
      label: 'Antiscalant',
      value: `${antiscalantResult.chemicalFlowMlMin.toFixed(1)} mL/min`,
    });
  }
  if (antifoamResult) {
    bannerItems.push({
      label: 'Anti-foam',
      value: `${antifoamResult.chemicalFlowMlMin.toFixed(1)} mL/min`,
    });
  }
  if (cipResult) {
    bannerItems.push({
      label: 'Acid CIP / Clean',
      value: `${cipResult.neatAcidLitres.toFixed(1)} L neat`,
    });
  }

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Chemical Dosing & CIP Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        {bannerItems.length > 0 && <PrimaryResultBanner items={bannerItems} />}

        {/* ── Antiscalant Section ── */}
        {antiscalantResult && antiscalantInputs && (
          <>
            <TwoColumnLayout
              left={
                <ReportSection title="Antiscalant — Input Parameters">
                  <KeyValueTable
                    rows={[
                      { label: 'Product', value: CHEMICAL_PRODUCTS.antiscalant.productName },
                      { label: 'Feed Flow', value: `${antiscalantInputs.feedFlow} m³/h` },
                      { label: 'Dose', value: `${antiscalantInputs.dose} mg/L` },
                      { label: 'Solution Density', value: `${antiscalantInputs.density} kg/L` },
                      { label: 'Storage Days', value: antiscalantInputs.storageDays || '—' },
                      ...(antiscalantInputs.linePressure
                        ? [
                            {
                              label: 'Line Pressure',
                              value: `${antiscalantInputs.linePressure} bar(g)`,
                            },
                          ]
                        : []),
                    ]}
                  />
                </ReportSection>
              }
              right={
                <ReportSection title="Antiscalant — Results">
                  <ReportTable
                    columns={[
                      { key: 'param', header: 'Parameter', width: '45%' },
                      { key: 'value', header: 'Value', width: '35%', align: 'right' },
                      { key: 'unit', header: 'Unit', width: '20%' },
                    ]}
                    rows={buildDosingRows(antiscalantResult)}
                  />
                </ReportSection>
              }
            />

            {antiscalantResult.dilution && (
              <ReportSection title="Antiscalant — Dilution">
                <KeyValueTable
                  rows={[
                    {
                      label: 'Dilution Ratio',
                      value: `${antiscalantResult.dilution.neatConcentration}% → ${antiscalantResult.dilution.workingConcentration}% (${antiscalantResult.dilution.dilutionRatio}:1)`,
                    },
                    {
                      label: 'Neat Chemical Flow',
                      value: `${antiscalantResult.dilution.neatChemicalFlowLh} L/h`,
                    },
                    {
                      label: 'Dilution Water Flow',
                      value: `${antiscalantResult.dilution.dilutionWaterFlowLh} L/h`,
                    },
                    {
                      label: 'Total Diluted Flow',
                      value: `${antiscalantResult.dilution.dilutedSolutionFlowLh} L/h`,
                    },
                  ]}
                />
              </ReportSection>
            )}
          </>
        )}

        {/* ── Anti-foam Section ── */}
        {antifoamResult && antifoamInputs && (
          <TwoColumnLayout
            left={
              <ReportSection title="Anti-foam — Input Parameters">
                <KeyValueTable
                  rows={[
                    { label: 'Product', value: CHEMICAL_PRODUCTS.antifoam.productName },
                    { label: 'Feed Flow', value: `${antifoamInputs.feedFlow} m³/h` },
                    { label: 'Dose', value: `${antifoamInputs.dose} mg/L` },
                    { label: 'Solution Density', value: `${antifoamInputs.density} kg/L` },
                    { label: 'Storage Days', value: antifoamInputs.storageDays || '—' },
                  ]}
                />
              </ReportSection>
            }
            right={
              <ReportSection title="Anti-foam — Results">
                <ReportTable
                  columns={[
                    { key: 'param', header: 'Parameter', width: '45%' },
                    { key: 'value', header: 'Value', width: '35%', align: 'right' },
                    { key: 'unit', header: 'Unit', width: '20%' },
                  ]}
                  rows={buildDosingRows(antifoamResult)}
                />
              </ReportSection>
            }
          />
        )}

        {/* ── Acid CIP Section ── */}
        {cipResult && cipInputs && (
          <>
            <ReportSection
              title={`Acid CIP — ${ACID_PRODUCTS[cipInputs.acidType].name} (${ACID_PRODUCTS[cipInputs.acidType].formula})`}
            >
              <TwoColumnLayout
                left={
                  <KeyValueTable
                    rows={[
                      { label: 'HX Surface Area', value: `${cipInputs.hxArea} m²` },
                      { label: 'Specific Volume', value: `${cipInputs.specificVolume} L/m²` },
                      {
                        label: 'Piping Hold-up',
                        value: cipInputs.pipingHoldup ? `${cipInputs.pipingHoldup} m³` : '—',
                      },
                      {
                        label: 'System Volume',
                        value: `${cipResult.systemVolumeLitres.toFixed(0)} L (${cipResult.systemVolume} m³)`,
                      },
                    ]}
                  />
                }
                right={
                  <KeyValueTable
                    rows={[
                      { label: 'Cleaning Conc.', value: `${cipInputs.cleaningConc}% w/w` },
                      { label: 'Recirc. Flow', value: `${cipInputs.recircFlow} m³/h` },
                      { label: 'Duration', value: `${cipInputs.cleaningDuration} hours` },
                      { label: 'Rinses', value: cipInputs.numRinses },
                      { label: 'Cleans / Year', value: cipInputs.cleaningsPerYear },
                    ]}
                  />
                }
              />
            </ReportSection>

            <ReportSection title="CIP — Per-Clean Quantities">
              <ReportTable
                columns={[
                  { key: 'param', header: 'Parameter', width: '50%' },
                  { key: 'value', header: 'Value', width: '30%', align: 'right' },
                  { key: 'unit', header: 'Unit', width: '20%' },
                ]}
                rows={[
                  {
                    param: 'Dilute Solution Volume',
                    value: fmt(cipResult.diluteSolutionVolume * 1000, 0),
                    unit: 'L',
                  },
                  {
                    param: `Neat ${ACID_PRODUCTS[cipInputs.acidType].name} (${ACID_PRODUCTS[cipInputs.acidType].neatConcentration}%)`,
                    value: fmt(cipResult.neatAcidLitres, 1),
                    unit: 'L',
                  },
                  { param: 'Neat Acid Mass', value: fmt(cipResult.neatAcidMassKg, 1), unit: 'kg' },
                  {
                    param: 'Dilution Water',
                    value: fmt(cipResult.dilutionWaterVolume * 1000, 0),
                    unit: 'L',
                  },
                  {
                    param: `Rinse Water (${cipInputs.numRinses} rinses)`,
                    value: fmt(cipResult.totalRinseWater * 1000, 0),
                    unit: 'L',
                  },
                  {
                    param: 'Total Water per Clean',
                    value: fmt(cipResult.totalWaterPerClean, 2),
                    unit: 'm³',
                  },
                  {
                    param: 'Volume Turnovers',
                    value: fmt(cipResult.volumeTurnovers, 1),
                    unit: `× (${cipResult.turnoverStatus})`,
                  },
                ]}
              />
            </ReportSection>

            <ReportSection title="CIP — Annual Consumption & Tanks">
              <ReportTable
                columns={[
                  { key: 'param', header: 'Parameter', width: '50%' },
                  { key: 'value', header: 'Value', width: '30%', align: 'right' },
                  { key: 'unit', header: 'Unit', width: '20%' },
                ]}
                rows={[
                  {
                    param: 'Annual Neat Acid',
                    value: fmt(cipResult.annualNeatAcidKg, 0),
                    unit: 'kg/yr',
                  },
                  {
                    param: 'Annual Neat Acid',
                    value: fmt(cipResult.annualNeatAcidLitres, 0),
                    unit: 'L/yr',
                  },
                  { param: 'Annual Water', value: fmt(cipResult.annualWaterM3, 1), unit: 'm³/yr' },
                  {
                    param: 'CIP Mixing Tank',
                    value: `${cipResult.cipTank.volumeLitres.toFixed(0)} L`,
                    unit:
                      cipResult.cipTank.type === 'cylindrical'
                        ? `D=${((cipResult.cipTank.diameter ?? 0) * 1000).toFixed(0)}, H=${(cipResult.cipTank.height * 1000).toFixed(0)} mm`
                        : `H=${(cipResult.cipTank.height * 1000).toFixed(0)} mm`,
                  },
                  ...(cipResult.storageTank
                    ? [
                        {
                          param: 'Acid Storage Tank',
                          value: `${cipResult.storageTank.volumeLitres.toFixed(0)} L`,
                          unit:
                            cipResult.storageTank.type === 'cylindrical'
                              ? `D=${((cipResult.storageTank.diameter ?? 0) * 1000).toFixed(0)}, H=${(cipResult.storageTank.height * 1000).toFixed(0)} mm`
                              : `H=${(cipResult.storageTank.height * 1000).toFixed(0)} mm`,
                        },
                      ]
                    : []),
                  ...(cipResult.bundVolume !== undefined
                    ? [
                        {
                          param: 'Bund Volume (110%)',
                          value: fmt(cipResult.bundVolume),
                          unit: 'm³',
                        },
                      ]
                    : []),
                ]}
              />
            </ReportSection>
          </>
        )}

        <WarningsBox warnings={allWarnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Chemical Dosing & CIP Calculator',
            'Dosing: mass balance approach | CIP: volumetric acid dilution with system hold-up estimation',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
