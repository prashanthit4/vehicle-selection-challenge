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

/** The uploaded file, independent of Express/Multer so validation stays pure. */
export interface LogbookUpload {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

export interface SubmissionInput {
  make?: unknown;
  model?: unknown;
  badge?: unknown;
  logbook?: LogbookUpload;
}

export type ValidationResult = { ok: true; value: VehicleSubmission } | { ok: false; error: string };

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** The file's text, or null if it isn't valid UTF-8 text (e.g. a binary renamed to .txt). */
function decodeText(content: Buffer): string | null {
  try {
    const text = utf8.decode(content);
    return text.includes('\u0000') ? null : text;
  } catch {
    return null;
  }
}

export function validateSubmission({ make, model, badge, logbook }: SubmissionInput): ValidationResult {
  if (!isNonEmptyString(make) || !isNonEmptyString(model) || !isNonEmptyString(badge)) {
    return { ok: false, error: 'make, model and badge are required strings.' };
  }
  if (!logbook) {
    return { ok: false, error: LOGBOOK_REQUIRED_MESSAGE };
  }
  if (!hasAllowedExtension(logbook.fileName) || !hasAllowedMimeType(logbook.mimeType)) {
    return { ok: false, error: LOGBOOK_TYPE_MESSAGE };
  }
  if (logbook.content.byteLength > MAX_LOGBOOK_BYTES) {
    return { ok: false, error: logbookTooLargeMessage(MAX_LOGBOOK_BYTES) };
  }

  const logbookText = decodeText(logbook.content);
  if (logbookText === null) {
    return { ok: false, error: LOGBOOK_TYPE_MESSAGE };
  }
  if (logbookText.trim() === '') {
    return { ok: false, error: LOGBOOK_REQUIRED_MESSAGE };
  }

  // Reject combinations that don't exist in the catalog.
  const badges = catalog[make]?.[model];
  if (!badges || !badges.includes(badge)) {
    return { ok: false, error: `Unknown vehicle: ${make} ${model} ${badge}.` };
  }

  return { ok: true, value: { make, model, badge, logbookText } };
}
