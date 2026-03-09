/**
 * MED Performance Ratio Report — PDF Document
 *
 * Uses standardised report components from @/lib/pdf/reportComponents.
 */

import { Document } from '@react-pdf/renderer';
import type { GORResult } from '@/lib/thermal/gorCalculator';
import { PLANT_CONFIGURATIONS, type PlantConfiguration } from '@/lib/thermal/gorCalculator';
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

export interface GORReportInputs {
  numberOfEffects: string;
  configuration: PlantConfiguration;
  topBrineTemperature: string;
  lastEffectTemperature: string;
  seawaterTemperature: string;
  steamPressure: string;
  feedSalinity: string;
  maxBrineSalinity: string;
  condenserApproach: string;
  condenserTTD: string;
  tvcEntrainmentRatio: string;
  tvcCompressionRatio: string;
  distillateCapacity: string;
  steamSatTemp: number | null;
}

interface GORReportPDFProps {
  result: GORResult;
  inputs: GORReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

export const GORReportPDF = ({
  result,
  inputs,
  documentNumber = 'GOR-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: GORReportPDFProps) => {
  const fmt = (value: number, decimals: number = 2) =>
    isNaN(value) ? '\u2014' : value.toFixed(decimals);

  const configLabel = PLANT_CONFIGURATIONS[inputs.configuration]?.label ?? inputs.configuration;

  // Primary banner items
  const bannerItems = [
    { label: 'GOR', value: fmt(result.gor) },
    { label: 'STE (kJ/kg)', value: fmt(result.specificThermalEnergy, 1) },
    { label: 'STE (kWh/m\u00B3)', value: fmt(result.specificThermalEnergy_kWh, 1) },
    { label: 'Recovery', value: `${(result.totalRecovery * 100).toFixed(1)}%` },
  ];

  // Plant configuration rows
  const plantRows = [
    { label: 'Configuration', value: configLabel },
    { label: 'Number of Effects', value: inputs.numberOfEffects },
    { label: 'Top Brine Temperature', value: `${inputs.topBrineTemperature} \u00B0C` },
    { label: 'Last Effect Temperature', value: `${inputs.lastEffectTemperature} \u00B0C` },
    { label: 'Seawater Temperature', value: `${inputs.seawaterTemperature} \u00B0C` },
    {
      label: 'Steam Pressure',
      value: inputs.steamSatTemp
        ? `${inputs.steamPressure} bar (T_sat = ${fmt(inputs.steamSatTemp, 1)} \u00B0C)`
        : `${inputs.steamPressure} bar`,
    },
  ];

  // Feed & condenser rows
  const feedRows = [
    { label: 'Feed Salinity', value: `${parseFloat(inputs.feedSalinity).toLocaleString()} ppm` },
    {
      label: 'Max Brine Salinity',
      value: `${parseFloat(inputs.maxBrineSalinity).toLocaleString()} ppm`,
    },
    { label: 'Condenser Approach', value: `${inputs.condenserApproach} \u00B0C` },
    { label: 'Condenser TTD', value: `${inputs.condenserTTD} \u00B0C` },
    ...(inputs.configuration === 'MED_TVC'
      ? [
          { label: 'TVC Entrainment Ratio', value: inputs.tvcEntrainmentRatio },
          ...(inputs.tvcCompressionRatio
            ? [{ label: 'TVC Compression Ratio', value: inputs.tvcCompressionRatio }]
            : []),
        ]
      : []),
  ];

  // Effect details table
  const effectRows = result.effects.map((e) => ({
    effect: String(e.effectNumber),
    temp: fmt(e.temperature, 1),
    steamTemp: fmt(e.steamTemperature, 1),
    bpe: fmt(e.bpElevation, 2),
    nea: fmt(e.neAllowance, 2),
    deltaT: fmt(e.effectiveDeltaT, 2),
    latentHeat: fmt(e.latentHeat, 1),
    salinity: Math.round(e.salinity).toLocaleString(),
    distPct: `${(e.distillateRate * 100).toFixed(1)}%`,
  }));

  // Temperature loss budget
  const totalLoss = result.totalBPELoss + result.totalNEALoss;
  const lossBudgetRows = [
    {
      param: 'Available \u0394T',
      value: fmt(result.availableDeltaT, 1),
      unit: '\u00B0C',
      pct: '100%',
    },
    {
      param: 'Total BPE Loss',
      value: fmt(result.totalBPELoss, 1),
      unit: '\u00B0C',
      pct: `${((result.totalBPELoss / Math.max(result.availableDeltaT, 0.01)) * 100).toFixed(1)}%`,
    },
    {
      param: 'Total NEA Loss',
      value: fmt(result.totalNEALoss, 1),
      unit: '\u00B0C',
      pct: `${((result.totalNEALoss / Math.max(result.availableDeltaT, 0.01)) * 100).toFixed(1)}%`,
    },
    {
      param: 'Total Losses',
      value: fmt(totalLoss, 1),
      unit: '\u00B0C',
      pct: `${((totalLoss / Math.max(result.availableDeltaT, 0.01)) * 100).toFixed(1)}%`,
    },
    {
      param: 'Effective \u0394T',
      value: fmt(result.effectiveDeltaT, 1),
      unit: '\u00B0C',
      pct: `${((result.effectiveDeltaT / Math.max(result.availableDeltaT, 0.01)) * 100).toFixed(1)}%`,
    },
    {
      param: 'Mean \u0394T per Effect',
      value: fmt(result.meanEffectiveDeltaT, 2),
      unit: '\u00B0C',
      pct: '',
    },
  ];

  // Mass flows (if capacity provided)
  const hasFlows = result.steamFlow != null;
  const flowRows = hasFlows
    ? [
        { param: 'Steam Flow', value: fmt(result.steamFlow!, 4), unit: 'kg/s' },
        { param: 'Feed Flow', value: fmt(result.feedFlow!, 4), unit: 'kg/s' },
        { param: 'Distillate Flow', value: fmt(result.distillateFlow!, 4), unit: 'kg/s' },
        { param: 'Brine Flow', value: fmt(result.brineFlow!, 4), unit: 'kg/s' },
        { param: 'Cooling Water Flow', value: fmt(result.coolingWaterFlow!, 4), unit: 'kg/s' },
      ]
    : [];

  // Specific ratios
  const ratioRows = [
    { param: 'Specific Feed', value: fmt(result.specificFeed, 2), unit: 'kg / kg distillate' },
    {
      param: 'Specific Cooling Water',
      value: fmt(result.specificCoolingWater, 2),
      unit: 'kg / kg distillate',
    },
    { param: 'Condenser Duty', value: fmt(result.condenserDuty, 1), unit: 'kJ / kg' },
    {
      param: 'Thermal Efficiency',
      value: `${(result.thermalEfficiency * 100).toFixed(1)}`,
      unit: '%',
    },
    ...(result.tvcBoost != null
      ? [{ param: 'TVC Boost Factor', value: fmt(result.tvcBoost, 3), unit: '\u00D7' }]
      : []),
  ];

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="MED Performance Ratio Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner items={bannerItems} />

        {/* Input Parameters */}
        <TwoColumnLayout
          left={
            <ReportSection title="Plant Configuration">
              <KeyValueTable rows={plantRows} />
            </ReportSection>
          }
          right={
            <ReportSection title="Feed & Condenser">
              <KeyValueTable rows={feedRows} />
            </ReportSection>
          }
        />

        {/* Effect Details */}
        <ReportSection title="Effect Details">
          <ReportTable
            columns={[
              { key: 'effect', header: '#', width: '6%', align: 'center' },
              { key: 'temp', header: 'Temp (\u00B0C)', width: '10%', align: 'right' },
              { key: 'steamTemp', header: 'Steam (\u00B0C)', width: '11%', align: 'right' },
              { key: 'bpe', header: 'BPE (\u00B0C)', width: '10%', align: 'right' },
              { key: 'nea', header: 'NEA (\u00B0C)', width: '10%', align: 'right' },
              { key: 'deltaT', header: 'Eff. \u0394T (\u00B0C)', width: '12%', align: 'right' },
              { key: 'latentHeat', header: 'L (kJ/kg)', width: '12%', align: 'right' },
              { key: 'salinity', header: 'Salinity (ppm)', width: '14%', align: 'right' },
              { key: 'distPct', header: 'Dist. %', width: '10%', align: 'right' },
            ]}
            rows={effectRows}
          />
        </ReportSection>

        {/* Temperature Loss Budget */}
        <ReportSection title="Temperature Loss Budget">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '40%' },
              { key: 'value', header: 'Value', width: '20%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
              { key: 'pct', header: '% of Available', width: '20%', align: 'right' },
            ]}
            rows={lossBudgetRows}
          />
        </ReportSection>

        {/* Mass Flows */}
        {hasFlows && (
          <ReportSection title="Mass Flows">
            <ReportTable
              columns={[
                { key: 'param', header: 'Parameter', width: '50%' },
                { key: 'value', header: 'Value', width: '30%', align: 'right' },
                { key: 'unit', header: 'Unit', width: '20%' },
              ]}
              rows={flowRows}
            />
          </ReportSection>
        )}

        {/* Specific Ratios */}
        <ReportSection title="Specific Ratios">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '50%' },
              { key: 'value', header: 'Value', width: '30%', align: 'right' },
              { key: 'unit', header: 'Unit', width: '20%' },
            ]}
            rows={ratioRows}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Performance Ratio / GOR Calculator',
            'Method: El-Dessouky & Ettouney (2002) | Thermophysical properties: Sharqawy et al. (2010)',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
