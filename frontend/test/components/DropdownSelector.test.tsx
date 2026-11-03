import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DropdownSelector from '../../src/components/DropdownSelector';

const options = [
  { value: 'ford', label: 'Ford' },
  { value: 'bmw', label: 'BMW' },
];

describe('DropdownSelector', () => {
  it('renders a labelled select with a placeholder and the given options', () => {
    render(
      <DropdownSelector id="make" label="Make" placeholder="Select a make" options={options} value="" onChange={vi.fn()} />,
    );

    const select = screen.getByLabelText('Make');
    expect(select).toHaveValue('');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Select a make', 'Ford', 'BMW']);
  });

  it('calls onChange with the selected value, not the event', async () => {
    const onChange = vi.fn();
    render(
      <DropdownSelector id="make" label="Make" placeholder="Select a make" options={options} value="" onChange={onChange} />,
    );

    await userEvent.setup().selectOptions(screen.getByLabelText('Make'), 'bmw');

    expect(onChange).toHaveBeenCalledWith('bmw');
  });

  it('respects the disabled prop', () => {
    render(
      <DropdownSelector id="model" label="Model" placeholder="Select a model" options={[]} value="" onChange={vi.fn()} disabled />,
    );

    expect(screen.getByLabelText('Model')).toBeDisabled();
  });

  it('visually hides the label when hideLabel is set, keeping it accessible', () => {
    render(
      <DropdownSelector id="make" label="Make" placeholder="Select a make" options={options} value="" onChange={vi.fn()} hideLabel />,
    );

    expect(screen.getByLabelText('Make')).toBeInTheDocument();
    expect(screen.getByText('Make')).toHaveClass('visually-hidden');
  });
});
