/**
 * Thermal Expansion Calculation Report — PDF Document
 *
 * Single-page report covering inputs, properties used, free ΔL, and restrained
 * thermal stress (with yield comparison if available).
 */

import { Document } from '@react-pdf/renderer';
import type { ThermalExpansionResult, ConstraintMode } from '@/lib/thermal';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  KeyValueTable,
  TwoColumnLayout,
  PrimaryResultBanner,
  WarningsBox,
  NotesSection,
  ReportFooter,
} from '@/lib/pdf/reportComponents';

export interface ThermalExpansionReportInputs {
  materialKey: string;
  length: string;
  installationTemperature: string;
  operatingTemperature: string;
  constraintMode: ConstraintMode;
}

interface ThermalExpansionReportPDFProps {
  result: ThermalExpansionResult;
  inputs: ThermalExpansionReportInputs;
  documentNumber?: string;
  revision?: string;
  projectName?: string;
  notes?: string;
  logoDataUri?: string;
}

export const ThermalExpansionReportPDF = ({
  result,
  inputs,
  documentNumber = 'THEXP-001',
  revision = '0',
  projectName,
  notes,
  logoDataUri,
}: ThermalExpansionReportPDFProps) => {
  const isRestrained = inputs.constraintMode === 'restrained';

  const deltaL_mm = result.deltaL;
  const deltaL_display =
    Math.abs(deltaL_mm) >= 1000
      ? `${(deltaL_mm / 1000).toFixed(3)} m`
      : `${deltaL_mm.toFixed(3)} mm`;

  const stressLabel = result.thermalStress >= 0 ? 'compressive' : 'tensile';

  return (
    <Document>
      <ReportPage>
        <ReportHeader
          title="Thermal Expansion Calculation Report"
          projectName={projectName}
          documentNumber={documentNumber}
          revision={revision}
          logoDataUri={logoDataUri}
        />

        <PrimaryResultBanner
          items={[
            { label: 'Material', value: result.materialLabel },
            { label: 'Free ΔL', value: deltaL_display },
            {
              label: isRestrained ? 'Restrained Stress' : 'Stress if Restrained',
              value: `${Math.abs(result.thermalStress).toFixed(0)} MPa (${stressLabel})`,
            },
          ]}
        />

        <TwoColumnLayout
          left={
            <ReportSection title="Input Parameters">
              <KeyValueTable
                rows={[
                  { label: 'Material', value: result.materialLabel },
                  { label: 'Initial Length L₀', value: `${inputs.length} mm` },
                  {
                    label: 'Installation Temperature',
                    value: `${inputs.installationTemperature} °C`,
                  },
                  {
                    label: 'Operating Temperature',
                    value: `${inputs.operatingTemperature} °C`,
                  },
                  {
                    label: 'ΔT (T_op − T_install)',
                    value: `${result.deltaT.toFixed(1)} °C`,
                  },
                  {
                    label: 'Constraint',
                    value: isRestrained ? 'Fully restrained' : 'Free to expand',
                  },
                ]}
              />
            </ReportSection>
          }
          right={
            <ReportSection title="Properties Used">
              <KeyValueTable
                rows={[
                  {
                    label: 'Mean α (20 °C → T_install)',
                    value: `${result.alphaMeanInstallation.toFixed(2)} × 10⁻⁶ /°C`,
                  },
                  {
                    label: 'Mean α (20 °C → T_op)',
                    value: `${result.alphaMeanOperating.toFixed(2)} × 10⁻⁶ /°C`,
                  },
                  {
                    label: 'Effective α (T_install → T_op)',
                    value: `${result.alphaEffective.toFixed(2)} × 10⁻⁶ /°C`,
                  },
                  {
                    label: "Young's modulus E(T_op)",
                    value: `${result.EOperating.toFixed(1)} GPa`,
                  },
                  ...(result.yieldStrength !== null
                    ? [
                        {
                          label: 'Yield strength σ_y(T_op)',
                          value: `${result.yieldStrength.toFixed(0)} MPa`,
                        },
                      ]
                    : []),
                ]}
              />
            </ReportSection>
          }
        />

        <ReportSection title="Results">
          <KeyValueTable
            rows={[
              { label: 'Free thermal expansion ΔL', value: deltaL_display },
              {
                label: 'Thermal strain ε',
                value: `${result.thermalStrain_mmPerM.toFixed(3)} mm/m (${result.thermalStrainPct.toFixed(3)} %)`,
              },
              {
                label: 'Restrained thermal stress σ',
                value: `${Math.abs(result.thermalStress).toFixed(1)} MPa (${stressLabel})`,
              },
              ...(result.yieldUtilisation !== null
                ? [
                    {
                      label: 'Yield utilisation σ/σ_y',
                      value: `${(result.yieldUtilisation * 100).toFixed(1)} %`,
                    },
                  ]
                : []),
            ]}
          />
        </ReportSection>

        <WarningsBox warnings={result.warnings} />

        {notes && <NotesSection notes={notes} title="Notes" />}

        <ReportFooter
          lines={[
            'Generated by Vapour Toolbox | Thermal Expansion Calculator',
            "Property data: Perry's Chemical Engineers' Handbook §28 / ASM Handbook Vol. 1 & 2 / ASME B31.3 App. C",
            'ΔL = L₀ × α_eff × ΔT  |  σ_restrained = E(T_op) × α_eff × ΔT',
            'This is a computer-generated document for preliminary design purposes only.',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
