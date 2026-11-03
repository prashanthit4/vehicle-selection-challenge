import type { VehicleCatalog, VehicleSelection } from '@vehicle/shared/types';

export const QUICK_SELECT_SEPARATOR = '-';

/**
 * Resolves one "make-model-badge" entry against the catalog, case-insensitively, returning the
 * catalog's own spelling. Each part is matched as a known prefix rather than by splitting on
 * the separator, so model and badge names may themselves contain "-".
 */
export function resolveQuickSelect(entry: string, catalog: VehicleCatalog): VehicleSelection | null {
  const target = entry.trim().toLowerCase();

  for (const [make, models] of Object.entries(catalog)) {
    const makePrefix = `${make}${QUICK_SELECT_SEPARATOR}`.toLowerCase();
    if (!target.startsWith(makePrefix)) continue;
    const afterMake = target.slice(makePrefix.length);

    for (const [model, badges] of Object.entries(models)) {
      const modelPrefix = `${model}${QUICK_SELECT_SEPARATOR}`.toLowerCase();
      if (!afterMake.startsWith(modelPrefix)) continue;
      const badgePart = afterMake.slice(modelPrefix.length);

      const badge = badges.find((b) => b.toLowerCase() === badgePart);
      if (badge) return { make, model, badge };
    }
  }
  return null;
}

/**
 * Parses VITE_QUICK_SELECTS: a JSON array of "make-model-badge" strings, e.g.
 * ["tesla-Model 3-Performance","bmw-130d-xDrive 26d"]. Entries that don't match the catalog,
 * and duplicates, are skipped with a console warning. Unset or malformed → no quick selects.
 */
export function parseQuickSelects(envValue: string | undefined, catalog: VehicleCatalog): VehicleSelection[] {
  if (!envValue?.trim()) return [];

  let entries: unknown;
  try {
    entries = JSON.parse(envValue);
  } catch {
    console.warn('VITE_QUICK_SELECTS is not valid JSON; expected an array of "make-model-badge" strings.');
    return [];
  }
  if (!Array.isArray(entries)) {
    console.warn('VITE_QUICK_SELECTS must be a JSON array of "make-model-badge" strings.');
    return [];
  }

  const selections: VehicleSelection[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const selection = typeof entry === 'string' ? resolveQuickSelect(entry, catalog) : null;
    if (!selection) {
      console.warn(`Ignoring quick select ${JSON.stringify(entry)}: no matching make-model-badge in the catalog.`);
      continue;
    }
    const key = [selection.make, selection.model, selection.badge].join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    selections.push(selection);
  }
  return selections;
}
