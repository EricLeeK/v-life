import { NEWSPAPER_OPERATIONS } from './newspaperAgent.ts';
import { NewspaperError, type NewspaperContext } from './newspaperTypes.ts';
import { validateToolInput } from '../mcp-server/toolSchema.ts';

/** Reject identity injection, unknown fields and permission failures before privileged work. */
export function validateNewspaperOperation(ctx: NewspaperContext, action: string, input: unknown): Record<string, unknown> {
  const definition = NEWSPAPER_OPERATIONS[action];
  if (!definition) throw new NewspaperError('ACTION_NOT_ALLOWED', 'Unknown newspaper operation', 404);
  if (!ctx.permissions.read || !ctx.permissions[definition.permission]) throw new NewspaperError('PERMISSION_DENIED', `${definition.permission} and read permission are required`, 403);
  if (ctx.idempotencyKey !== undefined && (typeof ctx.idempotencyKey !== 'string' || !ctx.idempotencyKey.trim() || ctx.idempotencyKey.length > 200)) throw new NewspaperError('INVALID_INPUT', 'Idempotency-Key must contain 1 to 200 characters');
  if (definition.paid && !ctx.idempotencyKey) throw new NewspaperError('INVALID_INPUT', 'Generation requires an Idempotency-Key; reuse it when retrying');
  try { validateToolInput(definition.schema, input); }
  catch (error) { throw new NewspaperError('INVALID_INPUT', (error as Error).message); }
  return input as Record<string, unknown>;
}

export async function executeNewspaperOperation(ctx: NewspaperContext, action: string, rawInput: unknown = {}): Promise<unknown> {
  const input = validateNewspaperOperation(ctx, action, rawInput);
  if (NEWSPAPER_OPERATIONS[action].image) {
    const { createNewspaperImageService } = await import('./newspaperImageService.ts');
    return createNewspaperImageService(ctx).execute(action, input);
  }
  const { createNewspaperService } = await import('./newspaperService.ts');
  const service = createNewspaperService(ctx);
  if (action === 'export') {
    const { exportNewspaperMarkdown } = await import('./newspaperDomain.ts');
    const report = await service.execute('get', { date: input.date });
    const selected = Array.isArray(input.sections) ? { ...report, snapshot: { ...report.snapshot, sections: report.snapshot.sections.filter((section: { id: string }) => (input.sections as string[]).includes(section.id)) } } : report;
    return { date: input.date, markdown: exportNewspaperMarkdown(selected, { includeSupplements: input.include_supplements !== false, includeReview: input.include_review !== false }) };
  }
  return service.execute(action, input);
}
