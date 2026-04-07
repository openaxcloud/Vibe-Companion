import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('renders correctly', () => {
    render(<Input placeholder="Enter text" data-testid="input-test" />);
    expect(screen.getByTestId('input-test')).toBeInTheDocument();
  });

  it('accepts and displays user input', () => {
    render(<Input data-testid="input-test" />);
    const input = screen.getByTestId('input-test');
    fireEvent.change(input, { target: { value: 'Hello World' } });
    expect(input).toHaveValue('Hello World');
  });

  it('applies disabled state', () => {
    render(<Input disabled data-testid="input-test" />);
    expect(screen.getByTestId('input-test')).toBeDisabled();
  });
});
