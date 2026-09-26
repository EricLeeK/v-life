import {classificationPolicy} from './agentClassifications.ts';
import { modulePurpose, moduleCanSearch } from './agentGuide.ts';
import { MODULES, agentMetaOf } from './moduleRegistry.ts';

export const AGENT_CONTRACT_VERSION = '2.5.0';

export function buildAgentCapabilities() {
  return {
    version: AGENT_CONTRACT_VERSION,
    contract: 'vlife-agent-data',
    onboarding: { tool: 'agent_help', guide: 'vlife://guide', today_tool: 'daily_task_today', classification_tool:'classification_list' },
    pagination: { default_limit: 50, limit: 200, offset: true, next_page: 'offset=nextOffset while hasMore=true' },
    limitations: ['Habits use habit_log; routine completion affects only its daily task. Daily-task scores are managed by the website.', 'Subscriptions track external services locally; editing status or auto_renew never cancels a vendor subscription. Monthly budgets are not actual expenses. Payment confirmation is idempotent by subscription_id + due_date and can optionally log an expense under the same write grant.'],
    summaries: {subscription:{mcp:'subscription_summary',http:'/summary/subscription',currency:'separate',actual_expenses:false}},
    modules: MODULES.filter((module) => agentMetaOf(module).agentVisible).map((module) => {
      const meta = agentMetaOf(module);
      return {
        key: module.key,
        label: module.labelZh,
        purpose: modulePurpose(module),
        classification:classificationPolicy(module.key),
        operations: {
          list: true,
          search: moduleCanSearch(module),
          get: true,
          create: !!module.actions.create,
          update: !!module.actions.update,
          delete: !!module.actions.delete,
        },
        readFields: meta.readFields,
        createFields: meta.createFields,
        updateFields: meta.updateFields,
        exportable: meta.exportable,
        dateField: module.executor?.dateField,
      };
    }),
  };
}
