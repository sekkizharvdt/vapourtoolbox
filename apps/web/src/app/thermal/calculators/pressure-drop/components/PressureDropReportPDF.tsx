/**
 * Pressure Drop Report — PDF Document
 */

import { Document } from '@react-pdf/renderer';
import type { PressureDropResult, FittingCount } from '@/lib/thermal/pressureDropCalculator';
import { FITTING_NAMES } from '@/lib/thermal/pressureDropCalculator';
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

export interface PressureDropReportInputs {
  selectedNPS: string;
  pipeLength: string;
  roughness: string;
  flowRate: string;
  fluidType: string;
  temperature: string;
  salinity?: string;
  fluidDensity: number;
  fluidViscosity: number;
  elevationChange: string;
  fittings: FittingCount[];
}

interface PressureDropReportPDFProps {
  result: PressureDropResult;
  inputs: PressureDropReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const fmt = (v: number, d = 2) => (isNaN(v) ? '—' : v.toFixed(d));

const FLUID_LABELS: Record<string, string> = {
  water: 'Pure Water',
  seawater: 'Seawater',
  custom: 'Custom Fluid',
};

export const PressureDropReportPDF = ({
  result,
  inputs,
  documentNumber = 'PD-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: PressureDropReportPDFProps) => {
  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Pressure Drop Calculation Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Total \u0394P', value: `${fmt(result.totalPressureDropBar, 3)} bar` },
            { label: 'Total \u0394P', value: `${fmt(result.totalPressureDropMH2O, 2)} m H\u2082O` },
            { label: 'Velocity', value: `${fmt(result.velocity, 2)} m/s` },
          ]}
        />

        {/* ── Input & Pipe ── */}
        <TwoColumnLayout
          left={
            <ReportSection title="Pipe & Flow Parameters">
              <KeyValueTable
                rows={[
                  {
                    label: 'Pipe Size',
                    value: `NPS ${inputs.selectedNPS} (ID ${fmt(result.pipe.id_mm, 1)} mm)`,
                  },
                  { label: 'Pipe Length', value: `${inputs.pipeLength} m` },
                  { label: 'Roughness', value: `${inputs.roughness} mm` },
                  { label: 'Flow Rate', value: `${inputs.flowRate} ton/hr` },
                  { label: 'Elevation Change', value: `${inputs.elevationChange} m` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Fluid Properties">
              <KeyValueTable
                rows={[
                  {
                    label: 'Fluid Type',
                    value: FLUID_LABELS[inputs.fluidType] ?? inputs.fluidType,
                  },
                  { label: 'Temperature', value: `${inputs.temperature} \u00B0C` },
                  ...(inputs.fluidType === 'seawater'
                    ? [{ label: 'Salinity', value: `${inputs.salinity ?? '35000'} mg/L` }]
                    : []),
                  { label: 'Density', value: `${fmt(inputs.fluidDensity, 1)} kg/m\u00B3` },
                  {
                    label: 'Viscosity',
                    value: `${(inputs.fluidViscosity * 1000).toFixed(3)} mPa\u00B7s`,
                  },
                ]}
              />
            </ReportSection>
          }
        />

        {/* ── Flow Regime ── */}
        <ReportSection title="Flow Characteristics">
          <KeyValueTable
            rows={[
              { label: 'Velocity', value: `${fmt(result.velocity, 2)} m/s` },
              { label: 'Reynolds Number', value: result.reynoldsNumber.toLocaleString() },
              { label: 'Flow Regime', value: result.flowRegime },
              { label: 'Friction Factor (f)', value: fmt(result.frictionFactor, 6) },
            ]}
          />
        </ReportSection>

        {/* ── Pressure Drop Breakdown ── */}
        <ReportSection title="Pressure Drop Breakdown">
          <ReportTable
            columns={[
              { key: 'component', header: 'Component', width: '50%' },
              { key: 'mh2o', header: 'm H\u2082O', width: '25%', align: 'right' },
              { key: 'bar', header: 'bar', width: '25%', align: 'right' },
            ]}
            rows={[
              {
                component: 'Straight Pipe',
                mh2o: fmt(result.straightPipeLoss, 3),
                bar: fmt(result.straightPipeLoss * 0.0981, 4),
              },
              {
                component: `Fittings (K = ${fmt(result.totalKFactor, 1)}, Leq = ${fmt(result.equivalentLength, 1)} m)`,
                mh2o: fmt(result.fittingsLoss, 3),
                bar: fmt(result.fittingsLoss * 0.0981, 4),
              },
              {
                component: 'Elevation Head',
                mh2o: fmt(result.elevationHead, 3),
                bar: fmt(result.elevationHead * 0.0981, 4),
              },
              {
                component: 'TOTAL',
                mh2o: fmt(result.totalPressureDropMH2O, 3),
                bar: fmt(result.totalPressureDropBar, 4),
              },
            ]}
          />
        </ReportSection>

        {/* ── Fittings Detail ── */}
        {result.fittingsBreakdown.length > 0 && (
          <ReportSection title="Fittings Detail">
            <ReportTable
              columns={[
                { key: 'fitting', header: 'Fitting', width: '40%' },
                { key: 'count', header: 'Qty', width: '10%', align: 'right' },
                { key: 'k', header: 'K', width: '15%', align: 'right' },
                { key: 'totalK', header: 'Total K', width: '15%', align: 'right' },
                { key: 'loss', header: 'm H\u2082O', width: '20%', align: 'right' },
              ]}
              rows={result.fittingsBreakdown.map((fb) => ({
                fitting: FITTING_NAMES[fb.type] ?? fb.type,
                count: `${fb.count}`,
                k: fmt(fb.kFactor, 2),
                totalK: fmt(fb.kFactor * fb.count, 2),
                loss: fmt(fb.loss, 4),
              }))}
            />
          </ReportSection>
        )}

        {/* ── Multi-unit summary ── */}
        <ReportSection title="Total Pressure Drop — All Units">
          <KeyValueTable
            rows={[
              { label: 'm H\u2082O', value: fmt(result.totalPressureDropMH2O, 3) },
              { label: 'bar', value: fmt(result.totalPressureDropBar, 4) },
              { label: 'mbar', value: fmt(result.totalPressureDropMbar, 1) },
              { label: 'kPa', value: fmt(result.totalPressureDropKPa, 2) },
            ]}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Pressure Drop Calculator',
            'Method: Darcy-Weisbach with Colebrook-White friction factor | Fittings: K-factor method (Crane TP-410)',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
