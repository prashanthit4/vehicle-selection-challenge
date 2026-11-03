import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';

describe('App', () => {
  it('renders the Drill Down Form heading and the form', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Drill Down Form' })).toBeInTheDocument();
    expect(screen.getByLabelText('Make')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });
});
