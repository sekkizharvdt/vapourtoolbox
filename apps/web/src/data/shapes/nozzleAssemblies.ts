/**
 * Nozzle Assembly Shape Definitions
 * Category 5: Nozzle Assemblies (5 shapes)
 * Smart assemblies with ASME UG-37 auto-reinforcement and bolt clearance checking
 */

import type { Shape } from '@vapour/types';
import { ShapeCategory, MaterialCategory } from '@vapour/types';

/**
 * 1. Standard Nozzle Assembly
 * Complete nozzle assembly with automatic reinforcement pad calculation
 */
export const nozzleAssembly: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Standard Nozzle Assembly',
  description:
    'Complete nozzle assembly with pipe, flange, and automatic ASME UG-37 reinforcement pad calculation. Includes bolt removal clearance check.',
  category: ShapeCategory.NOZZLE_ASSEMBLY,
  shapeType: 'PARAMETRIC',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'B16.5-NOZZLE-ASSEMBLY',
    title: 'Standard Flanged Nozzle Assembly',
  },

  parameters: [
    // Shell properties
    {
      name: 'shellID',
      label: 'Shell Inside Diameter',
      description: 'Inside diameter of the vessel shell',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 200,
      maxValue: 5000,
      order: 1,
      required: true,
      helpText: 'Vessel shell ID where nozzle is attached',
      usedInFormulas: ['reinforcementCheck'],
    },
    {
      name: 'shellThickness',
      label: 'Shell Thickness',
      description: 'Shell wall thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 12,
      minValue: 3,
      maxValue: 100,
      order: 2,
      required: true,
      usedInFormulas: ['reinforcementCheck'],
    },
    {
      name: 'designPressure',
      label: 'Design Pressure',
      description: 'Vessel design pressure',
      unit: 'MPa',
      dataType: 'NUMBER',
      defaultValue: 1.0,
      minValue: 0.1,
      maxValue: 50,
      order: 3,
      required: true,
      usedInFormulas: ['reinforcementCheck'],
    },
    {
      name: 'allowableStress',
      label: 'Material Allowable Stress',
      description: 'Shell material allowable stress at design temperature',
      unit: 'MPa',
      dataType: 'NUMBER',
      defaultValue: 138,
      minValue: 50,
      maxValue: 500,
      order: 4,
      required: true,
      helpText: 'Typical: CS=138 MPa, SS304=115 MPa at ambient',
      usedInFormulas: ['reinforcementCheck'],
    },

    // Nozzle properties
    {
      name: 'nozzleSize',
      label: 'Nozzle Nominal Size',
      description: 'Nozzle nominal pipe size (NPS)',
      unit: 'NPS',
      dataType: 'SELECT',
      options: [
        { value: 50, label: '2"', description: 'NPS 2' },
        { value: 80, label: '3"', description: 'NPS 3' },
        { value: 100, label: '4"', description: 'NPS 4' },
        { value: 150, label: '6"', description: 'NPS 6' },
        { value: 200, label: '8"', description: 'NPS 8' },
        { value: 250, label: '10"', description: 'NPS 10' },
        { value: 300, label: '12"', description: 'NPS 12' },
      ],
      defaultValue: 100,
      order: 5,
      required: true,
      usedInFormulas: ['nozzleWeight', 'flangeWeight'],
    },
    {
      name: 'nozzleSchedule',
      label: 'Nozzle Schedule',
      description: 'Pipe schedule for nozzle neck',
      unit: '',
      dataType: 'SELECT',
      options: [
        { value: 10, label: 'Sch 10', description: 'Schedule 10' },
        { value: 40, label: 'Sch 40 (Std)', description: 'Schedule 40 Standard' },
        { value: 80, label: 'Sch 80 (XS)', description: 'Schedule 80 Extra Strong' },
        { value: 160, label: 'Sch 160', description: 'Schedule 160' },
      ],
      defaultValue: 40,
      order: 6,
      required: true,
      usedInFormulas: ['nozzleWeight', 'reinforcementCheck'],
    },
    {
      name: 'projectionOutside',
      label: 'Projection Outside Shell',
      description: 'Nozzle neck projection outside shell surface',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 300,
      minValue: 100,
      maxValue: 2000,
      order: 7,
      required: true,
      usedInFormulas: ['nozzleWeight', 'boltClearanceCheck'],
    },
    {
      name: 'projectionInside',
      label: 'Projection Inside Shell',
      description: 'Nozzle neck projection inside shell (if any)',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 0,
      minValue: 0,
      maxValue: 500,
      order: 8,
      required: false,
      usedInFormulas: ['nozzleWeight'],
    },

    // Flange properties
    {
      name: 'flangeRating',
      label: 'Flange Pressure Rating',
      description: 'ASME B16.5 flange class',
      unit: '',
      dataType: 'SELECT',
      options: [
        { value: 150, label: '150#', description: 'Class 150' },
        { value: 300, label: '300#', description: 'Class 300' },
        { value: 600, label: '600#', description: 'Class 600' },
        { value: 900, label: '900#', description: 'Class 900' },
        { value: 1500, label: '1500#', description: 'Class 1500' },
      ],
      defaultValue: 150,
      order: 9,
      required: true,
      usedInFormulas: ['flangeWeight', 'boltClearanceCheck'],
    },
    {
      name: 'flangeType',
      label: 'Flange Type',
      description: 'Type of flange facing',
      unit: '',
      dataType: 'SELECT',
      options: [
        { value: 1, label: 'Weld Neck RF', description: 'Weld Neck Raised Face' },
        { value: 2, label: 'Slip-On RF', description: 'Slip-On Raised Face' },
        { value: 3, label: 'Weld Neck RTJ', description: 'Weld Neck Ring Type Joint' },
      ],
      defaultValue: 1,
      order: 10,
      required: true,
      usedInFormulas: ['flangeWeight'],
    },

    // Orientation
    {
      name: 'orientation',
      label: 'Nozzle Orientation',
      description: 'Nozzle attachment orientation',
      unit: '',
      dataType: 'SELECT',
      options: [
        { value: 1, label: 'Radial', description: 'Perpendicular to shell' },
        { value: 2, label: 'Tangential', description: 'Tangent to shell' },
        { value: 3, label: 'Hillside', description: 'Hillside orientation' },
      ],
      defaultValue: 1,
      order: 11,
      required: false,
      usedInFormulas: ['reinforcementCheck'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PIPES_CARBON_STEEL,
    MaterialCategory.PIPES_STAINLESS_304L,
    MaterialCategory.PIPES_STAINLESS_316L,
  ],
  defaultMaterialCategory: MaterialCategory.PIPES_CARBON_STEEL,

  formulas: {
    // Note: Actual weight calculations would reference pipe/flange catalogs
    // These are simplified approximations
    weight: {
      expression:
        'nozzleSize * 0.5 + flangeRating * 0.01 + (projectionOutside + projectionInside) * 0.02',
      variables: ['nozzleSize', 'flangeRating', 'projectionOutside', 'projectionInside'],
      unit: 'kg',
      description: 'Approximate nozzle assembly weight (link to catalog for accurate weight)',
      requiresDensity: false,
    },

    customFormulas: [
      {
        name: 'totalLength',
        label: 'Total Assembly Length',
        formula: {
          expression: 'projectionOutside + projectionInside + shellThickness',
          variables: ['projectionOutside', 'projectionInside', 'shellThickness'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 1,
      },
    ],
  },

  fabricationCost: {
    weldingCostPerMeter: 300, // Nozzle-to-shell weld + flange weld
  },

  tags: ['nozzle', 'assembly', 'asme', 'flanged', 'reinforcement', 'smart'],
  isStandard: true,
  isActive: true,
  usageCount: 0,

  validationRules: [
    {
      field: 'projectionOutside',
      rule: 'BOLT_CLEARANCE_CHECK',
      errorMessage: 'Insufficient projection for bolt removal - automatically checked',
      severity: 'error',
    },
    {
      field: 'shellThickness',
      rule: 'REINFORCEMENT_CHECK',
      errorMessage: 'ASME UG-37 reinforcement check - automatically performed',
      severity: 'info',
    },
  ],
};

/**
 * 2. Custom Circular Nozzle
 * Custom circular nozzle with user-defined dimensions
 */
export const customCircularNozzle: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Custom Circular Nozzle',
  description:
    'Custom circular nozzle with user-defined OD, thickness, and projection. Includes ASME UG-37 reinforcement calculation.',
  category: ShapeCategory.NOZZLE_CUSTOM_CIRCULAR,
  shapeType: 'CUSTOM',

  parameters: [
    {
      name: 'shellID',
      label: 'Shell Inside Diameter',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 200,
      maxValue: 5000,
      order: 1,
      required: true,
      usedInFormulas: ['reinforcementCheck'],
    },
    {
      name: 'shellThickness',
      label: 'Shell Thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 12,
      minValue: 3,
      maxValue: 100,
      order: 2,
      required: true,
      usedInFormulas: ['reinforcementCheck', 'totalLength'],
    },
    {
      name: 'nozzleOD',
      label: 'Nozzle Outer Diameter',
      description: 'Custom nozzle outside diameter',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 114.3,
      minValue: 20,
      maxValue: 1000,
      order: 3,
      required: true,
      usedInFormulas: ['volume', 'weight', 'reinforcementCheck'],
    },
    {
      name: 'nozzleThickness',
      label: 'Nozzle Wall Thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 6,
      minValue: 2,
      maxValue: 50,
      order: 4,
      required: true,
      usedInFormulas: ['volume', 'weight', 'reinforcementCheck'],
    },
    {
      name: 'projectionOutside',
      label: 'Projection Outside',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 300,
      minValue: 50,
      maxValue: 2000,
      order: 5,
      required: true,
      usedInFormulas: ['volume', 'weight', 'totalLength'],
    },
    {
      name: 'projectionInside',
      label: 'Projection Inside',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 0,
      minValue: 0,
      maxValue: 500,
      order: 6,
      required: false,
      usedInFormulas: ['volume', 'weight', 'totalLength'],
    },
    {
      name: 'designPressure',
      label: 'Design Pressure',
      unit: 'MPa',
      dataType: 'NUMBER',
      defaultValue: 1.0,
      minValue: 0.1,
      maxValue: 50,
      order: 7,
      required: true,
      usedInFormulas: ['reinforcementCheck'],
    },
    {
      name: 'allowableStress',
      label: 'Allowable Stress',
      unit: 'MPa',
      dataType: 'NUMBER',
      defaultValue: 138,
      minValue: 50,
      maxValue: 500,
      order: 8,
      required: true,
      usedInFormulas: ['reinforcementCheck'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PIPES_CARBON_STEEL,
    MaterialCategory.PIPES_STAINLESS_304L,
    MaterialCategory.PIPES_STAINLESS_316L,
  ],
  defaultMaterialCategory: MaterialCategory.PIPES_CARBON_STEEL,

  formulas: {
    volume: {
      expression:
        'pi * ((nozzleOD/2)^2 - ((nozzleOD - 2*nozzleThickness)/2)^2) * (projectionOutside + projectionInside + shellThickness)',
      variables: [
        'nozzleOD',
        'nozzleThickness',
        'projectionOutside',
        'projectionInside',
        'shellThickness',
      ],
      unit: 'mm³',
      description: 'Nozzle neck volume',
    },

    weight: {
      expression:
        '(pi * ((nozzleOD/2)^2 - ((nozzleOD - 2*nozzleThickness)/2)^2) * (projectionOutside + projectionInside + shellThickness) * density) / 1000000000',
      variables: [
        'nozzleOD',
        'nozzleThickness',
        'projectionOutside',
        'projectionInside',
        'shellThickness',
      ],
      unit: 'kg',
      description: 'Nozzle neck weight',
      requiresDensity: true,
    },

    customFormulas: [
      {
        name: 'totalLength',
        label: 'Total Length',
        formula: {
          expression: 'projectionOutside + projectionInside + shellThickness',
          variables: ['projectionOutside', 'projectionInside', 'shellThickness'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'nozzleID',
        label: 'Nozzle Inside Diameter',
        formula: {
          expression: 'nozzleOD - 2*nozzleThickness',
          variables: ['nozzleOD', 'nozzleThickness'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 2,
      },
    ],
  },

  fabricationCost: {
    weldingCostPerMeter: 250,
  },

  tags: ['nozzle', 'custom', 'circular', 'asme'],
  isStandard: false,
  isActive: true,
  usageCount: 0,
};

/**
 * 3. Custom Rectangular Nozzle
 * Custom rectangular nozzle opening
 */
export const customRectangularNozzle: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Custom Rectangular Nozzle',
  description:
    'Custom rectangular nozzle opening for special applications. Requires custom reinforcement design.',
  category: ShapeCategory.NOZZLE_CUSTOM_RECTANGULAR,
  shapeType: 'CUSTOM',

  parameters: [
    {
      name: 'length',
      label: 'Opening Length',
      description: 'Length of rectangular opening',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 500,
      minValue: 100,
      maxValue: 2000,
      order: 1,
      required: true,
      usedInFormulas: ['area', 'perimeter', 'reinforcementArea'],
    },
    {
      name: 'width',
      label: 'Opening Width',
      description: 'Width of rectangular opening',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 300,
      minValue: 100,
      maxValue: 2000,
      order: 2,
      required: true,
      usedInFormulas: ['area', 'perimeter', 'reinforcementArea'],
    },
    {
      name: 'plateThickness',
      label: 'Nozzle Plate Thickness',
      description: 'Thickness of rectangular nozzle neck plate',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 12,
      minValue: 6,
      maxValue: 50,
      order: 3,
      required: true,
      usedInFormulas: ['weight', 'volume'],
    },
    {
      name: 'projection',
      label: 'Projection from Shell',
      description: 'Projection distance from shell',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 200,
      minValue: 50,
      maxValue: 1000,
      order: 4,
      required: true,
      usedInFormulas: ['weight', 'volume'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    volume: {
      expression: '2 * (length + width) * plateThickness * projection',
      variables: ['length', 'width', 'plateThickness', 'projection'],
      unit: 'mm³',
      description: 'Approximate nozzle neck volume (4 sides)',
    },

    weight: {
      expression: '(2 * (length + width) * plateThickness * projection * density) / 1000000000',
      variables: ['length', 'width', 'plateThickness', 'projection'],
      unit: 'kg',
      description: 'Approximate weight',
      requiresDensity: true,
    },

    customFormulas: [
      {
        name: 'area',
        label: 'Opening Area',
        formula: {
          expression: 'length * width',
          variables: ['length', 'width'],
          unit: 'mm²',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'perimeter',
        label: 'Opening Perimeter',
        formula: {
          expression: '2 * (length + width)',
          variables: ['length', 'width'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 2,
      },
    ],
  },

  fabricationCost: {
    weldingCostPerMeter: 300,
  },

  tags: ['nozzle', 'rectangular', 'custom', 'special'],
  isStandard: false,
  isActive: true,
  usageCount: 0,
};

/**
 * 4. Manway Assembly
 * Complete manway assembly (separate from rectangular nozzle)
 */
export const manwayAssembly: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Manway Assembly',
  description:
    'Complete manway assembly for personnel access. May be purchased as pre-assembled unit or fabricated. Includes davit, cover, bolting.',
  category: ShapeCategory.MANWAY_ASSEMBLY,
  shapeType: 'PARAMETRIC',

  parameters: [
    {
      name: 'manwayType',
      label: 'Manway Type',
      description: 'Type of manway',
      unit: '',
      dataType: 'SELECT',
      options: [
        { value: 1, label: 'Circular 18"', description: '18" (450mm) circular' },
        { value: 2, label: 'Circular 20"', description: '20" (500mm) circular' },
        { value: 3, label: 'Oval 16x12"', description: '16"x12" oval' },
        { value: 4, label: 'Rectangular 18x12"', description: '18"x12" rectangular' },
      ],
      defaultValue: 1,
      order: 1,
      required: true,
      usedInFormulas: ['weight', 'cost'],
    },
    {
      name: 'pressureRating',
      label: 'Pressure Rating',
      description: 'Manway pressure rating',
      unit: '',
      dataType: 'SELECT',
      options: [
        { value: 150, label: '150 psi', description: '150 psi working pressure' },
        { value: 300, label: '300 psi', description: '300 psi working pressure' },
        { value: 600, label: '600 psi', description: '600 psi working pressure' },
      ],
      defaultValue: 150,
      order: 2,
      required: true,
      usedInFormulas: ['weight'],
    },
    {
      name: 'includeDavit',
      label: 'Include Davit Arm',
      description: 'Include davit arm for cover lifting',
      unit: '',
      dataType: 'BOOLEAN',
      defaultValue: 1,
      order: 3,
      required: false,
      usedInFormulas: ['weight', 'cost'],
    },
    {
      name: 'neckProjection',
      label: 'Neck Projection',
      description: 'Manway neck projection from shell',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 300,
      minValue: 200,
      maxValue: 800,
      order: 4,
      required: true,
      usedInFormulas: ['weight'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    // Simplified weight - actual would reference catalog
    weight: {
      expression:
        'manwayType * 50 + pressureRating * 0.1 + neckProjection * 0.05 + includeDavit * 20',
      variables: ['manwayType', 'pressureRating', 'neckProjection', 'includeDavit'],
      unit: 'kg',
      description: 'Approximate assembly weight (reference catalog for exact)',
      requiresDensity: false,
    },
  },

  fabricationCost: {
    weldingCostPerMeter: 400,
  },

  tags: ['manway', 'assembly', 'access', 'personnel', 'catalog'],
  isStandard: true,
  isActive: true,
  usageCount: 0,
};

/**
 * 5. Reinforcement Pad
 * Standalone reinforcement pad for nozzle openings
 */
export const reinforcementPad: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Reinforcement Pad',
  description:
    'Circular reinforcement pad for nozzle openings. Welded to shell to provide additional reinforcement area per ASME UG-37.',
  category: ShapeCategory.REINFORCEMENT_PAD,
  shapeType: 'PARAMETRIC',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'UG-37-RF-PAD',
    title: 'Reinforcement Pad per UG-37',
  },

  parameters: [
    {
      name: 'padOD',
      label: 'Pad Outer Diameter',
      description: 'Outside diameter of reinforcement pad',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 300,
      minValue: 100,
      maxValue: 1500,
      order: 1,
      required: true,
      usedInFormulas: ['volume', 'weight', 'area', 'reinforcementArea'],
    },
    {
      name: 'nozzleOD',
      label: 'Nozzle Hole Diameter',
      description: 'Nozzle OD (hole diameter in pad)',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 114.3,
      minValue: 20,
      maxValue: 1000,
      order: 2,
      required: true,
      usedInFormulas: ['volume', 'weight', 'area', 'reinforcementArea'],
    },
    {
      name: 'padThickness',
      label: 'Pad Thickness',
      description: 'Thickness of reinforcement pad',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 12,
      minValue: 6,
      maxValue: 50,
      order: 3,
      required: true,
      helpText: 'Typically 6-12mm or half shell thickness',
      usedInFormulas: ['volume', 'weight', 'reinforcementArea'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    volume: {
      expression: 'pi * ((padOD/2)^2 - (nozzleOD/2)^2) * padThickness',
      variables: ['padOD', 'nozzleOD', 'padThickness'],
      unit: 'mm³',
      description: 'Reinforcement pad volume (annular ring)',
    },

    weight: {
      expression: '(pi * ((padOD/2)^2 - (nozzleOD/2)^2) * padThickness * density) / 1000000000',
      variables: ['padOD', 'nozzleOD', 'padThickness'],
      unit: 'kg',
      description: 'Reinforcement pad weight',
      requiresDensity: true,
    },

    surfaceArea: {
      expression: '2 * pi * ((padOD/2)^2 - (nozzleOD/2)^2)',
      variables: ['padOD', 'nozzleOD'],
      unit: 'mm²',
      description: 'Total surface area (both faces)',
    },

    edgeLength: {
      expression: 'pi * padOD + pi * nozzleOD',
      variables: ['padOD', 'nozzleOD'],
      unit: 'mm',
      description: 'Total edge length (outer + inner perimeters)',
    },

    weldLength: {
      expression: 'pi * padOD + pi * nozzleOD',
      variables: ['padOD', 'nozzleOD'],
      unit: 'mm',
      description: 'Total weld length required',
    },

    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'padOD + 20',
        variables: ['padOD'],
        unit: 'mm',
        description: 'Blank diameter with cutting allowance',
      },
      blankThickness: 'padThickness',
      description: 'Circular blank with center hole',
    },

    customFormulas: [
      {
        name: 'area',
        label: 'Pad Area',
        formula: {
          expression: 'pi * ((padOD/2)^2 - (nozzleOD/2)^2)',
          variables: ['padOD', 'nozzleOD'],
          unit: 'mm²',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'reinforcementArea',
        label: 'Reinforcement Area Provided',
        formula: {
          expression: 'pi * ((padOD/2)^2 - (nozzleOD/2)^2)',
          variables: ['padOD', 'nozzleOD'],
          unit: 'mm²',
          description: 'Area available for UG-37 reinforcement',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'extension',
        label: 'Extension Beyond Nozzle',
        formula: {
          expression: '(padOD - nozzleOD) / 2',
          variables: ['padOD', 'nozzleOD'],
          unit: 'mm',
          description: 'Radial extension beyond nozzle OD',
        },
        displayInResults: true,
        order: 3,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 60,
    weldingCostPerMeter: 200, // Both inner and outer welds
    surfaceTreatmentCostPerSqm: 150,
  },

  tags: ['reinforcement', 'pad', 'nozzle', 'asme', 'ug-37'],
  isStandard: true,
  isActive: true,
  usageCount: 0,

  validationRules: [
    {
      field: 'padOD',
      rule: 'PAD_EXTENSION',
      errorMessage: 'Pad should extend at least 50mm beyond nozzle OD on all sides',
      severity: 'warning',
    },
  ],
};

/**
 * Export all nozzle assembly shapes
 */
export const nozzleAssemblyShapes = [
  nozzleAssembly,
  customCircularNozzle,
  customRectangularNozzle,
  manwayAssembly,
  reinforcementPad,
];
