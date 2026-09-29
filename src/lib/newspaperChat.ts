import { NEWSPAPER_OPERATIONS } from '../../supabase/functions/_shared/newspaperAgent';
import { newspaperPaidRequestStore } from './newspaperPaidRequests';

interface ChatOperation { module: string; action: string; data: Record<string, unknown>; idempotency_key?: string }
type NewspaperCall = (action: string, input: Record<string, unknown>, key: string) => Promise<any>;

/** Persist the request key on the operation so a UI retry cannot submit a second paid job. */
export async function executeNewspaperChatOperation(operation: ChatOperation, call: NewspaperCall, scope: string): Promise<string> {
  const definition = NEWSPAPER_OPERATIONS[operation.action];
  if (!definition || definition.permission === 'read') throw new Error('不支持的日报写操作，请先读取日报或在设置中管理配置。');
  operation.idempotency_key ||= crypto.randomUUID();
  const invoke = (key: string) => {
    operation.idempotency_key = key;
    return call(operation.action, operation.data, key);
  };
  const result = operation.action === 'image_generate' || operation.action === 'review_generate'
    ? await newspaperPaidRequestStore().run(scope, operation.action, operation.data, invoke, operation.idempotency_key)
    : await invoke(operation.idempotency_key);
  if (operation.action === 'image_generate') {
    const states: Record<string, string> = {
      queued: '配图任务已排队', submitting: '正在提交配图任务', running: '配图正在生成', saving: '正在保存配图',
      succeeded: '配图已生成并保存', failed: '配图失败，请查看日报中的任务说明', unknown: '配图结果待确认，请先核对任务，不要重复提交',
    };
    return `日报：${states[result?.status] || '配图任务状态待确认'}。`;
  }
  const labels: Record<string, string> = {
    refresh: '已更新报纸修订', supplement_save: '已保存原文补充', supplement_delete: '已删除补充', report_update: '已更新版块显示',
    review_generate: '已保存复盘', style_save: '已保存配图风格', style_delete: '已删除配图风格', image_select: '已选用配图', image_caption: '已更新图注',
  };
  return `日报：${labels[operation.action] || '操作已保存'}。`;
}
