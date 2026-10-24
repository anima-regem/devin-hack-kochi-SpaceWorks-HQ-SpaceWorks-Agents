import { z } from 'zod';
import { DomainError } from '../core/errors.js';
import type { OpsState } from './types.js';

const text = z.string();
const id = z.string().min(1);
const count = z.number().int().nonnegative();
const date = z.iso.datetime({ offset: true });
const scoped = { tenantId: id, id };
const policy = z.object({ version: z.number().int().positive(), selfService: z.boolean(),
  consumableDailyLimit: count.max(10000), loanDays: z.number().int().min(1).max(365),
  requireScan: z.boolean(), requireReturnRemarks: z.boolean(), automationEnabled: z.boolean() }).strict();
const evidence = { actorId: id, scan: text, remarks: text, at: date };
const stateSchema = z.object({
  schemaVersion: z.literal(1), policies: z.record(id, policy),
  items: z.array(z.object({ ...scoped, name: id, kind: z.enum(['consumable', 'equipment']),
    onHand: count, available: count, quarantined: count, reorderPoint: count, location: id, qr: id }).strict()),
  requests: z.array(z.object({ ...scoped, itemId: id, itemName: id, memberId: id, quantity: count.positive(),
    status: z.enum(['pending', 'approved', 'issued']), dueAt: date, policyVersion: count.positive(),
    approvedBy: id.optional(), approvedPolicyVersion: count.positive().optional() }).strict()),
  loans: z.array(z.object({ ...scoped, itemId: id, itemName: id, memberId: id, quantity: count.positive(),
    status: z.enum(['active', 'returned']), dueAt: date, issueEvidence: z.object(evidence).strict(),
    returnEvidence: z.object({ ...evidence, condition: z.enum(['good', 'damaged']) }).strict().optional() }).strict()),
  tasks: z.array(z.object({ ...scoped, kind: z.enum(['low-stock', 'overdue', 'approval', 'damage']), title: id,
    status: z.enum(['open', 'completed']), subjectId: id, cycle: count.positive(), createdAt: date,
    completedAt: date.optional(), completedBy: id.optional(), remarks: text.optional(), resolvedAt: date.optional() }).strict()),
  activity: z.array(z.object({ tenantId: id, actorId: id, actionId: id, operation: id, summary: text,
    at: date, policyVersion: count.positive() }).strict()),
  movements: z.array(z.object({ ...scoped, actorId: id, itemId: id, quantity: z.number().int(),
    kind: z.enum(['consume', 'receive', 'adjust']), reason: id, at: date }).strict()),
  runs: z.array(z.object({ ...scoped, actorId: id, at: date, policyVersion: count.positive(),
    status: z.literal('completed'), createdTasks: z.array(id) }).strict()),
  idempotency: z.record(id, z.object({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    result: z.object({ actionId: id, status: z.enum(['pending', 'succeeded']), summary: text,
      result: z.unknown(), replayed: z.boolean().optional() }).strict() }).strict()),
}).strict();

/** Reject incompatible/corrupt persisted state before executing any operation. */
export function assertValidState(value: unknown): asserts value is OpsState {
  const result = stateSchema.safeParse(value);
  if (!result.success) throw new DomainError('INVALID_STATE', `Stored operations state is incompatible: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).slice(0, 5).join('; ')}`, 503);
  for (const item of result.data.items) {
    if (item.onHand !== item.available + item.quarantined)
      throw new DomainError('INVALID_STATE', 'Stored inventory counts do not reconcile with quarantine', 503);
  }
  for (const collection of [result.data.items, result.data.requests, result.data.loans, result.data.tasks]) {
    const identifiers = collection.map(row => JSON.stringify([row.tenantId, row.id]));
    if (new Set(identifiers).size !== identifiers.length)
      throw new DomainError('INVALID_STATE', 'Stored operations state contains duplicate record identities', 503);
  }
}
