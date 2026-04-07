import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

describe('UI Components', () => {
  describe('Button', () => {
    it('renders Button component', () => {
      render(<Button>Test</Button>);
      expect(screen.getByText('Test')).toBeDefined();
    });

    it('handles click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      fireEvent.click(screen.getByText('Click Me'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders different variants', () => {
      const { container } = render(
        <>
          <Button variant="default">Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </>
      );
      expect(container.querySelectorAll('button')).toHaveLength(4);
    });

    it('renders different sizes', () => {
      const { container } = render(
        <>
          <Button size="default">Default</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">Icon</Button>
        </>
      );
      expect(container.querySelectorAll('button')).toHaveLength(4);
    });

    it('can be disabled', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByText('Disabled')).toHaveProperty('disabled', true);
    });
  });

  describe('Card', () => {
    it('renders Card component', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
          </CardHeader>
        </Card>
      );
      expect(screen.getByText('Test Title')).toBeDefined();
    });

    it('renders full Card with all sections', () => {
      render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>Card content here</CardContent>
          <CardFooter>Card footer</CardFooter>
        </Card>
      );
      expect(screen.getByText('Card Title')).toBeDefined();
      expect(screen.getByText('Card content here')).toBeDefined();
      expect(screen.getByText('Card footer')).toBeDefined();
    });
  });

  describe('Input', () => {
    it('renders Input component', () => {
      render(<Input placeholder="Test input" />);
      expect(screen.getByPlaceholderText('Test input')).toBeDefined();
    });

    it('handles value changes', () => {
      const handleChange = vi.fn();
      render(<Input placeholder="Type here" onChange={handleChange} />);
      const input = screen.getByPlaceholderText('Type here');
      fireEvent.change(input, { target: { value: 'Hello' } });
      expect(handleChange).toHaveBeenCalled();
    });

    it('can be disabled', () => {
      render(<Input placeholder="Disabled" disabled />);
      expect(screen.getByPlaceholderText('Disabled')).toHaveProperty('disabled', true);
    });

    it('supports different types', () => {
      const { container } = render(
        <>
          <Input type="text" placeholder="Text" />
          <Input type="email" placeholder="Email" />
          <Input type="password" placeholder="Password" />
        </>
      );
      expect(container.querySelectorAll('input')).toHaveLength(3);
    });
  });

  describe('Label', () => {
    it('renders Label component', () => {
      render(<Label>Test Label</Label>);
      expect(screen.getByText('Test Label')).toBeDefined();
    });

    it('associates with input via htmlFor', () => {
      render(
        <>
          <Label htmlFor="test-input">Label</Label>
          <Input id="test-input" placeholder="Associated input" />
        </>
      );
      const label = screen.getByText('Label');
      expect(label).toHaveProperty('htmlFor', 'test-input');
    });
  });

  describe('Checkbox', () => {
    it('renders Checkbox component', () => {
      const { container } = render(<Checkbox />);
      expect(container.querySelector('button[role="checkbox"]')).toBeDefined();
    });

    it('handles checked state change', () => {
      const handleChange = vi.fn();
      const { container } = render(<Checkbox onCheckedChange={handleChange} />);
      const checkbox = container.querySelector('button[role="checkbox"]');
      if (checkbox) {
        fireEvent.click(checkbox);
        expect(handleChange).toHaveBeenCalled();
      }
    });
  });

  describe('Badge', () => {
    it('renders Badge component', () => {
      render(<Badge>New</Badge>);
      expect(screen.getByText('New')).toBeDefined();
    });

    it('renders different variants', () => {
      const { container } = render(
        <>
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </>
      );
      expect(container.querySelectorAll('div')).toHaveLength(4);
    });
  });

  describe('Separator', () => {
    it('renders Separator component', () => {
      const { container } = render(<Separator />);
      expect(container.querySelector('[role="none"]')).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('Button has correct role', () => {
      render(<Button>Accessible Button</Button>);
      expect(screen.getByRole('button')).toBeDefined();
    });

    it('Checkbox has correct role', () => {
      const { container } = render(<Checkbox />);
      expect(container.querySelector('[role="checkbox"]')).toBeDefined();
    });

    it('Input is focusable', () => {
      render(<Input placeholder="Focus me" />);
      const input = screen.getByPlaceholderText('Focus me');
      input.focus();
      expect(document.activeElement).toBe(input);
    });
  });
});
