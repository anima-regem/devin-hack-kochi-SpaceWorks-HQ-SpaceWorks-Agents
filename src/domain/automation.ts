import { randomUUID } from 'node:crypto';
import type { Context } from './context.js';
import { addTask, fail, findScoped } from './context.js';
import type { Input } from './schemas.js';
import type { Task } from './types.js';

export function updatePolicy(c: Context, input: Input<'policy.update'>) {
  if (input.expectedVersion !== c.policy.version) fail('POLICY_CHANGED', 'Policy changed; review the latest criteria before saving');
  const next = { ...c.policy, ...input.criteria, version: c.policy.version + 1 };
  c.state.policies[c.actor.tenantId] = next;
  return { summary: `Saved operating criteria version ${next.version}`, result: { policy: next } };
}

export function completeTask(c: Context, input: Input<'tasks.complete'>) {
  const task = findScoped(c, c.state.tasks, input.taskId, 'Task');
  if (task.status !== 'open') fail('INVALID_STATE', 'Task is already completed');
  task.status = 'completed'; task.completedAt = c.at; task.completedBy = c.actor.id; task.remarks = input.remarks;
  return { summary: 'Task completed; inventory and loans are unchanged', result: { task } };
}

export function runAutomation(c: Context) {
  if (!c.policy.automationEnabled) fail('AUTOMATION_PAUSED', 'A manager must enable automation in operating criteria first', 403);
  const tenant = c.actor.tenantId;
  const findings: { kind: Task['kind']; subjectId: string; title: string }[] = [];
  for (const item of c.state.items.filter(i => i.tenantId === tenant)) {
    if (item.kind === 'consumable' && item.available <= item.reorderPoint)
      findings.push({ kind: 'low-stock', subjectId: item.id, title: `Replenish ${item.name}: ${item.available} available, threshold ${item.reorderPoint}` });
  }
  for (const loan of c.state.loans.filter(l => l.tenantId === tenant && l.status === 'active' && Date.parse(l.dueAt) < Date.parse(c.at)))
    findings.push({ kind: 'overdue', subjectId: loan.id, title: `Follow up overdue ${loan.itemName}; due ${loan.dueAt}` });
  for (const request of c.state.requests.filter(r => r.tenantId === tenant && r.status === 'pending'))
    findings.push({ kind: 'approval', subjectId: request.id, title: `Review request for ${request.quantity} ${request.itemName}` });
  const keys = new Set(findings.map(f => JSON.stringify([f.kind, f.subjectId])));
  for (const task of c.state.tasks.filter(t => t.tenantId === tenant && t.kind !== 'damage' && !t.resolvedAt)) {
    if (!keys.has(JSON.stringify([task.kind, task.subjectId]))) {
      task.resolvedAt = c.at;
      if (task.status === 'open') { task.status = 'completed'; task.completedAt = c.at; task.remarks = 'Condition resolved on verified state'; }
    }
  }
  const createdTasks: string[] = [];
  for (const finding of findings) {
    if (createdTasks.length >= 100) break;
    const task = addTask(c, finding.kind, finding.subjectId, finding.title);
    if (task) createdTasks.push(task.id);
  }
  const run = { id: randomUUID(), tenantId: tenant, actorId: c.actor.id, at: c.at,
    policyVersion: c.policy.version, status: 'completed' as const, createdTasks };
  c.state.runs.push(run);
  return { summary: `Operations check completed: ${createdTasks.length} new staff tasks; no external notifications sent`,
    result: { run, createdTasks, detectedConditions: findings.length, taskLimit: 100 } };
}
