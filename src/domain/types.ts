import type { OperationResult } from '../core/types.js';

export interface Policy {
  version: number; selfService: boolean; consumableDailyLimit: number; loanDays: number;
  requireScan: boolean; requireReturnRemarks: boolean; automationEnabled: boolean;
}
export interface Item {
  tenantId: string; id: string; name: string; kind: 'consumable' | 'equipment';
  /** Physical stock at the location, excluding all active loans; equals available + quarantined. */
  onHand: number; available: number; quarantined: number; reorderPoint: number;
  location: string; qr: string;
}
export interface Request {
  tenantId: string; id: string; itemId: string; itemName: string; memberId: string;
  quantity: number; status: 'pending' | 'approved' | 'issued'; dueAt: string;
  policyVersion: number; approvedBy?: string; approvedPolicyVersion?: number;
}
export interface Loan {
  tenantId: string; id: string; itemId: string; itemName: string; memberId: string;
  quantity: number; status: 'active' | 'returned'; dueAt: string;
  issueEvidence: { actorId: string; scan: string; remarks: string; at: string };
  returnEvidence?: { actorId: string; scan: string; remarks: string; condition: 'good' | 'damaged'; at: string };
}
export interface Task {
  tenantId: string; id: string; kind: 'low-stock' | 'overdue' | 'approval' | 'damage';
  title: string; status: 'open' | 'completed'; subjectId: string;
  cycle: number; createdAt: string; completedAt?: string; completedBy?: string; remarks?: string; resolvedAt?: string;
}
export interface Activity {
  tenantId: string; actorId: string; actionId: string; operation: string;
  summary: string; at: string; policyVersion: number;
}
export interface Movement {
  id: string; tenantId: string; actorId: string; itemId: string; quantity: number; kind: 'consume' | 'receive' | 'adjust';
  reason: string; at: string;
}
export interface Run {
  id: string; tenantId: string; actorId: string; at: string; policyVersion: number;
  status: 'completed'; createdTasks: string[];
}
export interface OpsState {
  schemaVersion: 1; policies: Record<string, Policy>; items: Item[]; requests: Request[];
  loans: Loan[]; tasks: Task[]; activity: Activity[]; movements: Movement[]; runs: Run[];
  idempotency: Record<string, { fingerprint: string; result: OperationResult }>;
}
export interface StaffSnapshot {
  items: Item[]; requests: Request[]; loans: Loan[]; tasks: Task[];
  activity: Activity[]; policy: Policy;
}
