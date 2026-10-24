import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/core/store.js';
import type { Actor } from '../src/core/types.js';
import { StaffService, createInitialState } from '../src/domain/index.js';

const staff: Actor = { id: 'staff-1', tenantId: 'demo', role: 'staff', name: 'Staff' };
const manager: Actor = { id: 'manager-1', tenantId: 'demo', role: 'manager', name: 'Manager' };
const member: Actor = { id: 'member-1', tenantId: 'demo', role: 'member', name: 'Member' };

describe('adversarial domain boundary review', () => {
  it('rejects malformed actors on read/discovery as well as writes', async () => {
    const service = new StaffService(new MemoryStore(createInitialState(true)));
    for (const malformed of [{ ...member, role: 'Member' }, { ...staff, id: 123 }, { ...staff, tenantId: {} }, null]) {
      const actor = malformed as unknown as Actor;
      await expect(service.snapshot(actor)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(() => service.operations(actor)).toThrow('host-authenticated actor');
      await expect(service.execute(actor, 'stock.receive', { itemId: 'bolts', quantity: 1, reason: 'Delivery' },
        { confirmed: true, actionKey: 'forged' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });

  it('freezes trusted identity before asynchronous reads and transactions', async () => {
    const store = new MemoryStore(createInitialState(true));
    await store.transact(state => state.requests.push({ ...state.requests[0]!, id: 'other-request', memberId: 'other-member' }));
    const service = new StaffService(store);
    const mutableActor = { ...member };
    const snapshot = service.snapshot(mutableActor);
    mutableActor.role = 'manager';
    expect((await snapshot).requests.map(r => r.id)).toEqual(['request-demo']);
    mutableActor.role = 'member';
    const pending = service.execute(mutableActor, 'inventory.consume', { itemId: 'bolts', quantity: 1, purpose: 'Role race' },
      { confirmed: true, actionKey: 'race' });
    mutableActor.role = 'staff';
    await expect(pending).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    expect((await store.read()).items[0]?.available).toBe(4);
  });

  it('rejects stale confirmations transactionally but reconciles committed retries after policy changes', async () => {
    const store = new MemoryStore(createInitialState(true));
    const service = new StaffService(store);
    const input = { itemId: 'bolts', quantity: 1, reason: 'New delivery' };
    const receipt = await service.execute(staff, 'stock.receive', input,
      { confirmed: true, actionKey: 'receipt', expectedPolicyVersion: 1 });
    await service.execute(manager, 'policy.update', { criteria: { selfService: true }, expectedVersion: 1 },
      { confirmed: true, actionKey: 'policy', expectedPolicyVersion: 1 });
    await expect(service.execute(staff, 'stock.receive', input,
      { confirmed: true, actionKey: 'new-receipt', expectedPolicyVersion: 1 })).rejects.toMatchObject({ code: 'POLICY_CHANGED' });
    const replay = await service.execute(staff, 'stock.receive', input,
      { confirmed: true, actionKey: 'receipt', expectedPolicyVersion: 1 });
    expect(replay).toMatchObject({ actionId: receipt.actionId, replayed: true });
    expect((await store.read()).items[0]?.available).toBe(5);
    expect((await store.read()).activity).toHaveLength(2);
  });

  it('keeps equipment counts at the location independent from loans and quarantine', async () => {
    const store = new MemoryStore(createInitialState(true));
    const service = new StaffService(store);
    const act = (operation: string, input: unknown, actionKey: string) =>
      service.execute(staff, operation, input, { confirmed: true, actionKey });
    // The synthetic drill is out on loan: there are zero physical units to subtract.
    await expect(act('stock.adjust', { itemId: 'drill', delta: -1, reason: 'Incorrect borrowed-unit correction' }, 'negative'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    await act('stock.receive', { itemId: 'drill', quantity: 2, reason: 'Two new physical drills' }, 'receipt');
    await act('stock.adjust', { itemId: 'drill', delta: -1, reason: 'One shelf unit missing' }, 'correction');
    expect((await store.read()).loans[0]?.status).toBe('active');
    await act('lending.return', { loanId: 'loan-demo', scan: 'SW:drill', remarks: 'Damaged casing', condition: 'damaged' }, 'return');
    expect((await store.read()).items.find(i => i.id === 'drill')).toMatchObject({ onHand: 2, available: 1, quarantined: 1 });
    await act('stock.adjust', { itemId: 'drill', delta: -1, reason: 'Missing physical shelf unit' }, 'correction-2');
    await expect(act('stock.adjust', { itemId: 'drill', delta: -1, reason: 'Cannot erase quarantine' }, 'correction-3'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect((await store.read()).items.find(i => i.id === 'drill')).toMatchObject({ onHand: 1, available: 0, quarantined: 1 });
  });

  it('rolls back mutations and audit/idempotency if stock overflows the safe integer range', async () => {
    const initial = createInitialState(true);
    initial.items[0]!.onHand = Number.MAX_SAFE_INTEGER; initial.items[0]!.available = Number.MAX_SAFE_INTEGER;
    const store = new MemoryStore(initial); const service = new StaffService(store);
    await expect(service.execute(staff, 'stock.receive', { itemId: 'bolts', quantity: 1, reason: 'Overflow' },
      { confirmed: true, actionKey: 'overflow' })).rejects.toMatchObject({ code: 'STOCK_INVARIANT' });
    const state = await store.read();
    expect(state.items[0]?.available).toBe(Number.MAX_SAFE_INTEGER);
    expect(state.activity).toHaveLength(0); expect(state.movements).toHaveLength(0); expect(Object.keys(state.idempotency)).toHaveLength(0);
  });

  it('rejects coercion and unknown policy properties without mutating the store', async () => {
    const store = new MemoryStore(createInitialState(true)); const service = new StaffService(store);
    for (const quantity of ['1', true, Number.NaN, Number.POSITIVE_INFINITY, { valueOf: () => 1 }]) {
      await expect(service.execute(staff, 'stock.receive', { itemId: 'bolts', quantity, reason: 'Coercion' },
        { confirmed: true, actionKey: 'invalid' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    }
    await expect(service.execute(manager, 'policy.update', { criteria: { version: 100, requireScan: false }, expectedVersion: 1 },
      { confirmed: true, actionKey: 'policy' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(service.execute(staff, 'stock.receive', { itemId: 'bolts', quantity: 1, reason: 'Wrong version type' },
      { confirmed: true, actionKey: 'wrong-version', expectedPolicyVersion: '1' as unknown as number })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect((await store.read()).activity).toHaveLength(0);
  });
});
