import {classificationPolicy} from './agentClassifications.ts';
import { modulePurpose, moduleCanSearch } from './agentGuide.ts';
import { MODULES, agentMetaOf } from './moduleRegistry.ts';

export const AGENT_CONTRACT_VERSION = '2.6.0';

export function buildAgentCapabilities() {
  return {
    version: AGENT_CONTRACT_VERSION,
    contract: 'vlife-agent-data',
    onboarding: { tool: 'agent_help', guide: 'vlife://guide', today_tool: 'daily_task_overview', classification_tool:'classification_list' },
    task_workflows: {
      preferred_read:{mcp:'daily_task_overview',http:'GET /daily_task/overview',complete_up_to:500,relative_dates:['today','tomorrow','yesterday'],lookback_days:{default:3,max:30}},
      transfer:{mcp:'daily_task_transfer',http:'POST /daily_task/transfer',atomic:true,max_sources:200,explicit_mode:['move','copy'],requires_idempotency_key:true,permissions:{move:['read','write','delete'],copy:['read','write']},replayed:'Original verified receipt; query overview for current state.'},
      completion:'once completion synchronizes all linked dates; copy does not create immutable completion history.',
    },
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
