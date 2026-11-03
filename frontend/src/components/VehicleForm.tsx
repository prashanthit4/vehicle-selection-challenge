import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { VehicleCatalog, VehicleSelection } from '@vehicle/shared/types';
import {
  hasAllowedExtension,
  hasAllowedMimeType,
  LOGBOOK_ACCEPT,
  LOGBOOK_FIELD,
  LOGBOOK_REQUIRED_MESSAGE,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
} from '@vehicle/shared/constants';
import { formatMake } from '@vehicle/shared/utils';
import quickSelectsJson from '@vehicle/shared/quickSelects.json';
import catalogJson from '@vehicle/shared/vehicleData.json';
import { MAX_LOGBOOK_BYTES, UPLOAD_URL } from '../config';
import DropdownSelector, { type DropdownSelectorProps } from './DropdownSelector';

const catalog: VehicleCatalog = catalogJson;

// Same make → model → badges shape as the catalog; each badge becomes one button.
const QUICK_SELECTS: VehicleSelection[] = Object.entries(quickSelectsJson as VehicleCatalog).flatMap(
  ([make, models]) =>
    Object.entries(models).flatMap(([model, badges]) => badges.map((badge) => ({ make, model, badge }))),
);

const toOptions = (values: string[], format: (v: string) => string = (v) => v) =>
  values.map((value) => ({ value, label: format(value) }));

// Every user-facing error is shown as a native popup.
const showError = (message: string) => window.alert(message);

/**
 * Checks what the browser knows about a picked file without reading it: presence, type
 * (extension + MIME) and size. Returns the error to show, or null if the file can be sent.
 * An empty file is allowed: a logbook can start blank and have entries added later.
 */
function checkLogbookFile(file: File | undefined): string | null {
  if (!file) return LOGBOOK_REQUIRED_MESSAGE;
  if (!hasAllowedExtension(file.name) || !hasAllowedMimeType(file.type)) return LOGBOOK_TYPE_MESSAGE;
  if (file.size > MAX_LOGBOOK_BYTES) return logbookTooLargeMessage(MAX_LOGBOOK_BYTES);
  return null;
}

interface VehicleFormProps {
  /** "Select a Vehicle" buttons. Defaults to the ones in shared/quickSelects.json. */
  quickSelects?: VehicleSelection[];
}

export default function VehicleForm({ quickSelects = QUICK_SELECTS }: VehicleFormProps) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [badge, setBadge] = useState('');
  // Bumping the key remounts the file input, which is how an <input type="file"> is cleared.
  const [fileInputKey, setFileInputKey] = useState(0);

  // Options are derived from the current selection, so they're always in sync.
  const makes = Object.keys(catalog);
  const models = make ? Object.keys(catalog[make] ?? {}) : [];
  const badges = make && model ? (catalog[make]?.[model] ?? []) : [];

  // The upload input only exists once a Badge is chosen, so it unmounts (and forgets its file)
  // when Make or Model change. A quick select can keep it mounted, so clear it explicitly.
  const clearLogbook = () => setFileInputKey((key) => key + 1);

  const handleMakeChange = (value: string) => {
    setMake(value);
    setModel('');
    setBadge('');
    clearLogbook();
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setBadge('');
    clearLogbook();
  };

  const handleBadgeChange = (value: string) => {
    setBadge(value);
  };

  // Sets all three at once, bypassing the step-by-step resets.
  const applyQuickSelect = (preset: VehicleSelection) => {
    setMake(preset.make);
    setModel(preset.model);
    setBadge(preset.badge);
    clearLogbook();
  };

  // Type and size are checked as soon as a file is picked, so a bad file never sits in the form.
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = checkLogbookFile(file);
    if (error) {
      clearLogbook();
      showError(error);
    }
  };

  // Client-side checks only. When they pass, the browser POSTs the form (including the file) as
  // multipart/form-data to UPLOAD_URL and navigates to the page the backend renders.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!make || !model || !badge) {
      e.preventDefault();
      return;
    }
    const fileInput = e.currentTarget.elements.namedItem(LOGBOOK_FIELD) as HTMLInputElement | null;
    const error = checkLogbookFile(fileInput?.files?.[0]);
    if (error) {
      e.preventDefault();
      showError(error);
    }
  };

  // What the hidden fields below post alongside the file.
  const selection: VehicleSelection = { make, model, badge };

  const isMatch = (p: VehicleSelection) => p.make === make && p.model === model && p.badge === badge;

  // Drill-down: each dropdown only appears once the one above it has a value.
  const dropdowns: (DropdownSelectorProps & { visible: boolean })[] = [
    {
      visible: true,
      id: 'make',
      label: 'Make',
      hideLabel: true,
      placeholder: 'Select a make',
      options: toOptions(makes, formatMake),
      value: make,
      onChange: handleMakeChange,
    },
    {
      id: 'model',
      label: 'Model',
      hideLabel: true,
      placeholder: 'Select a model',
      options: toOptions(models),
      value: model,
      onChange: handleModelChange,
      visible: Boolean(make),
    },
    {
      id: 'badge',
      label: 'Badge',
      hideLabel: true,
      placeholder: 'Select a badge',
      options: toOptions(badges),
      value: badge,
      onChange: handleBadgeChange,
      visible: Boolean(model),
    },
  ];

  return (
    <form
      className="vehicle-form"
      method="post"
      encType="multipart/form-data"
      action={UPLOAD_URL}
      onSubmit={handleSubmit}
    >
      {/* The dropdowns are unnamed; these hidden fields plus the file input are what's posted. */}
      <input type="hidden" name="make" value={selection.make} />
      <input type="hidden" name="model" value={selection.model} />
      <input type="hidden" name="badge" value={selection.badge} />

      {dropdowns
        .filter(({ visible }) => visible)
        .map(({ visible: _visible, ...dropdown }) => (
          <DropdownSelector key={dropdown.id} {...dropdown} />
        ))}

      {badge && (
        <div className="logbook-upload">
          <label htmlFor="logbook">Upload Logbook:</label>
          <input
            id="logbook"
            name={LOGBOOK_FIELD}
            key={fileInputKey}
            type="file"
            accept={LOGBOOK_ACCEPT}
            onChange={handleFileChange}
          />
        </div>
      )}

      <button type="submit" disabled={!badge}>
        Submit
      </button>
      {quickSelects.length > 0 && (
        <section className="quick-select" aria-labelledby="quick-select-heading">
          <h2 id="quick-select-heading">Select a Vehicle</h2>
          {quickSelects.map((preset) => (
            <button
              key={`${preset.make}-${preset.model}-${preset.badge}`}
              type="button"
              onClick={() => applyQuickSelect(preset)}
              aria-pressed={isMatch(preset)}
            >
              {formatMake(preset.make)} {preset.model} {preset.badge}
            </button>
          ))}
        </section>
      )}
    </form>
  );
}
