import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { VehicleCatalog, VehicleSelection, VehicleSubmission } from '@vehicle/shared/types';
import { formatMake, MAX_LOGBOOK_BYTES } from '@vehicle/shared/utils';
import catalogJson from '@vehicle/shared/vehicleData.json';
import DropdownSelector, { type DropdownSelectorProps } from './DropdownSelector';

const catalog: VehicleCatalog = catalogJson;

// Empty when unset → same-origin POST to /upload.
const API_URL = import.meta.env.VITE_API_URL ?? '';
const UPLOAD_URL = `${API_URL}/upload`;

const QUICK_SELECTS: VehicleSelection[] = [
  { make: 'tesla', model: 'Model 3', badge: 'Performance' },
  { make: 'bmw', model: '130d', badge: 'xDrive 26d' },
];

const toOptions = (values: string[], format: (v: string) => string = (v) => v) =>
  values.map((value) => ({ value, label: format(value) }));

// Every user-facing error is shown as a native popup.
const showError = (message: string) => window.alert(message);

export default function VehicleForm() {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [badge, setBadge] = useState('');
  const [logbookText, setLogbookText] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options are derived from the current selection, so they're always in sync.
  const makes = Object.keys(catalog);
  const models = make ? Object.keys(catalog[make] ?? {}) : [];
  const badges = make && model ? (catalog[make]?.[model] ?? []) : [];

  const clearLogbook = () => {
    setLogbookText('');
    setReadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      clearLogbook();
      return;
    }

    if (!file.name.toLowerCase().endsWith('.txt')) {
      clearLogbook();
      showError('Logbook should be txt file');
      return;
    }
    if (file.size > MAX_LOGBOOK_BYTES) {
      clearLogbook();
      showError('Logbook must be 1 MB or smaller.');
      return;
    }

    // Submit stays disabled until the read finishes, so a half-read file is never sent.
    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLogbookText(typeof reader.result === 'string' ? reader.result : '');
      setReadingFile(false);
      };
    reader.onerror = () => {
      clearLogbook();
      showError('Could not read the logbook file.');
    };
    reader.readAsText(file);
  };

  // Client-side checks only. When they pass, the browser does a normal form POST to
  // UPLOAD_URL and navigates to the page the backend renders.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!make || !model || !badge) {
      e.preventDefault();
      return;
    }
    if (logbookText.trim() === '') {
      e.preventDefault();
      showError('Please upload logbook');
    }
  };

  // What the hidden fields below post. Typed so it stays in step with the backend contract.
  const submission: VehicleSubmission = { make, model, badge, logbookText };

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
    <form className="vehicle-form" method="post" action={UPLOAD_URL} onSubmit={handleSubmit}>
      {/* The visible controls are unnamed; only these fields are posted. The logbook goes as
          text (read via FileReader), so the backend needs no multipart parsing. */}
      <input type="hidden" name="make" value={submission.make} />
      <input type="hidden" name="model" value={submission.model} />
      <input type="hidden" name="badge" value={submission.badge} />
      <textarea name="logbookText" value={submission.logbookText} readOnly hidden />

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
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileChange}
          />
        </div>
      )}

      <button type="submit" disabled={!badge || readingFile}>
        Submit
      </button>
      <section className="quick-select" aria-labelledby="quick-select-heading">
        <h2 id="quick-select-heading">Select a Vehicle</h2>
        {QUICK_SELECTS.map((preset) => (
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
    </form>
  );
}
