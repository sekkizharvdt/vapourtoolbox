'use client';

import { Document, View, Text, StyleSheet } from '@react-pdf/renderer';
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
import {
  getSaturationPressure,
  getEnthalpyVapor,
  getEnthalpyLiquid,
  getLatentHeat,
  getDensityLiquid,
  getDensityVapor,
  getViscosityLiquid,
  getThermalConductivityLiquid,
  getSeawaterDensity,
  getSeawaterViscosity,
  getSeawaterSpecificHeat,
  getSeawaterThermalConductivity,
  getBoilingPointElevation,
} from '@vapour/constants';

/* ─── Local styles ──────────────────────────────────────────── */

const ls = StyleSheet.create({
  methodItem: {
    fontSize: 7.5,
    lineHeight: 1.6,
    color: REPORT_THEME.text,
    marginBottom: 2,
    paddingLeft: 8,
  },
  refItem: {
    fontSize: 7.5,
    lineHeight: 1.5,
    color: REPORT_THEME.text,
    marginBottom: 2,
    paddingLeft: 12,
  },
  simpleHeader: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1.5pt solid ${REPORT_THEME.primary}`,
  },
  simpleHeaderTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
  },
  simpleHeaderSub: {
    fontSize: 7,
    color: REPORT_THEME.textSecondary,
    marginTop: 2,
  },
});

/* ─── Helpers ───────────────────────────────────────────────── */

function fmt(n: number | undefined | null, d = 1): string {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(d);
}

function fmtSci(n: number | undefined | null, d = 4): string {
  if (n == null || isNaN(n)) return '—';
  return n.toExponential(d);
}

const FOOTER_LABEL = 'Process Calculation Verification Report';

/** Simple header for pages 2+ (no logo, just a thin bar) */
function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={ls.simpleHeader}>
      <Text style={ls.simpleHeaderTitle}>{title}</Text>
      {subtitle && <Text style={ls.simpleHeaderSub}>{subtitle}</Text>}
    </View>
  );
}

/* ─── Props ─────────────────────────────────────────────────── */

interface MEDVerificationReportPDFProps {
  result: MEDDesignerResult;
  options: MEDDesignOption[];
  logoDataUri: string | null;
  documentNumber: string;
  revision: string;
  projectName?: string;
  notes?: string;
}

/* ═══════════════════════════════════════════════════════════════
 * Component
 * ═══════════════════════════════════════════════════════════════ */

export function MEDVerificationReportPDF({
  result,
  options: _options,
  logoDataUri,
  documentNumber,
  revision,
  projectName,
  notes,
}: MEDVerificationReportPDFProps) {
  const r = result;
  const nEff = r.effects.length;
  const rd = r.inputs.resolvedDefaults;
  const salinity = Number(rd.seawaterSalinity ?? 35000);
  const lastEffect = r.effects[nEff - 1];
  const steamTemp = r.inputs.steamTemperature;
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  /* ─── Pre-compute property tables ─────────────────────────── */

  // Steam / pure water properties at each effect temperature
  const steamPropRows = r.effects.map((e) => {
    const t = e.brineTemp;
    return {
      effect: `E${e.effect}`,
      temp: fmt(t),
      psat: fmt(getSaturationPressure(t), 4),
      hv: fmt(getEnthalpyVapor(t), 1),
      hl: fmt(getEnthalpyLiquid(t), 1),
      hfg: fmt(getLatentHeat(t), 1),
      rhoL: fmt(getDensityLiquid(t), 1),
      rhoV: fmt(getDensityVapor(t), 4),
      muL: fmtSci(getViscosityLiquid(t)),
      kL: fmt(getThermalConductivityLiquid(t), 4),
    };
  });

  // Seawater property comparison: inlet, effect 1, last effect
  const swConditions = [
    { label: 'At Inlet', temp: r.inputs.seawaterTemperature, sal: salinity },
    {
      label: `At Effect 1 (${fmt(r.effects[0]?.brineTemp)}°C)`,
      temp: r.effects[0]?.brineTemp ?? 55,
      sal: Number(rd.maxBrineSalinity ?? 65000),
    },
    {
      label: `At Effect ${nEff} (${fmt(lastEffect?.brineTemp)}°C)`,
      temp: lastEffect?.brineTemp ?? 39,
      sal: Number(rd.maxBrineSalinity ?? 65000),
    },
  ];

  const swParamNames = [
    'Density (kg/m³)',
    'Viscosity (Pa·s)',
    'Specific Heat (J/kg·K)',
    'Thermal Conductivity (W/m·K)',
    'BPE (°C)',
  ];
  const swPropRows = swParamNames.map((param, pi) => {
    const row: Record<string, string | number> = { param };
    swConditions.forEach((c, ci) => {
      let val: number;
      switch (pi) {
        case 0:
          val = getSeawaterDensity(c.sal, c.temp);
          break;
        case 1:
          val = getSeawaterViscosity(c.sal, c.temp);
          break;
        case 2:
          val = getSeawaterSpecificHeat(c.sal, c.temp);
          break;
        case 3:
          val = getSeawaterThermalConductivity(c.sal, c.temp);
          break;
        case 4:
          val = getBoilingPointElevation(c.sal, c.temp);
          break;
        default:
          val = 0;
      }
      row[`c${ci}`] = pi === 1 ? fmtSci(val) : fmt(val, pi === 4 ? 3 : pi === 2 ? 1 : 4);
    });
    return row;
  });

  // Computed steam pressure for design basis
  const steamPressureBar = getSaturationPressure(steamTemp);

  // Energy balance
  const totalSteamHeat = (r.inputs.steamFlow * getLatentHeat(steamTemp)) / 3.6; // T/h * kJ/kg / 3.6 -> kW
  const totalDistillateHeat = r.effects.reduce((s, e) => s + e.duty, 0);
  const energyBalanceErrorPct =
    totalSteamHeat > 0 ? ((totalSteamHeat - totalDistillateHeat) / totalSteamHeat) * 100 : 0;
  const specificThermalEnergy =
    r.totalDistillateM3Day > 0 ? (totalSteamHeat * 24) / r.totalDistillateM3Day : 0; // kWh/m³

  return (
    <Document>
      {/* ════════════════════════════════════════════════════════════
       * PAGE 1: Design Basis & Methodology
       * ════════════════════════════════════════════════════════════ */}
      <ReportPage>
        <ReportHeader
          title="MED Plant — Process Calculation Verification Report"
          logoDataUri={logoDataUri ?? undefined}
        />
        <MetadataRow
          items={[
            { label: 'Document No.', value: documentNumber },
            { label: 'Revision', value: revision },
            { label: 'Project', value: projectName ?? '—' },
            { label: 'Date', value: today },
          ]}
        />

        <SummaryCards
          items={[
            { label: 'Effects', value: nEff.toString() },
            { label: 'GOR', value: fmt(r.achievedGOR) },
            { label: 'Distillate', value: `${fmt(r.totalDistillateM3Day, 0)} m³/day` },
            { label: 'Steam', value: `${fmt(r.inputs.steamFlow, 2)} T/h` },
          ]}
        />

        {/* Section 1: Design Basis */}
        <ReportSection title="1. Design Basis">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Heating Vapour Flow', value: `${fmt(r.inputs.steamFlow, 2)} T/h` },
                  { label: 'Heating Vapour Temperature', value: `${fmt(steamTemp)}°C (saturated)` },
                  {
                    label: 'Heating Vapour Pressure',
                    value: `${fmt(steamPressureBar, 4)} bar abs`,
                  },
                  {
                    label: 'Seawater Inlet Temperature',
                    value: `${fmt(r.inputs.seawaterTemperature)}°C`,
                  },
                  { label: 'Seawater Salinity', value: `${salinity} ppm` },
                  { label: 'Condenser SW Discharge', value: `${rd.condenserSWOutlet}°C` },
                  { label: 'Target GOR', value: fmt(r.inputs.targetGOR) },
                  { label: 'Number of Effects', value: nEff.toString() },
                  { label: 'Number of Preheaters', value: r.preheaters.length.toString() },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  { label: 'Tube Material', value: String(rd.tubeMaterialName) },
                  { label: 'Tube OD', value: `${rd.tubeOD} mm` },
                  { label: 'Tube Wall Thickness', value: `${rd.tubeWallThickness} mm` },
                  { label: 'Tube Conductivity', value: `${rd.tubeConductivity} W/m·K` },
                  { label: 'Tube Pitch', value: `${rd.tubePitch} mm (triangular)` },
                  {
                    label: 'Available Tube Lengths',
                    value: `${(rd.availableTubeLengths ?? [0.8, 1.0, 1.2, 1.5]).toString()} m`,
                  },
                  { label: 'Design Margin', value: `${Number(rd.designMargin) * 100}%` },
                  { label: 'Fouling Resistance', value: `${rd.foulingResistance} m²·K/W` },
                  { label: 'NEA per Effect', value: `${rd.NEA}°C` },
                  { label: 'Demister Loss per Effect', value: `${rd.demisterLoss}°C` },
                  { label: 'Duct Pressure Drop Loss', value: `${rd.pressureDropLoss}°C` },
                  { label: 'Condenser Approach', value: `${rd.condenserApproach}°C` },
                  { label: 'Max Brine Salinity', value: `${rd.maxBrineSalinity} ppm` },
                  {
                    label: 'Concentration Factor',
                    value: fmt(Number(rd.maxBrineSalinity) / salinity, 2),
                  },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Section 2: Calculation Methodology */}
        <ReportSection title="2. Calculation Methodology">
          {[
            'Heat and mass balance solved using iterative secant method convergence on target capacity',
            'Per-effect model: explicit tube-side / shell-side separation',
            'Tube side: Nusselt horizontal in-tube condensation (1916)',
            'Shell side spray: Chun-Seban falling film evaporation (1971)',
            'Shell side flash: isenthalpic flash at lower pressure',
            'NCG tracking: carrier steam fraction 1%, dissolved gas 50 mg/L seawater',
            'Equipment sizing: Nusselt condensation HTC + overall U from composite thermal resistance',
            'Seawater properties: Sharqawy et al. (2010)',
            'Steam properties: IAPWS-IF97',
            'Boiling point elevation: Sharqawy (2010) correlation',
            'Fouling resistance per TEMA standards',
          ].map((item, i) => (
            <Text key={i} style={ls.methodItem}>
              {'\u2022'} {item}
            </Text>
          ))}
        </ReportSection>

        <ListFooter label={FOOTER_LABEL} />
      </ReportPage>

      {/* ════════════════════════════════════════════════════════════
       * PAGE 2: Property Data Tables
       * ════════════════════════════════════════════════════════════ */}
      <ReportPage>
        <PageHeader title="Property Data Tables" subtitle={`${documentNumber} Rev ${revision}`} />

        {/* Section 3: Steam / Water Properties */}
        <ReportSection title="3. Steam / Water Properties at Effect Temperatures">
          <ReportTable
            columns={[
              { key: 'effect', header: 'Effect', width: '7%' },
              { key: 'temp', header: 'Temp (°C)', width: '8%', align: 'right' },
              { key: 'psat', header: 'P_sat (bar)', width: '10%', align: 'right' },
              { key: 'hv', header: 'h_v (kJ/kg)', width: '10%', align: 'right' },
              { key: 'hl', header: 'h_l (kJ/kg)', width: '10%', align: 'right' },
              { key: 'hfg', header: 'h_fg (kJ/kg)', width: '10%', align: 'right' },
              { key: 'rhoL', header: '\u03C1_l (kg/m³)', width: '10%', align: 'right' },
              { key: 'rhoV', header: '\u03C1_v (kg/m³)', width: '10%', align: 'right' },
              { key: 'muL', header: '\u03BC_l (Pa·s)', width: '12%', align: 'right' },
              { key: 'kL', header: 'k_l (W/m·K)', width: '13%', align: 'right' },
            ]}
            rows={steamPropRows}
            striped
            fontSize={7}
          />
        </ReportSection>

        {/* Section 4: Seawater Properties */}
        <ReportSection title="4. Seawater Properties at Design Conditions">
          <ReportTable
            columns={[
              { key: 'param', header: 'Parameter', width: '28%' },
              { key: 'c0', header: swConditions[0]?.label ?? '', width: '24%', align: 'right' },
              { key: 'c1', header: swConditions[1]?.label ?? '', width: '24%', align: 'right' },
              { key: 'c2', header: swConditions[2]?.label ?? '', width: '24%', align: 'right' },
            ]}
            rows={swPropRows}
            striped
          />
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 6, color: REPORT_THEME.textMuted }}>
              Inlet: {salinity} ppm TDS at {fmt(r.inputs.seawaterTemperature)}°C | Effects:{' '}
              {rd.maxBrineSalinity} ppm TDS at brine temperature | Correlations: Sharqawy et al.
              (2010)
            </Text>
          </View>
        </ReportSection>

        <ListFooter label={FOOTER_LABEL} />
      </ReportPage>

      {/* ════════════════════════════════════════════════════════════
       * PAGE 3: Temperature Cascade (Landscape)
       * ════════════════════════════════════════════════════════════ */}
      <ReportPage orientation="landscape">
        <PageHeader
          title="Per-Effect Temperature Cascade"
          subtitle={`${documentNumber} Rev ${revision}`}
        />

        <ReportSection title="5. Temperature Cascade Breakdown">
          <ReportTable
            columns={[
              { key: 'effect', header: 'Effect', width: '7%' },
              { key: 'inVapT', header: 'Incoming Vap. (°C)', width: '10%', align: 'right' },
              { key: 'brineT', header: 'Brine T (°C)', width: '9%', align: 'right' },
              { key: 'bpe', header: 'BPE (°C)', width: '8%', align: 'right' },
              { key: 'nea', header: 'NEA (°C)', width: '8%', align: 'right' },
              { key: 'demL', header: 'Demister (°C)', width: '9%', align: 'right' },
              { key: 'dpL', header: 'Duct \u0394P (°C)', width: '9%', align: 'right' },
              { key: 'vapOutT', header: 'Vap. Out (°C)', width: '10%', align: 'right' },
              { key: 'workDT', header: 'Working \u0394T (°C)', width: '10%', align: 'right' },
              { key: 'press', header: 'Pressure (mbar)', width: '10%', align: 'right' },
              { key: 'hfg', header: 'h_fg (kJ/kg)', width: '10%', align: 'right' },
            ]}
            rows={r.effects.map((e) => ({
              effect: `E${e.effect}`,
              inVapT: fmt(e.incomingVapourTemp, 2),
              brineT: fmt(e.brineTemp, 2),
              bpe: fmt(e.bpe, 3),
              nea: fmt(e.nea, 2),
              demL: fmt(e.demisterLoss, 2),
              dpL: fmt(e.pressureDropLoss, 2),
              vapOutT: fmt(e.vapourOutTemp, 2),
              workDT: fmt(e.workingDeltaT, 2),
              press: fmt(e.pressure, 1),
              hfg: fmt(e.hfg, 1),
            }))}
            striped
            fontSize={7}
          />
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 6, color: REPORT_THEME.textMuted }}>
              Temperature drop per effect: Incoming vapour → Brine (= working \u0394T) | Brine → Vap
              out: BPE + NEA + demister + duct \u0394P | Vapour out of Effect N = incoming vapour to
              Effect N+1
            </Text>
          </View>
        </ReportSection>

        <ListFooter label={FOOTER_LABEL} />
      </ReportPage>

      {/* ════════════════════════════════════════════════════════════
       * PAGE 4: Heat & Mass Balance (Landscape)
       * ════════════════════════════════════════════════════════════ */}
      <ReportPage orientation="landscape">
        <PageHeader
          title="Per-Effect Heat & Mass Balance"
          subtitle={`${documentNumber} Rev ${revision}`}
        />

        <ReportSection title="6. Effect-by-Effect Heat & Mass Balance">
          <ReportTable
            columns={[
              { key: 'effect', header: 'Effect', width: '7%' },
              { key: 'duty', header: 'Duty (kW)', width: '10%', align: 'right' },
              { key: 'dist', header: 'Distillate (T/h)', width: '11%', align: 'right' },
              { key: 'accumDist', header: 'Accum. Dist. (T/h)', width: '12%', align: 'right' },
              { key: 'brineOut', header: 'Brine Out (T/h)', width: '10%', align: 'right' },
              { key: 'accumBrine', header: 'Accum. Brine (T/h)', width: '12%', align: 'right' },
              { key: 'flash', header: 'Flash Vap. (T/h)', width: '11%', align: 'right' },
              { key: 'spray', header: 'Min Spray (T/h)', width: '11%', align: 'right' },
              { key: 'recirc', header: 'Recirc. (T/h)', width: '10%', align: 'right' },
              { key: 'feedT', header: 'Spray T (°C)', width: '8%', align: 'right' },
            ]}
            rows={r.effects.map((e) => ({
              effect: `E${e.effect}`,
              duty: fmt(e.duty, 0),
              dist: fmt(e.distillateFlow, 3),
              accumDist: fmt(e.accumDistillateFlow, 3),
              brineOut: fmt(e.brineOutFlow, 3),
              accumBrine: fmt(e.accumBrineFlow, 3),
              flash: fmt(e.flashVapourFlow, 4),
              spray: fmt(e.minSprayFlow, 2),
              recirc: fmt(e.brineRecirculation, 2),
              feedT: fmt(e.sprayTemp, 1),
            }))}
            totalRow={{
              effect: 'Total',
              duty: fmt(
                r.effects.reduce((s, e) => s + e.duty, 0),
                0
              ),
              dist: fmt(r.totalDistillate, 3),
              accumDist: '',
              brineOut: '',
              accumBrine: fmt(r.brineBlowdown, 3),
              flash: fmt(
                r.effects.reduce((s, e) => s + e.flashVapourFlow, 0),
                4
              ),
              spray: '',
              recirc: fmt(r.totalBrineRecirculation, 2),
              feedT: '',
            }}
            striped
            fontSize={7}
          />
        </ReportSection>

        <ListFooter label={FOOTER_LABEL} />
      </ReportPage>

      {/* ════════════════════════════════════════════════════════════
       * PAGE 5: HTC & Equipment Sizing (Landscape)
       * ════════════════════════════════════════════════════════════ */}
      <ReportPage orientation="landscape">
        <PageHeader
          title="Heat Transfer & Equipment Sizing"
          subtitle={`${documentNumber} Rev ${revision}`}
        />

        {/* Section 7: HTC Breakdown */}
        <ReportSection title="7. Heat Transfer Coefficient & Equipment Sizing">
          <ReportTable
            columns={[
              { key: 'effect', header: 'Effect', width: '6%' },
              { key: 'u', header: 'U (W/m²·K)', width: '9%', align: 'right' },
              { key: 'reqA', header: 'Req. Area (m²)', width: '10%', align: 'right' },
              { key: 'desA', header: 'Design Area (m²)', width: '11%', align: 'right' },
              { key: 'instA', header: 'Installed (m²)', width: '10%', align: 'right' },
              { key: 'margin', header: 'Margin (%)', width: '8%', align: 'right' },
              { key: 'tubes', header: 'Tubes', width: '7%', align: 'right' },
              { key: 'tubeL', header: 'Tube L (m)', width: '8%', align: 'right' },
              { key: 'shellOD', header: 'Shell OD (mm)', width: '10%', align: 'right' },
              { key: 'shellL', header: 'Shell L (mm)', width: '10%', align: 'right' },
              { key: 'vapLanes', header: 'Vap. Lanes', width: '7%', align: 'center' },
            ]}
            rows={r.effects.map((e) => ({
              effect: `E${e.effect}`,
              u: fmt(e.overallU, 0),
              reqA: fmt(e.requiredArea, 1),
              desA: fmt(e.designArea, 1),
              instA: fmt(e.installedArea, 1),
              margin: `${e.areaMargin >= 0 ? '+' : ''}${fmt(e.areaMargin, 1)}`,
              tubes: e.tubes.toString(),
              tubeL: fmt(e.tubeLength, 2),
              shellOD: e.shellODmm.toString(),
              shellL: e.shellLengthMM.toLocaleString(),
              vapLanes: e.hasVapourLanes ? 'Yes' : 'No',
            }))}
            totalRow={{
              effect: 'Total',
              reqA: fmt(
                r.effects.reduce((s, e) => s + e.requiredArea, 0),
                1
              ),
              desA: fmt(
                r.effects.reduce((s, e) => s + e.designArea, 0),
                1
              ),
              instA: fmt(r.totalEvaporatorArea, 1),
              tubes: r.effects.reduce((s, e) => s + e.tubes, 0).toLocaleString(),
            }}
            striped
            fontSize={7}
          />
        </ReportSection>

        {/* Section 8: Wetting Rate Analysis */}
        <ReportSection title="8. Wetting Rate Analysis">
          <ReportTable
            columns={[
              { key: 'effect', header: 'Effect', width: '10%' },
              { key: 'minSpray', header: 'Min Spray Flow (T/h)', width: '20%', align: 'right' },
              { key: 'recirc', header: 'Recirculation (T/h)', width: '20%', align: 'right' },
              { key: 'minGamma', header: 'Min \u0393 (kg/m·s)', width: '25%', align: 'right' },
              { key: 'status', header: 'Status', width: '25%', align: 'center' },
            ]}
            rows={r.effects.map((e) => ({
              effect: `E${e.effect}`,
              minSpray: fmt(e.minSprayFlow, 2),
              recirc: fmt(e.brineRecirculation, 2),
              minGamma: fmt(Number(rd.minimumWettingRate ?? 0.035), 3),
              status: e.brineRecirculation > 0 ? 'Recirculation required' : 'Adequate',
            }))}
            totalRow={{
              effect: 'Total',
              minSpray: '',
              recirc: fmt(r.totalBrineRecirculation, 2),
              minGamma: '',
              status: '',
            }}
            striped
          />
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 6, color: REPORT_THEME.textMuted }}>
              Minimum wetting rate \u0393 = {rd.minimumWettingRate ?? 0.035} kg/m·s | Recirculation
              added where natural spray flow is insufficient for tube wetting
            </Text>
          </View>
        </ReportSection>

        <ListFooter label={FOOTER_LABEL} />
      </ReportPage>

      {/* ════════════════════════════════════════════════════════════
       * PAGE 6: Condenser, Preheaters & Auxiliary Equipment
       * ════════════════════════════════════════════════════════════ */}
      <ReportPage>
        <PageHeader
          title="Condenser, Preheaters & Auxiliary Equipment"
          subtitle={`${documentNumber} Rev ${revision}`}
        />

        {/* Section 9: Final Condenser */}
        <ReportSection title="9. Final Condenser">
          <TwoColumnLayout
            left={
              <KeyValueTable
                rows={[
                  { label: 'Vapour Flow', value: `${fmt(r.condenser.vapourFlow, 3)} T/h` },
                  { label: 'Vapour Temperature', value: `${fmt(r.condenser.vapourTemp, 2)}°C` },
                  { label: 'Heat Duty', value: `${fmt(r.condenser.duty, 0)} kW` },
                  { label: 'LMTD', value: `${fmt(r.condenser.lmtd, 2)}°C` },
                  { label: 'Overall U', value: `${fmt(r.condenser.overallU, 0)} W/m²·K` },
                ]}
              />
            }
            right={
              <KeyValueTable
                rows={[
                  { label: 'Design Area', value: `${fmt(r.condenser.designArea, 1)} m²` },
                  {
                    label: 'Seawater Flow',
                    value: `${fmt(r.condenser.seawaterFlowM3h, 0)} m³/h (${fmt(r.condenser.seawaterFlow, 1)} T/h)`,
                  },
                  {
                    label: 'SW Temperature',
                    value: `${fmt(r.inputs.seawaterTemperature)}°C → ${fmt(Number(rd.condenserSWOutlet ?? 35))}°C`,
                  },
                  {
                    label: 'Tubes / Passes',
                    value: `${r.condenser.tubes} / ${r.condenser.passes}`,
                  },
                  { label: 'Tube-side Velocity', value: `${fmt(r.condenser.velocity, 2)} m/s` },
                  { label: 'Shell OD', value: `${r.condenser.shellODmm} mm` },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Section 10: Preheaters */}
        {r.preheaters.length > 0 && (
          <ReportSection title="10. Preheaters">
            <ReportTable
              columns={[
                { key: 'id', header: 'PH', width: '6%' },
                { key: 'source', header: 'Vapour Source', width: '14%' },
                { key: 'vapT', header: 'Vap. T (°C)', width: '10%', align: 'right' },
                { key: 'swIn', header: 'SW In (°C)', width: '10%', align: 'right' },
                { key: 'swOut', header: 'SW Out (°C)', width: '10%', align: 'right' },
                { key: 'duty', header: 'Duty (kW)', width: '10%', align: 'right' },
                { key: 'lmtd', header: 'LMTD (°C)', width: '10%', align: 'right' },
                { key: 'area', header: 'Design Area (m²)', width: '12%', align: 'right' },
                { key: 'tubes', header: 'Tubes', width: '8%', align: 'right' },
                { key: 'vel', header: 'Vel. (m/s)', width: '10%', align: 'right' },
              ]}
              rows={r.preheaters.map((ph) => ({
                id: `PH${ph.id}`,
                source: ph.vapourSource,
                vapT: fmt(ph.vapourTemp, 1),
                swIn: fmt(ph.swInlet, 1),
                swOut: fmt(ph.swOutlet, 1),
                duty: fmt(ph.duty, 0),
                lmtd: fmt(ph.lmtd, 2),
                area: fmt(ph.designArea, 1),
                tubes: ph.tubes.toString(),
                vel: fmt(ph.velocity, 2),
              }))}
              striped
            />
          </ReportSection>
        )}

        {/* Section 11: Auxiliary Equipment */}
        <ReportSection title="11. Auxiliary Equipment Summary">
          {/* Demisters */}
          {r.auxiliaryEquipment.demisters.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: 'bold',
                  marginBottom: 3,
                  color: REPORT_THEME.text,
                }}
              >
                Demisters
              </Text>
              <ReportTable
                columns={[
                  { key: 'effect', header: 'Effect', width: '15%' },
                  { key: 'area', header: 'Required Area (m²)', width: '25%', align: 'right' },
                  {
                    key: 'velocity',
                    header: 'Design Velocity (m/s)',
                    width: '25%',
                    align: 'right',
                  },
                  { key: 'dp', header: 'Pressure Drop (Pa)', width: '20%', align: 'right' },
                  { key: 'status', header: 'Status', width: '15%', align: 'center' },
                ]}
                rows={r.auxiliaryEquipment.demisters.map((d) => ({
                  effect: `E${d.effect}`,
                  area: fmt(d.requiredArea, 2),
                  velocity: fmt(d.designVelocity, 2),
                  dp: fmt(d.pressureDrop, 1),
                  status: d.loadingStatus,
                }))}
                striped
                fontSize={7}
              />
            </View>
          )}

          {/* Spray Nozzles */}
          {r.auxiliaryEquipment.sprayNozzles.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: 'bold',
                  marginBottom: 3,
                  color: REPORT_THEME.text,
                }}
              >
                Spray Nozzles
              </Text>
              <ReportTable
                columns={[
                  { key: 'effect', header: 'Effect', width: '10%' },
                  { key: 'model', header: 'Model', width: '20%' },
                  { key: 'count', header: 'Count', width: '10%', align: 'right' },
                  { key: 'flow', header: 'Flow/Nozzle (lpm)', width: '15%', align: 'right' },
                  { key: 'angle', header: 'Spray Angle (°)', width: '15%', align: 'right' },
                  { key: 'along', header: 'Along Length', width: '15%', align: 'right' },
                  { key: 'across', header: 'Across Width', width: '15%', align: 'right' },
                ]}
                rows={r.auxiliaryEquipment.sprayNozzles.map((n) => ({
                  effect: `E${n.effect}`,
                  model: n.nozzleModel,
                  count: n.nozzleCount.toString(),
                  flow: fmt(n.flowPerNozzle, 1),
                  angle: n.sprayAngle.toString(),
                  along: n.nozzlesAlongLength.toString(),
                  across: n.rowsAcrossWidth.toString(),
                }))}
                striped
                fontSize={7}
              />
            </View>
          )}

          {/* Siphons */}
          {r.auxiliaryEquipment.siphons.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: 'bold',
                  marginBottom: 3,
                  color: REPORT_THEME.text,
                }}
              >
                Siphons
              </Text>
              <ReportTable
                columns={[
                  { key: 'from', header: 'From', width: '12%' },
                  { key: 'to', header: 'To', width: '12%' },
                  { key: 'fluid', header: 'Fluid', width: '16%' },
                  { key: 'flow', header: 'Flow (T/h)', width: '15%', align: 'right' },
                  { key: 'pipe', header: 'Pipe Size', width: '15%' },
                  { key: 'height', header: 'Min Height (m)', width: '15%', align: 'right' },
                  { key: 'vel', header: 'Velocity (m/s)', width: '15%', align: 'right' },
                ]}
                rows={r.auxiliaryEquipment.siphons.map((si) => ({
                  from: `E${si.fromEffect}`,
                  to: `E${si.toEffect}`,
                  fluid: si.fluidType,
                  flow: fmt(si.flowRate, 2),
                  pipe: si.pipeSize,
                  height: fmt(si.minimumHeight, 2),
                  vel: fmt(si.velocity, 2),
                }))}
                striped
                fontSize={7}
              />
            </View>
          )}

          {/* Pumps */}
          {r.auxiliaryEquipment.pumps.length > 0 && (
            <View style={{ marginBottom: 4 }}>
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: 'bold',
                  marginBottom: 3,
                  color: REPORT_THEME.text,
                }}
              >
                Pumps
              </Text>
              <ReportTable
                columns={[
                  { key: 'service', header: 'Service', width: '25%' },
                  { key: 'flow', header: 'Flow (m³/h)', width: '12%', align: 'right' },
                  { key: 'head', header: 'Head (m)', width: '12%', align: 'right' },
                  { key: 'power', header: 'Motor (kW)', width: '12%', align: 'right' },
                  { key: 'qty', header: 'Qty', width: '10%', align: 'center' },
                ]}
                rows={r.auxiliaryEquipment.pumps.map((p) => ({
                  service: p.service,
                  flow: fmt(p.flowRateM3h, 1),
                  head: fmt(p.totalHead, 1),
                  power: fmt(p.motorPower, 1),
                  qty: p.quantity,
                }))}
                striped
                fontSize={7}
              />
            </View>
          )}
        </ReportSection>

        <ListFooter label={FOOTER_LABEL} />
      </ReportPage>

      {/* ════════════════════════════════════════════════════════════
       * PAGE 7: Overall Balance & Validation
       * ════════════════════════════════════════════════════════════ */}
      <ReportPage>
        <PageHeader
          title="Overall Balance & Validation"
          subtitle={`${documentNumber} Rev ${revision}`}
        />

        {/* Section 12: Overall Mass & Energy Balance */}
        <ReportSection title="12. Overall Mass & Energy Balance">
          <TwoColumnLayout
            left={
              <KeyValueTable
                labelWidth="55%"
                valueWidth="45%"
                rows={[
                  { label: 'Total Steam In', value: `${fmt(r.inputs.steamFlow, 2)} T/h` },
                  { label: 'Steam Thermal Input', value: `${fmt(totalSteamHeat, 0)} kW` },
                  { label: 'Total Seawater In', value: `${fmt(r.makeUpFeed, 2)} T/h` },
                  {
                    label: 'Total Distillate Out',
                    value: `${fmt(r.totalDistillate, 2)} T/h (${fmt(r.totalDistillateM3Day, 0)} m³/day)`,
                  },
                  { label: 'Total Brine Out', value: `${fmt(r.brineBlowdown, 2)} T/h` },
                  { label: 'Cooling Water Rejected', value: `${fmt(r.swReject, 1)} T/h` },
                ]}
              />
            }
            right={
              <KeyValueTable
                labelWidth="55%"
                valueWidth="45%"
                rows={[
                  { label: 'GOR Achieved', value: fmt(r.achievedGOR, 2) },
                  {
                    label: 'Specific Thermal Energy',
                    value: `${fmt(specificThermalEnergy, 1)} kWh/m³`,
                  },
                  { label: 'Specific Energy (kJ/kg)', value: fmt(specificThermalEnergy * 3.6, 0) },
                  {
                    label: 'Total Brine Recirculation',
                    value: `${fmt(r.totalBrineRecirculation, 1)} T/h`,
                  },
                  { label: 'Energy Balance Error', value: `${fmt(energyBalanceErrorPct, 2)}%` },
                  { label: 'Spray Salinity', value: `${fmt(r.spraySalinity, 0)} ppm` },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Section 13: References & Standards */}
        <ReportSection title="13. References & Standards">
          {[
            '1. El-Dessouky, H.T. & Ettouney, H.M. (2002) "Fundamentals of Salt Water Desalination," Elsevier',
            '2. Sharqawy, M.H. et al. (2010) "Thermophysical properties of seawater: a review," Desalination and Water Treatment, 16, pp. 354-380',
            '3. IAPWS-IF97 "International Association for the Properties of Water and Steam — Industrial Formulation 1997"',
            '4. Nusselt, W. (1916) "Die Oberfl\u00E4chenkondensation des Wasserdampfes," Zeitschrift des VDI, 60, pp. 541-546',
            '5. Chun, K.R. & Seban, R.A. (1971) "Heat Transfer to Evaporating Liquid Films," ASME J. Heat Transfer, 93(4), pp. 391-396',
            '6. TEMA — Standards of the Tubular Exchanger Manufacturers Association, 10th Edition',
            '7. Crane Co. (2009) "Flow of Fluids Through Valves, Fittings, and Pipe," Technical Paper No. 410',
            '8. HEI — Standards for Steam Surface Condensers, Heat Exchange Institute',
          ].map((ref, i) => (
            <Text key={i} style={ls.refItem}>
              {ref}
            </Text>
          ))}
        </ReportSection>

        {/* Notes & Disclaimer */}
        <NotesSection
          title="DISCLAIMER"
          notes={
            'This report has been generated by Vapour Toolbox to provide sufficient data for independent verification of the MED plant process calculations. ' +
            'All property values are computed from published correlations (Sharqawy 2010 for seawater, IAPWS-IF97 for steam). ' +
            'Heat transfer coefficients are derived from first-principles correlations (Nusselt 1916, Chun-Seban 1971) and include fouling resistance per TEMA standards. ' +
            'The designer should verify all inputs, assumptions, and results against project-specific requirements before use in detailed engineering. ' +
            'Vapour Desal Technologies Private Limited accepts no liability for errors arising from incorrect input data or application beyond the stated design envelope.'
          }
        />

        {notes && <NotesSection notes={notes} title="PROJECT NOTES" />}

        <ListFooter label={FOOTER_LABEL} />
      </ReportPage>
    </Document>
  );
}
