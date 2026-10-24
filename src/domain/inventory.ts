import { randomUUID } from 'node:crypto';
import type { Context } from './context.js';
import { fail, findItem } from './context.js';
import type { Input } from './schemas.js';

export function createItem(c: Context, input: Input<'catalogue.create'>) {
  const id = randomUUID();
  const item = { ...input, id, tenantId: c.actor.tenantId, available: input.onHand,
    quarantined: 0, qr: `SW:${id}` };
  c.state.items.push(item);
  c.state.movements.push({ id: c.actionId, tenantId: c.actor.tenantId, actorId: c.actor.id,
    itemId: id, quantity: input.onHand, kind: 'receive', reason: 'Initial catalogue count', at: c.at });
  return { summary: `Added ${item.name} with ${input.onHand} initial stock`, result: { item, movementId: c.actionId } };
}

export function consume(c: Context, input: Input<'inventory.consume'>) {
  const item = findItem(c, input.itemId);
  if (item.kind !== 'consumable') fail('WRONG_OPERATION', 'Equipment requires a lending request and staff handover');
  if (c.actor.role === 'member') {
    if (!c.policy.selfService) fail('POLICY_DENIED', 'Member self-service is disabled', 403);
    const used = c.state.movements.filter(m => m.tenantId === c.actor.tenantId && m.actorId === c.actor.id &&
      m.kind === 'consume' && m.at.slice(0, 10) === c.at.slice(0, 10)).reduce((sum, m) => sum + m.quantity, 0);
    if (used + input.quantity > c.policy.consumableDailyLimit)
      fail('DAILY_LIMIT', `Daily consumable limit is ${c.policy.consumableDailyLimit} across all items`);
  }
  if (item.available < input.quantity) fail('INSUFFICIENT_STOCK', 'Insufficient available stock');
  item.available -= input.quantity; item.onHand -= input.quantity;
  c.state.movements.push({ id: c.actionId, tenantId: c.actor.tenantId, actorId: c.actor.id, itemId: item.id,
    quantity: input.quantity, kind: 'consume', reason: input.purpose, at: c.at });
  return { summary: `Recorded ${input.quantity} ${item.name} as consumed`, result: { item, movementId: c.actionId } };
}

export function receive(c: Context, input: Input<'stock.receive'>) {
  const item = findItem(c, input.itemId);
  item.onHand += input.quantity; item.available += input.quantity;
  c.state.movements.push({ id: c.actionId, tenantId: c.actor.tenantId, actorId: c.actor.id, itemId: item.id,
    quantity: input.quantity, kind: 'receive', reason: input.reason, at: c.at });
  return { summary: `Received ${input.quantity} ${item.name}`, result: { item, receiptId: c.actionId } };
}

export function adjust(c: Context, input: Input<'stock.adjust'>) {
  const item = findItem(c, input.itemId);
  if (item.available + input.delta < 0) fail('INSUFFICIENT_STOCK', 'Correction cannot make stock negative or remove quarantined equipment');
  item.onHand += input.delta; item.available += input.delta;
  c.state.movements.push({ id: c.actionId, tenantId: c.actor.tenantId, actorId: c.actor.id, itemId: item.id,
    quantity: input.delta, kind: 'adjust', reason: input.reason, at: c.at });
  return { summary: `Corrected ${item.name} by ${input.delta}`, result: { item, adjustmentId: c.actionId } };
}
