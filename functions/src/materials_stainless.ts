/**
 * Stainless Steel Material Generation Functions
 * Separated for clarity - to be merged into materials.ts
 */

// Type definitions
type MaterialCategory =
  | 'PLATES_CARBON_STEEL'
  | 'PLATES_STAINLESS_STEEL'
  | 'PIPES_SEAMLESS'
  | 'PIPES_WELDED'
  | 'PIPES_STAINLESS';

type MaterialType = 'RAW_MATERIAL' | 'CONSUMABLE' | 'COMPONENT';

/**
 * Generate stainless steel plate materials
 * - SS 304 (austenitic)
 * - SS 316L (low carbon austenitic, marine grade)
 * - Lean Duplex 2101/2304
 * - Duplex 2205
 * - Super Duplex 2507
 */
export function generateStainlessSteelPlates(getNextCode: () => string) {
  const plates = [];
  const thicknesses = [6, 8, 10, 12, 16, 20, 25, 30]; // mm

  const grades = [
    {
      name: 'SS 304',
      standard: 'ASTM A240',
      grade: '304',
      description:
        'ASTM A240 Type 304 stainless steel plate. General purpose austenitic stainless steel with excellent corrosion resistance and formability.',
      density: 8000,
      tensileStrength: 515,
      yieldStrength: 205,
      maxOperatingTemp: 870,
      tags: ['stainless-steel', 'austenitic', '304', 'ASTM', 'plate'],
      isStandard: true,
      certifications: ['ASTM', 'ASME', 'EN 10088'],
    },
    {
      name: 'SS 316L',
      standard: 'ASTM A240',
      grade: '316L',
      description:
        'ASTM A240 Type 316L low carbon stainless steel plate. Marine grade with superior corrosion resistance, especially in chloride environments.',
      density: 8000,
      tensileStrength: 485,
      yieldStrength: 170,
      maxOperatingTemp: 870,
      tags: ['stainless-steel', 'austenitic', '316l', 'marine-grade', 'ASTM', 'plate'],
      isStandard: true,
      certifications: ['ASTM', 'ASME', 'EN 10088', 'NACE MR0175'],
    },
    {
      name: 'Lean Duplex 2304',
      standard: 'ASTM A240',
      grade: 'UNS S32304',
      description:
        'ASTM A240 UNS S32304 lean duplex stainless steel plate. Cost-effective duplex grade with good strength and corrosion resistance.',
      density: 7800,
      tensileStrength: 600,
      yieldStrength: 400,
      maxOperatingTemp: 250,
      tags: ['stainless-steel', 'lean-duplex', '2304', 'ASTM', 'plate'],
      isStandard: false,
      certifications: ['ASTM', 'EN 10088', 'NACE MR0175'],
    },
    {
      name: 'Duplex 2205',
      standard: 'ASTM A240',
      grade: 'UNS S31803/S32205',
      description:
        'ASTM A240 UNS S31803/S32205 duplex stainless steel plate. High strength with excellent corrosion and stress corrosion cracking resistance.',
      density: 7800,
      tensileStrength: 620,
      yieldStrength: 450,
      maxOperatingTemp: 315,
      tags: ['stainless-steel', 'duplex', '2205', 'ASTM', 'plate'],
      isStandard: true,
      certifications: ['ASTM', 'ASME', 'EN 10088', 'NACE MR0175'],
    },
    {
      name: 'Super Duplex 2507',
      standard: 'ASTM A240',
      grade: 'UNS S32750',
      description:
        'ASTM A240 UNS S32750 super duplex stainless steel plate. Exceptional corrosion resistance and strength for severe corrosive environments.',
      density: 7800,
      tensileStrength: 800,
      yieldStrength: 550,
      maxOperatingTemp: 300,
      tags: ['stainless-steel', 'super-duplex', '2507', 'ASTM', 'plate'],
      isStandard: false,
      certifications: ['ASTM', 'ASME', 'EN 10088', 'NACE MR0175'],
    },
  ];

  for (const gradeInfo of grades) {
    for (const thickness of thicknesses) {
      plates.push({
        materialCode: getNextCode(),
        name: `${gradeInfo.name} Stainless Steel Plate - ${thickness}mm`,
        description: `${gradeInfo.description} Thickness: ${thickness}mm.`,
        category: 'PLATES_STAINLESS_STEEL' as MaterialCategory,
        materialType: 'RAW_MATERIAL' as MaterialType,
        specification: {
          standard: gradeInfo.standard,
          grade: gradeInfo.grade,
          finish: '2B',
          form: 'Plate',
          nominalSize: `${thickness}mm`,
        },
        properties: {
          density: gradeInfo.density,
          densityUnit: 'kg/m3' as 'kg/m3',
          tensileStrength: gradeInfo.tensileStrength,
          yieldStrength: gradeInfo.yieldStrength,
          maxOperatingTemp: gradeInfo.maxOperatingTemp,
        },
        baseUnit: 'kg',
        tags: gradeInfo.tags,
        isStandard: gradeInfo.isStandard,
        isActive: true,
        trackInventory: false,
        preferredVendors: [],
        priceHistory: [],
        certifications: gradeInfo.certifications,
      });
    }
  }

  return plates;
}

