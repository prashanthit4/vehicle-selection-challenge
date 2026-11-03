import type { VehicleCatalog, VehicleSubmission } from '@vehicle/shared/types';
import { MAX_LOGBOOK_BYTES } from '@vehicle/shared/utils';
import catalogJson from '@vehicle/shared/vehicleData.json';

const catalog: VehicleCatalog = catalogJson;

export type ValidationResult = { ok: true; value: VehicleSubmission } | { ok: false; error: string };

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function validateSubmission(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be an object.' };
  }
  const { make, model, badge, logbookText } = body as Record<string, unknown>;

  if (!isNonEmptyString(make) || !isNonEmptyString(model) || !isNonEmptyString(badge)) {
    return { ok: false, error: 'make, model and badge are required strings.' };
  }
  if (!isNonEmptyString(logbookText)) {
    return { ok: false, error: 'Please upload logbook' };
  }
  if (Buffer.byteLength(logbookText, 'utf8') > MAX_LOGBOOK_BYTES) {
    return { ok: false, error: 'Logbook must be 1 MB or smaller.' };
  }

  // Reject combinations that don't exist in the catalog.
  const badges = catalog[make]?.[model];
  if (!badges || !badges.includes(badge)) {
    return { ok: false, error: `Unknown vehicle: ${make} ${model} ${badge}.` };
  }

  return { ok: true, value: { make, model, badge, logbookText } };
}
