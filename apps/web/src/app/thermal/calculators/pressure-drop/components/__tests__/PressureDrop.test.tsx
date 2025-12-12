/**
 * Pressure Drop Calculator Components Tests
 *
 * Tests for PressureDropInputs and FittingsManager
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { PressureDropInputs } from '../PressureDropInputs';
import { FittingsManager } from '../FittingsManager';
import type { FluidType } from '../types';
import type { FittingCount, FittingType } from '@/lib/thermal';

// Mock the thermal library
jest.mock('@/lib/thermal', () => ({
  SCHEDULE_40_PIPES: [
    { nps: '1', dn: 25, id_mm: 26.6 },
    { nps: '1.5', dn: 40, id_mm: 40.9 },
    { nps: '2', dn: 50, id_mm: 52.5 },
    { nps: '3', dn: 80, id_mm: 77.9 },
    { nps: '4', dn: 100, id_mm: 102.3 },
  ],
  getAvailableFittings: () => [
    { type: 'elbow_90', name: '90° Elbow', kFactor: 0.75 },
    { type: 'elbow_45', name: '45° Elbow', kFactor: 0.35 },
    { type: 'tee_run', name: 'Tee (run)', kFactor: 0.4 },
    { type: 'tee_branch', name: 'Tee (branch)', kFactor: 1.5 },
    { type: 'gate_valve', name: 'Gate Valve', kFactor: 0.2 },
  ],
  FITTING_NAMES: {
    elbow_90: '90° Elbow',
    elbow_45: '45° Elbow',
    tee_run: 'Tee (run)',
    tee_branch: 'Tee (branch)',
    gate_valve: 'Gate Valve',
  },
}));

describe('PressureDropInputs', () => {
  const defaultProps = {
    selectedNPS: '2',
    setSelectedNPS: jest.fn(),
    pipeLength: '100',
    setPipeLength: jest.fn(),
    roughness: '0.045',
    setRoughness: jest.fn(),
    flowRate: '10',
    setFlowRate: jest.fn(),
    fluidType: 'water' as FluidType,
    setFluidType: jest.fn(),
    temperature: '25',
    setTemperature: jest.fn(),
    salinity: '35000',
    setSalinity: jest.fn(),
    customDensity: '1000',
    setCustomDensity: jest.fn(),
    customViscosity: '0.001',
    setCustomViscosity: jest.fn(),
    elevationChange: '0',
    setElevationChange: jest.fn(),
    fluidDensity: 997.05,
    fluidViscosity: 0.00089,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render Input Parameters title', () => {
      render(<PressureDropInputs {...defaultProps} />);

      expect(screen.getByText('Input Parameters')).toBeInTheDocument();
    });

    it('should render pipe size dropdown', () => {
      render(<PressureDropInputs {...defaultProps} />);

      // MUI Select uses combobox role - there are multiple selects
      expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
      // Check label text exists (may appear twice due to MUI implementation)
      expect(screen.getAllByText('Pipe Size').length).toBeGreaterThan(0);
    });

    it('should render all pipe sizes in dropdown', () => {
      render(<PressureDropInputs {...defaultProps} />);

      // Get the first combobox (Pipe Size)
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[0]!);

      expect(screen.getByText(/1" \(DN25\)/)).toBeInTheDocument();
      // Use getAllByText for "2" since it appears in the selected value and dropdown
      expect(screen.getAllByText(/2" \(DN50\)/).length).toBeGreaterThan(0);
      expect(screen.getByText(/4" \(DN100\)/)).toBeInTheDocument();
    });

    it('should render pipe length input', () => {
      render(<PressureDropInputs {...defaultProps} />);

      expect(screen.getByLabelText('Pipe Length')).toBeInTheDocument();
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    });

    it('should render roughness input with helper text', () => {
      render(<PressureDropInputs {...defaultProps} />);

      expect(screen.getByLabelText('Pipe Roughness')).toBeInTheDocument();
      expect(screen.getByText('Commercial steel: 0.045 mm')).toBeInTheDocument();
    });

    it('should render mass flow rate input', () => {
      render(<PressureDropInputs {...defaultProps} />);

      expect(screen.getByLabelText('Mass Flow Rate')).toBeInTheDocument();
    });

    it('should render fluid type dropdown', () => {
      render(<PressureDropInputs {...defaultProps} />);

      // MUI Select - check label text exists (may appear twice due to MUI implementation)
      expect(screen.getAllByText('Fluid Type').length).toBeGreaterThan(0);
    });

    it('should render elevation change input', () => {
      render(<PressureDropInputs {...defaultProps} />);

      expect(screen.getByLabelText('Elevation Change')).toBeInTheDocument();
      expect(screen.getByText('Positive = upward flow')).toBeInTheDocument();
    });

    it('should display calculated fluid properties', () => {
      const { container } = render(<PressureDropInputs {...defaultProps} />);

      // Fluid properties displayed - 997.05 rounds to 997.0 with toFixed(1)
      expect(container.textContent).toContain('997.0 kg/m³');
      expect(container.textContent).toContain('0.890 mPa·s');
    });
  });

  describe('Fluid Type Conditional Fields', () => {
    it('should show temperature for water', () => {
      render(<PressureDropInputs {...defaultProps} fluidType="water" />);

      expect(screen.getByLabelText('Temperature')).toBeInTheDocument();
      expect(screen.queryByLabelText('Salinity')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Fluid Density')).not.toBeInTheDocument();
    });

    it('should show temperature and salinity for seawater', () => {
      render(<PressureDropInputs {...defaultProps} fluidType="seawater" />);

      expect(screen.getByLabelText('Temperature')).toBeInTheDocument();
      expect(screen.getByLabelText('Salinity')).toBeInTheDocument();
      expect(screen.queryByLabelText('Fluid Density')).not.toBeInTheDocument();
    });

    it('should show custom density and viscosity for custom fluid', () => {
      render(<PressureDropInputs {...defaultProps} fluidType="custom" />);

      expect(screen.queryByLabelText('Temperature')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Fluid Density')).toBeInTheDocument();
      expect(screen.getByLabelText('Dynamic Viscosity')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call setSelectedNPS when pipe size changes', () => {
      const setSelectedNPS = jest.fn();
      render(<PressureDropInputs {...defaultProps} setSelectedNPS={setSelectedNPS} />);

      // First combobox is Pipe Size
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[0]!);
      fireEvent.click(screen.getByText(/3" \(DN80\)/));

      expect(setSelectedNPS).toHaveBeenCalledWith('3');
    });

    it('should call setPipeLength when length changes', () => {
      const setPipeLength = jest.fn();
      render(<PressureDropInputs {...defaultProps} setPipeLength={setPipeLength} />);

      fireEvent.change(screen.getByLabelText('Pipe Length'), { target: { value: '150' } });

      expect(setPipeLength).toHaveBeenCalledWith('150');
    });

    it('should call setFlowRate when flow rate changes', () => {
      const setFlowRate = jest.fn();
      render(<PressureDropInputs {...defaultProps} setFlowRate={setFlowRate} />);

      fireEvent.change(screen.getByLabelText('Mass Flow Rate'), { target: { value: '20' } });

      expect(setFlowRate).toHaveBeenCalledWith('20');
    });

    it('should call setFluidType when fluid type changes', () => {
      const setFluidType = jest.fn();
      render(<PressureDropInputs {...defaultProps} setFluidType={setFluidType} />);

      // Second combobox is Fluid Type
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[1]!);
      fireEvent.click(screen.getByText('Seawater'));

      expect(setFluidType).toHaveBeenCalledWith('seawater');
    });

    it('should call setTemperature when temperature changes', () => {
      const setTemperature = jest.fn();
      render(<PressureDropInputs {...defaultProps} setTemperature={setTemperature} />);

      fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '30' } });

      expect(setTemperature).toHaveBeenCalledWith('30');
    });
  });
});

describe('FittingsManager', () => {
  const defaultProps = {
    fittings: [] as FittingCount[],
    setFittings: jest.fn(),
    newFittingType: 'elbow_90' as FittingType,
    setNewFittingType: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render Fittings title', () => {
      render(<FittingsManager {...defaultProps} />);

      expect(screen.getByText('Fittings')).toBeInTheDocument();
    });

    it('should render fitting type dropdown', () => {
      render(<FittingsManager {...defaultProps} />);

      // MUI Select uses combobox role
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render add button', () => {
      render(<FittingsManager {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should show empty state when no fittings', () => {
      render(<FittingsManager {...defaultProps} />);

      expect(screen.getByText('No fittings added')).toBeInTheDocument();
    });
  });

  describe('With Fittings', () => {
    const propsWithFittings = {
      ...defaultProps,
      fittings: [
        { type: 'elbow_90' as FittingType, count: 2 },
        { type: 'gate_valve' as FittingType, count: 1 },
      ],
    };

    it('should render fittings table headers', () => {
      render(<FittingsManager {...propsWithFittings} />);

      expect(screen.getByText('Fitting')).toBeInTheDocument();
      expect(screen.getByText('Count')).toBeInTheDocument();
      expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('should render fitting names', () => {
      render(<FittingsManager {...propsWithFittings} />);

      expect(screen.getByText('90° Elbow')).toBeInTheDocument();
      expect(screen.getByText('Gate Valve')).toBeInTheDocument();
    });

    it('should render fitting counts', () => {
      render(<FittingsManager {...propsWithFittings} />);

      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });

    it('should render K factors', () => {
      render(<FittingsManager {...propsWithFittings} />);

      expect(screen.getByText('0.75')).toBeInTheDocument();
      expect(screen.getByText('0.20')).toBeInTheDocument();
    });

    it('should render delete buttons for each fitting', () => {
      render(<FittingsManager {...propsWithFittings} />);

      // 2 fittings + 1 add button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(3);
    });
  });

  describe('Interactions', () => {
    it('should call setFittings with new fitting when add button is clicked', () => {
      const setFittings = jest.fn();
      render(<FittingsManager {...defaultProps} setFittings={setFittings} />);

      fireEvent.click(screen.getByRole('button'));

      expect(setFittings).toHaveBeenCalledWith([{ type: 'elbow_90', count: 1 }]);
    });

    it('should increment existing fitting count when adding same type', () => {
      const setFittings = jest.fn();
      const propsWithExisting = {
        ...defaultProps,
        fittings: [{ type: 'elbow_90' as FittingType, count: 1 }],
        setFittings,
      };

      render(<FittingsManager {...propsWithExisting} />);

      // Find the add button (not the delete buttons)
      const addButton = screen.getAllByRole('button')[0]!;
      fireEvent.click(addButton);

      expect(setFittings).toHaveBeenCalledWith([{ type: 'elbow_90', count: 2 }]);
    });

    it('should update fitting count when count field changes', () => {
      const setFittings = jest.fn();
      const propsWithFitting = {
        ...defaultProps,
        fittings: [{ type: 'elbow_90' as FittingType, count: 2 }],
        setFittings,
      };

      render(<FittingsManager {...propsWithFitting} />);

      fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '5' } });

      expect(setFittings).toHaveBeenCalledWith([{ type: 'elbow_90', count: 5 }]);
    });

    it('should remove fitting when count is set to 0', () => {
      const setFittings = jest.fn();
      const propsWithFitting = {
        ...defaultProps,
        fittings: [{ type: 'elbow_90' as FittingType, count: 2 }],
        setFittings,
      };

      render(<FittingsManager {...propsWithFitting} />);

      fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '0' } });

      expect(setFittings).toHaveBeenCalledWith([]);
    });

    it('should remove fitting when delete button is clicked', () => {
      const setFittings = jest.fn();
      const propsWithFitting = {
        ...defaultProps,
        fittings: [{ type: 'elbow_90' as FittingType, count: 2 }],
        setFittings,
      };

      render(<FittingsManager {...propsWithFitting} />);

      // Click the delete button (second button after add)
      const deleteButton = screen.getAllByRole('button')[1]!;
      fireEvent.click(deleteButton);

      expect(setFittings).toHaveBeenCalledWith([]);
    });

    it('should call setNewFittingType when dropdown changes', () => {
      const setNewFittingType = jest.fn();
      render(<FittingsManager {...defaultProps} setNewFittingType={setNewFittingType} />);

      fireEvent.mouseDown(screen.getByRole('combobox'));
      fireEvent.click(screen.getByText(/45° Elbow/));

      expect(setNewFittingType).toHaveBeenCalledWith('elbow_45');
    });
  });

  describe('Fitting Options', () => {
    it('should show all available fitting types in dropdown', () => {
      render(<FittingsManager {...defaultProps} />);

      fireEvent.mouseDown(screen.getByRole('combobox'));

      // Check for fitting names (dropdown shows name + K factor separately)
      // Use getAllByText since selected value also appears in the combobox display
      expect(screen.getAllByText(/90° Elbow/).length).toBeGreaterThan(0);
      expect(screen.getByText(/45° Elbow/)).toBeInTheDocument();
      expect(screen.getByText(/Tee \(run\)/)).toBeInTheDocument();
      expect(screen.getByText(/Gate Valve/)).toBeInTheDocument();
    });
  });
});
