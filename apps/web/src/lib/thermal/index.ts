/**
 * Thermal Desalination Module
 *
 * Services and calculators for thermal desalination equipment design.
 */

// Flash Chamber Calculator
export { calculateFlashChamber, validateFlashChamberInput } from './flashChamberCalculator';

// Pipe Service
export {
  getSchedule40Pipes,
  selectPipeSize,
  selectPipeByVelocity,
  calculateRequiredArea,
  calculateVelocity,
  getPipeByNPS,
  getPipeByDN,
  clearPipeCache,
  SCHEDULE_40_PIPES,
  type PipeVariant,
  type SelectedPipe,
} from './pipeService';
