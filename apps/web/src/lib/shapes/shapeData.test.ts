/**
 * Shape Data Service Tests
 *
 * Tests for shape data retrieval and filtering functions.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { ShapeCategory } from '@vapour/types';

// Mock shape data
const mockShapes = [
  {
    name: 'Rectangular Plate',
    category: ShapeCategory.PLATE_RECTANGULAR,
    parameters: [{ name: 'L', unit: 'mm', type: 'NUMBER', label: 'Length' }],
    formulas: {},
  },
  {
    name: 'Circular Plate',
    category: ShapeCategory.PLATE_CIRCULAR,
    parameters: [{ name: 'D', unit: 'mm', type: 'NUMBER', label: 'Diameter' }],
    formulas: {},
  },
  {
    name: 'Straight Tube',
    category: ShapeCategory.TUBE_STRAIGHT,
    parameters: [{ name: 'L', unit: 'mm', type: 'NUMBER', label: 'Length' }],
    formulas: {},
  },
  {
    name: 'Cylindrical Shell',
    category: ShapeCategory.SHELL_CYLINDRICAL,
    parameters: [{ name: 'D', unit: 'mm', type: 'NUMBER', label: 'Diameter' }],
    formulas: {},
  },
  {
    name: 'Hemispherical Head',
    category: ShapeCategory.HEAD_HEMISPHERICAL,
    parameters: [{ name: 'D', unit: 'mm', type: 'NUMBER', label: 'Diameter' }],
    formulas: {},
  },
  {
    name: 'Tube Bundle',
    category: ShapeCategory.HX_TUBE_BUNDLE,
    parameters: [{ name: 'N', unit: '', type: 'NUMBER', label: 'Number of Tubes' }],
    formulas: {},
  },
  {
    name: 'Nozzle Assembly',
    category: ShapeCategory.NOZZLE_ASSEMBLY,
    parameters: [{ name: 'NPS', unit: '', type: 'SELECT', label: 'Size' }],
    formulas: {},
  },
];

// Mock data/shapes module
jest.mock('@/data/shapes', () => ({
  allShapes: mockShapes,
}));

// Mock firebase/firestore
const mockTimestampNow = jest.fn();
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => mockTimestampNow(),
  },
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Import after mocks
import {
  getShapesByCategory,
  getAllShapes,
  getShapeById,
  getAvailableCategories,
} from './shapeData';

describe('shapeData', () => {
  const mockTimestamp = { seconds: 1703318400, nanoseconds: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
  });

  describe('getShapesByCategory', () => {
    it('should return shapes for plates category', () => {
      const shapes = getShapesByCategory('plates');

      expect(shapes).toHaveLength(2);
      expect(shapes.map((s) => s.name)).toContain('Rectangular Plate');
      expect(shapes.map((s) => s.name)).toContain('Circular Plate');
    });

    it('should return shapes for tubes category', () => {
      const shapes = getShapesByCategory('tubes');

      expect(shapes).toHaveLength(1);
      expect(shapes[0]?.name).toBe('Straight Tube');
    });

    it('should return shapes for vessels category', () => {
      const shapes = getShapesByCategory('vessels');

      expect(shapes).toHaveLength(2);
      expect(shapes.map((s) => s.name)).toContain('Cylindrical Shell');
      expect(shapes.map((s) => s.name)).toContain('Hemispherical Head');
    });

    it('should return shapes for heatExchangers category', () => {
      const shapes = getShapesByCategory('heatExchangers');

      expect(shapes).toHaveLength(1);
      expect(shapes[0]?.name).toBe('Tube Bundle');
    });

    it('should return shapes for nozzles category', () => {
      const shapes = getShapesByCategory('nozzles');

      expect(shapes).toHaveLength(1);
      expect(shapes[0]?.name).toBe('Nozzle Assembly');
    });

    it('should return empty array for invalid category', () => {
      const shapes = getShapesByCategory('invalid-category');

      expect(shapes).toHaveLength(0);
    });

    it('should add metadata to each shape', () => {
      const shapes = getShapesByCategory('plates');

      shapes.forEach((shape) => {
        expect(shape).toHaveProperty('id');
        expect(shape).toHaveProperty('shapeCode');
        expect(shape).toHaveProperty('createdAt');
        expect(shape).toHaveProperty('updatedAt');
        expect(shape).toHaveProperty('createdBy');
        expect(shape).toHaveProperty('updatedBy');
      });
    });

    it('should generate correct ID format', () => {
      const shapes = getShapesByCategory('plates');

      expect(shapes[0]?.id).toBe('shape-plates-0');
      expect(shapes[1]?.id).toBe('shape-plates-1');
    });

    it('should generate correct shape code format', () => {
      const shapes = getShapesByCategory('plates');

      expect(shapes[0]?.shapeCode).toBe('SHP-PLATES-001');
      expect(shapes[1]?.shapeCode).toBe('SHP-PLATES-002');
    });

    it('should set system as creator', () => {
      const shapes = getShapesByCategory('plates');

      shapes.forEach((shape) => {
        expect(shape.createdBy).toBe('system');
        expect(shape.updatedBy).toBe('system');
      });
    });

    it('should set current timestamp', () => {
      const shapes = getShapesByCategory('plates');

      shapes.forEach((shape) => {
        expect(shape.createdAt).toEqual(mockTimestamp);
        expect(shape.updatedAt).toEqual(mockTimestamp);
      });
    });
  });

  describe('getAllShapes', () => {
    it('should return all shapes', () => {
      const shapes = getAllShapes();

      expect(shapes).toHaveLength(mockShapes.length);
    });

    it('should add metadata to all shapes', () => {
      const shapes = getAllShapes();

      shapes.forEach((shape, index) => {
        expect(shape.id).toBe(`shape-global-${index}`);
        expect(shape.shapeCode).toBe(`SHP-GLOBAL-${String(index + 1).padStart(3, '0')}`);
      });
    });

    it('should preserve original shape properties', () => {
      const shapes = getAllShapes();

      const rectangularPlate = shapes.find((s) => s.name === 'Rectangular Plate');
      expect(rectangularPlate).toBeDefined();
      expect(rectangularPlate?.category).toBe(ShapeCategory.PLATE_RECTANGULAR);
      expect(rectangularPlate?.parameters).toHaveLength(1);
    });
  });

  describe('getShapeById', () => {
    it('should return shape when found', () => {
      const shape = getShapeById('shape-global-0');

      expect(shape).toBeDefined();
      expect(shape?.name).toBe('Rectangular Plate');
    });

    it('should return undefined for invalid ID', () => {
      const shape = getShapeById('invalid-id');

      expect(shape).toBeUndefined();
    });

    it('should return undefined for out-of-range index', () => {
      const shape = getShapeById('shape-global-999');

      expect(shape).toBeUndefined();
    });

    it('should add metadata to returned shape', () => {
      const shape = getShapeById('shape-global-0');

      expect(shape?.id).toBe('shape-global-0');
      expect(shape?.shapeCode).toBe('SHP-GLOBAL-001');
      expect(shape?.createdBy).toBe('system');
    });

    it('should return correct shape for each valid index', () => {
      mockShapes.forEach((mockShape, index) => {
        const shape = getShapeById(`shape-global-${index}`);
        expect(shape).toBeDefined();
        expect(shape?.name).toBe(mockShape.name);
      });
    });
  });

  describe('getAvailableCategories', () => {
    it('should return all available category IDs', () => {
      const categories = getAvailableCategories();

      expect(categories).toContain('plates');
      expect(categories).toContain('tubes');
      expect(categories).toContain('vessels');
      expect(categories).toContain('heatExchangers');
      expect(categories).toContain('nozzles');
    });

    it('should return exactly 5 categories', () => {
      const categories = getAvailableCategories();

      expect(categories).toHaveLength(5);
    });

    it('should return consistent category IDs', () => {
      const categories1 = getAvailableCategories();
      const categories2 = getAvailableCategories();

      expect(categories1).toEqual(categories2);
    });
  });

  describe('Metadata Generation', () => {
    it('should generate unique IDs for shapes in same category', () => {
      const shapes = getShapesByCategory('plates');
      const ids = shapes.map((s) => s.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should generate padded shape codes', () => {
      const shapes = getAllShapes();

      // All shape codes should have 3-digit padded numbers
      shapes.forEach((shape) => {
        expect(shape.shapeCode).toMatch(/SHP-[A-Z]+-\d{3}/);
      });
    });

    it('should use category in ID for category-filtered shapes', () => {
      const platesShapes = getShapesByCategory('plates');
      const tubesShapes = getShapesByCategory('tubes');

      platesShapes.forEach((shape) => {
        expect(shape.id).toContain('plates');
      });

      tubesShapes.forEach((shape) => {
        expect(shape.id).toContain('tubes');
      });
    });

    it('should use GLOBAL in ID for getAllShapes', () => {
      const shapes = getAllShapes();

      shapes.forEach((shape) => {
        expect(shape.id).toContain('global');
      });
    });
  });
});
