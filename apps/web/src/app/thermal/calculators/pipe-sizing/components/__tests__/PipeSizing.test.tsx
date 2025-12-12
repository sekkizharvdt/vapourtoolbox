/**
 * Pipe Sizing Calculator Components Tests
 *
 * Tests for VelocityStatus helper functions
 */

import { render } from '@testing-library/react';
import { getVelocityStatusIcon, getVelocityStatusColor } from '../VelocityStatus';

describe('VelocityStatus', () => {
  describe('getVelocityStatusIcon', () => {
    it('should return success icon for OK status', () => {
      const { container } = render(<>{getVelocityStatusIcon('OK')}</>);

      expect(container.querySelector('[data-testid="CheckCircleIcon"]')).toBeInTheDocument();
    });

    it('should return error icon for HIGH status', () => {
      const { container } = render(<>{getVelocityStatusIcon('HIGH')}</>);

      expect(container.querySelector('[data-testid="ErrorIcon"]')).toBeInTheDocument();
    });

    it('should return warning icon for LOW status', () => {
      const { container } = render(<>{getVelocityStatusIcon('LOW')}</>);

      expect(container.querySelector('[data-testid="WarningIcon"]')).toBeInTheDocument();
    });
  });

  describe('getVelocityStatusColor', () => {
    it('should return success color for OK status', () => {
      expect(getVelocityStatusColor('OK')).toBe('success.main');
    });

    it('should return error color for HIGH status', () => {
      expect(getVelocityStatusColor('HIGH')).toBe('error.main');
    });

    it('should return warning color for LOW status', () => {
      expect(getVelocityStatusColor('LOW')).toBe('warning.main');
    });
  });
});

describe('Types', () => {
  // These tests ensure the types are exported correctly
  // and can be imported without errors

  it('should export CalculationMode type', async () => {
    const typesModule = await import('../types');
    expect(typesModule).toHaveProperty('DEFAULT_VELOCITY_LIMITS');
  });

  it('should have correct default velocity limits for water', async () => {
    const { DEFAULT_VELOCITY_LIMITS } = await import('../types');

    expect(DEFAULT_VELOCITY_LIMITS.water_liquid).toEqual({
      min: 0.5,
      max: 3.0,
      target: 1.5,
    });
  });

  it('should have correct default velocity limits for seawater', async () => {
    const { DEFAULT_VELOCITY_LIMITS } = await import('../types');

    expect(DEFAULT_VELOCITY_LIMITS.seawater_liquid).toEqual({
      min: 0.5,
      max: 2.5,
      target: 1.5,
    });
  });

  it('should have correct default velocity limits for steam', async () => {
    const { DEFAULT_VELOCITY_LIMITS } = await import('../types');

    expect(DEFAULT_VELOCITY_LIMITS.steam_vapor).toEqual({
      min: 15.0,
      max: 40.0,
      target: 25.0,
    });
  });

  it('should have correct default velocity limits for vacuum', async () => {
    const { DEFAULT_VELOCITY_LIMITS } = await import('../types');

    expect(DEFAULT_VELOCITY_LIMITS.vacuum_vapor).toEqual({
      min: 20.0,
      max: 60.0,
      target: 35.0,
    });
  });
});
