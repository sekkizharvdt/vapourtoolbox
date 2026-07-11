/**
 * Shape Data Service Tests
 *
 * Tests run against the REAL shape dataset (no mock of @/data/shapes) —
 * ids and shapeCodes are hand-written and permanent, so asserting on the
 * real data is the point: BOM items persist `shapeId` forever.
 */

import { ShapeCategory } from '@vapour/types';
import { allShapes } from '@/data/shapes';

// Mock firebase/firestore (Timestamp.now needs no app, but keep it deterministic)
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

  describe('stable hand-written identity (permanent invariants)', () => {
    it('has exactly 20 shapes', () => {
      expect(allShapes).toHaveLength(20);
    });

    it('every id is unique', () => {
      const ids = allShapes.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every shapeCode is unique', () => {
      const codes = allShapes.map((s) => s.shapeCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('every id is a kebab-case slug', () => {
      allShapes.forEach((shape) => {
        expect(shape.id).toMatch(/^[a-z0-9-]+$/);
      });
    });

    it('every shapeCode is SHP- + upper-snake of the id', () => {
      allShapes.forEach((shape) => {
        expect(shape.shapeCode).toBe(`SHP-${shape.id.toUpperCase().replace(/-/g, '_')}`);
      });
    });

    it('pins the full id list — a failure here means an id was renamed, which BREAKS persisted BOM items', () => {
      expect(allShapes.map((s) => s.id).sort()).toEqual(
        [
          'head-conical',
          'head-ellipsoidal',
          'head-flat',
          'head-hemispherical',
          'head-torispherical',
          'hx-baffle',
          'hx-tube-bundle',
          'hx-tube-sheet',
          'hx-tube-support',
          'manway-assembly',
          'nozzle-custom-circular',
          'nozzle-custom-rectangular',
          'nozzle-standard',
          'plate-circular',
          'plate-custom',
          'plate-rectangular',
          'reinforcement-pad',
          'shell-cylindrical',
          'shell-conical',
          'tube-straight',
        ].sort()
      );
    });
  });

  describe('getShapesByCategory', () => {
    it('should return the 3 plate shapes', () => {
      const shapes = getShapesByCategory('plates');
      expect(shapes.map((s) => s.id).sort()).toEqual([
        'plate-circular',
        'plate-custom',
        'plate-rectangular',
      ]);
    });

    it('should return the tube shape', () => {
      const shapes = getShapesByCategory('tubes');
      expect(shapes.map((s) => s.id)).toEqual(['tube-straight']);
    });

    it('should return the 7 vessel shapes (2 shells + 5 heads)', () => {
      const shapes = getShapesByCategory('vessels');
      expect(shapes.map((s) => s.id).sort()).toEqual([
        'head-conical',
        'head-ellipsoidal',
        'head-flat',
        'head-hemispherical',
        'head-torispherical',
        'shell-conical',
        'shell-cylindrical',
      ]);
    });

    it('should return the 4 heat-exchanger shapes', () => {
      const shapes = getShapesByCategory('heatExchangers');
      expect(shapes.map((s) => s.id).sort()).toEqual([
        'hx-baffle',
        'hx-tube-bundle',
        'hx-tube-sheet',
        'hx-tube-support',
      ]);
    });

    it('should return the 5 nozzle shapes', () => {
      const shapes = getShapesByCategory('nozzles');
      expect(shapes.map((s) => s.id).sort()).toEqual([
        'manway-assembly',
        'nozzle-custom-circular',
        'nozzle-custom-rectangular',
        'nozzle-standard',
        'reinforcement-pad',
      ]);
    });

    it('should return empty array for invalid category', () => {
      expect(getShapesByCategory('invalid-category')).toHaveLength(0);
    });

    it('should stamp audit metadata on each shape', () => {
      const shapes = getShapesByCategory('plates');
      shapes.forEach((shape) => {
        expect(shape.createdAt).toEqual(mockTimestamp);
        expect(shape.updatedAt).toEqual(mockTimestamp);
        expect(shape.createdBy).toBe('system');
        expect(shape.updatedBy).toBe('system');
      });
    });
  });

  describe('getAllShapes', () => {
    it('should return all 20 shapes with their hand-written ids intact', () => {
      const shapes = getAllShapes();
      expect(shapes).toHaveLength(20);
      shapes.forEach((shape, i) => {
        expect(shape.id).toBe(allShapes[i]!.id);
        expect(shape.shapeCode).toBe(allShapes[i]!.shapeCode);
      });
    });

    it('should preserve original shape properties', () => {
      const rectangularPlate = getAllShapes().find((s) => s.id === 'plate-rectangular');
      expect(rectangularPlate).toBeDefined();
      expect(rectangularPlate?.name).toBe('Rectangular Plate');
      expect(rectangularPlate?.category).toBe(ShapeCategory.PLATE_RECTANGULAR);
      expect(rectangularPlate?.parameters.length).toBeGreaterThan(0);
    });
  });

  describe('getShapeById', () => {
    it('should look up every shape by its explicit id', () => {
      allShapes.forEach((def) => {
        const shape = getShapeById(def.id);
        expect(shape).toBeDefined();
        expect(shape?.name).toBe(def.name);
      });
    });

    it('should return undefined for an unknown id', () => {
      expect(getShapeById('invalid-id')).toBeUndefined();
    });

    it('should return undefined for the retired index-based id scheme', () => {
      expect(getShapeById('shape-global-0')).toBeUndefined();
      expect(getShapeById('shape-plates-2')).toBeUndefined();
    });

    it('should stamp audit metadata on the returned shape', () => {
      const shape = getShapeById('plate-rectangular');
      expect(shape?.shapeCode).toBe('SHP-PLATE_RECTANGULAR');
      expect(shape?.createdBy).toBe('system');
      expect(shape?.createdAt).toEqual(mockTimestamp);
    });
  });

  describe('getAvailableCategories', () => {
    it('should return exactly the 5 category IDs', () => {
      expect(getAvailableCategories().sort()).toEqual([
        'heatExchangers',
        'nozzles',
        'plates',
        'tubes',
        'vessels',
      ]);
    });
  });
});
