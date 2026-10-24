import { z } from 'zod';
import { DomainError } from '../core/errors.js';

const text = z.string().trim().min(1).max(1000);
const id = z.string().trim().min(1).max(160);
const quantity = z.number().int().positive().max(10000);
const criteria = z.object({ selfService: z.boolean().optional(),
  consumableDailyLimit: z.number().int().min(0).max(10000).optional(),
  loanDays: z.number().int().min(1).max(365).optional(), requireScan: z.boolean().optional(),
  requireReturnRemarks: z.boolean().optional(), automationEnabled: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one criterion is required');

export const schemas = {
  'catalogue.create': z.object({ name: z.string().trim().min(1).max(160), kind: z.enum(['consumable', 'equipment']),
    onHand: z.number().int().min(0).max(100000), reorderPoint: z.number().int().min(0).max(100000),
    location: z.string().trim().min(1).max(200) }).strict(),
  'inventory.consume': z.object({ itemId: id, quantity, purpose: text }).strict(),
  'stock.receive': z.object({ itemId: id, quantity, reason: text }).strict(),
  'stock.adjust': z.object({ itemId: id, delta: z.number().int().min(-10000).max(10000).refine(n => n !== 0), reason: text }).strict(),
  'lending.request': z.object({ itemId: id, quantity, memberId: id, dueAt: z.iso.datetime({ offset: true }) }).strict(),
  'lending.approve': z.object({ requestId: id }).strict(),
  'lending.issue': z.object({ requestId: id, scan: z.string().max(1000).optional(), remarks: z.string().max(1000).optional() }).strict(),
  'lending.return': z.object({ loanId: id, scan: z.string().max(1000).optional(), remarks: z.string().max(1000).optional(), condition: z.enum(['good', 'damaged']) }).strict(),
  'policy.update': z.object({ criteria, expectedVersion: z.number().int().positive() }).strict(),
  'tasks.complete': z.object({ taskId: id, remarks: text }).strict(),
  'automation.run': z.object({}).strict(),
};
export type OperationName = keyof typeof schemas;
export type Input<N extends OperationName> = z.infer<(typeof schemas)[N]>;
export function parseInput<N extends OperationName>(name: N, input: unknown): Input<N> {
  const parsed = schemas[name].safeParse(input);
  if (!parsed.success) throw new DomainError('INVALID_INPUT', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data as Input<N>;
}
