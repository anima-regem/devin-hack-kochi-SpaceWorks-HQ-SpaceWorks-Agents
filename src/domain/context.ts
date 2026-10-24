import { randomUUID } from 'node:crypto';
import { DomainError } from '../core/errors.js';
import type { Actor } from '../core/types.js';
import type { Item, OpsState, Policy } from './types.js';

export interface Context { state: OpsState; actor: Actor; policy: Policy; at: string; actionId: string }
export function fail(code: string, message: string, status = 409): never { throw new DomainError(code, message, status); }
export function findItem(c: Context, id: string): Item {
  return c.state.items.find(i => i.id === id && i.tenantId === c.actor.tenantId)
    ?? fail('NOT_FOUND', 'Item not found', 404);
}
export function findScoped<T extends { id: string; tenantId: string }>(c: Context, records: T[], id: string, kind: string): T {
  return records.find(i => i.id === id && i.tenantId === c.actor.tenantId)
    ?? fail('NOT_FOUND', `${kind} not found`, 404);
}
export function checkScan(c: Context, item: Item, scan?: string) {
  if ((c.policy.requireScan || scan) && scan !== item.qr) fail('EVIDENCE_REQUIRED', 'Scan the exact item QR before handover or return');
}
export function checkDue(c: Context, dueAt: string) {
  const milliseconds = Date.parse(dueAt) - Date.parse(c.at);
  if (milliseconds <= 0 || milliseconds > c.policy.loanDays * 86400000)
    fail('POLICY_DENIED', `Due date must be in the next ${c.policy.loanDays} days`);
}
export function addTask(c: Context, kind: 'low-stock' | 'overdue' | 'approval' | 'damage', subjectId: string, title: string) {
  const previous = c.state.tasks.filter(t => t.tenantId === c.actor.tenantId && t.kind === kind && t.subjectId === subjectId);
  if (previous.some(t => !t.resolvedAt)) return undefined;
  const task = { id: randomUUID(), tenantId: c.actor.tenantId, kind, subjectId, title,
    status: 'open' as const, cycle: previous.length + 1, createdAt: c.at };
  c.state.tasks.push(task); return task;
}
