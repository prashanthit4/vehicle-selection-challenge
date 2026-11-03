// The only place the frontend reads import.meta.env (Vite inlines these at build time).
import { parseMaxSizeBytes } from '@vehicle/shared/config';
import { UPLOAD_PATH } from '@vehicle/shared/constants';
import type { VehicleCatalog } from '@vehicle/shared/types';
import catalogJson from '@vehicle/shared/vehicleData.json';
import { parseQuickSelects } from './utils/quickSelects';

const catalog: VehicleCatalog = catalogJson;

// Empty VITE_API_URL → same-origin POST.
export const UPLOAD_URL = `${import.meta.env.VITE_API_URL ?? ''}${UPLOAD_PATH}`;

export const MAX_LOGBOOK_BYTES = parseMaxSizeBytes(import.meta.env.VITE_MAX_LOGBOOK_BYTES);

/** "Select a Vehicle" buttons, resolved against the catalog. Empty when unset. */
export const QUICK_SELECTS = parseQuickSelects(import.meta.env.VITE_QUICK_SELECTS, catalog);
