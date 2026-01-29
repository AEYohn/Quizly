import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonBase, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';

describe('SkeletonBase', () => {
  it('renders with default classes', () => {
    const { container } = render(<SkeletonBase />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveClass('bg-gray-700/50');
    expect(skeleton).toHaveClass('rounded');
  });

  it('renders with custom className', () => {
    const { container } = render(<SkeletonBase className="custom-class" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('custom-class');
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('renders children', () => {
    const { container } = render(
      <SkeletonBase>
        <span data-testid="child">Child content</span>
      </SkeletonBase>
    );
    const child = container.querySelector('[data-testid="child"]');
    expect(child).toBeInTheDocument();
  });
});

describe('SkeletonText', () => {
  it('renders single line by default', () => {
    const { container } = render(<SkeletonText />);
    const lines = container.querySelectorAll('.animate-pulse');
    expect(lines).toHaveLength(1);
  });

  it('renders correct number of lines', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const lines = container.querySelectorAll('.animate-pulse');
    expect(lines).toHaveLength(3);
  });

  it('renders multiple lines with lastLineWidth applied to last line', () => {
    const { container } = render(<SkeletonText lines={4} lastLineWidth="w-1/2" />);
    const lines = container.querySelectorAll('.animate-pulse');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toHaveClass('w-1/2');
  });
});

describe('SkeletonCard', () => {
  it('renders with default header', () => {
    const { container } = render(<SkeletonCard />);
    // Header contains two skeleton elements
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders without header when showHeader is false', () => {
    const { container } = render(<SkeletonCard showHeader={false} />);
    // Should only have body text lines (default 2)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(2);
  });

  it('renders with footer when showFooter is true', () => {
    const { container } = render(<SkeletonCard showFooter={true} />);
    // Header (2) + body (2) + footer (2)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(6);
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonCard className="my-custom-class" />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('my-custom-class');
  });

  it('has expected card structure with border and background', () => {
    const { container } = render(<SkeletonCard />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('rounded-2xl');
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('bg-gray-900');
  });
});
