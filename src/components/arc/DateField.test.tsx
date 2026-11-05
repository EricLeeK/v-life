import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateField } from './DateField';
vi.mock('@/contexts/LanguageContext', () => ({ useLang: () => ({ lang: 'zh', t: (zh: string) => zh }) }));
afterEach(cleanup);
const day = (date: string) => screen.getByRole('button', { name: new RegExp(`^${date}`) });
describe('single date selection', () => {
  it('replaces the selected day on every click, including an earlier second date', () => {
    const change = vi.fn();
    render(<DateField label="日期" value="2026-11-15" onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: /^日期:/ }));
    fireEvent.click(day('2026年11月20日'));
    fireEvent.click(day('2026年11月10日'));
    expect(document.querySelectorAll('[role="gridcell"][aria-selected="true"]')).toHaveLength(1);
    expect(day('2026年11月10日')).toHaveAttribute('data-edge', 'true');
    fireEvent.pointerEnter(day('2026年11月18日'));
    fireEvent.keyDown(day('2026年11月10日'), { key: 'ArrowRight' });
    expect(document.querySelectorAll('[role="gridcell"][aria-selected="true"]')).toHaveLength(1);
    expect(day('2026年11月10日')).toHaveAttribute('data-range', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^(确定|Apply)$/ }));
    expect(change).toHaveBeenCalledWith('2026-11-10');
  });
  it('cancels a draft without changing the saved date and enforces limits', () => {
    const change = vi.fn();
    render(<DateField label="日期" value="2026-11-15" min="2026-11-10" max="2026-11-20" onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: /^日期:/ }));
    expect(day('2026年11月9日')).toBeDisabled();
    expect(day('2026年11月21日')).toBeDisabled();
    fireEvent.click(day('2026年11月12日'));
    fireEvent.click(screen.getByRole('button', { name: /^(取消|Cancel)$/ }));
    expect(change).not.toHaveBeenCalled();
  });
});
