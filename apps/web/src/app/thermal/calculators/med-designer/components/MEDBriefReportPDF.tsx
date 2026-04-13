'use client';

import { Document, View, Text } from '@react-pdf/renderer';
import {
  ReportPage,
  ReportHeader,
  MetadataRow,
  ReportSection,
  ReportTable,
  KeyValueTable,
  TwoColumnLayout,
  SummaryCards,
  NotesSection,
  ListFooter,
  REPORT_THEME,
} from '@/lib/pdf/reportComponents';
import type { MEDDesignerResult, MEDDesignOption } from '@/lib/thermal';

function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

interface MEDBriefReportPDFProps {
  result: MEDDesignerResult;
  options: MEDDesignOption[];
  logoDataUri: string | null;
  documentNumber: string;
  revision: string;
  projectName?: string;
  notes?: string;
}

/**
 * Brief MED Design Report — Proposal Stage
 *
 * Shows only key performance data suitable for client proposals.
 * Does NOT reveal: tube counts, U-values, BPE details, HTC values,
 * or detailed engineering data.
 */
export function MEDBriefReportPDF({
  result,
  options,
  logoDataUri,
  documentNumber,
  revision,
  projectName,
  notes,
}: MEDBriefReportPDFProps) {
  const r = result;
  const nEff = r.effects.length;

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="MED Desalination Plant — Technical Summary"
          logoDataUri={logoDataUri ?? undefined}
        />
        <MetadataRow
          items={[
            { label: 'Doc No', value: documentNumber },
            { label: 'Rev', value: revision },
            { label: 'Project', value: projectName ?? '—' },
            { label: 'Date', value: new Date().toLocaleDateString('en-GB') },
          ]}
        />
        <ReportTable
          columns={[
            { key: 'rev', header: 'Rev', width: '8%' },
            { key: 'date', header: 'Date', width: '15%' },
            { key: 'description', header: 'Description', width: '42%' },
            { key: 'preparedBy', header: 'Prepared', width: '15%' },
            { key: 'checkedBy', header: 'Checked', width: '10%' },
            { key: 'approvedBy', header: 'Approved', width: '10%' },
          ]}
          rows={[
            {
              rev: revision,
              date: new Date().toLocaleDateString('en-GB'),
              description: revision === '0' ? 'Issued for review' : 'Revised',
              preparedBy: '—',
              checkedBy: '—',
              approvedBy: '—',
            },
          ]}
          fontSize={7}
        />

        {/* Plant Description */}
        <ReportSection title="Plant Description">
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 8, lineHeight: 1.6, color: REPORT_THEME.text }}>
              The proposed Multi-Effect Distillation (MED) plant is a {nEff}-effect parallel-feed
              thermal desalination system producing {fmt(r.totalDistillateM3Day, 0)} m³/day of
              high-purity distillate from seawater.{' '}
              {r.inputs.steamTemperature < 70
                ? `The plant is designed for low-grade heat input at ${fmt(r.inputs.steamTemperature)}°C, making it suitable for integration with solar thermal, waste heat, or low-pressure steam sources.`
                : `Heating steam is supplied at ${fmt(r.inputs.steamTemperature)}°C.`}{' '}
              Seawater at {fmt(r.inputs.seawaterTemperature)}°C is used as the cooling medium in the
              final condenser and as the feed water source. The plant achieves a Gain Output Ratio
              (GOR) of {fmt(r.achievedGOR)}, representing efficient thermal energy utilisation
              across {nEff} evaporation stages.
            </Text>
          </View>
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 8, lineHeight: 1.6, color: REPORT_THEME.text }}>
              Each evaporator effect consists of a horizontal cylindrical shell containing a lateral
              tube bundle with aluminium alloy tubes. Seawater is sprayed over the horizontal tubes
              while vapour condenses inside, transferring heat to evaporate the brine on the tube
              exterior. The vapour produced in each effect serves as the heating medium for the next
              effect at a progressively lower temperature and pressure, maximising energy recovery.
              Brine recirculation ensures adequate tube wetting across all effects.
            </Text>
          </View>
        </ReportSection>

        {/* Key Performance */}
        <SummaryCards
          items={[
            { label: 'GOR', value: fmt(r.achievedGOR) },
            { label: 'Output', value: `${fmt(r.totalDistillateM3Day, 0)} m³/day` },
            { label: 'Effects', value: nEff.toString() },
            { label: 'SW Flow', value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h` },
          ]}
        />

        {/* Design Basis — limited data for proposal */}
        <ReportSection title="Design Basis">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  {
                    label: 'Heating Source',
                    value: `${fmt(r.inputs.steamFlow, 2)} T/h saturated vapour @ ${fmt(r.inputs.steamTemperature)}°C`,
                  },
                  {
                    label: 'Seawater Temperature',
                    value: `${fmt(r.inputs.seawaterTemperature)}°C`,
                  },
                  {
                    label: 'Seawater TDS',
                    value: `${r.inputs.resolvedDefaults.seawaterSalinity} ppm`,
                  },
                  { label: 'Distillate Quality', value: '< 5 ppm TDS' },
                  { label: 'Number of Effects', value: nEff.toString() },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  { label: 'GOR', value: fmt(r.achievedGOR) },
                  { label: 'Net Distillate', value: `${fmt(r.totalDistillate, 2)} T/h` },
                  {
                    label: 'Max Brine Concentration',
                    value: `${r.inputs.resolvedDefaults.maxBrineSalinity} ppm`,
                  },
                  { label: 'Brine Blowdown', value: `${fmt(r.brineBlowdown)} T/h` },
                  {
                    label: 'Recovery Ratio',
                    value: `${fmt((r.totalDistillate / r.makeUpFeed) * 100, 0)}%`,
                  },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Overall Dimensions */}
        <ReportSection title="Plant Dimensions & Weight">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Shell Diameter (OD)', value: `${r.overallDimensions.shellODmm} mm` },
                  {
                    label: 'Evaporator Train Length',
                    value: `${(r.overallDimensions.totalLengthMM / 1000).toFixed(1)} m`,
                  },
                  { label: 'Number of Shells', value: r.numberOfShells.toString() },
                  { label: 'Total Evaporator Area', value: `${fmt(r.totalEvaporatorArea, 0)} m²` },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  {
                    label: 'Dry Weight (evaporators)',
                    value: `${
                      options
                        .find((o) => o.effects === nEff)
                        ?.weight.totalDryWeight.toLocaleString() ?? '—'
                    } kg`,
                  },
                  {
                    label: 'Operating Weight',
                    value: `${
                      options
                        .find((o) => o.effects === nEff)
                        ?.weight.totalOperatingWeight.toLocaleString() ?? '—'
                    } kg`,
                  },
                  { label: 'Condenser Area', value: `${fmt(r.condenser.designArea)} m²` },
                  {
                    label: 'Condenser SW Flow',
                    value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h`,
                  },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Mass Balance */}
        <ReportSection title="Mass Balance">
          <ReportTable
            columns={[
              { key: 'stream', header: 'Stream', width: '35%' },
              { key: 'flow', header: 'Flow (T/h)', width: '20%', align: 'right' },
              { key: 'temp', header: 'Temp (°C)', width: '20%', align: 'right' },
              { key: 'tds', header: 'TDS (ppm)', width: '25%', align: 'right' },
            ]}
            rows={[
              {
                stream: 'Heating Vapour (in)',
                flow: fmt(r.inputs.steamFlow, 2),
                temp: fmt(r.inputs.steamTemperature),
                tds: '—',
              },
              {
                stream: 'Condensate Return (out)',
                flow: fmt(r.inputs.steamFlow, 2),
                temp: fmt(r.inputs.steamTemperature),
                tds: '—',
              },
              {
                stream: 'Seawater Feed (in)',
                flow: fmt(r.makeUpFeed),
                temp: fmt(r.inputs.seawaterTemperature),
                tds: String(r.inputs.resolvedDefaults.seawaterSalinity),
              },
              {
                stream: 'Distillate (out)',
                flow: fmt(r.totalDistillate, 2),
                temp: fmt(r.effects[r.effects.length - 1]?.vapourOutTemp ?? 38),
                tds: '< 5',
              },
              {
                stream: 'Brine Blowdown (out)',
                flow: fmt(r.brineBlowdown),
                temp: fmt(r.effects[r.effects.length - 1]?.brineTemp ?? 39),
                tds: String(r.inputs.resolvedDefaults.maxBrineSalinity),
              },
              {
                stream: 'Condenser SW (in)',
                flow: fmt(r.condenser.seawaterFlow, 0),
                temp: fmt(r.inputs.seawaterTemperature),
                tds: String(r.inputs.resolvedDefaults.seawaterSalinity),
              },
              {
                stream: 'Condenser SW (out)',
                flow: fmt(r.condenser.seawaterFlow, 0),
                temp: fmt(Number(r.inputs.resolvedDefaults.condenserSWOutlet ?? 35)),
                tds: String(r.inputs.resolvedDefaults.seawaterSalinity),
              },
            ]}
            striped
          />
        </ReportSection>

        {notes && <NotesSection notes={notes} />}
        <ListFooter label="Vapour Toolbox — MED Plant Designer (Proposal Summary)" />
      </ReportPage>
    </Document>
  );
}
