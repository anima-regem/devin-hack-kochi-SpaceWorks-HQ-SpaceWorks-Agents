import type { Item, OpsState, Policy } from './types.js';

export function defaultPolicy(): Policy {
  return { version: 1, selfService: false, consumableDailyLimit: 5, loanDays: 7,
    requireScan: true, requireReturnRemarks: true, automationEnabled: false };
}

export function createInitialState(demo = false): OpsState {
  const state: OpsState = { schemaVersion: 1, policies: { demo: defaultPolicy() }, items: [],
    requests: [], loans: [], tasks: [], activity: [], movements: [], runs: [], idempotency: {} };
  if (!demo) return state;
  const item = (id: string, name: string, kind: Item['kind'], onHand: number, reorderPoint: number): Item =>
    ({ tenantId: 'demo', id, name, kind, onHand, available: onHand, quarantined: 0,
      reorderPoint, location: 'Workshop · shelf A', qr: `SW:${id}` });
  state.items = [item('bolts', 'M3 bolts', 'consumable', 4, 10),
    item('soldering-iron', 'Soldering iron', 'equipment', 2, 0), item('drill', 'Cordless drill', 'equipment', 0, 0)];
  state.requests.push({ tenantId: 'demo', id: 'request-demo', itemId: 'soldering-iron',
    itemName: 'Soldering iron', memberId: 'member-1', quantity: 1, status: 'pending',
    dueAt: new Date(Date.now() + 3 * 86400000).toISOString(), policyVersion: 1 });
  state.loans.push({ tenantId: 'demo', id: 'loan-demo', itemId: 'drill', itemName: 'Cordless drill',
    memberId: 'member-1', quantity: 1, status: 'active', dueAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    issueEvidence: { actorId: 'staff-1', scan: 'SW:drill', remarks: 'Synthetic demo handover', at: new Date(Date.now() - 9 * 86400000).toISOString() } });
  return state;
}
