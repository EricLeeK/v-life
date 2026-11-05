import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CollectionFeedback } from './CollectionFeedback';
afterEach(cleanup);
it('keeps content skeletons until records resolve, then reveals the content', () => {
  const { rerender } = render(<CollectionFeedback loading><p>记录内容</p></CollectionFeedback>);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status').querySelector('[skullet-bar]')).not.toBeNull();
  expect(screen.queryByText('正在读取记录…')).not.toBeInTheDocument();
  expect(screen.queryByText('记录内容')).not.toBeInTheDocument();
  rerender(<CollectionFeedback><p>记录内容</p></CollectionFeedback>);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByText('记录内容')).toBeInTheDocument();
});
it('offers retry after a failed request rather than displaying an empty result', () => {
  const retry = vi.fn();
  render(<CollectionFeedback error={new Error('offline')} retry={retry}><p>空记录</p></CollectionFeedback>);
  fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByText('空记录')).not.toBeInTheDocument();
});
