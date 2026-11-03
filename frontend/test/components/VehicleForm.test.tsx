import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { MAX_LOGBOOK_BYTES } from '@vehicle/shared/utils';
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

// Submit is disabled while FileReader runs, so "enabled again" means the read finished.
const waitForFileRead = () => waitFor(() => expect(submitButton()).toBeEnabled());

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
  await waitForFileRead();
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
  it('lists the quick-select vehicles under a "Select a Vehicle" heading', () => {
    setup();
    const heading = screen.getByRole('heading', { name: 'Select a Vehicle' });
    const buttons = Array.from(heading.parentElement!.querySelectorAll('button')).map((b) => b.textContent);

    expect(buttons).toEqual(['Tesla Model 3 Performance', 'BMW 130d xDrive 26d']);
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

  it('only offers .txt files in the file picker', async () => {
    const { user } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    expect(logbookInput()).toHaveAttribute('accept', '.txt');
  });

  it('keeps Submit disabled until the file has been read', async () => {
    // A FileReader that never finishes, to freeze the "reading" state.
    vi.stubGlobal(
      'FileReader',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsText() {}
      },
    );
    const { user } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    expect(submitButton()).toBeEnabled();

    await user.upload(logbookInput()!, textFile('oil change'));

    expect(submitButton()).toBeDisabled();
  });

  it.each([
    ['logbook.pdf', 'application/pdf'],
    ['logbook.csv', 'text/csv'],
    ['logbook.md', 'text/plain'], // plain-text MIME type, but not a .txt file
    ['logbook', 'text/plain'],
  ])('pops up "Logbook should be txt file" for %s', async (name, type) => {
    // applyAccept: false lets the test bypass the picker filter, like drag-and-drop or "All files" would.
    const { user, alertSpy } = setup({ applyAccept: false });
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(logbookInput()!, new File(['data'], name, { type }));

    expect(alertSpy).toHaveBeenCalledWith('Logbook should be txt file');
    expect(logbookInput()!.files).toHaveLength(0);
  });

  it('accepts an upper-case .TXT extension', async () => {
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(logbookInput()!, textFile('oil change', 'LOGBOOK.TXT'));
    await waitForFileRead();

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('discards a valid logbook if an invalid file is picked afterwards', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup({ applyAccept: false });
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await uploadLogbook(user);

    await user.upload(logbookInput()!, new File(['%PDF'], 'logbook.pdf', { type: 'application/pdf' }));
    await user.click(submitButton());

    expect(alertSpy).toHaveBeenLastCalledWith('Please upload logbook');
    expect(submits[0].blocked).toBe(true);
  });

  it('pops up an error for a file over 1 MB', async () => {
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(logbookInput()!, textFile('a'.repeat(MAX_LOGBOOK_BYTES + 1)));

    expect(alertSpy).toHaveBeenCalledWith('Logbook must be 1 MB or smaller.');
  });

  it('accepts a file of exactly 1 MB', async () => {
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await uploadLogbook(user, 'a'.repeat(MAX_LOGBOOK_BYTES));

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('pops up an error if the file cannot be read', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsText() {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');

    await user.upload(logbookInput()!, textFile('oil change'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Could not read the logbook file.'));
  });

  it('drops a loaded logbook when the Model changes, so it must be uploaded again', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup();
    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await uploadLogbook(user, 'old vehicle history');

    await user.selectOptions(field('Model'), 'Falcon');
    await user.selectOptions(field('Badge'), 'XR8');
    expect(logbookInput()!.files).toHaveLength(0);

    await user.click(submitButton());
    expect(alertSpy).toHaveBeenCalledWith('Please upload logbook');
    expect(submits[0].blocked).toBe(true);
  });
});

describe('VehicleForm – submit', () => {
  it('is a native POST form targeting the backend /upload route', () => {
    setup();
    const form = submitButton().closest('form')!;

    expect(form.method).toBe('post');
    expect(form.action).toMatch(/\/upload$/); // prefixed with VITE_API_URL when set
    expect(form.enctype).toBe('application/x-www-form-urlencoded');
  });

  it('lets the browser post make, model, badge and the logbook text when valid', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup();

    await selectVehicle(user, 'bmw', '130d', 'xDrive 26d');
    await uploadLogbook(user, '2020/05/01: Initial Service\n2021/06/15: Check-Up');
    await user.click(submitButton());

    expect(submits).toHaveLength(1);
    expect(submits[0].blocked).toBe(false);
    expect(submits[0].fields).toEqual({
      make: 'bmw',
      model: '130d',
      badge: 'xDrive 26d',
      logbookText: '2020/05/01: Initial Service\n2021/06/15: Check-Up',
    });
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
      fields: { make: 'tesla', model: 'Model 3', badge: 'Performance', logbookText: 'oil change' },
    });
  });

  it('never posts the file itself, only its text', async () => {
    const submits = captureSubmits();
    const { user } = setup();

    await selectVehicle(user, 'ford', 'Ranger', 'Raptor');
    await uploadLogbook(user);
    await user.click(submitButton());

    expect(Object.keys(submits[0].fields).sort()).toEqual(['badge', 'logbookText', 'make', 'model']);
  });

  it('requires a logbook: pops up "Please upload logbook" and blocks the POST', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup();

    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await user.click(submitButton());

    expect(alertSpy).toHaveBeenCalledWith('Please upload logbook');
    expect(submits[0].blocked).toBe(true);
  });

  it('treats a blank .txt file as no logbook', async () => {
    const submits = captureSubmits();
    const { user, alertSpy } = setup();

    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await uploadLogbook(user, '  \n  ');
    await user.click(submitButton());

    expect(alertSpy).toHaveBeenCalledWith('Please upload logbook');
    expect(submits[0].blocked).toBe(true);
  });

  it('never shows errors inline on the page', async () => {
    captureSubmits();
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Tesla Model 3 Performance' }));
    await user.click(submitButton());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Please upload logbook')).not.toBeInTheDocument();
  });
});
