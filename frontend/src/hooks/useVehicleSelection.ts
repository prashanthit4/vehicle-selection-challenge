import { useState } from 'react';
import type { VehicleCatalog, VehicleSelection } from '@vehicle/shared/types';

const NO_SELECTION: VehicleSelection = { make: '', model: '', badge: '' };

/**
 * Drill-down Make → Model → Badge state for a catalog.
 *
 * Only the selection is stored; the options for each level are derived from the catalog on every
 * render, so they can't go stale. Choosing a level clears every level below it.
 */
export function useVehicleSelection(catalog: VehicleCatalog) {
  const [selection, setSelection] = useState<VehicleSelection>(NO_SELECTION);
  const { make, model, badge } = selection;

  const options = {
    makes: Object.keys(catalog),
    models: make ? Object.keys(catalog[make] ?? {}) : [],
    badges: make && model ? (catalog[make]?.[model] ?? []) : [],
  };

  return {
    selection,
    options,
    isComplete: Boolean(make && model && badge),

    selectMake: (value: string) => setSelection({ make: value, model: '', badge: '' }),
    selectModel: (value: string) => setSelection((current) => ({ ...current, model: value, badge: '' })),
    selectBadge: (value: string) => setSelection((current) => ({ ...current, badge: value })),

    /** Sets all three at once (a quick select), bypassing the step-by-step clearing. */
    selectVehicle: (vehicle: VehicleSelection) => setSelection(vehicle),

    isSelected: (vehicle: VehicleSelection) =>
      vehicle.make === make && vehicle.model === model && vehicle.badge === badge,
  };
}
