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
  warningItem: {
    fontSize: 7.5,
    lineHeight: 1.5,
    color: '#b71c1c',
    marginBottom: 2,
    paddingLeft: 8,
  },
  nomenclatureRow: {
    flexDirection: 'row' as const,
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
    paddingVertical: 1.5,
  },
  nomenclatureAbbr: {
    fontSize: 7,
    fontWeight: 'bold' as const,
    width: '18%',
    color: REPORT_THEME.text,
  },
  nomenclatureDesc: {
    fontSize: 7,
    width: '82%',
    color: REPORT_THEME.textSecondary,
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

  // Overall energy balance: steam input kW (for display and STE calculation)
  // Per-effect energy balance is validated by the engine (warns if any > 0.5%).
  // The overall plant balance check uses the engine's convergence status.
  const totalSteamHeat = (r.inputs.steamFlow * getLatentHeat(steamTemp)) / 3.6; // kW
  const hasEnergyWarnings = r.warnings.some((w) => w.includes('Energy balance error'));
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

        {/* Revision history */}
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
              date: today,
              description: revision === '0' ? 'Issued for review' : 'Revised',
              preparedBy: '—',
              checkedBy: '—',
              approvedBy: '—',
            },
          ]}
          fontSize={7}
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
                    label: 'Tube Length',
                    value: `${r.effects[0]?.tubeLength ?? 'N/A'} m`,
                  },
                  { label: 'Design Margin', value: `${Number(rd.designMargin) * 100}%` },
                  {
                    label: 'Fouling Resistance',
                    value: `${rd.foulingResistance ?? 0.00015} m2.K/W`,
                  },
                  {
                    label: 'BPE Safety Factor',
                    value:
                      rd.bpeSafetyFactor && Number(rd.bpeSafetyFactor) !== 1
                        ? `x${rd.bpeSafetyFactor} (+${((Number(rd.bpeSafetyFactor) - 1) * 100).toFixed(0)}%)`
                        : '1.0 (none)',
                  },
                  { label: 'NEA per Effect', value: `${rd.NEA}°C` },
                  { label: 'Demister Loss per Effect', value: 'Computed per effect' },
                  { label: 'Duct Pressure Drop Loss', value: 'Computed per effect' },
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
              { key: 'rhoL', header: 'rho_l (kg/m3)', width: '10%', align: 'right' },
              { key: 'rhoV', header: 'rho_v (kg/m3)', width: '10%', align: 'right' },
              { key: 'muL', header: 'mu_l (Pa.s)', width: '12%', align: 'right' },
              { key: 'kL', header: 'k_l (W/m.K)', width: '13%', align: 'right' },
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
              { key: 'effect', header: 'Effect', width: '5%' },
              { key: 'inVapT', header: 'Incoming Vap. (°C)', width: '9%', align: 'right' },
              { key: 'brineT', header: 'Brine T (°C)', width: '8%', align: 'right' },
              { key: 'bpe', header: 'BPE (°C)', width: '7%', align: 'right' },
              { key: 'flashDT', header: 'Flash ΔT (°C)', width: '8%', align: 'right' },
              { key: 'nea', header: 'NEA (°C)', width: '7%', align: 'right' },
              { key: 'demL', header: 'Demister (°C)', width: '8%', align: 'right' },
              { key: 'dpL', header: 'Duct dP (°C)', width: '8%', align: 'right' },
              { key: 'totalLoss', header: 'Total Loss (°C)', width: '8%', align: 'right' },
              { key: 'vapOutT', header: 'Vap. Out (°C)', width: '8%', align: 'right' },
              { key: 'workDT', header: 'Working dT (°C)', width: '8%', align: 'right' },
              { key: 'press', header: 'Pressure (mbar)', width: '8%', align: 'right' },
              { key: 'hfg', header: 'h_fg (kJ/kg)', width: '8%', align: 'right' },
            ]}
            rows={r.effects.map((e, i) => {
              const prevBrineT = i > 0 ? r.effects[i - 1]!.brineTemp : 0;
              const flashDT = i > 0 ? Math.max(0, prevBrineT - (e.brineTemp - e.bpe)) : 0;
              const totalLoss = e.bpe + e.nea + e.demisterLoss + e.pressureDropLoss;
              return {
                effect: `E${e.effect}`,
                inVapT: fmt(e.incomingVapourTemp, 2),
                brineT: fmt(e.brineTemp, 2),
                bpe: fmt(e.bpe, 3),
                flashDT: i === 0 ? '—' : fmt(flashDT, 2),
                nea: fmt(e.nea, 3),
                demL: fmt(e.demisterLoss, 3),
                dpL: fmt(e.pressureDropLoss, 3),
                totalLoss: fmt(totalLoss, 3),
                vapOutT: fmt(e.vapourOutTemp, 2),
                workDT: fmt(e.workingDeltaT, 2),
                press: fmt(e.pressure, 1),
                hfg: fmt(e.hfg, 1),
              };
            })}
            striped
            fontSize={7}
          />
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 6, color: REPORT_THEME.textMuted }}>
              Working dT = Incoming vapour − Brine T | Total Loss = BPE + NEA + Demister + Duct dP |
              Vap. Out = Effect saturation T − (NEA + Demister + Duct dP) | NEA ={' '}
              {(Number(r.inputs.resolvedDefaults.NEA_FLASH_FRACTION ?? 0.1) * 100).toFixed(0)}% of
              Flash ΔT (E1 = 0: no cascaded brine) | Vapour out of Effect N = incoming vapour to
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
              { key: 'effect', header: 'Effect', width: '5%' },
              { key: 'hTube', header: 'h_tube', width: '7%', align: 'right' },
              { key: 'hShell', header: 'h_shell', width: '7%', align: 'right' },
              { key: 'u', header: 'U', width: '6%', align: 'right' },
              { key: 'reqA', header: 'Req (m2)', width: '8%', align: 'right' },
              { key: 'desA', header: 'Design (m2)', width: '8%', align: 'right' },
              { key: 'instA', header: 'Inst. (m2)', width: '8%', align: 'right' },
              { key: 'margin', header: 'Margin', width: '7%', align: 'right' },
              { key: 'tubes', header: 'Tubes', width: '7%', align: 'right' },
              { key: 'tubeL', header: 'L (m)', width: '6%', align: 'right' },
              { key: 'shellOD', header: 'Shell OD', width: '8%', align: 'right' },
              { key: 'shellL', header: 'Shell L', width: '8%', align: 'right' },
              { key: 'vapLanes', header: 'Lanes', width: '5%', align: 'center' },
            ]}
            rows={r.effects.map((e) => ({
              effect: `E${e.effect}`,
              hTube: fmt(e.tubeSideHTC, 0),
              hShell: fmt(e.shellSideHTC, 0),
              u: fmt(e.overallU, 0),
              reqA: fmt(e.requiredArea, 1),
              desA: fmt(e.designArea, 1),
              instA: fmt(e.installedArea, 1),
              margin: `${e.areaMargin >= 0 ? '+' : ''}${fmt(e.areaMargin, 0)}%`,
              tubes: e.tubes.toString(),
              tubeL: fmt(e.tubeLength, 2),
              shellOD: e.shellODmm.toString(),
              shellL: e.shellLengthMM.toLocaleString(),
              vapLanes: e.hasVapourLanes ? 'Y' : 'N',
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
              { key: 'effect', header: 'Effect', width: '8%' },
              { key: 'feed', header: 'Feed (T/h)', width: '14%', align: 'right' },
              { key: 'recirc', header: 'Recirc (T/h)', width: '14%', align: 'right' },
              { key: 'totalSpray', header: 'Total Spray (T/h)', width: '16%', align: 'right' },
              { key: 'gamma', header: 'Gamma (kg/m·s)', width: '16%', align: 'right' },
              { key: 'minGamma', header: 'Min Gamma', width: '14%', align: 'right' },
              { key: 'status', header: 'Status', width: '18%', align: 'center' },
            ]}
            rows={r.effects.map((e) => {
              const totalSpray = e.minSprayFlow + e.brineRecirculation;
              const nRows = e.bundleGeometry?.numberOfRows ?? 0;
              const gamma =
                nRows > 0 && e.tubeLength > 0
                  ? (totalSpray * 1000) / 3600 / (2 * e.tubeLength * nRows)
                  : 0;
              const gammaMin = Number(rd.minimumWettingRate ?? 0.035);
              return {
                effect: `E${e.effect}`,
                feed: fmt(e.minSprayFlow, 2),
                recirc: fmt(e.brineRecirculation, 2),
                totalSpray: fmt(totalSpray, 2),
                gamma: fmt(gamma, 3),
                minGamma: fmt(gammaMin, 3),
                status: gamma >= gammaMin ? 'Adequate' : 'Insufficient',
              };
            })}
            totalRow={{
              effect: 'Total',
              feed: '',
              recirc: fmt(r.totalBrineRecirculation, 2),
              totalSpray: '',
              gamma: '',
              minGamma: '',
              status: '',
            }}
            striped
          />
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 6, color: REPORT_THEME.textMuted }}>
              Minimum wetting rate Gamma = {rd.minimumWettingRate ?? 0.035} kg/m·s | Recirculation
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
                  { label: 'Vapour Temperature', value: `${fmt(r.condenser.vapourTemp, 2)} C` },
                  { label: 'Heat Duty', value: `${fmt(r.condenser.duty, 0)} kW` },
                  { label: 'LMTD', value: `${fmt(r.condenser.lmtd, 2)} C` },
                  {
                    label: 'Tube-side HTC (Dittus-Boelter)',
                    value: `${fmt(r.condenser.tubeSideHTC, 0)} W/m2.K`,
                  },
                  {
                    label: 'Shell-side HTC (Nusselt+Kern)',
                    value: `${fmt(r.condenser.shellSideHTC, 0)} W/m2.K`,
                  },
                  { label: 'Overall U', value: `${fmt(r.condenser.overallU, 0)} W/m2.K` },
                  { label: 'Required Area', value: `${fmt(r.condenser.requiredArea, 1)} m2` },
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
                { key: 'id', header: 'PH', width: '5%' },
                { key: 'source', header: 'Source', width: '10%' },
                { key: 'duty', header: 'Duty (kW)', width: '9%', align: 'right' },
                { key: 'lmtd', header: 'LMTD (C)', width: '8%', align: 'right' },
                { key: 'hTube', header: 'h_tube', width: '8%', align: 'right' },
                { key: 'hShell', header: 'h_shell', width: '8%', align: 'right' },
                { key: 'U', header: 'U', width: '8%', align: 'right' },
                { key: 'reqArea', header: 'Req (m2)', width: '8%', align: 'right' },
                { key: 'area', header: 'Design (m2)', width: '9%', align: 'right' },
                { key: 'tubes', header: 'Tubes', width: '7%', align: 'right' },
                { key: 'vel', header: 'Vel (m/s)', width: '8%', align: 'right' },
                { key: 'shell', header: 'Shell (mm)', width: '8%', align: 'right' },
              ]}
              rows={r.preheaters.map((ph) => ({
                id: `PH${ph.id}`,
                source: ph.vapourSource,
                duty: fmt(ph.duty, 0),
                lmtd: fmt(ph.lmtd, 2),
                hTube: fmt(ph.tubeSideHTC, 0),
                hShell: fmt(ph.shellSideHTC, 0),
                U: fmt(ph.overallU, 0),
                reqArea: fmt(ph.requiredArea, 1),
                area: fmt(ph.designArea, 1),
                tubes: ph.tubes.toString(),
                vel: fmt(ph.velocity, 2),
                shell: ph.shellODmm.toString(),
              }))}
              striped
              fontSize={7}
            />
          </ReportSection>
        )}

        {/* Section 11: Auxiliary Equipment */}
        <ReportSection title="11. Auxiliary Equipment Summary">
          {/* Demister & Steam Flow Area — from lateral shell geometry */}
          {r.vaporPathGeometry && r.vaporPathGeometry.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: 'bold',
                  marginBottom: 3,
                  color: REPORT_THEME.text,
                }}
              >
                Demister &amp; Steam Flow Area (Lateral Shell Geometry)
              </Text>
              <ReportTable
                columns={[
                  { key: 'effect', header: 'Effect', width: '8%' },
                  { key: 'elev', header: 'Dem. Elev. (mm)', width: '13%', align: 'right' },
                  { key: 'chord', header: 'Dem. Width (mm)', width: '13%', align: 'right' },
                  { key: 'demArea', header: 'Dem. Area (m²)', width: '13%', align: 'right' },
                  { key: 'demVel', header: 'Dem. Vel. (m/s)', width: '13%', align: 'right' },
                  { key: 'sfArea', header: 'Steam Area (m²)', width: '13%', align: 'right' },
                  { key: 'sfVel', header: 'Steam Vel. (m/s)', width: '13%', align: 'right' },
                ]}
                rows={r.vaporPathGeometry.map((vpg, i) => ({
                  effect: `E${i + 1}`,
                  elev: fmt(vpg.demisterElevation, 0),
                  chord: fmt(vpg.demisterChordWidth, 0),
                  demArea: fmt(vpg.demisterArea, 3),
                  demVel: fmt(vpg.demisterVelocity, 2),
                  sfArea: fmt(vpg.steamFlowArea, 4),
                  sfVel: fmt(vpg.steamFlowVelocity, 1),
                }))}
                striped
                fontSize={7}
              />
              <Text style={{ fontSize: 6, color: REPORT_THEME.textMuted, marginTop: 2 }}>
                Demister: wire mesh pad in free (right) semicircle of lateral shell | Steam flow
                area: cutout in tubesheet above demister + 100mm clearance | Elevation optimised
                per-effect (Souders-Brown + steam flow velocity target 30 m/s)
              </Text>
            </View>
          ) : r.auxiliaryEquipment.demisters.length > 0 ? (
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
          ) : null}

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
                  {
                    label: 'Energy Balance',
                    value: hasEnergyWarnings
                      ? 'Per-effect error > 0.5% (see warnings)'
                      : 'Verified (< 0.5% per effect)',
                  },
                  { label: 'Spray Salinity', value: `${fmt(r.spraySalinity, 0)} ppm` },
                ]}
              />
            }
          />
        </ReportSection>

        {/* Section 13: Operator Guidance — Fouling & Cleaning */}
        <ReportSection title="13. Operator Guidance — Fouling &amp; Acid Cleaning">
          <Text
            style={{
              fontSize: 8,
              color: REPORT_THEME.text,
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            The plant is designed with fouling resistance R_f ={' '}
            {fmt(Number(rd.foulingFactor ?? 0.00015) * 1e6, 0)} × 10⁻⁶ m²·K/W (TEMA seawater
            standard). Heat transfer degrades as scale builds up on tube surfaces. Acid cleaning is
            required periodically to restore design capacity. Monitor the indicators below during
            operation:
          </Text>

          <Text
            style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 3, color: REPORT_THEME.text }}
          >
            Fouling progression over operating cycle
          </Text>
          <ReportTable
            columns={[
              { key: 'stage', header: 'Stage', width: '22%' },
              { key: 'rf', header: 'R_f (m²·K/W)', width: '18%', align: 'right' },
              { key: 'uRel', header: 'U vs design', width: '18%', align: 'right' },
              { key: 'capacity', header: 'Capacity vs design', width: '20%', align: 'right' },
              { key: 'when', header: 'Typical timing', width: '22%' },
            ]}
            rows={[
              {
                stage: 'Fresh (after clean)',
                rf: '0.00005',
                uRel: '+45%',
                capacity: '+18%',
                when: 'Day 0–7',
              },
              {
                stage: 'Normal operation',
                rf: '0.00010',
                uRel: '+18%',
                capacity: '+8%',
                when: 'Day 30–90',
              },
              {
                stage: 'Design basis',
                rf: '0.00015',
                uRel: 'baseline',
                capacity: 'baseline',
                when: 'Day 90–180',
              },
              {
                stage: 'End of cycle',
                rf: '0.00020',
                uRel: '−13%',
                capacity: '−8%',
                when: 'Day 300–365',
              },
              {
                stage: 'Cleaning overdue',
                rf: '0.00025+',
                uRel: '−24%',
                capacity: '−15%',
                when: 'Clean immediately',
              },
            ]}
            striped
            fontSize={7}
          />

          <Text
            style={{
              fontSize: 8,
              fontWeight: 'bold',
              marginTop: 8,
              marginBottom: 3,
              color: REPORT_THEME.text,
            }}
          >
            Triggers for acid cleaning (clean when ANY triggers)
          </Text>
          <ReportTable
            columns={[
              { key: 'indicator', header: 'Indicator', width: '25%' },
              { key: 'baseline', header: 'Clean-condition baseline', width: '30%' },
              { key: 'trigger', header: 'Cleaning trigger', width: '45%' },
            ]}
            rows={[
              {
                indicator: 'GOR drop',
                baseline: `Design GOR ${fmt(r.achievedGOR, 2)}`,
                trigger: `GOR drops ≥ 15% below design (< ${fmt(r.achievedGOR * 0.85, 2)})`,
              },
              {
                indicator: 'Distillate drop',
                baseline: `Design ${fmt(r.totalDistillateM3Day, 0)} m³/day`,
                trigger: `Production drops ≥ 10% below design (< ${fmt(r.totalDistillateM3Day * 0.9, 0)} m³/day)`,
              },
              {
                indicator: 'Brine temperature rise',
                baseline: `Design TBT ${fmt(r.effects[0]?.brineTemp)}°C`,
                trigger: 'TBT rises ≥ 3°C above design at constant steam flow',
              },
              {
                indicator: 'Effect pressure rise',
                baseline: 'Design pressure per effect',
                trigger: '≥ 10% above design at constant load',
              },
              {
                indicator: 'Brine conductivity',
                baseline: `Design ${fmt(Number(rd.maxBrineSalinity ?? 65000) / 1000, 1)} g/L`,
                trigger: 'Brine TDS > 70 g/L (concentration factor drift)',
              },
              {
                indicator: 'Days since last cleaning',
                baseline: '—',
                trigger: '300–365 days (annual preventive maintenance)',
              },
              {
                indicator: 'Tube wall ΔT',
                baseline: 'Design (if instrumented)',
                trigger: '≥ 5°C above design at steady load',
              },
            ]}
            striped
            fontSize={7}
          />

          <Text
            style={{
              fontSize: 8,
              fontWeight: 'bold',
              marginTop: 8,
              marginBottom: 3,
              color: REPORT_THEME.text,
            }}
          >
            Factors that accelerate fouling
          </Text>
          <Text style={ls.methodItem}>
            • CaCO₃ deposition — sensitive to temperature; worst at hot effects (E1). Higher TBT
            accelerates scaling.
          </Text>
          <Text style={ls.methodItem}>
            • CaSO₄ deposition — sensitive to brine concentration. Risk above 60 g/L TDS (design
            uses {fmt(Number(rd.maxBrineSalinity ?? 65000) / 1000, 1)} g/L).
          </Text>
          <Text style={ls.methodItem}>
            • Insufficient antiscalant dosing — maintain design dose (typically 2 mg/L Belgard EV
            2050 or equivalent).
          </Text>
          <Text style={ls.methodItem}>
            • Seawater pre-treatment failures — allow biological or suspended solids fouling.
          </Text>
          <Text style={ls.methodItem}>
            • Top Brine Temperature {'>'} 70°C — dramatically increases scaling rates.
          </Text>

          <Text
            style={{
              fontSize: 8,
              fontWeight: 'bold',
              marginTop: 8,
              marginBottom: 3,
              color: REPORT_THEME.text,
            }}
          >
            Acid cleaning procedure (typical)
          </Text>
          <Text style={ls.methodItem}>
            1. Shut down MED train, drain effects, isolate from seawater intake.
          </Text>
          <Text style={ls.methodItem}>
            2. Fill effects with demineralised water and inhibited HCl (3–5%) or sulfamic acid
            (5–10%).
          </Text>
          <Text style={ls.methodItem}>
            3. Circulate acid using the brine recirculation pump (sized for full spray flow) for 4–8
            hours while monitoring pH and acid consumption.
          </Text>
          <Text style={ls.methodItem}>
            4. Drain, neutralise with dilute NaOH (pH 7–8), rinse with demineralised water until
            effluent is neutral.
          </Text>
          <Text style={ls.methodItem}>
            5. Resume normal operation; record post-cleaning GOR and U-value as the clean baseline
            for the next cycle.
          </Text>
        </ReportSection>

        {/* Section 14: Design Warnings & Notes */}
        {r.warnings.length > 0 && (
          <ReportSection title="14. Design Warnings">
            {r.warnings.map((w, i) => (
              <Text key={i} style={ls.warningItem}>
                {i + 1}. {w}
              </Text>
            ))}
          </ReportSection>
        )}

        {/* Section 15: Nomenclature */}
        <ReportSection title={r.warnings.length > 0 ? '15. Nomenclature' : '14. Nomenclature'}>
          {(
            [
              [
                'BPE',
                'Boiling Point Elevation — temperature increase of boiling brine over pure water at the same pressure',
              ],
              [
                'GOR',
                'Gain Output Ratio — kg distillate produced per kg of heating steam consumed',
              ],
              ['NEA', 'Non-Equilibrium Allowance — temperature loss due to incomplete flashing'],
              [
                'STE',
                'Specific Thermal Energy — thermal energy consumed per unit distillate (kWh/m3)',
              ],
              [
                'LMTD',
                'Log Mean Temperature Difference — effective driving force for heat transfer',
              ],
              [
                'HTC / U',
                'Heat Transfer Coefficient / Overall HTC — rate of heat transfer per unit area per unit temperature difference (W/m2.K)',
              ],
              [
                'Gamma',
                'Wetting Rate — liquid mass flow per unit tube length per row (kg/m.s). Minimum ~0.035 for falling film evaporation',
              ],
              [
                'NCG',
                'Non-Condensable Gases — air leakage and dissolved gases released from seawater',
              ],
              [
                'TVC',
                'Thermo Vapor Compressor — steam ejector that entrains low-pressure vapor to boost Effect 1 capacity',
              ],
              [
                'OTL',
                'Outer Tube Limit — diameter of the circle bounding the outermost tube centres',
              ],
              [
                'TEMA',
                'Tubular Exchanger Manufacturers Association — standards for shell and tube heat exchanger design',
              ],
              [
                'CF',
                'Concentration Factor — ratio of max brine salinity to feed salinity (dimensionless)',
              ],
            ] as [string, string][]
          ).map(([abbr, desc], i) => (
            <View key={i} style={ls.nomenclatureRow}>
              <Text style={ls.nomenclatureAbbr}>{abbr}</Text>
              <Text style={ls.nomenclatureDesc}>{desc}</Text>
            </View>
          ))}
        </ReportSection>

        {/* Section 16: References & Standards */}
        <ReportSection
          title={
            r.warnings.length > 0 ? '16. References & Standards' : '15. References & Standards'
          }
        >
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
