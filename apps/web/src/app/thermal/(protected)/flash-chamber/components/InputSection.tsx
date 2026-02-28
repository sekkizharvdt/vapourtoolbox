/**
 * InputSection
 *
 * This component has been split into smaller, focused subcomponents.
 * See input-section/ directory for implementation:
 * - input-section/index.tsx - Main component with state management
 * - input-section/ProcessInputs.tsx - Water type, mode, pressure, flow rate inputs
 * - input-section/ChamberDesignInputs.tsx - Vessel diameter, retention time, flashing zone, spray angle
 * - input-section/ElevationInputs.tsx - Pump centerline, operating level, BTL gap inputs
 * - input-section/NozzleVelocityInputs.tsx - Inlet, outlet, vapor velocity inputs
 * - input-section/helpers.ts - Calculation helper functions
 */

export { InputSection } from './input-section';
