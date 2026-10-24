import { scanApp, type SourceFile } from './scope.js';

export interface Evidence { path: string; line: number; snippet: string }
export interface Capability { name: string; status: 'detected-unverified'; evidence: string[] }
export interface AppProfile {
  path: string; purpose: string; domains: string[]; framework: string;
  capabilities: Capability[]; gaps: string[];
  recommendedTasks: { name: string; status: 'needs-implementation'; reason: string }[];
  evidence: Evidence[]; scan: { files: number; excluded: number; truncated: boolean };
}
const domains = [
  { name: 'inventory', signal: /\b(?:inventory|stock|consumable|reorder_point|on_hand|onHand|item_id|itemId)\b/i, purpose: 'Manage inventory, stock and item availability', tasks: ['Low-stock staff follow-up', 'Guided stock receipt and item handover'] },
  { name: 'bookings', signal: /\b(?:bookings?|reservation|room_id|roomId|time_slot|timeSlot)\b/i, purpose: 'Manage reservations and resource availability', tasks: ['Pending booking staff follow-up', 'Availability and conflict checks'] },
  { name: 'machines', signal: /\b(?:machine_id|machineId|maintenance|fabrication)\b/i, purpose: 'Coordinate machines and maintenance', tasks: ['Maintenance exception review'] },
  { name: 'events', signal: /\b(?:event_id|eventId|checkin|check_in|attendee)\b/i, purpose: 'Manage events and attendance', tasks: ['Event staff preparation'] },
  { name: 'membership', signal: /\b(?:membership|renewal|member_status)\b/i, purpose: 'Manage membership and renewals', tasks: ['Membership renewal staff follow-up'] },
];
const operations = [
  ['inventory.read', /(?:function|def|class|const|async)\s+(?:\w*(?:get|list|find|search)[_]?items?|\w*inventory\w*)\b/i],
  ['stock.receive', /(?:function|def|const|async)\s+(?:receive[_]?stock|stock[_]?receive)\b/i],
  ['lending.issue', /(?:function|def|const|async)\s+(?:issue[_]?(?:loan|item)|checkout[_]?item)\b/i],
  ['bookings.read', /(?:function|def|const|async)\s+(?:list[_]?bookings|get[_]?availability|available[_]?slots)\b/i],
  ['bookings.request', /(?:function|def|const|async)\s+(?:create[_]?booking|request[_]?booking)\b/i],
] as const;

function evidence(file: SourceFile, pattern: RegExp): Evidence | undefined {
  const lines = file.content.split('\n');
  const index = lines.findIndex(line => !/^\s*(?:\/\/|\/\*|\*|#|"""|''')/.test(line) && pattern.test(line) && !/secret|password|token|api[_-]?key/i.test(line));
  if (index < 0) return undefined;
  return { path: file.path, line: index + 1, snippet: lines[index]!.trim().slice(0, 180) };
}

export async function inspectApp(path: string, allowedRoot: string): Promise<AppProfile> {
  const scan = await scanApp(path, allowedRoot);
  const refs: Evidence[] = [];
  const sources = scan.files.filter(file => /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|sql|prisma)$/.test(file.path));
  const detected = domains.filter(domain => {
    const matches = sources.flatMap(file => evidence(file, domain.signal) ?? []);
    refs.push(...matches.slice(0, 3)); return matches.length > 0;
  });
  let framework = 'unknown';
  const pkg = scan.files.find(file => file.path === 'package.json');
  if (pkg) {
    try {
      const data = JSON.parse(pkg.content) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };
      if (data.dependencies?.next || data.devDependencies?.next) { framework = 'nextjs'; const ref = evidence(pkg, /"next"\s*:/); if (ref) refs.push(ref); }
    } catch { /* malformed manifests are an evidence gap */ }
  }
  if (framework === 'unknown') for (const file of sources) {
    const ref = evidence(file, /(?:from flask import|from fastapi import|from django)/);
    if (ref) { framework = /fastapi/.test(ref.snippet) ? 'fastapi' : /flask/.test(ref.snippet) ? 'flask' : 'django'; refs.push(ref); break; }
  }
  const capabilities: Capability[] = [];
  for (const [name, signal] of operations) {
    const matches = sources.flatMap(file => evidence(file, signal) ?? []);
    if (matches.length) { refs.push(...matches.slice(0, 3)); capabilities.push({ name, status: 'detected-unverified', evidence: matches.map(ref => `${ref.path}:${ref.line}`) }); }
  }
  const gaps = [
    'Source matches are candidates; callable operations, runtime availability and business correctness have not been verified.',
    'Host authentication, tenant permissions, policy, audit and idempotency must be connected and tested before activation.',
    'Staff operating criteria and resource availability require authorized manager confirmation and live host checks.',
  ];
  if (!detected.length) gaps.push('Application purpose is unknown: no supported domain evidence in inspected implementation files.');
  if (detected.length > 1) gaps.push('Mixed application domains detected; select the staff workflows to activate.');
  if (framework === 'unknown') gaps.push('No supported framework identified.');
  if (scan.truncated) gaps.push('Inspection limits reached; profile is incomplete and requires targeted review.');
  const unique = [...new Map(refs.map(ref => [`${ref.path}:${ref.line}`, ref])).values()];
  return {
    path: scan.root, purpose: detected.map(domain => domain.purpose).join('; ') || 'Unknown; ask the maintainer to confirm the application purpose',
    domains: detected.map(domain => domain.name), framework, capabilities, gaps,
    recommendedTasks: detected.flatMap(domain => domain.tasks.map(name => ({ name, status: 'needs-implementation' as const, reason: 'Connect authenticated host services, confirm staff criteria, and verify availability before activation.' }))),
    evidence: unique, scan: { files: scan.files.length, excluded: scan.excluded, truncated: scan.truncated },
  };
}
