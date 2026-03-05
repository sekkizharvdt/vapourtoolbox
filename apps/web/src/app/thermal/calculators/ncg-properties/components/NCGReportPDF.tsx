/**
 * NCG Properties Calculation Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document } from '@react-pdf/renderer';
import type { NCGResult, NCGInputMode } from '@/lib/thermal/ncgCalculator';
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

export interface NCGReportInputs {
  mode: NCGInputMode;
  temperatureC: string;
  pressureBar: string;
  useSatPressure: boolean;
  // Seawater mode
  seawaterFlowM3h?: string;
  seawaterTempC?: string;
  salinityGkg?: string;
  // Dry NCG mode
  dryNcgFlowKgH?: string;
  // Wet NCG mode
  wetNcgFlowKgH?: string;
  // Split flows mode
  splitNcgFlowKgH?: string;
  splitVapourFlowKgH?: string;
}

interface NCGReportPDFProps {
  result: NCGResult;
  inputs: NCGReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

const MODE_LABELS: Record<NCGInputMode, string> = {
  seawater: 'Seawater Feed',
  dry_ncg: 'Dry NCG Flow',
  wet_ncg: 'Wet NCG Flow',
  split_flows: 'NCG + Vapour Split',
};

export const NCGReportPDF = ({
  result,
  inputs,
  documentNumber = 'NCG-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: NCGReportPDFProps) => {
  const fmt = (value: number, decimals: number = 3) =>
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const pressureLabel =
    inputs.mode === 'split_flows'
      ? 'Derived from flow rates (Dalton\u2019s law)'
      : inputs.useSatPressure
        ? `${inputs.pressureBar} bar (NCG partial pressure above P_sat)`
        : `${inputs.pressureBar} bar abs (total)`;

  // Build mode-specific right-column rows
  const modeSpecificRows = (() => {
    switch (inputs.mode) {
      case 'seawater':
        return [
          { label: 'Seawater Flow', value: `${inputs.seawaterFlowM3h} m³/h` },
          { label: 'SW Inlet Temperature', value: `${inputs.seawaterTempC} °C` },
          { label: 'Salinity', value: `${inputs.salinityGkg} g/kg` },
        ];
      case 'dry_ncg':
        return [{ label: 'Dry NCG Flow', value: `${inputs.dryNcgFlowKgH} kg/h` }];
      case 'wet_ncg':
        return [{ label: 'Total (Wet) Gas Flow', value: `${inputs.wetNcgFlowKgH} kg/h` }];
      case 'split_flows':
        return [
          { label: 'Dry NCG Flow (input)', value: `${inputs.splitNcgFlowKgH} kg/h` },
          { label: 'Water Vapour Flow (input)', value: `${inputs.splitVapourFlowKgH} kg/h` },
        ];
      default:
        return [];
    }
  })();

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="NCG PROPERTIES CALCULATION"
          subtitle="Non-Condensable Gas + Water Vapour Mixture"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Temperature', value: `${fmt(result.temperatureC, 1)} °C` },
            { label: 'Total Pressure', value: `${fmt(result.totalPressureBar, 4)} bar` },
            { label: 'Density', value: `${fmt(result.density, 4)} kg/m³` },
            {
              label: 'NCG Partial Pressure',
              value: `${fmt(result.ncgPartialPressureBar, 4)} bar`,
              fontSize: 12,
            },
          ]}
        />

        {/* 1. Input Parameters */}
        <ReportSection title="1. INPUT PARAMETERS">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Input Mode', value: MODE_LABELS[inputs.mode] },
                  { label: 'Temperature', value: `${inputs.temperatureC} °C` },
                  { label: 'Pressure Input', value: pressureLabel },
                ]}
              />
            }
            right={<KeyValueTable rows={modeSpecificRows} />}
          />
        </ReportSection>

        {/* 2. System Conditions */}
        <ReportSection title="2. SYSTEM CONDITIONS">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Total Pressure', value: `${fmt(result.totalPressureBar, 5)} bar abs` },
                  {
                    label: 'Saturation Pressure P_sat(T)',
                    value: `${fmt(result.satPressureBar, 5)} bar`,
                  },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  {
                    label: 'Water Vapour Partial P',
                    value: `${fmt(result.waterVapourPartialPressureBar, 5)} bar`,
                  },
                  {
                    label: 'NCG Partial Pressure',
                    value: `${fmt(result.ncgPartialPressureBar, 5)} bar`,
                  },
                ]}
              />
            }
          />
        </ReportSection>

        {/* 3. Mixture Composition */}
        <ReportSection title="3. MIXTURE COMPOSITION">
          <ReportTable
            columns={[
              { key: 'component', header: 'Component', width: '35%' },
              { key: 'moleFrac', header: 'Mole Fraction', width: '25%', align: 'right' },
              { key: 'massFrac', header: 'Mass Fraction', width: '25%', align: 'right' },
              { key: 'partialP', header: 'Partial P (bar)', width: '25%', align: 'right' },
            ]}
            rows={[
              {
                component: 'Water Vapour (H₂O)',
                moleFrac: fmt(result.waterVapourMoleFrac, 4),
                massFrac: fmt(result.waterVapourMassFrac, 4),
                partialP: fmt(result.waterVapourPartialPressureBar, 5),
              },
              {
                component: 'NCG (Dry Air)',
                moleFrac: fmt(result.ncgMoleFrac, 4),
                massFrac: fmt(result.ncgMassFrac, 4),
                partialP: fmt(result.ncgPartialPressureBar, 5),
              },
            ]}
            totalRow={{
              component: 'Mixture Molar Mass',
              moleFrac: '—',
              massFrac: '—',
              partialP: `${fmt(result.mixMolarMass, 3)} g/mol`,
            }}
          />
        </ReportSection>

        {/* 4. Thermodynamic Properties */}
        <ReportSection title="4. THERMODYNAMIC PROPERTIES">
          <TwoColumnLayout
            left={
              <KeyValueTable
                labelWidth="60%"
                valueWidth="40%"
                rows={[
                  { label: 'Density (ρ)', value: `${fmt(result.density, 5)} kg/m³` },
                  { label: 'Specific Volume (v)', value: `${fmt(result.specificVolume, 4)} m³/kg` },
                  {
                    label: 'Specific Enthalpy (h_mix)',
                    value: `${fmt(result.specificEnthalpy, 2)} kJ/kg`,
                  },
                  {
                    label: ' └ Vapour enthalpy (h_g)',
                    value: `${fmt(result.vaporEnthalpy, 2)} kJ/kg`,
                  },
                  { label: ' └ Air enthalpy (Cp·T)', value: `${fmt(result.airEnthalpy, 2)} kJ/kg` },
                ]}
              />
            }
            right={
              <KeyValueTable
                labelWidth="60%"
                valueWidth="40%"
                rows={[
                  { label: 'Spec. Heat Cp', value: `${fmt(result.cpMix, 4)} kJ/(kg·K)` },
                  { label: 'Spec. Heat Cv', value: `${fmt(result.cvMix, 4)} kJ/(kg·K)` },
                  { label: 'Heat Ratio γ (Cp/Cv)', value: fmt(result.gammaMix, 4) },
                ]}
              />
            }
          />
        </ReportSection>

        {/* 5. Transport Properties */}
        <ReportSection title="5. TRANSPORT PROPERTIES">
          <ReportTable
            columns={[
              { key: 'property', header: 'Property', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'method', header: 'Method', width: '20%', align: 'right' },
            ]}
            rows={[
              {
                property: 'Dynamic Viscosity (μ)',
                value: `${fmt(result.dynamicViscosityPas * 1e6, 3)} μPa·s`,
                method: 'Wilke mixing rule',
              },
              {
                property: 'Thermal Conductivity (λ)',
                value: `${fmt(result.thermalConductivityWmK * 1000, 3)} mW/(m·K)`,
                method: 'Wassiljewa–M.S.',
              },
              {
                property: 'Prandtl Number (Pr)',
                value: fmt(
                  (result.cpMix * 1000 * result.dynamicViscosityPas) /
                    result.thermalConductivityWmK,
                  3
                ),
                method: '—',
              },
            ]}
          />
        </ReportSection>

        {/* 6. Flow Breakdown (conditional) */}
        {result.totalFlowKgH !== null && (
          <ReportSection title="6. FLOW BREAKDOWN">
            <ReportTable
              columns={[
                { key: 'stream', header: 'Stream', width: '50%' },
                { key: 'flow', header: 'Flow (kg/h)', width: '25%', align: 'right' },
                { key: 'note', header: 'Note', width: '25%', align: 'right' },
              ]}
              rows={[
                {
                  stream: 'Dry NCG (Air)',
                  flow: fmt(result.dryNcgFlowKgH ?? 0, 4),
                  note: `${fmt((result.ncgMassFrac ?? 0) * 100, 1)}% by mass`,
                },
                {
                  stream: 'Water Vapour',
                  flow: fmt(result.waterVapourFlowKgH ?? 0, 4),
                  note: `${fmt((result.waterVapourMassFrac ?? 0) * 100, 1)}% by mass`,
                },
                {
                  stream: 'Volumetric Flow at T, P',
                  flow: fmt(result.volumetricFlowM3h ?? 0, 3),
                  note: 'm³/h',
                },
              ]}
              totalRow={{
                stream: 'Total (Wet)',
                flow: fmt(result.totalFlowKgH, 4),
                note: 'kg/h',
              }}
            />
          </ReportSection>
        )}

        {/* 7. Dissolved Gas Content (seawater mode only) */}
        {result.seawaterInfo && (
          <ReportSection
            title={`7. DISSOLVED GAS CONTENT — Weiss (1970) at ${fmt(result.seawaterInfo.gasTempC, 1)} °C, ${result.seawaterInfo.salinityGkg} g/kg${result.seawaterInfo.extrapolated ? ' [EXTRAPOLATED — outside valid range]' : ''}`}
          >
            <ReportTable
              columns={[
                { key: 'gas', header: 'Gas', width: '25%' },
                { key: 'mlL', header: 'mL(STP)/L', width: '25%', align: 'right' },
                { key: 'mgL', header: 'mg/L', width: '25%', align: 'right' },
              ]}
              rows={[
                {
                  gas: 'O₂',
                  mlL: result.seawaterInfo.o2MlL.toExponential(3),
                  mgL: fmt(result.seawaterInfo.o2MgL, 3),
                },
                {
                  gas: 'N₂',
                  mlL: result.seawaterInfo.n2MlL.toExponential(3),
                  mgL: fmt(result.seawaterInfo.n2MgL, 3),
                },
              ]}
              totalRow={{
                gas: 'Total',
                mlL: (result.seawaterInfo.o2MlL + result.seawaterInfo.n2MlL).toExponential(3),
                mgL: fmt(result.seawaterInfo.totalGasMgL, 3),
              }}
            />
          </ReportSection>
        )}

        {notes && <NotesSection notes={notes} />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | NCG Properties Calculator',
            "Methods: Dalton's Law (Ideal Gas) | Dissolved Gas: Weiss (1970) | Viscosity: Wilke (1950) | Conductivity: Wassiljewa-Mason-Saxena | Steam: IAPWS-IF97",
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
