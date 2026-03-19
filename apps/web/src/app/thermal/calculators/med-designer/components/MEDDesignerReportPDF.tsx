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
import { PdfProcessFlowDiagram, PdfGeneralArrangement } from './MEDPdfDiagrams';

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

/**
 * Detailed MED Design Report — Full Engineering Data
 *
 * Contains all design parameters including U-values, BPE, tube counts,
 * weight breakdown, temperature profile, and equipment list.
 */
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
  const nEff = r.effects.length;
  const selectedOption = options.find((o) => o.effects === nEff);

  return (
    <Document>
      {/* ── Page 1: Summary, Description & Design Basis ──────────── */}
      <ReportPage>
        <ReportHeader
          title="MED Plant Design — Detailed Engineering Report"
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

        <SummaryCards
          items={[
            { label: 'GOR', value: fmt(r.achievedGOR) },
            { label: 'Distillate', value: `${fmt(r.totalDistillateM3Day, 0)} m³/day` },
            { label: 'Evap Area', value: `${fmt(r.totalEvaporatorArea, 0)} m²` },
            { label: 'Brine Recirc', value: `${fmt(r.totalBrineRecirculation, 0)} T/h` },
            { label: 'SW Flow', value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h` },
          ]}
        />

        {/* Plant Description */}
        <ReportSection title="1. Plant Description">
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 7.5, lineHeight: 1.6, color: REPORT_THEME.text }}>
              The Multi-Effect Distillation (MED) plant is a {nEff}-effect parallel-feed thermal
              desalination system producing {fmt(r.totalDistillateM3Day, 0)} m³/day (
              {fmt(r.totalDistillate, 2)} T/h) of high-purity distillate (TDS &lt; 5 ppm) from
              seawater at {r.inputs.resolvedDefaults.seawaterSalinity} ppm. Heating vapour at{' '}
              {fmt(r.inputs.steamTemperature)}°C / {fmt(r.effects[0]?.pressure ?? 173)} mbar abs
              enters Effect 1 where it condenses inside horizontal tubes, transferring its latent
              heat to the brine sprayed on the tube exterior. The vapour generated in each effect
              cascades to the next effect at progressively lower temperature and pressure (from{' '}
              {fmt(r.effects[0]?.brineTemp ?? 55)}°C down to{' '}
              {fmt(r.effects[nEff - 1]?.brineTemp ?? 39)}°C), maximising thermal energy recovery
              with a GOR of {fmt(r.achievedGOR)}.
            </Text>
          </View>
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 7.5, lineHeight: 1.6, color: REPORT_THEME.text }}>
              Each evaporator effect is a horizontal cylindrical shell (
              {r.overallDimensions.shellODmm} mm OD) containing a lateral tube bundle of{' '}
              {String(r.inputs.resolvedDefaults.tubeMaterialName)} tubes (
              {r.inputs.resolvedDefaults.tubeOD} × {r.inputs.resolvedDefaults.tubeWallThickness} mm,
              k={r.inputs.resolvedDefaults.tubeConductivity} W/m·K) on{' '}
              {r.inputs.resolvedDefaults.tubePitch} mm triangular pitch with rubber grommet fixing.
              Brine recirculation pumps maintain adequate tube wetting (Γ ≥{' '}
              {r.inputs.resolvedDefaults.minimumWettingRate} kg/m·s) at a total recirculation flow
              of {fmt(r.totalBrineRecirculation)} T/h. Shell length includes 750 mm tube sheet
              access clearance on each side for tube removal and insertion.
            </Text>
          </View>
          {r.preheaters.length > 0 && (
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 7.5, lineHeight: 1.6, color: REPORT_THEME.text }}>
                {r.preheaters.length} shell-and-tube preheater{r.preheaters.length > 1 ? 's' : ''}{' '}
                heat the seawater feed from{' '}
                {fmt(r.preheaters[r.preheaters.length - 1]?.swInlet ?? 35)}°C to{' '}
                {fmt(r.preheaters[0]?.swOutlet ?? 47)}°C using vapour from intermediate effects. The
                final condenser condenses the last-effect vapour at {fmt(r.condenser.vapourTemp)}°C
                using {fmt(r.condenser.seawaterFlowM3h, 0)} m³/h of seawater (
                {fmt(r.inputs.seawaterTemperature)}°C →{' '}
                {fmt(Number(r.inputs.resolvedDefaults.condenserSWOutlet ?? 35))}°C).
              </Text>
            </View>
          )}
        </ReportSection>

        {/* Design Basis */}
        <ReportSection title="2. Design Basis">
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
                  {
                    label: 'Condenser Approach',
                    value: `${r.inputs.resolvedDefaults.condenserApproach}°C`,
                  },
                  {
                    label: 'Fouling Resistance',
                    value: `${r.inputs.resolvedDefaults.foulingResistance} m²·K/W`,
                  },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  { label: 'Shell ID', value: `${r.inputs.resolvedDefaults.shellID} mm` },
                  {
                    label: 'Shell Thickness',
                    value: `${r.inputs.resolvedDefaults.shellThickness ?? 8} mm`,
                  },
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
                  {
                    label: 'Tube Sheet Access',
                    value: `${r.inputs.resolvedDefaults.tubeSheetAccess ?? 750} mm each side`,
                  },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Design Options Comparison */}
        <ReportSection title="3. Design Options — Trade-off Comparison">
          <ReportTable
            columns={[
              { key: 'label', header: 'Option', width: '24%' },
              { key: 'effects', header: 'Eff', width: '5%', align: 'right' },
              { key: 'gor', header: 'GOR', width: '6%', align: 'right' },
              { key: 'distillate', header: 'm³/day', width: '8%', align: 'right' },
              { key: 'area', header: 'Evap m²', width: '8%', align: 'right' },
              { key: 'shellID', header: 'Shell ID', width: '8%', align: 'right' },
              { key: 'trainL', header: 'Train m', width: '8%', align: 'right' },
              { key: 'energy', header: 'kWh/m³', width: '8%', align: 'right' },
              { key: 'dryWt', header: 'Dry kg', width: '10%', align: 'right' },
              { key: 'ok', header: 'OK?', width: '5%', align: 'center' },
            ]}
            rows={options.map((o) => ({
              label: o.label,
              effects: o.effects.toString(),
              gor: fmt(o.gor),
              distillate: fmt(o.distillateM3Day, 0),
              area: fmt(o.totalEvaporatorArea, 0),
              shellID: o.largestShellID.toLocaleString(),
              trainL: fmt(o.trainLengthMM / 1000, 1),
              energy: fmt(o.specificEnergy, 0),
              dryWt: o.weight.totalDryWeight.toLocaleString(),
              ok: o.feasible ? 'YES' : 'NO',
            }))}
            striped
          />
        </ReportSection>

        {r.warnings.length > 0 && <WarningsBox warnings={r.warnings} />}
        <ListFooter label="Vapour Toolbox — MED Plant Designer (Detailed Report)" />
      </ReportPage>

      {/* ── Page 2: Process Flow Diagram & General Arrangement ────── */}
      <ReportPage>
        <ReportHeader title="MED Plant Design — Diagrams" logoDataUri={logoDataUri ?? undefined} />
        <ReportSection title="Process Flow Diagram">
          <PdfProcessFlowDiagram result={r} />
        </ReportSection>
        <ReportSection title="General Arrangement">
          <PdfGeneralArrangement result={r} />
        </ReportSection>
        <ListFooter label="Vapour Toolbox — MED Plant Designer (Detailed Report)" />
      </ReportPage>

      {/* ── Page 3: Effect-by-Effect Design ──────────────────────── */}
      <ReportPage>
        <ReportHeader
          title="MED Plant Design — Effect Performance"
          logoDataUri={logoDataUri ?? undefined}
        />

        <ReportSection title="4. Effect-by-Effect Design">
          <ReportTable
            columns={[
              { key: 'eff', header: 'Effect', width: '6%' },
              { key: 'brineT', header: 'Brine °C', width: '7%', align: 'right' },
              { key: 'vapT', header: 'Vap °C', width: '7%', align: 'right' },
              { key: 'bpe', header: 'BPE °C', width: '6%', align: 'right' },
              { key: 'wkDT', header: 'ΔT °C', width: '6%', align: 'right' },
              { key: 'press', header: 'mbar', width: '6%', align: 'right' },
              { key: 'u', header: 'U W/m²K', width: '7%', align: 'right' },
              { key: 'duty', header: 'kW', width: '6%', align: 'right' },
              { key: 'tubes', header: 'Tubes', width: '6%', align: 'right' },
              { key: 'tubeL', header: 'L (m)', width: '6%', align: 'right' },
              { key: 'instA', header: 'Area m²', width: '7%', align: 'right' },
              { key: 'margin', header: 'Margin', width: '6%', align: 'right' },
              { key: 'dist', header: 'Dist T/h', width: '7%', align: 'right' },
              { key: 'recirc', header: 'Recirc', width: '7%', align: 'right' },
              { key: 'shellL', header: 'Shell mm', width: '7%', align: 'right' },
            ]}
            rows={r.effects.map((e) => ({
              eff: `E${e.effect}${e.hasVapourLanes ? '*' : ''}`,
              brineT: fmt(e.brineTemp),
              vapT: fmt(e.vapourOutTemp),
              bpe: fmt(e.bpe, 2),
              wkDT: fmt(e.workingDeltaT, 2),
              press: fmt(e.pressure, 0),
              u: fmt(e.overallU, 0),
              duty: fmt(e.duty, 0),
              tubes: e.tubes.toString(),
              tubeL: fmt(e.tubeLength),
              instA: fmt(e.installedArea, 0),
              margin: `${e.areaMargin >= 0 ? '+' : ''}${fmt(e.areaMargin, 0)}%`,
              dist: fmt(e.distillateFlow, 2),
              recirc: fmt(e.brineRecirculation),
              shellL: e.shellLengthMM.toLocaleString(),
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
              * = with diagonal vapour escape lanes | Shell length includes 750 mm tube sheet access
              each side
            </Text>
          </View>
        </ReportSection>

        {/* Condenser, Preheaters, Mass Balance */}
        <TwoColumnLayout
          left={
            <ReportSection title="5. Final Condenser">
              <KeyValueTable
                rows={[
                  {
                    label: 'Vapour',
                    value: `${fmt(r.condenser.vapourFlow, 3)} T/h @ ${fmt(r.condenser.vapourTemp)}°C`,
                  },
                  { label: 'Duty', value: `${fmt(r.condenser.duty, 0)} kW` },
                  { label: 'LMTD', value: `${fmt(r.condenser.lmtd, 2)}°C` },
                  { label: 'U', value: `${fmt(r.condenser.overallU, 0)} W/m²·K` },
                  { label: 'Design Area', value: `${fmt(r.condenser.designArea)} m²` },
                  { label: 'SW Flow', value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h` },
                  {
                    label: 'SW Temp',
                    value: `${fmt(r.inputs.seawaterTemperature)} → ${fmt(Number(r.inputs.resolvedDefaults.condenserSWOutlet ?? 35))}°C`,
                  },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="6. Mass Balance">
              <KeyValueTable
                rows={[
                  {
                    label: 'Heating Steam In',
                    value: `${fmt(r.inputs.steamFlow, 2)} T/h @ ${fmt(r.inputs.steamTemperature)}°C`,
                  },
                  { label: 'Condensate Out', value: `${fmt(r.inputs.steamFlow, 2)} T/h` },
                  {
                    label: 'Make-up Feed',
                    value: `${fmt(r.makeUpFeed)} T/h @ ${fmt(r.inputs.seawaterTemperature)}°C`,
                  },
                  {
                    label: 'Distillate Out',
                    value: `${fmt(r.totalDistillate, 2)} T/h (${fmt(r.totalDistillateM3Day, 0)} m³/d)`,
                  },
                  {
                    label: 'Brine Blowdown',
                    value: `${fmt(r.brineBlowdown)} T/h @ ${r.inputs.resolvedDefaults.maxBrineSalinity} ppm`,
                  },
                  { label: 'Brine Recirculation', value: `${fmt(r.totalBrineRecirculation)} T/h` },
                  { label: 'Condenser SW', value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h` },
                ]}
              />
            </ReportSection>
          }
        />

        {/* Preheaters */}
        {r.preheaters.length > 0 && (
          <ReportSection title="7. Preheaters">
            <ReportTable
              columns={[
                { key: 'id', header: 'PH', width: '6%' },
                { key: 'source', header: 'Vapour Source', width: '16%' },
                { key: 'vapT', header: 'Vap T (°C)', width: '12%', align: 'right' },
                { key: 'swRange', header: 'SW In→Out (°C)', width: '18%', align: 'right' },
                { key: 'duty', header: 'Duty (kW)', width: '12%', align: 'right' },
                { key: 'lmtd', header: 'LMTD (°C)', width: '12%', align: 'right' },
                { key: 'area', header: 'Area (m²)', width: '12%', align: 'right' },
              ]}
              rows={r.preheaters.map((ph) => ({
                id: `PH${ph.id}`,
                source: ph.vapourSource,
                vapT: fmt(ph.vapourTemp),
                swRange: `${fmt(ph.swInlet)} → ${fmt(ph.swOutlet)}`,
                duty: fmt(ph.duty, 0),
                lmtd: fmt(ph.lmtd, 2),
                area: fmt(ph.designArea),
              }))}
              striped
            />
          </ReportSection>
        )}

        <ListFooter label="Vapour Toolbox — MED Plant Designer (Detailed Report)" />
      </ReportPage>

      {/* ── Page 3: Dimensions, Weight & Equipment ───────────────── */}
      <ReportPage>
        <ReportHeader
          title="MED Plant Design — Dimensions & Equipment"
          logoDataUri={logoDataUri ?? undefined}
        />

        {/* Overall Dimensions */}
        <ReportSection title="8. Evaporator Dimensions">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Shell OD', value: `${r.overallDimensions.shellODmm} mm` },
                  { label: 'Shell ID', value: `${r.inputs.resolvedDefaults.shellID} mm` },
                  {
                    label: 'Shell Thickness',
                    value: `${r.inputs.resolvedDefaults.shellThickness ?? 8} mm`,
                  },
                  {
                    label: 'Tube Sheet Thickness',
                    value: `${r.inputs.resolvedDefaults.tubeSheetThickness ?? 8} mm`,
                  },
                  {
                    label: 'Tube Sheet Access',
                    value: `${r.inputs.resolvedDefaults.tubeSheetAccess ?? 750} mm each side`,
                  },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  {
                    label: 'Shell Length (range)',
                    value:
                      r.overallDimensions.shellLengthRange.min ===
                      r.overallDimensions.shellLengthRange.max
                        ? `${r.overallDimensions.shellLengthRange.min.toLocaleString()} mm`
                        : `${r.overallDimensions.shellLengthRange.min.toLocaleString()} – ${r.overallDimensions.shellLengthRange.max.toLocaleString()} mm`,
                  },
                  {
                    label: 'Total Train Length',
                    value: `${(r.overallDimensions.totalLengthMM / 1000).toFixed(1)} m`,
                  },
                  { label: 'Number of Shells', value: r.numberOfShells.toString() },
                  { label: 'Dished Heads', value: '2:1 Semi-Ellipsoidal (each shell)' },
                  {
                    label: 'Bundle Type',
                    value: `Lateral (${r.inputs.resolvedDefaults.bundleType ?? 'lateral'})`,
                  },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Weight Breakdown */}
        {selectedOption && (
          <ReportSection title="9. Weight Estimate">
            <TwoColumnLayout
              left={
                <>
                  <Text
                    style={{
                      fontSize: 7,
                      fontWeight: 'bold',
                      marginBottom: 4,
                      color: REPORT_THEME.text,
                    }}
                  >
                    Evaporator Shells ({nEff} effects)
                  </Text>
                  <ReportTable
                    columns={[
                      { key: 'eff', header: 'Effect', width: '15%' },
                      { key: 'shell', header: 'Shell kg', width: '14%', align: 'right' },
                      { key: 'heads', header: 'Heads kg', width: '14%', align: 'right' },
                      { key: 'ts', header: 'TS kg', width: '14%', align: 'right' },
                      { key: 'tubes', header: 'Tubes kg', width: '14%', align: 'right' },
                      { key: 'other', header: 'Other kg', width: '14%', align: 'right' },
                      { key: 'total', header: 'Total kg', width: '14%', align: 'right' },
                    ]}
                    rows={selectedOption.weight.evaporatorShells.map((sw, i) => ({
                      eff: `E${i + 1}`,
                      shell: sw.shell.toLocaleString(),
                      heads: sw.dishedHeads.toLocaleString(),
                      ts: sw.tubeSheets.toLocaleString(),
                      tubes: sw.tubes.toLocaleString(),
                      other: (sw.waterBoxes + sw.internals).toLocaleString(),
                      total: sw.total.toLocaleString(),
                    }))}
                    totalRow={{
                      eff: 'Total',
                      total: selectedOption.weight.evaporatorShells
                        .reduce((s, sw) => s + sw.total, 0)
                        .toLocaleString(),
                    }}
                    striped
                  />
                </>
              }
              right={
                <KeyValueTable
                  rows={[
                    {
                      label: 'Evaporators Total',
                      value: `${selectedOption.weight.evaporatorShells.reduce((s, sw) => s + sw.total, 0).toLocaleString()} kg`,
                    },
                    {
                      label: 'Condenser',
                      value: `${selectedOption.weight.condenserWeight.toLocaleString()} kg`,
                    },
                    {
                      label: 'Preheaters',
                      value: `${selectedOption.weight.preheatersWeight.toLocaleString()} kg`,
                    },
                    {
                      label: 'Total Dry Weight',
                      value: `${selectedOption.weight.totalDryWeight.toLocaleString()} kg`,
                    },
                    {
                      label: 'Total Operating Weight',
                      value: `${selectedOption.weight.totalOperatingWeight.toLocaleString()} kg`,
                    },
                  ]}
                />
              }
            />
          </ReportSection>
        )}

        {/* Equipment List */}
        <ReportSection title="10. Equipment Summary">
          <ReportTable
            columns={[
              { key: 'equip', header: 'Equipment', width: '30%' },
              { key: 'qty', header: 'Qty', width: '8%', align: 'right' },
              { key: 'specs', header: 'Key Specifications', width: '40%' },
              { key: 'material', header: 'Material', width: '22%' },
            ]}
            rows={[
              {
                equip: 'Evaporator Shells',
                qty: nEff.toString(),
                specs: `${r.overallDimensions.shellODmm}mm OD × ${r.overallDimensions.shellLengthRange.min}–${r.overallDimensions.shellLengthRange.max}mm`,
                material: 'Duplex SS S32304',
              },
              {
                equip: 'Evaporator Tubes',
                qty: r.effects.reduce((s, e) => s + e.tubes, 0).toLocaleString(),
                specs: `${r.inputs.resolvedDefaults.tubeOD}×${r.inputs.resolvedDefaults.tubeWallThickness}mm, ${r.totalEvaporatorArea.toFixed(0)} m² total`,
                material: String(r.inputs.resolvedDefaults.tubeMaterialName),
              },
              {
                equip: 'Final Condenser',
                qty: '1',
                specs: `${fmt(r.condenser.designArea)} m², ${fmt(r.condenser.duty, 0)} kW`,
                material: 'Ti Gr 2 / SS316L',
              },
              ...(r.preheaters.length > 0
                ? [
                    {
                      equip: `Preheaters PH1–PH${r.preheaters.length}`,
                      qty: r.preheaters.length.toString(),
                      specs: `${r.preheaters.reduce((s, p) => s + p.designArea, 0).toFixed(1)} m² total`,
                      material: 'Ti Gr 2 / SS316L',
                    },
                  ]
                : []),
              {
                equip: 'Brine Recirculation Pumps',
                qty: nEff.toString(),
                specs: `${fmt(r.totalBrineRecirculation / nEff)} T/h each, with VFD`,
                material: 'Duplex SS',
              },
              {
                equip: 'Distillate Pump',
                qty: '1+1',
                specs: `${fmt(r.totalDistillate, 2)} T/h`,
                material: 'SS316L',
              },
              {
                equip: 'Brine Blowdown Pump',
                qty: '1+1',
                specs: `${fmt(r.brineBlowdown)} T/h`,
                material: 'Duplex SS',
              },
              {
                equip: 'SW Pump',
                qty: '1+1',
                specs: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h`,
                material: 'Duplex SS',
              },
              {
                equip: 'Vacuum System',
                qty: '1',
                specs: `Hold ${fmt(r.effects[nEff - 1]?.pressure ?? 66, 0)} mbar`,
                material: 'SS316L',
              },
              {
                equip: 'Demisters',
                qty: nEff.toString(),
                specs: 'Wire mesh, SS316, 100mm thick',
                material: 'SS316',
              },
              {
                equip: 'Spray Nozzles',
                qty: `${nEff} sets`,
                specs: 'Lateral distribution',
                material: 'Ti Gr 2',
              },
            ]}
            striped
          />
        </ReportSection>

        {notes && <NotesSection notes={notes} />}
        <ListFooter label="Vapour Toolbox — MED Plant Designer (Detailed Report)" />
      </ReportPage>
    </Document>
  );
}
