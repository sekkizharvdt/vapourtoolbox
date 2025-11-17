/**
 * Pressure Vessel Head Shape Definitions (Continuation)
 * ASME Section VIII Division 1 compliant head types
 */

import type { Shape } from '@vapour/types';
import { ShapeCategory, MaterialCategory } from '@vapour/types';

/**
 * 4. Ellipsoidal Head (2:1)
 * ASME UG-32(d) compliant 2:1 ellipsoidal head
 */
export const ellipsoidalHead: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Ellipsoidal Head (2:1)',
  description:
    'ASME Section VIII Division 1 compliant 2:1 ellipsoidal head (UG-32(d)). Most commonly used head type, good balance of strength and manufacturability.',
  category: ShapeCategory.HEAD_ELLIPSOIDAL,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'SEC-VIII-DIV1-UG32D',
    title: '2:1 Ellipsoidal Heads',
    revision: '2021',
  },

  parameters: [
    {
      name: 'ID',
      label: 'Inside Diameter',
      description: 'Inside diameter of the head',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 100,
      maxValue: 10000,
      order: 1,
      required: true,
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'height'],
    },
    {
      name: 't',
      label: 'Wall Thickness',
      description: 'Head wall thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 10,
      minValue: 3,
      maxValue: 200,
      order: 2,
      required: true,
      usedInFormulas: ['volume', 'weight', 'outerSurfaceArea'],
    },
    {
      name: 'SF',
      label: 'Straight Flange',
      description: 'Straight flange length',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 50,
      minValue: 25,
      maxValue: 300,
      order: 3,
      required: false,
      usedInFormulas: ['height', 'volume', 'weight'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    volume: {
      expression:
        'pi * ((ID/2 + t)^2 * (ID/4 + t) - (ID/2)^2 * (ID/4)) + pi * ((ID/2 + t)^2 - (ID/2)^2) * SF',
      variables: ['ID', 't', 'SF'],
      unit: 'mm³',
      description: 'Head material volume (2:1 ellipsoid + straight flange)',
    },

    weight: {
      expression:
        '(pi * ((ID/2 + t)^2 * (ID/4 + t) - (ID/2)^2 * (ID/4)) + pi * ((ID/2 + t)^2 - (ID/2)^2) * SF) * density / 1000000',
      variables: ['ID', 't', 'SF'],
      unit: 'kg',
      description: 'Head weight',
      requiresDensity: true,
    },

    innerSurfaceArea: {
      expression: '1.09 * ID^2 + pi * ID * SF',
      variables: ['ID', 'SF'],
      unit: 'mm²',
      description: 'Inner surface area (approximation)',
    },

    outerSurfaceArea: {
      expression: '1.09 * (ID + 2*t)^2 + pi * (ID + 2*t) * SF',
      variables: ['ID', 't', 'SF'],
      unit: 'mm²',
      description: 'Outer surface area (approximation)',
    },

    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'ID + 2*t + 2*SF + 100',
        variables: ['ID', 't', 'SF'],
        unit: 'mm',
        description: 'Blank diameter for forming',
      },
      blankThickness: 't',
      description: 'Circular blank for forming',
    },

    customFormulas: [
      {
        name: 'height',
        label: 'Crown Height',
        formula: {
          expression: 'ID/4',
          variables: ['ID'],
          unit: 'mm',
          description: '2:1 ellipsoidal crown height',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'totalHeight',
        label: 'Total Height',
        formula: {
          expression: 'ID/4 + SF',
          variables: ['ID', 'SF'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'internalVolume',
        label: 'Internal Volume',
        formula: {
          expression: 'pi * (ID/2)^2 * (ID/4) / 1000000 + pi * (ID/2)^2 * SF / 1000000',
          variables: ['ID', 'SF'],
          unit: 'liters',
        },
        displayInResults: true,
        order: 3,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 60,
    surfaceTreatmentCostPerSqm: 200,
  },

  tags: ['head', 'ellipsoidal', '2:1', 'closure', 'asme'],
  isStandard: true,
  isActive: true,
  usageCount: 0,
};

/**
 * 5. Torispherical Head (ASME F&D)
 * ASME UG-32(e) compliant torispherical head (Flanged & Dished)
 */
export const torisphericialHead: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Torispherical Head (F&D)',
  description:
    'ASME Section VIII Division 1 compliant torispherical (Flanged & Dished) head (UG-32(e)). Cost-effective alternative to ellipsoidal heads.',
  category: ShapeCategory.HEAD_TORISPHERICAL,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'SEC-VIII-DIV1-UG32E',
    title: 'Torispherical Heads (Flanged & Dished)',
    revision: '2021',
  },

  parameters: [
    {
      name: 'ID',
      label: 'Inside Diameter',
      description: 'Inside diameter of the head',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 100,
      maxValue: 10000,
      order: 1,
      required: true,
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'crownRadius', 'knuckleRadius'],
    },
    {
      name: 't',
      label: 'Wall Thickness',
      description: 'Head wall thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 12,
      minValue: 3,
      maxValue: 200,
      order: 2,
      required: true,
      usedInFormulas: ['volume', 'weight', 'outerSurfaceArea'],
    },
    {
      name: 'SF',
      label: 'Straight Flange',
      description: 'Straight flange length',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 50,
      minValue: 25,
      maxValue: 300,
      order: 3,
      required: false,
      usedInFormulas: ['height', 'volume', 'weight'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    // Simplified volume calculation (accurate formula is complex)
    volume: {
      expression:
        '(pi/24) * (ID + 2*t)^2 * (2*(ID + 2*t) + 3*0.06*(ID + 2*t)) - (pi/24) * ID^2 * (2*ID + 3*0.06*ID) + pi * ((ID/2 + t)^2 - (ID/2)^2) * SF',
      variables: ['ID', 't', 'SF'],
      unit: 'mm³',
      description: 'F&D head material volume (approximation)',
    },

    weight: {
      expression:
        '((pi/24) * (ID + 2*t)^2 * (2*(ID + 2*t) + 3*0.06*(ID + 2*t)) - (pi/24) * ID^2 * (2*ID + 3*0.06*ID) + pi * ((ID/2 + t)^2 - (ID/2)^2) * SF) * density / 1000000',
      variables: ['ID', 't', 'SF'],
      unit: 'kg',
      description: 'F&D head weight',
      requiresDensity: true,
    },

    innerSurfaceArea: {
      expression: '1.08 * ID^2 + pi * ID * SF',
      variables: ['ID', 'SF'],
      unit: 'mm²',
      description: 'Inner surface area (approximation)',
    },

    outerSurfaceArea: {
      expression: '1.08 * (ID + 2*t)^2 + pi * (ID + 2*t) * SF',
      variables: ['ID', 't', 'SF'],
      unit: 'mm²',
      description: 'Outer surface area (approximation)',
    },

    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'ID + 2*t + 2*SF + 100',
        variables: ['ID', 't', 'SF'],
        unit: 'mm',
        description: 'Blank diameter for forming',
      },
      blankThickness: 't',
      description: 'Circular blank for forming',
    },

    customFormulas: [
      {
        name: 'crownRadius',
        label: 'Crown Radius',
        formula: {
          expression: 'ID',
          variables: ['ID'],
          unit: 'mm',
          description: 'Standard F&D crown radius = ID',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'knuckleRadius',
        label: 'Knuckle Radius',
        formula: {
          expression: '0.06 * ID',
          variables: ['ID'],
          unit: 'mm',
          description: 'Standard F&D knuckle radius = 6% of ID',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'crownHeight',
        label: 'Crown Height',
        formula: {
          expression: '0.169 * ID',
          variables: ['ID'],
          unit: 'mm',
          description: 'Approximate crown height',
        },
        displayInResults: true,
        order: 3,
      },
      {
        name: 'totalHeight',
        label: 'Total Height',
        formula: {
          expression: '0.169 * ID + SF',
          variables: ['ID', 'SF'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 4,
      },
      {
        name: 'internalVolume',
        label: 'Internal Volume',
        formula: {
          expression:
            '(pi/24) * ID^2 * (2*ID + 3*0.06*ID) / 1000000 + pi * (ID/2)^2 * SF / 1000000',
          variables: ['ID', 'SF'],
          unit: 'liters',
        },
        displayInResults: true,
        order: 5,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 60,
    surfaceTreatmentCostPerSqm: 180,
  },

  tags: ['head', 'torispherical', 'f&d', 'flanged', 'dished', 'asme'],
  isStandard: true,
  isActive: true,
  usageCount: 0,
};

/**
 * 6. Flat Head
 * ASME UG-34 compliant flat head/cover
 */
export const flatHead: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Flat Head',
  description:
    'ASME Section VIII Division 1 compliant flat head or cover plate (UG-34). Used for low-pressure applications or reinforced with stays.',
  category: ShapeCategory.HEAD_FLAT,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'SEC-VIII-DIV1-UG34',
    title: 'Unstayed Flat Heads and Covers',
    revision: '2021',
  },

  parameters: [
    {
      name: 'D',
      label: 'Diameter',
      description: 'Diameter of the flat head (bolt circle or gasket seating diameter)',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 100,
      maxValue: 5000,
      order: 1,
      required: true,
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'area'],
    },
    {
      name: 't',
      label: 'Thickness',
      description: 'Head thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 25,
      minValue: 6,
      maxValue: 300,
      order: 2,
      required: true,
      helpText: 'Flat heads require substantial thickness for strength',
      usedInFormulas: ['volume', 'weight'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    volume: {
      expression: 'pi * (D/2)^2 * t',
      variables: ['D', 't'],
      unit: 'mm³',
      description: 'Flat head volume',
    },

    weight: {
      expression: 'pi * (D/2)^2 * t * density / 1000000',
      variables: ['D', 't'],
      unit: 'kg',
      description: 'Flat head weight',
      requiresDensity: true,
    },

    surfaceArea: {
      expression: '2 * pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'Total surface area (both faces)',
    },

    outerSurfaceArea: {
      expression: 'pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'One face area',
    },

    innerSurfaceArea: {
      expression: 'pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'One face area',
    },

    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'D + 50',
        variables: ['D'],
        unit: 'mm',
        description: 'Blank diameter with cutting allowance',
      },
      blankThickness: 't',
      description: 'Circular blank cut from plate',
    },

    customFormulas: [
      {
        name: 'area',
        label: 'Area',
        formula: {
          expression: 'pi * (D/2)^2',
          variables: ['D'],
          unit: 'mm²',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'circumference',
        label: 'Circumference',
        formula: {
          expression: 'pi * D',
          variables: ['D'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 2,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 50,
    surfaceTreatmentCostPerSqm: 150,
  },

  tags: ['head', 'flat', 'cover', 'closure', 'asme'],
  isStandard: true,
  isActive: true,
  usageCount: 0,

  validationRules: [
    {
      field: 't',
      rule: 'FLAT_HEAD_THICKNESS',
      errorMessage:
        'Flat heads require substantial thickness - verify thickness calculation per ASME UG-34',
      severity: 'warning',
    },
  ],
};

/**
 * 7. Conical Head
 * ASME UG-32 compliant conical head/closure
 */
export const conicalHead: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Conical Head',
  description:
    'ASME Section VIII Division 1 compliant conical head closure (UG-32). Used for cone-bottom tanks and hoppers.',
  category: ShapeCategory.HEAD_CONICAL,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'SEC-VIII-DIV1-UG32',
    title: 'Conical Heads',
    revision: '2021',
  },

  parameters: [
    {
      name: 'D',
      label: 'Base Diameter',
      description: 'Base diameter of the conical head',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 100,
      maxValue: 10000,
      order: 1,
      required: true,
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'slantHeight'],
    },
    {
      name: 't',
      label: 'Wall Thickness',
      description: 'Head wall thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 12,
      minValue: 3,
      maxValue: 200,
      order: 2,
      required: true,
      usedInFormulas: ['volume', 'weight', 'outerSurfaceArea'],
    },
    {
      name: 'H',
      label: 'Height',
      description: 'Vertical height of the cone',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 500,
      minValue: 50,
      maxValue: 10000,
      order: 3,
      required: true,
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'slantHeight', 'coneAngle'],
    },
    {
      name: 'SF',
      label: 'Straight Flange',
      description: 'Straight flange length at base',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 50,
      minValue: 0,
      maxValue: 300,
      order: 4,
      required: false,
      usedInFormulas: ['volume', 'weight', 'totalHeight'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    volume: {
      expression:
        '(pi/3) * H * ((D/2 + t)^2 + (D/2 + t)*t + t^2) + pi * ((D/2 + t)^2 - (D/2)^2) * SF',
      variables: ['D', 't', 'H', 'SF'],
      unit: 'mm³',
      description: 'Conical head material volume',
    },

    weight: {
      expression:
        '((pi/3) * H * ((D/2 + t)^2 + (D/2 + t)*t + t^2) + pi * ((D/2 + t)^2 - (D/2)^2) * SF) * density / 1000000',
      variables: ['D', 't', 'H', 'SF'],
      unit: 'kg',
      description: 'Conical head weight',
      requiresDensity: true,
    },

    innerSurfaceArea: {
      expression: 'pi * (D/2) * sqrt(H^2 + (D/2)^2) + pi * D * SF',
      variables: ['D', 'H', 'SF'],
      unit: 'mm²',
      description: 'Inner surface area',
    },

    outerSurfaceArea: {
      expression: 'pi * (D/2 + t) * sqrt(H^2 + (D/2)^2) + pi * (D + 2*t) * SF',
      variables: ['D', 't', 'H', 'SF'],
      unit: 'mm²',
      description: 'Outer surface area',
    },

    customFormulas: [
      {
        name: 'slantHeight',
        label: 'Slant Height',
        formula: {
          expression: 'sqrt(H^2 + (D/2)^2)',
          variables: ['D', 'H'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'coneAngle',
        label: 'Cone Half-Angle',
        formula: {
          expression: 'atan((D/2)/H) * 180 / pi',
          variables: ['D', 'H'],
          unit: 'degrees',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'totalHeight',
        label: 'Total Height',
        formula: {
          expression: 'H + SF',
          variables: ['H', 'SF'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 3,
      },
      {
        name: 'internalVolume',
        label: 'Internal Volume',
        formula: {
          expression: '(pi/3) * (D/2)^2 * H / 1000000 + pi * (D/2)^2 * SF / 1000000',
          variables: ['D', 'H', 'SF'],
          unit: 'liters',
        },
        displayInResults: true,
        order: 4,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 70,
    weldingCostPerMeter: 180,
    surfaceTreatmentCostPerSqm: 180,
  },

  tags: ['head', 'cone', 'conical', 'closure', 'asme', 'hopper'],
  isStandard: true,
  isActive: true,
  usageCount: 0,

  validationRules: [
    {
      field: 'coneAngle',
      rule: 'CONE_ANGLE_ASME',
      errorMessage: 'Cone half-angle > 30° may require special considerations per ASME UG-32',
      severity: 'warning',
    },
  ],
};

/**
 * Export all head shapes
 */
export const pressureVesselHeadShapes = [
  ellipsoidalHead,
  torisphericialHead,
  flatHead,
  conicalHead,
];
