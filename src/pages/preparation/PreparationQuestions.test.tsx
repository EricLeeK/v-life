import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PreparationQuestions from './PreparationQuestions';

const mocks = vi.hoisted(() => ({ save: vi.fn(), edit: vi.fn(), toast: vi.fn() }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: {children:React.ReactNode}) => <div>{children}</div> }));
vi.mock('@/components/preparation/QuestionLinks', () => ({ QuestionLinks: () => null }));
vi.mock('@/components/preparation/StudyImageUpload', () => ({ StudyImageUpload: () => <div>图片上传</div> }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/usePreparation', () => ({
  questionsForExam: (data: {questions:[]}) => data.questions,
  usePreparation: () => ({ userId: 'test-user', data: { questions: [], banks: [{ id: 'bank', name: '共享题库' }], materials: [], states: [], attempts: [], bankQuestions: [] }, save: mocks.save, editQuestion: mocks.edit }),
}));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);

it('retains the latest saved revision when linking fails after an image draft was created', async () => {
  let bankFails = true;
  mocks.save.mockImplementation(async ({ collection, record }) => {
    if (collection === 'questions') return { ...record, id: 'question', revision: 1 };
    if (bankFails) { bankFails = false; throw new Error('network interrupted'); }
    return record;
  });
  mocks.edit.mockImplementation(async (question, patch) => ({ ...patch, id: question.id, revision: question.revision + 1 }));
  render(<MemoryRouter><PreparationQuestions /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '添加题目' }));
  fireEvent.change(screen.getByLabelText('题干 · 支持 Markdown'), { target: { value: '图片题草稿' } });
  fireEvent.change(screen.getByLabelText('解析 · Markdown'), { target: { value: '已经写好的解析' } });
  fireEvent.change(screen.getByLabelText('加入题库'), { target: { value: 'bank' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿以插入图片' }));
  await screen.findByText('图片上传');
  expect(mocks.save.mock.calls[0][0].record.explanation_md).toBe('已经写好的解析');
  fireEvent.click(screen.getByRole('button', { name: '保存题目' }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(mocks.edit.mock.calls[0][0].revision).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: '保存题目' }));
  await waitFor(() => expect(mocks.edit).toHaveBeenCalledTimes(2));
  expect(mocks.edit.mock.calls[1][0].revision).toBe(2);
  await waitFor(() => expect(screen.queryByLabelText('题干 · 支持 Markdown')).not.toBeInTheDocument());
});

it('restores all entered fields and the created question identity after a reload', async () => {
  mocks.save.mockResolvedValue({ id: 'saved-draft', revision: 1 });
  const tree = () => <MemoryRouter><PreparationQuestions /></MemoryRouter>;
  const mounted = render(tree());
  fireEvent.click(screen.getByRole('button', { name: '添加题目' }));
  fireEvent.change(screen.getByLabelText('题干 · 支持 Markdown'), { target: { value: '保存后继续' } });
  fireEvent.change(screen.getByLabelText('错因与下次提醒 · Markdown'), { target: { value: '检查单位' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿以插入图片' }));
  await screen.findByText('图片上传');
  mounted.unmount();
  render(tree());
  fireEvent.click(screen.getByRole('button', { name: '添加题目' }));
  expect(screen.getByLabelText('题干 · 支持 Markdown')).toHaveValue('保存后继续');
  expect(screen.getByLabelText('错因与下次提醒 · Markdown')).toHaveValue('检查单位');
  expect(screen.getByText('图片上传')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '保存草稿以插入图片' })).not.toBeInTheDocument();
});
