/**
 * Siphon Sizing Calculation Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SiphonSizingResult } from '@/lib/thermal/siphonSizingCalculator';
import { FITTING_NAMES, type FittingType } from '@/lib/thermal/pressureDropCalculator';
import {
  ELBOW_CONFIG_LABELS,
  FLUID_TYPE_LABELS,
  PRESSURE_UNIT_LABELS,
  PIPE_MATERIAL_LABELS,
} from './types';
import type { ElbowConfig } from './types';
import { SiphonDiagramPDF } from './SiphonDiagramPDF';
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
  reportStyles as s,
} from '@/lib/pdf/reportComponents';

const local = StyleSheet.create({
  diagramSection: {
    marginTop: 10,
    marginBottom: 6,
    alignItems: 'center',
  },
  flowParams: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  flowParam: {
    marginRight: 20,
  },
});

export interface SiphonReportInputs {
  upstreamPressure: string;
  downstreamPressure: string;
  pressureUnit: string;
  fluidType: string;
  salinity: string;
  flowRate: string;
  targetVelocity: string;
  pipeSchedule: string;
  pipeMaterial: string;
  elbowConfig: string;
  horizontalDistance: string;
  offsetDistance: string;
  safetyFactor: string;
}

interface SiphonReportPDFProps {
  result: SiphonSizingResult;
  inputs: SiphonReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

export const SiphonReportPDF = ({
  result,
  inputs,
  documentNumber = 'SIPHON-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: SiphonReportPDFProps) => {
  const fmt = (value: number, decimals: number = 2) =>
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const unitLabel = PRESSURE_UNIT_LABELS[inputs.pressureUnit] || inputs.pressureUnit;
  const fluidLabel = FLUID_TYPE_LABELS[inputs.fluidType] || inputs.fluidType;
  const elbowLabel = ELBOW_CONFIG_LABELS[inputs.elbowConfig] || inputs.elbowConfig;
  const scheduleLabel = `Sch ${inputs.pipeSchedule || '40'}`;
  const materialLabel =
    PIPE_MATERIAL_LABELS[inputs.pipeMaterial] || inputs.pipeMaterial || 'Carbon Steel';
  const safetyPct = (
    (result.safetyMargin / (result.staticHead + result.frictionHead)) *
    100
  ).toFixed(0);

  // Build conditional KV rows for input parameters
  const leftParams = [
    { label: 'Upstream Pressure', value: `${inputs.upstreamPressure} ${unitLabel}` },
    { label: 'Downstream Pressure', value: `${inputs.downstreamPressure} ${unitLabel}` },
    {
      label: 'Pressure Difference',
      value: `${fmt(result.pressureDiffBar * 1000, 1)} mbar (${fmt(result.pressureDiffBar, 4)} bar)`,
    },
    { label: 'Fluid Type', value: fluidLabel },
    ...(inputs.fluidType === 'seawater' || inputs.fluidType === 'brine'
      ? [{ label: 'Salinity', value: `${inputs.salinity} ppm` }]
      : []),
  ];

  const rightParams = [
    { label: 'Mass Flow Rate', value: `${inputs.flowRate} ton/hr` },
    { label: 'Target Velocity', value: `${inputs.targetVelocity} m/s` },
    { label: 'Pipe Material', value: materialLabel },
    { label: 'Elbow Configuration', value: elbowLabel },
    { label: 'Horizontal Distance', value: `${inputs.horizontalDistance} m` },
    ...(inputs.elbowConfig !== '2_elbows'
      ? [{ label: 'Offset Distance', value: `${inputs.offsetDistance} m` }]
      : []),
    { label: 'Safety Factor', value: `${inputs.safetyFactor}%` },
  ];

  // Pressure drop fitting rows
  const pressureDropRows = [
    {
      component: `Straight pipe (${fmt(result.totalPipeLength, 1)} m)`,
      mH2O: fmt(result.pressureDrop.straightPipeLoss, 3),
      mbar: fmt((result.pressureDrop.straightPipeLoss * result.fluidDensity * 9.81) / 100, 1),
    },
    ...result.pressureDrop.fittingsBreakdown.map((f) => ({
      component: `${FITTING_NAMES[f.type as FittingType]} x ${f.count} (K=${f.kFactor})`,
      mH2O: fmt(f.loss, 3),
      mbar: fmt((f.loss * result.fluidDensity * 9.81) / 100, 1),
    })),
  ];

  // Flash vapor KV rows
  const flashRows = [
    { label: 'Downstream Saturation Temp', value: `${fmt(result.downstreamSatTemp, 1)} °C` },
    ...(result.downstreamSatTemp !== result.downstreamSatTempPure
      ? [{ label: 'Pure Saturation Temp', value: `${fmt(result.downstreamSatTempPure, 1)} °C` }]
      : []),
    { label: 'Flash Occurs', value: result.flashOccurs ? 'Yes' : 'No' },
    ...(result.flashOccurs
      ? [
          { label: 'Flash Vapor Fraction', value: `${fmt(result.flashVaporFraction * 100, 2)}%` },
          { label: 'Vapor Flow', value: `${fmt(result.flashVaporFlow, 3)} ton/hr` },
          { label: 'Liquid After Flash', value: `${fmt(result.liquidFlowAfterFlash, 3)} ton/hr` },
        ]
      : []),
  ];

  const holdupDisplay =
    result.holdupVolumeLiters >= 1000
      ? `${fmt(result.holdupVolumeLiters / 1000, 2)} m³`
      : `${fmt(result.holdupVolumeLiters, 1)} L`;

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="SIPHON SIZING CALCULATION"
          subtitle="CALCULATION REPORT"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            {
              label: 'Selected Pipe',
              value: `${result.pipe.nps}" ${scheduleLabel} (DN${result.pipe.dn})`,
            },
            { label: 'Min. Siphon Height', value: `${fmt(result.minimumHeight, 3)} m` },
            {
              label: 'Velocity',
              value: `${fmt(result.velocity)} m/s (${result.velocityStatus})`,
              fontSize: 12,
            },
          ]}
        />

        {/* Siphon Arrangement Diagram */}
        <View style={local.diagramSection}>
          <Text style={s.sectionTitle}>SIPHON ARRANGEMENT</Text>
          <SiphonDiagramPDF
            result={result}
            elbowConfig={inputs.elbowConfig as ElbowConfig}
            horizontalDistance={parseFloat(inputs.horizontalDistance) || 0}
            offsetDistance={parseFloat(inputs.offsetDistance) || 0}
          />
        </View>

        {/* 1. Input Parameters */}
        <ReportSection title="1. INPUT PARAMETERS">
          <TwoColumnLayout
            left={<KeyValueTable rows={leftParams} />}
            right={<KeyValueTable rows={rightParams} />}
          />
        </ReportSection>

        {/* 2. Pipe Selection */}
        <ReportSection title="2. PIPE SELECTION">
          <ReportTable
            columns={[
              { key: 'nps', header: 'NPS', width: '20%' },
              { key: 'dn', header: 'DN', width: '15%' },
              { key: 'od', header: 'OD (mm)', width: '15%', align: 'right' },
              { key: 'id', header: 'ID (mm)', width: '15%', align: 'right' },
              { key: 'wt', header: 'WT (mm)', width: '15%', align: 'right' },
              { key: 'velocity', header: 'Velocity (m/s)', width: '20%', align: 'right' },
            ]}
            rows={[
              {
                nps: `${result.pipe.nps}" ${scheduleLabel}`,
                dn: result.pipe.dn,
                od: fmt(result.pipe.od_mm, 1),
                id: fmt(result.pipe.id_mm, 1),
                wt: fmt(result.pipe.wt_mm, 2),
                velocity: `${fmt(result.velocity)} (${result.velocityStatus})`,
              },
            ]}
          />
        </ReportSection>

        {/* 3. Siphon Height Breakdown */}
        <ReportSection title="3. SIPHON HEIGHT BREAKDOWN">
          <ReportTable
            columns={[
              { key: 'component', header: 'Component', width: '50%' },
              { key: 'value', header: 'Value (m)', width: '25%', align: 'right' },
            ]}
            rows={[
              { component: 'Static head (dP / rho.g)', value: fmt(result.staticHead, 3) },
              {
                component: 'Friction losses (pipe + fittings)',
                value: fmt(result.frictionHead, 3),
              },
              { component: `Safety margin (${safetyPct}%)`, value: fmt(result.safetyMargin, 3) },
            ]}
            totalRow={{ component: 'Minimum Siphon Height', value: fmt(result.minimumHeight, 3) }}
          />
        </ReportSection>

        {/* 4. Pressure Drop Details */}
        <ReportSection title="4. PRESSURE DROP DETAILS">
          <View style={local.flowParams}>
            <Text style={local.flowParam}>
              <Text style={s.bold}>Re: </Text>
              {fmt(result.pressureDrop.reynoldsNumber, 0)}
            </Text>
            <Text style={local.flowParam}>
              <Text style={s.bold}>Regime: </Text>
              {result.pressureDrop.flowRegime}
            </Text>
            <Text>
              <Text style={s.bold}>f: </Text>
              {result.pressureDrop.frictionFactor.toFixed(5)}
            </Text>
          </View>
          <ReportTable
            columns={[
              { key: 'component', header: 'Component', width: '40%' },
              { key: 'mH2O', header: 'm H2O', width: '30%', align: 'right' },
              { key: 'mbar', header: 'mbar', width: '30%', align: 'right' },
            ]}
            rows={pressureDropRows}
            totalRow={{
              component: 'Total',
              mH2O: fmt(result.pressureDrop.totalPressureDropMH2O, 3),
              mbar: fmt(result.pressureDrop.totalPressureDropMbar, 1),
            }}
          />
        </ReportSection>

        {/* 5. Flash Vapor */}
        <ReportSection title="5. FLASH VAPOR AT DOWNSTREAM EFFECT">
          <KeyValueTable rows={flashRows} />
        </ReportSection>

        {/* 6. Fluid Properties & Geometry */}
        <ReportSection title="6. FLUID PROPERTIES &amp; GEOMETRY">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Fluid Temperature', value: `${fmt(result.fluidTemperature, 1)} °C` },
                  { label: 'Density', value: `${fmt(result.fluidDensity, 2)} kg/m³` },
                  { label: 'Viscosity', value: `${fmt(result.fluidViscosity * 1000, 3)} mPa·s` },
                  ...(result.upstreamSatTempPure !== result.fluidTemperature
                    ? [
                        {
                          label: 'BPE',
                          value: `${fmt(result.fluidTemperature - result.upstreamSatTempPure, 2)} °C`,
                        },
                      ]
                    : []),
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  { label: 'Elbows', value: String(result.elbowCount) },
                  { label: 'Total Pipe Length', value: `${fmt(result.totalPipeLength, 1)} m` },
                  { label: 'Holdup Volume', value: holdupDisplay },
                ]}
              />
            }
          />
        </ReportSection>

        {/* 7. Weight Estimate */}
        <ReportSection title="7. WEIGHT ESTIMATE">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Pipe Material', value: materialLabel },
                  { label: 'Pipe Weight', value: `${fmt(result.pipeWeight, 1)} kg` },
                  {
                    label: 'Elbow Weight',
                    value: `${fmt(result.elbowWeight, 1)} kg (${result.elbowCount} nos.)`,
                  },
                  { label: 'Total Dry Weight', value: `${fmt(result.totalDryWeight, 1)} kg` },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  { label: 'Liquid Holdup Weight', value: `${fmt(result.liquidWeight, 1)} kg` },
                  {
                    label: 'Total Operating Weight',
                    value: `${fmt(result.totalOperatingWeight, 1)} kg`,
                  },
                ]}
              />
            }
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Siphon Sizing Calculator',
            'Method: Darcy-Weisbach | Steam Tables: IAPWS-IF97 | Seawater Properties: Sharqawy et al. (2010)',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
