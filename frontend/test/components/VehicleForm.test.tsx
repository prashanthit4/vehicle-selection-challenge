import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  LOGBOOK_ACCEPT,
  LOGBOOK_FIELD,
  LOGBOOK_REQUIRED_MESSAGE,
  LOGBOOK_TYPE_MESSAGE,
  logbookTooLargeMessage,
} from '@vehicle/shared/constants';
import quickSelectsJson from '@vehicle/shared/quickSelects.json';
import type { VehicleCatalog } from '@vehicle/shared/types';
import catalogJson from '@vehicle/shared/vehicleData.json';
import { MAX_LOGBOOK_BYTES } from '../../src/config';
import VehicleForm from '../../src/components/VehicleForm';

const optionLabels = (select: HTMLElement) =>
  Array.from((select as HTMLSelectElement).options)
    .filter((o) => o.value !== '')
    .map((o) => o.textContent);

type Field = 'Make' | 'Model' | 'Badge';

// Model and Badge only exist once the level above has a value, so look them up lazily.
const field = (name: Field) => screen.getByLabelText(name) as HTMLSelectElement;
const queryField = (name: Field) => screen.queryByLabelText(name);

const logbookInput = () => screen.queryByLabelText('Upload Logbook:') as HTMLInputElement | null;
const submitButton = () => screen.getByRole('button', { name: 'Submit' });

const textFile = (content: string, name = 'logbook.txt') =>
  new File([content], name, { type: 'text/plain' });

interface CapturedSubmit {
  /** True when the form's own handler blocked the browser POST. */
  blocked: boolean;
  /** Exactly the fields the browser would post. */
  fields: Record<string, FormDataEntryValue>;
  action: string;
  method: string;
}

// A real submit navigates, which jsdom can't do. Listening on document runs after React's
// handler (attached at the root), so we see whether it blocked the POST and what would be sent.
function captureSubmits() {
  const submits: CapturedSubmit[] = [];
  const listener = (e: Event) => {
    const form = e.target as HTMLFormElement;
    submits.push({
      blocked: e.defaultPrevented,
      fields: Object.fromEntries(new FormData(form)),
      action: form.action,
      method: form.method,
    });
    e.preventDefault();
  };
  document.addEventListener('submit', listener);
  onTestFinished(() => document.removeEventListener('submit', listener));
  return submits;
}

// All errors are shown with window.alert(); spy on it so tests can read the popup text.
function setup(options: Parameters<typeof userEvent.setup>[0] = {}) {
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  const user = userEvent.setup(options);
  render(<VehicleForm />);
  return { user, alertSpy };
}

async function uploadLogbook(user: ReturnType<typeof userEvent.setup>, content = 'oil change') {
  await user.upload(logbookInput()!, textFile(content));
}

async function selectVehicle(
  user: ReturnType<typeof userEvent.setup>,
  make: string,
  model: string,
  badge: string,
) {
  await user.selectOptions(field('Make'), make);
  await user.selectOptions(field('Model'), model);
  await user.selectOptions(field('Badge'), badge);
}

