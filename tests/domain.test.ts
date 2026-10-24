import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/core/store.js';
import type { Actor } from '../src/core/types.js';
import { StaffService, createInitialState, assertValidState } from '../src/domain/index.js';

const manager: Actor = { id: 'manager-1', tenantId: 'demo', role: 'manager', name: 'Manager' };
const staff: Actor = { id: 'staff-1', tenantId: 'demo', role: 'staff', name: 'Staff' };
const member: Actor = { id: 'member-1', tenantId: 'demo', role: 'member', name: 'Member' };
function setup() {
  const store = new MemoryStore(createInitialState(true));
  const service = new StaffService(store);
  let sequence = 0;
  const act = (operation: string, input: unknown, actor = staff, key = `action-${++sequence}`) =>
    service.execute(actor, operation, input, { actionKey: key, confirmed: true });
  const policy = (criteria: Record<string, unknown>, expectedVersion = 1) =>
    act('policy.update', { criteria, expectedVersion }, manager);
  return { store, service, act, policy };
}

describe('staff operations', () => {
  it('creates tenant-scoped catalogue items with initial count ledger and stable retry', async () => {
    const store = new MemoryStore(createInitialState(false));
    const service = new StaffService(store);
    const input = { name: 'Safety glasses', kind: 'equipment', onHand: 3, reorderPoint: 1, location: 'Cabinet B' };
    const first = await service.execute(staff, 'catalogue.create', input, { actionKey: 'create', confirmed: true });
    const replay = await service.execute(staff, 'catalogue.create', input, { actionKey: 'create', confirmed: true });
    expect(replay.actionId).toBe(first.actionId);
    const state = await store.read();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ name: 'Safety glasses', tenantId: 'demo', onHand: 3, available: 3, quarantined: 0 });
    expect(state.items[0]?.qr).toBe(`SW:${state.items[0]?.id}`);
    expect(state.movements[0]).toMatchObject({ id: first.actionId, quantity: 3, kind: 'receive', reason: 'Initial catalogue count' });
    await expect(service.execute(member, 'catalogue.create', input, { actionKey: 'member', confirmed: true })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.execute(staff, 'catalogue.create', { ...input, onHand: -1 }, { actionKey: 'invalid', confirmed: true })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects corrupt state shape, unreconciled counts and duplicate identities before writes', () => {
    expect(() => assertValidState({ schemaVersion: 1 })).toThrow('Stored operations state is incompatible');
    const state = createInitialState(true);
    state.items[0]!.available = -1;
    expect(() => assertValidState(state)).toThrow('Stored operations state is incompatible');
    state.items[0]!.available = 3;
    expect(() => assertValidState(state)).toThrow('do not reconcile');
    state.items[0]!.available = 4; state.items.push({ ...state.items[0]! });
    expect(() => assertValidState(state)).toThrow('duplicate record identities');
  });

  it('requires explicit confirmation and rejects forged actor fields and fractional quantities', async () => {
    const { service, act, store } = setup();
    await expect(service.execute(staff, 'stock.receive', { itemId: 'bolts', quantity: 1, reason: 'Delivery' },
      { actionKey: 'confirm', confirmed: false })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    await expect(act('stock.receive', { itemId: 'bolts', quantity: 1, reason: 'Delivery', actor: manager })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(act('stock.receive', { itemId: 'bolts', quantity: 0.5, reason: 'Delivery' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect((await store.read()).activity).toHaveLength(0);
  });

  it('records receipts and stock-count reasons, rejects negative counts and preserves immutable replay results', async () => {
    const { act, store } = setup();
    const original = await act('stock.receive', { itemId: 'bolts', quantity: 3, reason: 'Invoice 101' }, staff, 'receipt');
    await act('stock.adjust', { itemId: 'bolts', delta: -2, reason: 'Physical shelf count' });
    const replay = await act('stock.receive', { reason: 'Invoice 101', quantity: 3, itemId: 'bolts' }, staff, 'receipt');
    expect(replay).toMatchObject({ ...original, replayed: true });
    await expect(act('stock.adjust', { itemId: 'bolts', delta: -6, reason: 'Incorrect' })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    const state = await store.read();
    expect(state.items[0]?.available).toBe(5);
    expect(state.movements.map(m => m.reason)).toEqual(['Invoice 101', 'Physical shelf count']);
    expect(state.activity).toHaveLength(2);
  });

  it('serializes competing consumption of the final unit', async () => {
    const { act, store } = setup();
    const results = await Promise.allSettled([
      act('inventory.consume', { itemId: 'bolts', quantity: 4, purpose: 'Project A' }),
      act('inventory.consume', { itemId: 'bolts', quantity: 4, purpose: 'Project B' }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await store.read()).items[0]?.available).toBe(0);
    expect((await store.read()).movements).toHaveLength(1);
  });

  it('deduplicates concurrent submissions and conflicts on a reused key with other input', async () => {
    const { act, store } = setup();
    const input = { itemId: 'bolts', quantity: 1, purpose: 'Assembly' };
    const [first, second] = await Promise.all([act('inventory.consume', input, staff, 'same'), act('inventory.consume', input, staff, 'same')]);
    expect(first.actionId).toBe(second.actionId); expect(second.replayed).toBe(true);
    await expect(act('inventory.consume', { ...input, quantity: 2 }, staff, 'same')).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await act('inventory.consume', input, manager, 'same');
    expect((await store.read()).items[0]?.available).toBe(2);
  });

  it('isolates item IDs, loan records, tasks, history and idempotency by tenant', async () => {
    const { act, store, service } = setup();
    await store.transact(state => {
      state.policies.other = { ...state.policies.demo! };
      state.items.push({ ...state.items[0]!, tenantId: 'other', id: 'secret', name: 'Private item' });
    });
    await expect(act('stock.receive', { itemId: 'secret', quantity: 1, reason: 'Guess' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const foreign = { ...staff, tenantId: 'other' };
    await expect(act('lending.return', { loanId: 'loan-demo', scan: 'SW:drill', remarks: 'OK', condition: 'good' }, foreign)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await act('stock.receive', { itemId: 'bolts', quantity: 1, reason: 'Local' }, staff, 'same');
    await act('stock.receive', { itemId: 'secret', quantity: 1, reason: 'Foreign' }, foreign, 'same');
    const snapshot = await service.snapshot(staff);
    expect(snapshot.items.some(i => i.id === 'secret')).toBe(false);
    expect(snapshot.activity.every(a => a.tenantId === 'demo')).toBe(true);
    expect((await service.snapshot(foreign)).loans).toHaveLength(0);
  });

  it('enforces manager-only settings, member ownership and private snapshots', async () => {
    const { act, service, policy, store } = setup();
    await expect(act('policy.update', { criteria: { selfService: true }, expectedVersion: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(act('lending.approve', { requestId: 'request-demo' }, member)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(act('lending.request', { itemId: 'soldering-iron', quantity: 1, memberId: 'someone-else', dueAt: new Date(Date.now() + 86400000).toISOString() }, member)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await policy({ automationEnabled: true }); await act('automation.run', {});
    await store.transact(state => { state.requests.push({ ...state.requests[0]!, id: 'private', memberId: 'other-member' }); });
    const snapshot = await service.snapshot(member);
    expect(snapshot.tasks).toHaveLength(0); expect(snapshot.activity).toHaveLength(0);
    expect(snapshot.requests.map(r => r.id)).toEqual(['request-demo']);
    expect(service.operations(member).map(o => o.name)).toEqual(['inventory.consume', 'lending.request']);
  });

  it('enforces confirmed self-service criteria and aggregate daily consumable limit', async () => {
    const { act, policy, store } = setup();
    const input = { itemId: 'bolts', quantity: 1, purpose: 'Build' };
    await expect(act('inventory.consume', input, member)).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    await policy({ selfService: true, consumableDailyLimit: 2 });
    await store.transact(state => state.items.push({ ...state.items[0]!, id: 'nuts' }));
    await act('inventory.consume', input, member);
    await act('inventory.consume', { ...input, itemId: 'nuts' }, member);
    await expect(act('inventory.consume', input, member)).rejects.toMatchObject({ code: 'DAILY_LIMIT' });
    await act('inventory.consume', input, staff);
  });

  it('rejects lost policy updates and invalidates approval after criteria changes', async () => {
    const { act, policy, store } = setup();
    await act('lending.approve', { requestId: 'request-demo' });
    await policy({ loanDays: 4 });
    await expect(policy({ loanDays: 3 })).rejects.toMatchObject({ code: 'POLICY_CHANGED' });
    const input = { requestId: 'request-demo', scan: 'SW:soldering-iron', remarks: 'Handed over' };
    await expect(act('lending.issue', input)).rejects.toMatchObject({ code: 'POLICY_CHANGED' });
    expect((await store.read()).loans).toHaveLength(1);
    await act('lending.approve', { requestId: 'request-demo' }); await act('lending.issue', input);
    expect((await store.read()).loans).toHaveLength(2);
  });

  it('requires approval and exact physical scan before equipment handover', async () => {
    const { act, store } = setup();
    await expect(act('lending.issue', { requestId: 'request-demo', scan: 'SW:soldering-iron' })).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    await act('lending.approve', { requestId: 'request-demo' });
    await expect(act('lending.issue', { requestId: 'request-demo', scan: 'invented' })).rejects.toMatchObject({ code: 'EVIDENCE_REQUIRED' });
    await expect(act('lending.issue', { requestId: 'request-demo' })).rejects.toMatchObject({ code: 'EVIDENCE_REQUIRED' });
    const result = await act('lending.issue', { requestId: 'request-demo', scan: 'SW:soldering-iron', remarks: 'Physically handed over' }, staff, 'handover');
    const repeated = await act('lending.issue', { requestId: 'request-demo', scan: 'SW:soldering-iron', remarks: 'Physically handed over' }, staff, 'handover');
    expect(repeated.actionId).toBe(result.actionId);
    const state = await store.read();
    expect(state.items.find(i => i.id === 'soldering-iron')?.available).toBe(1);
    expect(state.loans[1]?.issueEvidence.remarks).toBe('Physically handed over');
  });

  it('prevents approval from reserving or overselling scarce equipment', async () => {
    const { act, store } = setup();
    await store.transact(state => { const iron = state.items.find(i => i.id === 'soldering-iron')!; iron.onHand = 1; iron.available = 1; });
    const result = await act('lending.request', { itemId: 'soldering-iron', quantity: 1, memberId: 'member-1', dueAt: new Date(Date.now() + 86400000).toISOString() }, member);
    const otherId = (result.result as { request: { id: string } }).request.id;
    await act('lending.approve', { requestId: 'request-demo' }); await act('lending.approve', { requestId: otherId });
    const outcomes = await Promise.allSettled(['request-demo', otherId].map(requestId => act('lending.issue', { requestId, scan: 'SW:soldering-iron' })));
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    expect((await store.read()).items.find(i => i.id === 'soldering-iron')?.available).toBe(0);
  });

  it('requires inspection evidence and quarantines damaged equipment on return', async () => {
    const { act, store } = setup();
    await expect(act('lending.return', { loanId: 'loan-demo', scan: 'SW:drill', condition: 'good' })).rejects.toMatchObject({ code: 'EVIDENCE_REQUIRED' });
    await act('lending.return', { loanId: 'loan-demo', scan: 'SW:drill', remarks: 'Cracked casing', condition: 'damaged' });
    const state = await store.read();
    expect(state.items.find(i => i.id === 'drill')).toMatchObject({ onHand: 1, available: 0, quarantined: 1 });
    expect(state.loans[0]?.returnEvidence).toMatchObject({ actorId: 'staff-1', remarks: 'Cracked casing', condition: 'damaged' });
    expect(state.tasks[0]).toMatchObject({ kind: 'damage', status: 'open' });
    await expect(act('lending.return', { loanId: 'loan-demo', scan: 'SW:drill', remarks: 'Again', condition: 'good' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(act('stock.adjust', { itemId: 'drill', delta: -1, reason: 'Remove quarantine' })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  });

  it('persists paused/deduplicated automation with verified resolution and renewed incidents', async () => {
    const { act, policy, store } = setup();
    await expect(act('automation.run', {})).rejects.toMatchObject({ code: 'AUTOMATION_PAUSED' });
    await policy({ automationEnabled: true });
    await act('automation.run', {}); await act('automation.run', {});
    let state = await store.read(); expect(state.tasks).toHaveLength(3); expect(state.runs).toHaveLength(2);
    const task = state.tasks.find(t => t.kind === 'low-stock')!;
    await act('tasks.complete', { taskId: task.id, remarks: 'Purchasing request prepared' }); await act('automation.run', {});
    expect((await store.read()).tasks).toHaveLength(3);
    await act('stock.receive', { itemId: 'bolts', quantity: 20, reason: 'Delivery' }); await act('automation.run', {});
    await act('inventory.consume', { itemId: 'bolts', quantity: 20, purpose: 'Restock demo cycle' }); await act('automation.run', {});
    state = await store.read(); expect(state.tasks.filter(t => t.kind === 'low-stock')).toHaveLength(2);
    expect(state.tasks.find(t => t.id === task.id)?.resolvedAt).toBeDefined();
    await policy({ automationEnabled: false }, 2);
    await expect(act('automation.run', {})).rejects.toMatchObject({ code: 'AUTOMATION_PAUSED' });
  });

  it('rejects impossible dates and treating equipment as consumables', async () => {
    const { act } = setup();
    await expect(act('inventory.consume', { itemId: 'drill', quantity: 1, purpose: 'Bypass lending' })).rejects.toMatchObject({ code: 'WRONG_OPERATION' });
    await expect(act('lending.request', { itemId: 'soldering-iron', memberId: 'member-1', quantity: 1,
      dueAt: new Date(Date.now() + 30 * 86400000).toISOString() }, member)).rejects.toMatchObject({ code: 'POLICY_DENIED' });
  });
});
