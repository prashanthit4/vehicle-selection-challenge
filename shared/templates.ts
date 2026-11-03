import type { VehicleSubmission } from './types';

export const RESULT_PAGE_LABELS = {
  make: 'Make',
  model: 'Model',
  badge: 'Badge',
  logbook: 'Logbook',
} as const;

/** Shown in place of the logbook text when the uploaded file is empty or whitespace only. */
export const EMPTY_LOGBOOK_TEXT = 'no entries yet!!';

type ResultPageFields = Pick<VehicleSubmission, 'make' | 'model' | 'badge' | 'logbookText'>;

/**
 * The plain-text page served at /upload:
 *
 *   Make: bmw
 *   Model: 130d
 *   Badge: xDrive 26d
 *
 *   Logbook:
 *
 *   <logbook text, or EMPTY_LOGBOOK_TEXT if it has no content>
 */
export function formatResultPage({ make, model, badge, logbookText }: ResultPageFields): string {
  const labels = RESULT_PAGE_LABELS;
  return [
    `${labels.make}: ${make}`,
    `${labels.model}: ${model}`,
    `${labels.badge}: ${badge}`,
    '',
    `${labels.logbook}:`,
    '',
    logbookText.trim() === '' ? EMPTY_LOGBOOK_TEXT : logbookText,
    '',
  ].join('\n');
}
