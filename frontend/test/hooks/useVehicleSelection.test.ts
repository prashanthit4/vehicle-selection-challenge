import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { VehicleCatalog } from '@vehicle/shared/types';
import { useVehicleSelection } from '../../src/hooks/useVehicleSelection';

// A small catalog of its own, so these tests pin the rules rather than the real vehicle data.
const catalog: VehicleCatalog = {
  ford: { Ranger: ['Raptor', 'Wildtrak'], Falcon: ['XR6', 'XR8'] },
  tesla: { 'Model 3': ['Performance'] },
};

const setup = () => renderHook(() => useVehicleSelection(catalog));

describe('useVehicleSelection', () => {
  it('starts empty, offering only the makes', () => {
    const { result } = setup();

    expect(result.current.selection).toEqual({ make: '', model: '', badge: '' });
    expect(result.current.options).toEqual({ makes: ['ford', 'tesla'], models: [], badges: [] });
    expect(result.current.isComplete).toBe(false);
  });

  it('derives each level’s options from the level above', () => {
    const { result } = setup();

    act(() => result.current.selectMake('ford'));
    expect(result.current.options.models).toEqual(['Ranger', 'Falcon']);
    expect(result.current.options.badges).toEqual([]);

    act(() => result.current.selectModel('Falcon'));
    expect(result.current.options.badges).toEqual(['XR6', 'XR8']);

    act(() => result.current.selectBadge('XR8'));
    expect(result.current.selection).toEqual({ make: 'ford', model: 'Falcon', badge: 'XR8' });
    expect(result.current.isComplete).toBe(true);
  });

  it('clears model and badge when the make changes', () => {
    const { result } = setup();
    act(() => result.current.selectVehicle({ make: 'ford', model: 'Ranger', badge: 'Raptor' }));

    act(() => result.current.selectMake('tesla'));

    expect(result.current.selection).toEqual({ make: 'tesla', model: '', badge: '' });
    expect(result.current.options.models).toEqual(['Model 3']);
  });

  it('clears the badge, keeping the make, when the model changes', () => {
    const { result } = setup();
    act(() => result.current.selectVehicle({ make: 'ford', model: 'Ranger', badge: 'Raptor' }));

    act(() => result.current.selectModel('Falcon'));

    expect(result.current.selection).toEqual({ make: 'ford', model: 'Falcon', badge: '' });
    expect(result.current.isComplete).toBe(false);
  });

  it('keeps make and model when only the badge changes', () => {
    const { result } = setup();
    act(() => result.current.selectVehicle({ make: 'ford', model: 'Ranger', badge: 'Raptor' }));

    act(() => result.current.selectBadge('Wildtrak'));

    expect(result.current.selection).toEqual({ make: 'ford', model: 'Ranger', badge: 'Wildtrak' });
  });

  it('sets all three at once for a quick select and reports which one is selected', () => {
    const { result } = setup();
    const preset = { make: 'tesla', model: 'Model 3', badge: 'Performance' };

    act(() => result.current.selectVehicle(preset));

    expect(result.current.selection).toEqual(preset);
    expect(result.current.isSelected(preset)).toBe(true);
    expect(result.current.isSelected({ make: 'ford', model: 'Ranger', badge: 'Raptor' })).toBe(false);
  });

  it('offers nothing below an unknown make or model rather than failing', () => {
    const { result } = setup();

    act(() => result.current.selectVehicle({ make: 'holden', model: 'Commodore', badge: 'SS' }));

    expect(result.current.options.models).toEqual([]);
    expect(result.current.options.badges).toEqual([]);
  });
});
