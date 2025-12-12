import { getSaturationTemperature, mbarAbsToBar } from '@vapour/constants';

/**
 * Calculate spray zone height from diameter and spray angle
 */
export function calculateSprayZoneHeight(diameter: number, angle: number): number {
  const radiusMM = diameter / 2;
  const halfAngleRad = (angle / 2) * (Math.PI / 180);
  return Math.round(radiusMM / Math.tan(halfAngleRad));
}

/**
 * Calculate sonic velocity and maximum recommended vapor velocity
 * For saturated steam, sonic velocity ≈ √(γRT) where:
 * - γ (gamma) ≈ 1.3 for steam
 * - R = 461.5 J/(kg·K) for steam
 * - T = temperature in Kelvin
 *
 * Maximum practical velocity is ~0.3-0.5 of sonic to avoid entrainment
 */
export function calculateMaxVaporVelocity(operatingPressureMbar: number): {
  saturationTemp: number;
  sonicVelocity: number;
  maxRecommendedVelocity: number;
} {
  // Guard against invalid pressure values during user typing
  // Steam tables have minimum pressure of ~6.1 mbar (triple point)
  // Values below 10 mbar are likely incomplete user input
  if (operatingPressureMbar < 10) {
    return {
      saturationTemp: 0,
      sonicVelocity: 0,
      maxRecommendedVelocity: 0,
    };
  }

  const pressureBar = mbarAbsToBar(operatingPressureMbar);
  const satTempC = getSaturationTemperature(pressureBar);
  const satTempK = satTempC + 273.15;

  // Steam properties
  const gamma = 1.3; // Ratio of specific heats for steam
  const R_steam = 461.5; // J/(kg·K)

  // Sonic velocity for ideal gas approximation
  const sonicVelocity = Math.sqrt(gamma * R_steam * satTempK);

  // Maximum recommended velocity (35% of sonic - conservative)
  const maxRecommendedVelocity = sonicVelocity * 0.35;

  return {
    saturationTemp: satTempC,
    sonicVelocity,
    maxRecommendedVelocity,
  };
}
