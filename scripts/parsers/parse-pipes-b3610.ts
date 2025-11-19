/**
 * ASME B36.10-2022 Pipes Parser
 * Extracts pipe dimensions and weights for all schedules and NPS
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Material, MaterialVariant, MaterialCategory } from '../../packages/types/src/material';

// PDF extraction library
const PDFExtract = require('pdf.js-extract').PDFExtract;
const pdfExtract = new PDFExtract();

// Pipe schedules defined in ASME B36.10
const PIPE_SCHEDULES = [
  '5S', '10S', '10', '20', '30', '40S', '40', '60', '80S', '80',
  '100', '120', '140', '160', 'STD', 'XS', 'XXS'
];

interface PipeData {
  nps: string; // Nominal Pipe Size (e.g., "1/2", "3/4", "1", "2")
  schedule: string; // e.g., "40", "80", "160"
  outsideDiameter: number; // inches
  wallThickness: number; // inches
  insideDiameter: number; // inches
  weightPerFoot: number; // lb/ft
  weightPerMeter?: number; // kg/m (calculated)
}

interface ParsedPipeStandard {
  standard: string;
  material: string; // "Carbon Steel", "Stainless Steel"
  specification: string; // e.g., "ASTM A106", "ASTM A312"
  pipes: PipeData[];
}

/**
 * Parse ASME B36.10-2022 PDF
 */
export async function parsePipesB3610(pdfPath: string): Promise<ParsedPipeStandard> {
  console.log(`📖 Reading PDF: ${pdfPath}`);

  const data = await pdfExtract.extract(pdfPath, {});

  console.log(`📄 PDF Info:`);
  console.log(`  - Pages: ${data.pages.length}`);

  // Extract text content from all pages
  let text = '';
  for (const page of data.pages) {
    for (const item of page.content) {
      text += item.str + ' ';
    }
    text += '\n';
  }

  console.log(`  - Text length: ${text.length} characters`);

  // Parse tables from text
  const pipes = extractPipeDimensions(text);

  console.log(`✅ Extracted ${pipes.length} pipe variants`);

  return {
    standard: 'ASME B36.10-2022',
    material: 'Carbon Steel',
    specification: 'ASTM A53/A106',
    pipes,
  };
}

/**
 * Extract pipe dimensions from PDF text
 * ASME B36.10 tables typically have format:
 * NPS | OD | Schedule | Wall Thickness | Weight
 */
function extractPipeDimensions(text: string): PipeData[] {
  const pipes: PipeData[] = [];

  // Split text into lines
  const lines = text.split('\n');

  // Common NPS values (in inches)
  const standardNPS = [
    '1/8', '1/4', '3/8', '1/2', '3/4', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '3-1/2', '4',
    '5', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '34', '36',
    '42', '48', '52', '56', '60', '64', '72'
  ];

  // Pattern to match pipe data rows
  // Looking for: NPS OD (various schedules with wall thickness and weight)
  const npsPat = /^([\d\-\/]+)\s+(\d+\.?\d*)/;

  let currentNPS = '';
  let currentOD = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Try to match NPS and OD
    const npsMatch = trimmed.match(npsPat);
    if (npsMatch && standardNPS.includes(npsMatch[1])) {
      currentNPS = npsMatch[1];
      currentOD = parseFloat(npsMatch[2]);
      continue;
    }

    // Try to extract schedule data
    // Pattern: Schedule [number/STD/XS/XXS] Wall [decimal] Weight [decimal]
    const schedMatch = trimmed.match(/(STD|XS|XXS|\d+S?)\s+(\d+\.?\d+)\s+(\d+\.?\d+)/);
    if (schedMatch && currentNPS && currentOD > 0) {
      const schedule = schedMatch[1];
      const wallThickness = parseFloat(schedMatch[2]);
      const weight = parseFloat(schedMatch[3]);

      // Calculate inside diameter: ID = OD - 2*WT
      const insideDiameter = currentOD - (2 * wallThickness);

      // Convert weight from lb/ft to kg/m
      const weightPerMeter = weight * 1.48816; // 1 lb/ft = 1.48816 kg/m

      pipes.push({
        nps: currentNPS,
        schedule,
        outsideDiameter: currentOD,
        wallThickness,
        insideDiameter,
        weightPerFoot: weight,
        weightPerMeter,
      });
    }
  }

  return pipes;
}

/**
 * Convert parsed pipes to Material/MaterialVariant format
 */
export function convertToMaterialFormat(
  parsed: ParsedPipeStandard,
  materialCategory: MaterialCategory
): { material: Partial<Material>; variants: Partial<MaterialVariant>[] } {
  // Create base material (one per material grade/specification)
  const material: Partial<Material> = {
    materialCode: `PP-CS-A106-SMLS`, // Pipe-Carbon Steel-A106-Seamless
    name: `Carbon Steel Pipe ASTM A106`,
    description: `Seamless Carbon Steel Pipe for High-Temperature Service - ${parsed.standard}`,
    category: materialCategory,
    materialType: 'RAW_MATERIAL',
    specification: {
      standard: parsed.standard,
      form: 'Pipe',
      // grade will be set per variant if needed
    },
    properties: {
      // Material properties (not size-specific)
    },
    hasVariants: true,
    baseUnit: 'meter',
    tags: ['pipe', 'carbon-steel', 'seamless', 'ASME', 'B36.10'],
    isActive: true,
    isStandard: true,
  };

  // Create variants for each NPS × Schedule combination
  const variants: Partial<MaterialVariant>[] = parsed.pipes.map((pipe) => ({
    variantCode: `${pipe.nps}-SCH${pipe.schedule}`,
    displayName: `NPS ${pipe.nps}" Schedule ${pipe.schedule}`,
    dimensions: {
      diameter: pipe.outsideDiameter * 25.4, // Convert inches to mm
      thickness: pipe.wallThickness * 25.4, // Convert inches to mm
      schedule: `Sch ${pipe.schedule}`,
      nominalSize: pipe.nps,
    },
    weightPerUnit: pipe.weightPerMeter, // kg/m
    isAvailable: true,
  }));

  return { material, variants };
}

/**
 * Generate JSON output file
 */
export async function generatePipesJSON(outputPath: string) {
  const pdfPath = path.join(__dirname, '../../feedback/ASME B36.10-2022.pdf');

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const parsed = await parsePipesB3610(pdfPath);

  // Convert to Material format
  const { material, variants } = convertToMaterialFormat(
    parsed,
    'PIPES_CARBON_STEEL' as MaterialCategory
  );

  // Write JSON output
  const output = {
    standard: parsed.standard,
    material,
    variants,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalVariants: variants.length,
      source: 'ASME B36.10-2022',
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Generated JSON: ${outputPath}`);
  console.log(`📊 Total variants: ${variants.length}`);

  // Print sample data
  console.log(`\n📋 Sample variants:`);
  variants.slice(0, 5).forEach((v) => {
    console.log(`  - ${v.displayName}`);
  });

  return output;
}

// CLI execution
if (require.main === module) {
  const outputPath = path.join(__dirname, '../output/pipes-b3610.json');

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  generatePipesJSON(outputPath)
    .then(() => {
      console.log('\n✨ Parsing complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}
