/**
 * Heat Transfer Coefficient Calculator — PDF Report
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 * Retains domain-specific banner cards (colour-coded h_i, h_o, U_o)
 * and the embedded HeatTransferDiagramPDF.
 */

import { Document, View, Text, StyleSheet } from '@react-pdf/renderer';
import { HeatTransferDiagramPDF } from './HeatTransferDiagramPDF';
import type { TubeSideHTCResult, CondensationHTCResult, OverallHTCResult } from '@/lib/thermal';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  MetadataRow,
  ReportTable,
  KeyValueTable,
  TwoColumnLayout,
  SummaryCards,
  NotesSection,
  ListFooter,
  REPORT_THEME,
} from '@/lib/pdf/reportComponents';

export interface HeatTransferReportInputs {
  // Tube side
  tsDensity: string;
  tsVelocity: string;
  tsTubeID: string;
  tsViscosity: string;
  tsSpecificHeat: string;
  tsConductivity: string;
  tsIsHeating: boolean;
  // Shell side
  condLiquidDensity: string;
  condVaporDensity: string;
  condLatentHeat: string;
  condLiquidConductivity: string;
  condLiquidViscosity: string;
  condDimension: string;
  condDeltaT: string;
  condOrientation: 'vertical' | 'horizontal';
  // Tube wall
  overallTubeOD: string;
  overallWallConductivity: string;
  overallTubeSideFouling: string;
  overallShellSideFouling: string;
}

interface HeatTransferReportPDFProps {
  inputs: HeatTransferReportInputs;
  tubeSideResult: TubeSideHTCResult;
  condensationResult: CondensationHTCResult;
  overallResult: OverallHTCResult;
  logoDataUri: string | null;
  // Report metadata
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
}

const BLUE = '#1565c0';
const RED = '#c62828';
const GREEN = '#2e7d32';

const local = StyleSheet.create({
  /* Colour-coded banner cards for hi, ho, Uo */
  bannerRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  bannerCard: { flex: 1, padding: 10, borderRadius: 4, alignItems: 'center' },
  bannerLabel: { fontSize: 8, marginBottom: 3 },
  bannerValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  bannerUnit: { fontSize: 7, marginTop: 2, color: REPORT_THEME.textSecondary },
  /* Parameter group header (coloured) */
  paramGroupTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    backgroundColor: REPORT_THEME.tableHeaderBg,
    padding: '3 6',
    borderRadius: 2,
  },
});

function fmtHTC(v: number) {
  return `${v.toFixed(1)} W/(m²·K)`;
}
function fmtR(v: number) {
  return `${(v * 1000).toFixed(4)} ×10⁻³ m²·K/W`;
}

