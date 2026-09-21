import { MODULES, agentMetaOf } from './moduleRegistry.ts';

export const AGENT_CONTRACT_VERSION = '2.1.0';

export function buildAgentCapabilities() {
  return {
    version: AGENT_CONTRACT_VERSION,
    contract: 'vlife-agent-data',
    pagination: { limit: 200, offset: true },
    limitations: ['daily_task actions remain in the website'],
    modules: MODULES.filter((module) => agentMetaOf(module).agentVisible).map((module) => {
      const meta = agentMetaOf(module);
      return {
        key: module.key,
        label: module.labelZh,
        operations: {
          list: true,
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
