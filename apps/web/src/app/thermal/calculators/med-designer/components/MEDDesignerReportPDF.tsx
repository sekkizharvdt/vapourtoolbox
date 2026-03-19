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
  WarningsBox,
  NotesSection,
  ListFooter,
  REPORT_THEME,
} from '@/lib/pdf/reportComponents';
import type { MEDDesignerResult, MEDDesignOption } from '@/lib/thermal';

function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

interface MEDDesignerReportPDFProps {
  result: MEDDesignerResult;
  options: MEDDesignOption[];
  logoDataUri: string | null;
  documentNumber: string;
  revision: string;
  projectName?: string;
  notes?: string;
}

export function MEDDesignerReportPDF({
  result,
  options,
  logoDataUri,
  documentNumber,
  revision,
  projectName,
  notes,
}: MEDDesignerReportPDFProps) {
  const r = result;

  return (
    <Document>
      {/* ── Page 1: Summary & Options ─────────────────────────────────── */}
      <ReportPage>
        <ReportHeader title="MED Plant Design Report" logoDataUri={logoDataUri ?? undefined} />
        <MetadataRow
          items={[
            { label: 'Doc No', value: documentNumber },
            { label: 'Rev', value: revision },
            { label: 'Project', value: projectName ?? '—' },
            { label: 'Effects', value: r.effects.length.toString() },
          ]}
        />

        {/* Summary Cards */}
        <SummaryCards
          items={[
            { label: 'GOR', value: fmt(r.achievedGOR) },
            { label: 'Distillate', value: `${fmt(r.totalDistillateM3Day, 0)} m³/day` },
            { label: 'Evap Area', value: `${fmt(r.totalEvaporatorArea, 0)} m²` },
            { label: 'Brine Recirc', value: `${fmt(r.totalBrineRecirculation, 0)} T/h` },
            { label: 'SW Flow', value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h` },
          ]}
        />

        {/* Design Basis */}
        <ReportSection title="Design Basis">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  {
                    label: 'Heating Vapour',
                    value: `${fmt(r.inputs.steamFlow, 2)} T/h @ ${fmt(r.inputs.steamTemperature)}°C`,
                  },
                  { label: 'Seawater Temp', value: `${fmt(r.inputs.seawaterTemperature)}°C` },
                  { label: 'Target GOR', value: fmt(r.inputs.targetGOR) },
                  {
                    label: 'SW Salinity',
                    value: `${r.inputs.resolvedDefaults.seawaterSalinity} ppm`,
                  },
                  {
                    label: 'Max Brine',
                    value: `${r.inputs.resolvedDefaults.maxBrineSalinity} ppm`,
                  },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  { label: 'Shell ID', value: `${r.inputs.resolvedDefaults.shellID} mm` },
                  {
                    label: 'Tube Material',
                    value: String(r.inputs.resolvedDefaults.tubeMaterialName),
                  },
                  {
                    label: 'Tube OD × Wall',
                    value: `${r.inputs.resolvedDefaults.tubeOD} × ${r.inputs.resolvedDefaults.tubeWallThickness} mm`,
                  },
                  { label: 'Pitch', value: `${r.inputs.resolvedDefaults.tubePitch} mm triangular` },
                  {
                    label: 'Design Margin',
                    value: `${Number(r.inputs.resolvedDefaults.designMargin) * 100}%`,
                  },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Design Options Comparison */}
        <ReportSection title="Design Options — Trade-off Comparison">
          <ReportTable
            columns={[
              { key: 'label', header: 'Option', width: '28%' },
              { key: 'effects', header: 'Effects', width: '7%', align: 'right' },
              { key: 'gor', header: 'GOR', width: '7%', align: 'right' },
              { key: 'distillate', header: 'm³/day', width: '9%', align: 'right' },
              { key: 'area', header: 'Evap m²', width: '9%', align: 'right' },
              { key: 'energy', header: 'kWh/m³', width: '9%', align: 'right' },
              { key: 'dryWt', header: 'Dry kg', width: '10%', align: 'right' },
              { key: 'operWt', header: 'Oper kg', width: '10%', align: 'right' },
              { key: 'ok', header: 'OK?', width: '6%', align: 'center' },
            ]}
            rows={options.map((o) => ({
              label: o.label,
              effects: o.effects.toString(),
              gor: fmt(o.gor),
              distillate: fmt(o.distillateM3Day, 0),
              area: fmt(o.totalEvaporatorArea, 0),
              energy: fmt(o.specificEnergy, 0),
              dryWt: o.weight.totalDryWeight.toLocaleString(),
              operWt: o.weight.totalOperatingWeight.toLocaleString(),
              ok: o.feasible ? 'YES' : 'NO',
            }))}
            striped
          />
        </ReportSection>

        {r.warnings.length > 0 && <WarningsBox warnings={r.warnings} />}
        <ListFooter label="Vapour Toolbox — MED Plant Designer" />
      </ReportPage>

      {/* ── Page 2: Detailed Design ───────────────────────────────────── */}
      <ReportPage>
        <ReportHeader
          title="MED Plant Design — Detailed Results"
          logoDataUri={logoDataUri ?? undefined}
        />

        {/* Effect-by-Effect */}
        <ReportSection title="Effect-by-Effect Design">
          <ReportTable
            columns={[
              { key: 'eff', header: 'Effect', width: '7%' },
              { key: 'brineT', header: 'Brine °C', width: '8%', align: 'right' },
              { key: 'vapT', header: 'Vap °C', width: '8%', align: 'right' },
              { key: 'bpe', header: 'BPE °C', width: '7%', align: 'right' },
              { key: 'wkDT', header: 'ΔT °C', width: '7%', align: 'right' },
              { key: 'u', header: 'U W/m²K', width: '9%', align: 'right' },
              { key: 'duty', header: 'kW', width: '7%', align: 'right' },
              { key: 'tubes', header: 'Tubes', width: '8%', align: 'right' },
              { key: 'tubeL', header: 'L (m)', width: '7%', align: 'right' },
              { key: 'instA', header: 'Area m²', width: '8%', align: 'right' },
              { key: 'margin', header: 'Margin', width: '8%', align: 'right' },
              { key: 'dist', header: 'Dist T/h', width: '8%', align: 'right' },
              { key: 'recirc', header: 'Recirc', width: '8%', align: 'right' },
            ]}
            rows={r.effects.map((e) => ({
              eff: `E${e.effect}${e.hasVapourLanes ? '*' : ''}`,
              brineT: fmt(e.brineTemp),
              vapT: fmt(e.vapourOutTemp),
              bpe: fmt(e.bpe, 2),
              wkDT: fmt(e.workingDeltaT, 2),
              u: fmt(e.overallU, 0),
              duty: fmt(e.duty, 0),
              tubes: e.tubes.toString(),
              tubeL: fmt(e.tubeLength),
              instA: fmt(e.installedArea, 0),
              margin: `${e.areaMargin >= 0 ? '+' : ''}${fmt(e.areaMargin, 0)}%`,
              dist: fmt(e.distillateFlow, 2),
              recirc: fmt(e.brineRecirculation),
            }))}
            totalRow={{
              eff: 'Total',
              duty: fmt(
                r.effects.reduce((s, e) => s + e.duty, 0),
                0
              ),
              instA: fmt(r.totalEvaporatorArea, 0),
              dist: fmt(r.totalDistillate, 2),
              recirc: fmt(r.totalBrineRecirculation),
            }}
            striped
          />
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 6, color: REPORT_THEME.textMuted }}>
              * = with diagonal vapour escape lanes
            </Text>
          </View>
        </ReportSection>

        {/* Condenser & Mass Balance side by side */}
        <TwoColumnLayout
          left={
            <ReportSection title="Final Condenser">
              <KeyValueTable
                rows={[
                  {
                    label: 'Vapour',
                    value: `${fmt(r.condenser.vapourFlow, 3)} T/h @ ${fmt(r.condenser.vapourTemp)}°C`,
                  },
                  { label: 'Duty', value: `${fmt(r.condenser.duty, 0)} kW` },
                  { label: 'LMTD', value: `${fmt(r.condenser.lmtd, 2)}°C` },
                  { label: 'Design Area', value: `${fmt(r.condenser.designArea)} m²` },
                  { label: 'SW Flow', value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h` },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Mass Balance">
              <KeyValueTable
                rows={[
                  { label: 'Steam In', value: `${fmt(r.inputs.steamFlow, 2)} T/h` },
                  { label: 'Make-up Feed', value: `${fmt(r.makeUpFeed)} T/h` },
                  {
                    label: 'Distillate Out',
                    value: `${fmt(r.totalDistillate, 2)} T/h (${fmt(r.totalDistillateM3Day, 0)} m³/d)`,
                  },
                  { label: 'Brine Blowdown', value: `${fmt(r.brineBlowdown)} T/h` },
                  { label: 'Brine Recirc', value: `${fmt(r.totalBrineRecirculation)} T/h` },
                  { label: 'Condenser SW', value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h` },
                ]}
              />
            </ReportSection>
          }
        />

        {/* Preheaters */}
        {r.preheaters.length > 0 && (
          <ReportSection title="Preheaters">
            <ReportTable
              columns={[
                { key: 'id', header: 'PH', width: '8%' },
                { key: 'source', header: 'Vapour Source', width: '20%' },
                { key: 'swRange', header: 'SW In→Out', width: '22%', align: 'right' },
                { key: 'duty', header: 'Duty (kW)', width: '15%', align: 'right' },
                { key: 'lmtd', header: 'LMTD (°C)', width: '15%', align: 'right' },
                { key: 'area', header: 'Area (m²)', width: '15%', align: 'right' },
              ]}
              rows={r.preheaters.map((ph) => ({
                id: `PH${ph.id}`,
                source: ph.vapourSource,
                swRange: `${fmt(ph.swInlet)}→${fmt(ph.swOutlet)}°C`,
                duty: fmt(ph.duty, 0),
                lmtd: fmt(ph.lmtd, 2),
                area: fmt(ph.designArea),
              }))}
              striped
            />
          </ReportSection>
        )}

        {notes && <NotesSection notes={notes} />}
        <ListFooter label="Vapour Toolbox — MED Plant Designer" />
      </ReportPage>
    </Document>
  );
}
