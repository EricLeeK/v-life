import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WeightedTaskGrid } from './WeightedTaskGrid';
import { projectColumns } from './board-model';

vi.mock('@/contexts/LanguageContext', () => ({ useLang: () => ({ t: (zh: string) => zh }) }));

describe('keyboard drag interruption', () => {
  it('discards the keyboard preview when the user switches to the pointer', () => {
    const item = { id: 'a', title: 'Original', status: 'todo', type: 'task', weight: 1, sort_order: 0 };
    const props = { columns: projectColumns, onMove: vi.fn(), onAdd: vi.fn(), labelItem: (row: typeof item) => row.title, renderItem: (row: typeof item) => <span>{row.title}</span> };
    const { rerender } = render(<WeightedTaskGrid {...props} items={[item]} />);
    fireEvent.keyDown(screen.getByRole('listitem'), { key: ' ' });
    fireEvent.pointerDown(document.body);
    rerender(<WeightedTaskGrid {...props} items={[{ ...item, title: 'Updated' }]} />);
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(props.onMove).not.toHaveBeenCalled();
  });
});
