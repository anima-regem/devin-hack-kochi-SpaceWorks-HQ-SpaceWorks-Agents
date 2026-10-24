import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from '../core/errors.js';
import type { Actor, OperationDefinition, OperationResult, Role, StateStore } from '../core/types.js';
import { consume, receive, adjust, createItem } from './inventory.js';
import { request, approve, issue, returnLoan } from './lending.js';
import { completeTask, runAutomation, updatePolicy } from './automation.js';
import type { Context } from './context.js';
import { fail } from './context.js';
import { parseInput, schemas, type OperationName } from './schemas.js';
import { defaultPolicy } from './state.js';
import type { OpsState, StaffSnapshot } from './types.js';
import { assertValidState } from './validation.js';
import { trustedActor } from './identity.js';
export { createInitialState } from './state.js';
export { assertValidState } from './validation.js';
export type * from './types.js';

const everyone: Role[] = ['manager', 'staff', 'member'];
const operators: Role[] = ['manager', 'staff'];
const definitions: OperationDefinition[] = [
  { name: 'catalogue.create', description: 'Add a catalogue item with a verified initial count', roles: operators, fields: ['name', 'kind', 'onHand', 'reorderPoint', 'location'] },
  { name: 'inventory.consume', description: 'Record taking consumable stock with a purpose', roles: everyone, fields: ['itemId', 'quantity', 'purpose'] },
  { name: 'stock.receive', description: 'Record a physical stock receipt', roles: operators, fields: ['itemId', 'quantity', 'reason'] },
  { name: 'stock.adjust', description: 'Correct a verified stock count with a reason', roles: operators, fields: ['itemId', 'delta', 'reason'] },
  { name: 'lending.request', description: 'Request equipment; staff approval and handover are required', roles: everyone, fields: ['itemId', 'quantity', 'memberId', 'dueAt'] },
  { name: 'lending.approve', description: 'Approve or re-review a pending equipment request', roles: operators, fields: ['requestId'] },
  { name: 'lending.issue', description: 'Record physical handover of approved equipment', roles: operators, fields: ['requestId', 'scan', 'remarks'] },
  { name: 'lending.return', description: 'Inspect and return equipment or quarantine damaged stock', roles: operators, fields: ['loanId', 'scan', 'remarks', 'condition'] },
  { name: 'policy.update', description: 'Save reviewed staff and member operating criteria', roles: ['manager'], fields: ['criteria', 'expectedVersion'] },
  { name: 'tasks.complete', description: 'Record completion of a staff operations task', roles: operators, fields: ['taskId', 'remarks'] },
  { name: 'automation.run', description: 'Run enabled low-stock, overdue and approval checks', roles: operators, fields: [] },
];

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function fingerprint(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function dispatch(c: Context, name: OperationName, value: unknown): { summary: string; result: unknown; status?: 'pending' } {
  switch (name) {
    case 'catalogue.create': return createItem(c, parseInput(name, value));
    case 'inventory.consume': return consume(c, parseInput(name, value));
    case 'stock.receive': return receive(c, parseInput(name, value));
    case 'stock.adjust': return adjust(c, parseInput(name, value));
    case 'lending.request': return request(c, parseInput(name, value));
    case 'lending.approve': return approve(c, parseInput(name, value));
    case 'lending.issue': return issue(c, parseInput(name, value));
    case 'lending.return': return returnLoan(c, parseInput(name, value));
    case 'policy.update': return updatePolicy(c, parseInput(name, value));
    case 'tasks.complete': return completeTask(c, parseInput(name, value));
    case 'automation.run': parseInput(name, value); return runAutomation(c);
  }
}

export class StaffService {
  constructor(private store: StateStore<OpsState>) {}

  operations(actor: Actor): OperationDefinition[] {
    actor = trustedActor(actor);
    return structuredClone(definitions.filter(d => d.roles.includes(actor.role)));
  }

  async snapshot(actor: Actor): Promise<StaffSnapshot> {
    actor = trustedActor(actor);
    const state = await this.store.read();
    assertValidState(state);
    const tenant = <T extends { tenantId: string }>(rows: T[]) => rows.filter(r => r.tenantId === actor.tenantId);
    const own = <T extends { memberId: string }>(rows: T[]) => actor.role === 'member' ? rows.filter(r => r.memberId === actor.id) : rows;
    return structuredClone({ items: tenant(state.items), requests: own(tenant(state.requests)),
      loans: own(tenant(state.loans)), tasks: actor.role === 'member' ? [] : tenant(state.tasks),
      activity: tenant(state.activity).filter(a => actor.role !== 'member' || a.actorId === actor.id).slice(-100).reverse(),
      policy: Object.hasOwn(state.policies, actor.tenantId) ? state.policies[actor.tenantId]! : defaultPolicy() });
  }

  async execute(actor: Actor, operation: string, input: unknown, options: { actionKey: string; confirmed: boolean; expectedPolicyVersion?: number }): Promise<OperationResult> {
    actor = trustedActor(actor);
    const definition = definitions.find(d => d.name === operation);
    if (!definition || !Object.hasOwn(schemas, operation)) fail('UNKNOWN_OPERATION', 'Unknown business operation', 404);
    if (!definition.roles.includes(actor.role)) fail('FORBIDDEN', 'This role cannot perform the requested operation', 403);
    if (options.confirmed !== true) fail('CONFIRMATION_REQUIRED', 'Review and explicitly confirm this action', 400);
    if (typeof options.actionKey !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(options.actionKey))
      fail('INVALID_ACTION_KEY', 'Provide a stable action key of 1–160 letters, numbers, dots, colons, dashes or underscores', 400);
    const expectedVersion = options.expectedPolicyVersion;
    if (expectedVersion !== undefined && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1))
      fail('INVALID_INPUT', 'expectedPolicyVersion must be a positive integer', 400);
    const name = operation as OperationName;
    const normalized = parseInput(name, input);
    const hash = fingerprint({ operation, input: normalized });
    const scope = fingerprint([actor.tenantId, actor.id, options.actionKey]);
    return this.store.transact(state => {
      assertValidState(state);
      const previous = state.idempotency[scope];
      if (previous) {
        if (previous.fingerprint !== hash) fail('IDEMPOTENCY_CONFLICT', 'This action key was already used for different input');
        return structuredClone({ ...previous.result, replayed: true });
      }
      const policy = Object.hasOwn(state.policies, actor.tenantId) ? state.policies[actor.tenantId]!
        : fail('TENANT_NOT_CONFIGURED', 'Operating criteria are not configured for this tenant', 403);
      if (expectedVersion !== undefined && expectedVersion !== policy.version)
        fail('POLICY_CHANGED', 'Operating criteria changed after confirmation; review the latest criteria and confirm again');
      const c: Context = { state, actor, policy, at: new Date().toISOString(), actionId: randomUUID() };
      const outcome = dispatch(c, name, normalized);
      for (const item of state.items.filter(i => i.tenantId === actor.tenantId)) {
        if (![item.onHand, item.available, item.quarantined].every(n => Number.isSafeInteger(n) && n >= 0) || item.onHand !== item.available + item.quarantined)
          throw new DomainError('STOCK_INVARIANT', 'Inventory constraints failed; transaction was rolled back', 500);
      }
      const result: OperationResult = structuredClone({ actionId: c.actionId, status: outcome.status ?? 'succeeded', summary: outcome.summary, result: outcome.result });
      state.activity.push({ tenantId: actor.tenantId, actorId: actor.id, actionId: c.actionId,
        operation, summary: result.summary, at: c.at, policyVersion: state.policies[actor.tenantId]!.version });
      state.idempotency[scope] = { fingerprint: hash, result: structuredClone(result) };
      return result;
    });
  }
}