export function HeatTransferReportPDF({
  inputs,
  tubeSideResult,
  condensationResult,
  overallResult,
  logoDataUri,
  documentNumber,
  revision,
  projectName,
  notes,
}: HeatTransferReportPDFProps) {
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const resTotal = overallResult.resistances.total;
  const resistanceRows = [
    {
      label: 'Tube-side convection (ref. OD)',
      value: overallResult.resistances.tubeSide,
      pct: (overallResult.resistances.tubeSide / resTotal) * 100,
    },
    {
      label: 'Tube-side fouling (ref. OD)',
      value: overallResult.resistances.tubeSideFouling,
      pct: (overallResult.resistances.tubeSideFouling / resTotal) * 100,
    },
    {
      label: 'Tube wall conduction',
      value: overallResult.resistances.tubeWall,
      pct: (overallResult.resistances.tubeWall / resTotal) * 100,
    },
    {
      label: 'Shell-side fouling',
      value: overallResult.resistances.shellSideFouling,
      pct: (overallResult.resistances.shellSideFouling / resTotal) * 100,
    },
    {
      label: 'Shell-side convection',
      value: overallResult.resistances.shellSide,
      pct: (overallResult.resistances.shellSide / resTotal) * 100,
    },
  ];

  // Build metadata items
  const metaItems = [
    ...(projectName ? [{ label: 'Project', value: projectName }] : []),
    ...(documentNumber ? [{ label: 'Document No.', value: documentNumber }] : []),
    ...(revision ? [{ label: 'Revision', value: revision }] : []),
    { label: 'Date', value: today },
  ];

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Heat Transfer Coefficient"
          subtitle="Shell &amp; Tube — Condensation (Shell) + Forced Convection (Tube)"
          logoDataUri={logoDataUri || undefined}
        />

        <MetadataRow items={metaItems} />

        {/* Primary results banner — colour-coded cards (domain-specific) */}
        <View style={local.bannerRow}>
          <View
            style={[local.bannerCard, { backgroundColor: '#e3f2fd', border: `1.5 solid ${BLUE}` }]}
          >
            <Text style={[local.bannerLabel, { color: BLUE }]}>h_i — Tube Side HTC</Text>
            <Text style={[local.bannerValue, { color: BLUE }]}>{fmtHTC(tubeSideResult.htc)}</Text>
            <Text style={local.bannerUnit}>
              Re = {tubeSideResult.reynoldsNumber.toFixed(0)} · Pr ={' '}
              {tubeSideResult.prandtlNumber.toFixed(3)}
            </Text>
          </View>
          <View
            style={[local.bannerCard, { backgroundColor: '#ffebee', border: `1.5 solid ${RED}` }]}
          >
            <Text style={[local.bannerLabel, { color: RED }]}>h_o — Shell Side HTC</Text>
            <Text style={[local.bannerValue, { color: RED }]}>
              {fmtHTC(condensationResult.htc)}
            </Text>
            <Text style={local.bannerUnit}>Nusselt Film Condensation</Text>
          </View>
          <View
            style={[local.bannerCard, { backgroundColor: '#e8f5e9', border: `1.5 solid ${GREEN}` }]}
          >
            <Text style={[local.bannerLabel, { color: GREEN }]}>U_o — Overall HTC</Text>
            <Text style={[local.bannerValue, { color: GREEN }]}>
              {fmtHTC(overallResult.overallHTC)}
            </Text>
            <Text style={local.bannerUnit}>Based on outer tube area</Text>
          </View>
        </View>

        {/* Diagram */}
        <ReportSection title="Heat Exchanger Schematic">
          <HeatTransferDiagramPDF
            tubeSideResult={tubeSideResult}
            condensationResult={condensationResult}
            overallResult={overallResult}
          />
        </ReportSection>

        {/* Input Parameters */}
        <ReportSection title="Input Parameters">
          <TwoColumnLayout
            left={
              <>
                <Text style={[local.paramGroupTitle, { color: BLUE }]}>
                  Tube Side (Cold — Forced Convection)
                </Text>
                <KeyValueTable
                  rows={[
                    { label: 'Fluid Density', value: `${inputs.tsDensity} kg/m³` },
                    { label: 'Flow Velocity', value: `${inputs.tsVelocity} m/s` },
                    { label: 'Tube Inner Diameter', value: `${inputs.tsTubeID} mm` },
                    { label: 'Dynamic Viscosity', value: `${inputs.tsViscosity} Pa·s` },
                    { label: 'Specific Heat', value: `${inputs.tsSpecificHeat} kJ/(kg·K)` },
                    { label: 'Thermal Conductivity', value: `${inputs.tsConductivity} W/(m·K)` },
                    { label: 'Process', value: inputs.tsIsHeating ? 'Heating' : 'Cooling' },
                  ]}
                />
              </>
            }
            right={
              <>
                <Text style={[local.paramGroupTitle, { color: RED }]}>
                  Shell Side (Hot — Condensation)
                </Text>
                <KeyValueTable
                  rows={[
                    { label: 'Liquid Density', value: `${inputs.condLiquidDensity} kg/m³` },
                    { label: 'Vapor Density', value: `${inputs.condVaporDensity} kg/m³` },
                    { label: 'Latent Heat', value: `${inputs.condLatentHeat} kJ/kg` },
                    {
                      label: 'Liquid Conductivity',
                      value: `${inputs.condLiquidConductivity} W/(m·K)`,
                    },
                    { label: 'Liquid Viscosity', value: `${inputs.condLiquidViscosity} Pa·s` },
                    {
                      label: inputs.condOrientation === 'vertical' ? 'Tube Length' : 'Tube OD',
                      value: `${inputs.condDimension} m`,
                    },
                    { label: 'ΔT (Tsat − Twall)', value: `${inputs.condDeltaT} °C` },
                    {
                      label: 'Orientation',
                      value: inputs.condOrientation === 'vertical' ? 'Vertical' : 'Horizontal',
                    },
                  ]}
                />
              </>
            }
          />
        </ReportSection>

        {/* Tube Geometry & Fouling */}
        <View style={{ marginTop: 8 }}>
          <Text style={[local.paramGroupTitle, { color: REPORT_THEME.textSecondary }]}>
            Tube Geometry &amp; Fouling
          </Text>
          <SummaryCards
            items={[
              { label: 'TUBE INNER DIAMETER', value: `${inputs.tsTubeID} mm` },
              { label: 'TUBE OUTER DIAMETER', value: `${inputs.overallTubeOD} mm` },
              { label: 'WALL CONDUCTIVITY', value: `${inputs.overallWallConductivity} W/(m·K)` },
              { label: 'TUBE-SIDE FOULING', value: `${inputs.overallTubeSideFouling} m²·K/W` },
              { label: 'SHELL-SIDE FOULING', value: `${inputs.overallShellSideFouling} m²·K/W` },
            ]}
          />
        </View>

        {/* Thermal Resistance Breakdown */}
        <ReportSection title="Thermal Resistance Breakdown">
          <ReportTable
            columns={[
              { key: 'component', header: 'Resistance Component', width: '50%' },
              { key: 'value', header: 'Value (m²·K/W)', width: '30%', align: 'right' },
              { key: 'pct', header: '% of Total', width: '20%', align: 'right' },
            ]}
            rows={resistanceRows.map((row) => ({
              component: row.label,
              value: fmtR(row.value),
              pct: `${row.pct.toFixed(1)}%`,
            }))}
            totalRow={{
              component: 'Total Resistance → U_o',
              value: fmtR(resTotal),
              pct: '100%',
            }}
            striped
          />
        </ReportSection>

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ListFooter label="Vapour Toolbox — Heat Transfer Calculator" />
      </ReportPage>
    </Document>
  );
}
