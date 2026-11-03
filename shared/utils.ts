import type { VehicleCatalog, VehicleSelection } from './types';

// Catalog keys are lowercase ("ford", "bmw"); this gives the display label.
const MAKE_LABELS: Record<string, string> = { bmw: 'BMW' };

export const formatMake = (make: string): string =>
  MAKE_LABELS[make] ?? make.charAt(0).toUpperCase() + make.slice(1);

/** Flattens catalog-shaped data (make → model → badges) into one entry per badge, in order. */
export const listVehicles = (catalog: VehicleCatalog): VehicleSelection[] =>
  Object.entries(catalog).flatMap(([make, models]) =>
    Object.entries(models).flatMap(([model, badges]) => badges.map((badge) => ({ make, model, badge }))),
  );
