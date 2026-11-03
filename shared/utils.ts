// Catalog keys are lowercase ("ford", "bmw"); this gives the display label.
const MAKE_LABELS: Record<string, string> = { bmw: 'BMW' };

export const formatMake = (make: string): string =>
  MAKE_LABELS[make] ?? make.charAt(0).toUpperCase() + make.slice(1);

/** Max logbook size, enforced by both the upload input and the API. */
export const MAX_LOGBOOK_BYTES = 1024 * 1024; // 1 MB