/**
 * Generate stainless steel seamless pipes
 * - SS 304/304L (ASTM A312)
 * - SS 316/316L (ASTM A312)
 * - Duplex 2205 (ASTM A790)
 */
export function generateStainlessSeamlessPipes(getNextCode: () => string) {
  const pipes = [];

  // Pipe sizes (common for stainless)
  const pipeSizes = [
    { dn: 15, nps: '1/2' },
    { dn: 20, nps: '3/4' },
    { dn: 25, nps: '1' },
    { dn: 32, nps: '1-1/4' },
    { dn: 40, nps: '1-1/2' },
    { dn: 50, nps: '2' },
    { dn: 80, nps: '3' },
    { dn: 100, nps: '4' },
    { dn: 150, nps: '6' },
    { dn: 200, nps: '8' },
  ];

  const schedules = ['10S', '40S', '80S'];

  const grades = [
    {
      name: '304/304L',
      standard: 'ASTM A312',
      grade: 'TP304/304L',
      description: 'austenitic stainless steel',
      density: 8000,
      tensileStrength: 515,
      yieldStrength: 205,
      maxOperatingTemp: 870,
      tags: ['stainless-steel', 'austenitic', '304', 'seamless', 'ASTM', 'a312'],
      isStandard: true,
    },
    {
      name: '316/316L',
      standard: 'ASTM A312',
      grade: 'TP316/316L',
      description: 'austenitic stainless steel, marine grade',
      density: 8000,
      tensileStrength: 485,
      yieldStrength: 170,
      maxOperatingTemp: 870,
      tags: ['stainless-steel', 'austenitic', '316l', 'marine-grade', 'seamless', 'ASTM', 'a312'],
      isStandard: true,
    },
    {
      name: 'Duplex 2205',
      standard: 'ASTM A790',
      grade: 'UNS S31803',
      description: 'duplex stainless steel, high strength',
      density: 7800,
      tensileStrength: 620,
      yieldStrength: 450,
      maxOperatingTemp: 315,
      tags: ['stainless-steel', 'duplex', '2205', 'seamless', 'ASTM', 'a790'],
      isStandard: false,
    },
  ];

  for (const gradeInfo of grades) {
    for (const { dn, nps } of pipeSizes) {
      for (const schedule of schedules) {
        const standardAbbrev = gradeInfo.standard.split(' ')[1]; // A312 or A790
        pipes.push({
          materialCode: getNextCode(),
          name: `ASTM ${standardAbbrev} ${gradeInfo.name} Seamless Pipe - DN ${dn} (NPS ${nps}) ${schedule}`,
          description: `${gradeInfo.standard} Grade ${gradeInfo.grade} seamless ${gradeInfo.description} pipe. Size: DN ${dn} (NPS ${nps}), Schedule ${schedule}.`,
          category: 'PIPES_STAINLESS' as MaterialCategory,
          materialType: 'RAW_MATERIAL' as MaterialType,
          specification: {
            standard: gradeInfo.standard,
            grade: gradeInfo.grade,
            finish: 'Pickled & Annealed',
            form: 'Seamless Pipe',
            schedule: schedule,
            nominalSize: `DN ${dn} (NPS ${nps})`,
          },
          properties: {
            density: gradeInfo.density,
            densityUnit: 'kg/m3' as 'kg/m3',
            tensileStrength: gradeInfo.tensileStrength,
            yieldStrength: gradeInfo.yieldStrength,
            maxOperatingTemp: gradeInfo.maxOperatingTemp,
          },
          baseUnit: 'meter',
          tags: [...gradeInfo.tags, `dn${dn}`, `sch${schedule}`],
          isStandard: gradeInfo.isStandard && schedule === '40S',
          isActive: true,
          trackInventory: false,
          preferredVendors: [],
          priceHistory: [],
          certifications: ['ASTM', 'ASME B31.3', 'NACE MR0175'],
        });
      }
    }
  }

  return pipes;
}
