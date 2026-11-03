import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VehicleCatalog } from '@vehicle/shared/types';
import catalogJson from '@vehicle/shared/vehicleData.json';
import { parseQuickSelects, resolveQuickSelect } from '../../src/utils/quickSelects';

const catalog: VehicleCatalog = catalogJson;

afterEach(() => vi.restoreAllMocks());
const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('resolveQuickSelect', () => {
  it.each([
    ['tesla-Model 3-Performance', { make: 'tesla', model: 'Model 3', badge: 'Performance' }],
    ['bmw-130d-xDrive 26d', { make: 'bmw', model: '130d', badge: 'xDrive 26d' }],
    ['ford-Falcon Ute-XR6 Turbo', { make: 'ford', model: 'Falcon Ute', badge: 'XR6 Turbo' }],
  ])('resolves %j', (entry, expected) => {
    expect(resolveQuickSelect(entry, catalog)).toEqual(expected);
  });

  it('matches case-insensitively and returns the catalog spelling', () => {
    expect(resolveQuickSelect('  BMW-130D-XDRIVE 26D ', catalog)).toEqual({
      make: 'bmw',
      model: '130d',
      badge: 'xDrive 26d',
    });
  });

  it('prefers the full model name over a shorter one it starts with', () => {
    // "Falcon" and "Falcon Ute" share a prefix; XR6 Turbo exists under both, Falcon Ute's is wanted here.
    expect(resolveQuickSelect('ford-Falcon Ute-XR6', catalog)).toEqual({
      make: 'ford',
      model: 'Falcon Ute',
      badge: 'XR6',
    });
    expect(resolveQuickSelect('ford-Falcon-XR8', catalog)).toEqual({ make: 'ford', model: 'Falcon', badge: 'XR8' });
  });

  it('copes with hyphens inside model and badge names', () => {
    const hyphenated: VehicleCatalog = { mazda: { 'CX-5': ['Maxx Sport', 'GT-SP'] } };
    expect(resolveQuickSelect('mazda-CX-5-GT-SP', hyphenated)).toEqual({
      make: 'mazda',
      model: 'CX-5',
      badge: 'GT-SP',
    });
  });

  it.each([
    'holden-Commodore-SS', // unknown make
    'tesla-Ranger-Raptor', // model from another make
    'ford-Ranger-XR8', // badge from another model
    'ford-Ranger', // missing badge
    'ford Ranger Raptor', // wrong separator
    '',
  ])('returns null for %j', (entry) => {
    expect(resolveQuickSelect(entry, catalog)).toBeNull();
  });
});

describe('parseQuickSelects', () => {
  it('builds selections in the given order', () => {
    expect(parseQuickSelects('["bmw-130d-xDrive 26d","ford-Ranger-Raptor"]', catalog)).toEqual([
      { make: 'bmw', model: '130d', badge: 'xDrive 26d' },
      { make: 'ford', model: 'Ranger', badge: 'Raptor' },
    ]);
  });

  it.each([undefined, '', '   '])('returns no quick selects when unset (%j)', (value) => {
    expect(parseQuickSelects(value, catalog)).toEqual([]);
  });

  it.each(['not json', '{"a":1}', '"tesla-Model 3-Performance"'])(
    'returns no quick selects and warns for a non-array value %j',
    (value) => {
      const warn = silenceWarnings();
      expect(parseQuickSelects(value, catalog)).toEqual([]);
      expect(warn).toHaveBeenCalledOnce();
    },
  );

  it('skips entries that are not in the catalog or not strings, keeping the rest', () => {
    const warn = silenceWarnings();
    const result = parseQuickSelects('["holden-Commodore-SS", 42, "tesla-Model 3-Performance"]', catalog);

    expect(result).toEqual([{ make: 'tesla', model: 'Model 3', badge: 'Performance' }]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('holden-Commodore-SS');
  });

  it('drops duplicates, including ones that differ only in case', () => {
    expect(parseQuickSelects('["bmw-130d-xDrive 26d","BMW-130d-xdrive 26d"]', catalog)).toHaveLength(1);
  });
});
