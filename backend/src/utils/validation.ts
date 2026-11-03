import {
  hasAllowedExtension,
  hasAllowedMimeType,
  LOGBOOK_REQUIRED_MESSAGE,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
} from '@vehicle/shared/constants';
import type { VehicleCatalog, VehicleSubmission } from '@vehicle/shared/types';
import catalogJson from '@vehicle/shared/vehicleData.json';
import { MAX_LOGBOOK_BYTES } from '../config';

const catalog: VehicleCatalog = catalogJson;

export type ValidationResult = { ok: true; value: VehicleSubmission } | { ok: false; error: string };

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function validateSubmission(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be an object.' };
  }
  const { make, model, badge, logbookText, logbookFileName, logbookMimeType } = body as Record<
    string,
    unknown
  >;

  if (!isNonEmptyString(make) || !isNonEmptyString(model) || !isNonEmptyString(badge)) {
    return { ok: false, error: 'make, model and badge are required strings.' };
  }
  if (!isNonEmptyString(logbookText)) {
    return { ok: false, error: LOGBOOK_REQUIRED_MESSAGE };
  }
  if (
    typeof logbookFileName !== 'string' ||
    !hasAllowedExtension(logbookFileName) ||
    typeof logbookMimeType !== 'string' ||
    !hasAllowedMimeType(logbookMimeType)
  ) {
    return { ok: false, error: LOGBOOK_TYPE_MESSAGE };
  }
  if (Buffer.byteLength(logbookText, 'utf8') > MAX_LOGBOOK_BYTES) {
    return { ok: false, error: logbookTooLargeMessage(MAX_LOGBOOK_BYTES) };
  }

  // Reject combinations that don't exist in the catalog.
  const badges = catalog[make]?.[model];
  if (!badges || !badges.includes(badge)) {
    return { ok: false, error: `Unknown vehicle: ${make} ${model} ${badge}.` };
  }

  return { ok: true, value: { make, model, badge, logbookText, logbookFileName, logbookMimeType } };
}
