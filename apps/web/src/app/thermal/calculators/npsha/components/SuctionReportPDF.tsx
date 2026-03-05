/**
 * Suction System Design Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import React from 'react';
import { Document, Text, View } from '@react-pdf/renderer';
import type { SuctionSystemResult } from '@/lib/thermal/suctionSystemCalculator';
import { FLUID_TYPE_LABELS } from './types';
import type { SuctionReportInputs } from './SuctionResults';
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
  REPORT_THEME,
  reportStyles as s,
} from '@/lib/pdf/reportComponents';

interface SuctionReportPDFProps {
  result: SuctionSystemResult;
  inputs: SuctionReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
}

export const SuctionReportPDF = ({
  result,
  inputs,
  documentNumber = 'SUCTION-001',
  revision = '0',
  projectName,
  notes,
}: SuctionReportPDFProps) => {
  const fmt = (value: number, decimals: number = 2) =>
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const fluidLabel = FLUID_TYPE_LABELS[inputs.fluidType] || inputs.fluidType;

  // Build conditional KV rows for left input parameters
  const leftParams = [
    { label: 'Effect Pressure', value: `${inputs.effectPressure} mbar(a)` },
    { label: 'Fluid Type', value: fluidLabel },
    ...(inputs.fluidType === 'brine'
      ? [{ label: 'Salinity', value: `${inputs.salinity} ppm` }]
      : []),
    { label: 'Mass Flow Rate', value: `${inputs.flowRate} ton/hr` },
    { label: 'Pump NPSHr', value: `${inputs.pumpNPSHr} m` },
    { label: 'Safety Margin', value: `${inputs.safetyMargin} m` },
  ];

  const rightParams = [
    { label: 'Nozzle Vel. Target', value: `${inputs.nozzleVelocityTarget} m/s` },
    { label: 'Suction Vel. Target', value: `${inputs.suctionVelocityTarget} m/s` },
    { label: '90° Elbows', value: String(inputs.elbowCount) },
    { label: 'Vertical Run', value: `${inputs.verticalPipeRun} m` },
    { label: 'Horizontal Run', value: `${inputs.horizontalPipeRun} m` },
  ];

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="MED SUCTION SYSTEM DESIGN"
          subtitle="CALCULATION REPORT"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Required Elevation', value: `${fmt(result.requiredElevation)} m` },
            { label: 'NPSHa (Dirty)', value: `${fmt(result.npshaDirty.npsha)} m`, fontSize: 14 },
            {
              label: 'Nozzle / Suction',
              value: `${result.nozzlePipe.nps}" / ${result.suctionPipe.nps}"`,
              fontSize: 12,
            },
            {
              label: 'Margin',
              value: `${result.npshaDirty.margin >= 0 ? '+' : ''}${fmt(result.npshaDirty.margin)} m`,
              fontSize: 12,
              color: result.npshaDirty.isAdequate ? REPORT_THEME.successText : '#c62828',
            },
          ]}
        />

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
              { key: 'function', header: 'Function', width: '20%' },
              { key: 'nps', header: 'NPS', width: '15%' },
              { key: 'dn', header: 'DN', width: '15%' },
              { key: 'id', header: 'ID (mm)', width: '15%', align: 'right' },
              { key: 'od', header: 'OD (mm)', width: '15%', align: 'right' },
              { key: 'velocity', header: 'Velocity (m/s)', width: '20%', align: 'right' },
            ]}
            rows={[
              {
                function: 'Nozzle',
                nps: `${result.nozzlePipe.nps}"`,
                dn: String(result.nozzlePipe.dn),
                id: fmt(result.nozzlePipe.id_mm, 1),
                od: fmt(result.nozzlePipe.od_mm, 1),
                velocity: `${fmt(result.nozzleVelocity, 3)} (${result.nozzleVelocityStatus})`,
              },
              {
                function: 'Suction',
                nps: `${result.suctionPipe.nps}"`,
                dn: String(result.suctionPipe.dn),
                id: fmt(result.suctionPipe.id_mm, 1),
                od: fmt(result.suctionPipe.od_mm, 1),
                velocity: `${fmt(result.suctionVelocity, 2)} (${result.suctionVelocityStatus})`,
              },
            ]}
          />
          <Text style={{ fontSize: 8, color: REPORT_THEME.textSecondary, marginTop: 3 }}>
            Reducer: Concentric ({result.reducer.largePipeNPS}&quot; to{' '}
            {result.reducer.smallPipeNPS}&quot;, Beta={fmt(result.reducer.beta, 3)}, K=
            {fmt(result.reducer.kFactor, 4)})
          </Text>
        </ReportSection>

        {/* 3. Fittings */}
        <ReportSection title="3. FITTINGS &amp; K-FACTORS">
          <ReportTable
            columns={[
              { key: 'fitting', header: 'Fitting', width: '40%' },
              { key: 'count', header: 'Count', width: '15%', align: 'center' },
              { key: 'kFactor', header: 'K-factor', width: '20%', align: 'right' },
              { key: 'loss', header: 'Loss (m H2O)', width: '25%', align: 'right' },
            ]}
            rows={result.fittings.map((f) => ({
              fitting: f.name,
              count: String(f.count),
              kFactor: fmt(f.kFactor, 4),
              loss: fmt(f.loss, 4),
            }))}
          />
          <Text style={{ fontSize: 8, color: REPORT_THEME.textSecondary, marginTop: 3 }}>
            Auto-selected: {result.valveType === 'gate' ? 'Gate' : 'Ball'} valve,{' '}
            {result.strainerType === 'bucket_type' ? 'Bucket' : 'Y-type'} strainer (NPS{' '}
            {result.suctionPipe.nps}&quot; threshold at 4&quot;)
          </Text>
        </ReportSection>

        {/* 4. Strainer Pressure Drop */}
        <ReportSection
          title={`4. STRAINER PRESSURE DROP — ${result.strainerPressureDrop.strainerName.toUpperCase()}`}
        >
          <ReportTable
            columns={[
              { key: 'condition', header: 'Condition', width: '30%' },
              { key: 'kFactor', header: 'K-factor', width: '20%', align: 'right' },
              { key: 'lossM', header: 'Loss (m H2O)', width: '25%', align: 'right' },
              { key: 'lossMbar', header: 'Loss (mbar)', width: '25%', align: 'right' },
            ]}
            rows={[
              {
                condition: 'Clean',
                kFactor: String(result.strainerPressureDrop.cleanKFactor),
                lossM: fmt(result.strainerPressureDrop.cleanLoss, 3),
                lossMbar: fmt(result.strainerPressureDrop.cleanLossMbar, 1),
              },
              {
                condition: 'Dirty',
                kFactor: String(result.strainerPressureDrop.dirtyKFactor),
                lossM: fmt(result.strainerPressureDrop.dirtyLoss, 3),
                lossMbar: fmt(result.strainerPressureDrop.dirtyLossMbar, 1),
              },
            ]}
          />
        </ReportSection>

        {/* 5. NPSHa Breakdown */}
        <ReportSection title="5. NPSHa BREAKDOWN (CLEAN vs DIRTY)">
          <Text style={{ fontSize: 8, color: REPORT_THEME.textSecondary, marginBottom: 4 }}>
            NPSHa = Hs + Hp - Hvp - Hf
          </Text>
          <ReportTable
            columns={[
              { key: 'component', header: 'Component', width: '30%' },
              { key: 'sign', header: 'Sign', width: '15%', align: 'center' },
              { key: 'clean', header: 'Clean (m)', width: '25%', align: 'right' },
              { key: 'dirty', header: 'Dirty (m)', width: '25%', align: 'right' },
            ]}
            rows={[
              {
                component: 'Hs — Static head',
                sign: '+',
                clean: fmt(result.npshaClean.staticHead, 3),
                dirty: fmt(result.npshaDirty.staticHead, 3),
              },
              {
                component: 'Hp — Pressure head',
                sign: '+',
                clean: fmt(result.npshaClean.pressureHead, 3),
                dirty: fmt(result.npshaDirty.pressureHead, 3),
              },
              {
                component: 'Hvp — Vapor pressure',
                sign: '-',
                clean: fmt(result.npshaClean.vaporPressureHead, 3),
                dirty: fmt(result.npshaDirty.vaporPressureHead, 3),
              },
              {
                component: 'Hf — Friction loss',
                sign: '-',
                clean: fmt(result.npshaClean.frictionLoss, 3),
                dirty: fmt(result.npshaDirty.frictionLoss, 3),
              },
            ]}
            totalRow={{
              component: 'NPSHa',
              sign: '=',
              clean: fmt(result.npshaClean.npsha, 3),
              dirty: fmt(result.npshaDirty.npsha, 3),
            }}
          />
          {/* Margin row below the total */}
          <View style={s.kvRow}>
            <Text style={[s.kvLabel, { width: '30%' }]}>Margin (NPSHa - NPSHr)</Text>
            <Text style={{ width: '15%', paddingHorizontal: 3 }} />
            <Text style={{ width: '25%', paddingHorizontal: 3, textAlign: 'right' }}>
              {result.npshaClean.margin >= 0 ? '+' : ''}
              {fmt(result.npshaClean.margin, 3)}
            </Text>
            <Text style={{ width: '25%', paddingHorizontal: 3, textAlign: 'right' }}>
              {result.npshaDirty.margin >= 0 ? '+' : ''}
              {fmt(result.npshaDirty.margin, 3)}
            </Text>
          </View>
        </ReportSection>

        {/* 6. Holdup Volume & Elevation */}
        <ReportSection title="6. HOLDUP VOLUME &amp; ELEVATION">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  {
                    label: 'Holdup Pipe',
                    value: `${result.holdup.holdupPipeNPS}" (ID ${fmt(result.holdup.holdupPipeID, 1)} mm)`,
                  },
                  {
                    label: 'From Residence Time',
                    value: `${fmt(result.holdup.heightFromResidenceTime, 2)} m`,
                  },
                  {
                    label: 'From Min Column',
                    value: `${fmt(result.holdup.heightFromMinColumn, 2)} m`,
                  },
                  {
                    label: 'Governing Height',
                    value: `${fmt(result.holdup.governingHeight, 2)} m`,
                  },
                  { label: 'Volume', value: `${fmt(result.holdup.holdupVolume, 1)} litres` },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  {
                    label: 'Holdup Height',
                    value: `${fmt(result.elevationBreakdown.holdupHeight, 2)} m`,
                  },
                  {
                    label: 'Additional for NPSHa',
                    value: `${fmt(result.elevationBreakdown.additionalHeadRequired, 2)} m`,
                  },
                  {
                    label: 'Required Elevation',
                    value: `${fmt(result.elevationBreakdown.total, 2)} m`,
                  },
                ]}
              />
            }
          />
        </ReportSection>

        {/* 7. Fluid Properties */}
        <ReportSection title="7. FLUID PROPERTIES">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Sat. Temperature', value: `${fmt(result.saturationTemperature, 1)} C` },
                  ...(result.boilingPointElevation > 0
                    ? [{ label: 'BPE', value: `${fmt(result.boilingPointElevation, 2)} C` }]
                    : []),
                  { label: 'Fluid Temperature', value: `${fmt(result.fluidTemperature, 1)} C` },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  { label: 'Density', value: `${fmt(result.fluidDensity, 2)} kg/m3` },
                  { label: 'Viscosity', value: `${fmt(result.fluidViscosity * 1000, 3)} mPa.s` },
                  { label: 'Vapor Pressure', value: `${fmt(result.vaporPressure * 1000, 1)} mbar` },
                ]}
              />
            }
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Suction System Designer',
            'Method: Darcy-Weisbach + Crane TP-410 | NPSHa: Hydraulic Institute | Steam Tables: IAPWS-IF97',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