describe('VehicleForm – drill-down selects', () => {
  it('starts with only the Make dropdown', () => {
    setup();

    expect(optionLabels(field('Make'))).toEqual(['Ford', 'BMW', 'Tesla']);
    expect(queryField('Model')).not.toBeInTheDocument();
    expect(queryField('Badge')).not.toBeInTheDocument();
    expect(logbookInput()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('reveals Model after Make, then Badge after Model, with the right options', async () => {
    const { user } = setup();

    await user.selectOptions(field('Make'), 'ford');
    expect(optionLabels(field('Model'))).toEqual(['Ranger', 'Falcon', 'Falcon Ute']);
    expect(queryField('Badge')).not.toBeInTheDocument();

    await user.selectOptions(field('Model'), 'Ranger');
    expect(optionLabels(field('Badge'))).toEqual(['Raptor', 'Raptor X', 'Wildtrak']);
    expect(logbookInput()).not.toBeInTheDocument();

    await user.selectOptions(field('Badge'), 'Raptor');
    expect(logbookInput()).toBeInTheDocument();
  });

  it('clears model, hides badge and loads new models when Make changes', async () => {
    const { user } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Wildtrak');

    await user.selectOptions(field('Make'), 'tesla');

    expect(field('Model')).toHaveValue('');
    expect(optionLabels(field('Model'))).toEqual(['Model 3']);
    expect(queryField('Badge')).not.toBeInTheDocument();
    expect(logbookInput()).not.toBeInTheDocument();
  });

  it('clears badge and loads new badges when Model changes', async () => {
    const { user } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Wildtrak');

    await user.selectOptions(field('Model'), 'Falcon');

    expect(field('Make')).toHaveValue('ford');
    expect(field('Badge')).toHaveValue('');
    expect(optionLabels(field('Badge'))).toEqual(['XR6', 'XR6 Turbo', 'XR8']);
    expect(logbookInput()).not.toBeInTheDocument();
  });

  it('hides everything below Make when Make is cleared', async () => {
    const { user } = setup();
    await selectVehicle(user, 'bmw', '240i', 'xDrive 50d');

    await user.selectOptions(field('Make'), '');

    expect(queryField('Model')).not.toBeInTheDocument();
    expect(queryField('Badge')).not.toBeInTheDocument();
  });

  it('starts fresh when a dropdown is re-revealed', async () => {
    const { user } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await user.selectOptions(field('Make'), '');
    await user.selectOptions(field('Make'), 'ford');

    expect(field('Model')).toHaveValue('');
    expect(queryField('Badge')).not.toBeInTheDocument();
  });
});

describe('VehicleForm – quick select', () => {
  it.each([
    ['Tesla Model 3 Performance', 'tesla', 'Model 3', 'Performance'],
    ['BMW 130d xDrive 26d', 'bmw', '130d', 'xDrive 26d'],
  ])('“%s” pre-fills all three dropdowns', async (label, make, model, badge) => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: label }));

    expect(field('Make')).toHaveValue(make);
    expect(field('Model')).toHaveValue(model);
    expect(field('Badge')).toHaveValue(badge);
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    expect(logbookInput()).toBeInTheDocument();
  });

  it('still clears dependents if Make is changed after a quick select', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await user.selectOptions(field('Make'), 'bmw');

    expect(field('Model')).toHaveValue('');
    expect(queryField('Badge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tesla Model 3 Performance' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('VehicleForm – layout', () => {
  it('only lists quick selects that exist in the catalog, and at least two of them', () => {
    // quickSelects.json uses the catalog's shape; a typo there would give a button that can't fill
    // the dropdowns, so check every make → model → badge against vehicleData.json.
    const catalog: VehicleCatalog = catalogJson;
    const entries = Object.entries(quickSelectsJson as VehicleCatalog).flatMap(([make, models]) =>
      Object.entries(models).flatMap(([model, badges]) => badges.map((badge) => ({ make, model, badge }))),
    );

    expect(entries.length).toBeGreaterThanOrEqual(2); // the brief asks for at least two
    for (const { make, model, badge } of entries) {
      expect(catalog[make]?.[model], `${make} ${model}`).toContain(badge);
    }
  });

  it('builds the quick-select buttons from shared/quickSelects.json by default', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Tesla Model 3 Performance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BMW 130d xDrive 26d' })).toBeInTheDocument();
  });

  it('pre-fills the dropdowns from any configured quick select', async () => {
    const user = userEvent.setup();
    render(<VehicleForm quickSelects={[{ make: 'ford', model: 'Falcon Ute', badge: 'XR6 Turbo' }]} />);

    await user.click(screen.getByRole('button', { name: 'Ford Falcon Ute XR6 Turbo' }));

    expect(field('Make')).toHaveValue('ford');
    expect(field('Model')).toHaveValue('Falcon Ute');
    expect(field('Badge')).toHaveValue('XR6 Turbo');
  });

  it('hides the "Select a Vehicle" section when no quick selects are configured', () => {
    render(<VehicleForm quickSelects={[]} />);

    expect(screen.queryByRole('heading', { name: 'Select a Vehicle' })).not.toBeInTheDocument();
  });

  it('lists the quick-select vehicles under a "Select a Vehicle" heading', () => {
    setup();
    const heading = screen.getByRole('heading', { name: 'Select a Vehicle' });
    const buttons = Array.from(heading.parentElement!.querySelectorAll('button')).map((b) => b.textContent);

    expect(buttons).toEqual(['Tesla Model 3 Performance', 'BMW 130d xDrive 26d', 'Ford Ranger Raptor']);
  });

  it('keeps dropdown labels for screen readers but hides them visually', async () => {
    const { user } = setup();
    await selectVehicle(user, 'ford', 'Falcon Ute', 'XR6');

    for (const name of ['Make', 'Model', 'Badge'] as const) {
      expect(screen.getByText(name, { selector: 'label' })).toHaveClass('visually-hidden');
    }
  });
});

describe('VehicleForm – logbook upload', () => {
  it('accepts a .txt file without a popup', async () => {
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await uploadLogbook(user);

    expect(logbookInput()!.files?.[0]?.name).toBe('logbook.txt');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('configures the file picker from the shared allowed extensions and MIME types', async () => {
    const { user } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    expect(logbookInput()).toHaveAttribute('accept', LOGBOOK_ACCEPT);
    expect(logbookInput()).toHaveAttribute('name', LOGBOOK_FIELD);
  });

  it.each([
    ['logbook.pdf', 'application/pdf'],
    ['logbook.csv', 'text/csv'],
    ['logbook.md', 'text/plain'], // plain-text MIME type, but not a .txt file
    ['logbook', 'text/plain'],
    ['logbook.txt', 'application/pdf'], // right extension, explicitly wrong type
  ])('pops up "Logbook should be txt file" as soon as %s is picked', async (name, type) => {
    // applyAccept: false lets the test bypass the picker filter, like drag-and-drop or "All files" would.
    const { user, alertSpy } = setup({ applyAccept: false });
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(logbookInput()!, new File(['data'], name, { type }));

    expect(alertSpy).toHaveBeenCalledWith(LOGBOOK_TYPE_MESSAGE);
    expect(logbookInput()!.value).toBe('');
  });

  it('accepts an upper-case .TXT extension', async () => {
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(logbookInput()!, textFile('oil change', 'LOGBOOK.TXT'));

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('accepts a .txt file whose type the browser does not know', async () => {
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(logbookInput()!, new File(['oil change'], 'logbook.txt', { type: '' }));

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('discards a valid logbook if an invalid file is picked afterwards', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup({ applyAccept: false });
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await uploadLogbook(user);

    await user.upload(logbookInput()!, new File(['%PDF'], 'logbook.pdf', { type: 'application/pdf' }));
    await user.click(submitButton());

    expect(alertSpy).toHaveBeenLastCalledWith(LOGBOOK_REQUIRED_MESSAGE);
    expect(submits[0].blocked).toBe(true);
  });

  it('pops up an error as soon as a file over the configured limit is picked', async () => {
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(logbookInput()!, textFile('a'.repeat(MAX_LOGBOOK_BYTES + 1)));

    expect(alertSpy).toHaveBeenCalledWith(logbookTooLargeMessage(MAX_LOGBOOK_BYTES));
    expect(logbookInput()!.value).toBe('');
  });

  it('accepts a file exactly at the limit', async () => {
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await uploadLogbook(user, 'a'.repeat(MAX_LOGBOOK_BYTES));

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('drops a picked logbook when the Model changes, so it must be uploaded again', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await uploadLogbook(user, 'old vehicle history');

    await user.selectOptions(field('Model'), 'Falcon');
    await user.selectOptions(field('Badge'), 'XR8');
    expect(logbookInput()!.files).toHaveLength(0);

    await user.click(submitButton());
    expect(alertSpy).toHaveBeenCalledWith(LOGBOOK_REQUIRED_MESSAGE);
    expect(submits[0].blocked).toBe(true);
  });

  it('drops a picked logbook when switching between quick selects', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await uploadLogbook(user);

    await user.click(screen.getByRole('button', { name: 'BMW 130d xDrive 26d' }));

    expect(logbookInput()!.value).toBe('');
  });
});

describe('VehicleForm – submit', () => {
  it('is a native multipart POST form targeting the backend /upload route', () => {
    setup();
    const form = submitButton().closest('form')!;

    expect(form.method).toBe('post');
    expect(form.enctype).toBe('multipart/form-data');
    expect(form.action).toMatch(/\/upload$/); // prefixed with VITE_API_URL when set
  });

  it('lets the browser post make, model, badge and the logbook file when valid', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup();

    await selectVehicle(user, 'bmw', '130d', 'xDrive 26d');
    await uploadLogbook(user, '2020/05/01: Initial Service');
    await user.click(submitButton());

    expect(submits).toHaveLength(1);
    expect(submits[0].blocked).toBe(false);
    expect(submits[0].fields).toMatchObject({ make: 'bmw', model: '130d', badge: 'xDrive 26d' });
    // The file input is part of the post. (jsdom's FormData can't see files set by user-event,
    // so the chosen file itself is asserted on the input.)
    expect(submits[0].fields[LOGBOOK_FIELD]).toBeInstanceOf(File);
    expect(logbookInput()!.files?.[0]?.name).toBe('logbook.txt');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('posts quick-select values the same way', async () => {
    const submits = captureSubmits();
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await uploadLogbook(user);
    await user.click(submitButton());

    expect(submits[0]).toMatchObject({
      blocked: false,
      fields: { make: 'tesla', model: 'Model 3', badge: 'Performance' },
    });
  });

  it('posts only the vehicle fields and the file: no extra text fields', async () => {
    const submits = captureSubmits();
    const { user } = setup();

    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await uploadLogbook(user);
    await user.click(submitButton());

    expect(Object.keys(submits[0].fields).sort()).toEqual(['badge', LOGBOOK_FIELD, 'make', 'model'].sort());
  });

  it('requires a logbook: pops up "Please upload logbook" and blocks the POST', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup();

    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await user.click(submitButton());

    expect(alertSpy).toHaveBeenCalledWith(LOGBOOK_REQUIRED_MESSAGE);
    expect(submits[0].blocked).toBe(true);
  });

  it('accepts an empty (0-byte) .txt file: a logbook can start with no entries', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup();

    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await uploadLogbook(user, '');
    await user.click(submitButton());

    expect(alertSpy).not.toHaveBeenCalled();
    expect(submits[0].blocked).toBe(false);
  });

  it('re-checks the file type on submit, before anything is sent', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup({ applyAccept: false });
    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));

    // Bypass the change handler (as a stale or scripted value would) to prove submit checks too.
    const input = logbookInput()!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['%PDF'], 'logbook.pdf', { type: 'application/pdf' })],
    });
    await user.click(submitButton());

    expect(alertSpy).toHaveBeenCalledWith(LOGBOOK_TYPE_MESSAGE);
    expect(submits[0].blocked).toBe(true);
  });

  it('never shows errors inline on the page', async () => {
    captureSubmits();
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await user.click(submitButton());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(LOGBOOK_REQUIRED_MESSAGE)).not.toBeInTheDocument();
  });
});
