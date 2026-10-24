import { randomUUID } from 'node:crypto';
import type { Context } from './context.js';
import { addTask, checkDue, checkScan, fail, findItem, findScoped } from './context.js';
import type { Input } from './schemas.js';
import type { Loan, Request } from './types.js';

export function request(c: Context, input: Input<'lending.request'>) {
  if (c.actor.role === 'member' && input.memberId !== c.actor.id) fail('FORBIDDEN', 'Members may only request their own loans', 403);
  const item = findItem(c, input.itemId);
  if (item.kind !== 'equipment') fail('WRONG_OPERATION', 'Use consumable taking for this item');
  checkDue(c, input.dueAt);
  if (item.available < input.quantity) fail('INSUFFICIENT_STOCK', 'Requested equipment is unavailable');
  const record: Request = { ...input, id: randomUUID(), tenantId: c.actor.tenantId,
    itemName: item.name, status: 'pending', policyVersion: c.policy.version };
  c.state.requests.push(record);
  return { status: 'pending' as const, summary: 'Loan requested; staff approval and physical handover are still required', result: { request: record } };
}

export function approve(c: Context, input: Input<'lending.approve'>) {
  const record = findScoped(c, c.state.requests, input.requestId, 'Request');
  if (record.status === 'issued') fail('INVALID_STATE', 'Request has already been issued');
  checkDue(c, record.dueAt);
  const item = findItem(c, record.itemId);
  if (item.available < record.quantity) fail('INSUFFICIENT_STOCK', 'Requested equipment is no longer available');
  record.status = 'approved'; record.approvedBy = c.actor.id; record.approvedPolicyVersion = c.policy.version;
  return { summary: 'Request approved; physical handover remains required', result: { request: record } };
}

export function issue(c: Context, input: Input<'lending.issue'>) {
  const record = findScoped(c, c.state.requests, input.requestId, 'Request');
  if (record.status !== 'approved') fail('APPROVAL_REQUIRED', 'Approve this request before issue');
  if (record.approvedPolicyVersion !== c.policy.version) fail('POLICY_CHANGED', 'Policy changed after approval; staff must review and approve again');
  checkDue(c, record.dueAt);
  const item = findItem(c, record.itemId); checkScan(c, item, input.scan);
  if (item.available < record.quantity) fail('INSUFFICIENT_STOCK', 'Equipment is no longer available');
  item.available -= record.quantity; item.onHand -= record.quantity; record.status = 'issued';
  const loan: Loan = { id: randomUUID(), tenantId: c.actor.tenantId, itemId: item.id, itemName: item.name,
    quantity: record.quantity, memberId: record.memberId, dueAt: record.dueAt, status: 'active',
    issueEvidence: { actorId: c.actor.id, scan: input.scan ?? '', remarks: input.remarks ?? '', at: c.at } };
  c.state.loans.push(loan);
  return { summary: `Issued ${record.quantity} ${item.name}`, result: { loan, request: record } };
}

export function returnLoan(c: Context, input: Input<'lending.return'>) {
  const loan = findScoped(c, c.state.loans, input.loanId, 'Loan');
  if (loan.status !== 'active') fail('INVALID_STATE', 'Loan has already been returned');
  const item = findItem(c, loan.itemId); checkScan(c, item, input.scan);
  if ((c.policy.requireReturnRemarks || input.condition === 'damaged') && !input.remarks?.trim())
    fail('EVIDENCE_REQUIRED', 'Return inspection remarks are required');
  loan.status = 'returned'; loan.returnEvidence = { actorId: c.actor.id, scan: input.scan ?? '',
    remarks: input.remarks ?? '', condition: input.condition, at: c.at };
  item.onHand += loan.quantity;
  if (input.condition === 'damaged') {
    item.quarantined += loan.quantity;
    addTask(c, 'damage', loan.id, `Inspect quarantined ${item.name}: ${input.remarks}`);
  } else item.available += loan.quantity;
  return { summary: input.condition === 'damaged' ? `${item.name} returned to quarantine; inspection required` : `${item.name} returned and available`, result: { loan, item } };
}
