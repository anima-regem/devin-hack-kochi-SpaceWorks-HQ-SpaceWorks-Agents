export const adapter = `// Integration scaffold. No host business actions are connected.
// Replace this module through a reviewed change that uses host auth, tenancy,
// domain services, policy, audit, transactional idempotency and verification.
export async function integrationStatus() {
  return { readiness: 'integration-pending', operations: [],
    gaps: ['Connect host authentication and actor/tenant context',
      'Connect and test domain services, policy, audit and idempotency',
      'Confirm manager criteria before enabling staff automation'] };
}
export async function executeOperation(_request) {
  return { status: 503, body: { error: { code: 'INTEGRATION_PENDING',
    message: 'Business operations remain disabled until host integration is reviewed and verified.' } } };
}
`;

export function route(importPath: string): string {
  return `import { timingSafeEqual } from 'node:crypto';
import { integrationStatus, executeOperation } from '${importPath}';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function authorize(request) {
  const expected = process.env.SPACEWORKS_OPS_TOKEN;
  if (!expected || expected.length < 32) return json({ error: { code: 'OPS_NOT_CONFIGURED', message: 'Configure a dedicated token of at least 32 characters; host identity integration remains pending.' } }, 503);
  const supplied = request.headers.get('authorization') || '';
  const target = 'Bearer ' + expected;
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(target) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(target)))
    return json({ error: { code: 'UNAUTHORIZED', message: 'Bearer authentication required.' } }, 401);
  return null;
}
export async function GET(request) {
  const denied = authorize(request); if (denied) return denied;
  return json(await integrationStatus());
}
export async function POST(request) {
  const denied = authorize(request); if (denied) return denied;
  if (!(request.headers.get('content-type') || '').startsWith('application/json'))
    return json({ error: { code: 'INVALID_CONTENT_TYPE', message: 'Use application/json.' } }, 415);
  // Limit streaming bodies too; Content-Length alone is not authoritative.
  let body;
  try {
    const reader = request.body?.getReader(); let size = 0; const chunks = [];
    if (!reader) throw new Error('Missing body');
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 16384) { await reader.cancel(); return json({ error: { code: 'BODY_TOO_LARGE', message: 'Maximum request size is 16 KiB.' } }, 413); }
      chunks.push(Buffer.from(value));
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return json({ error: { code: 'INVALID_JSON', message: 'A valid JSON body is required.' } }, 400); }
  const keys = ['operation', 'input', 'actionKey', 'confirmed'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key)) ||
      typeof body.operation !== 'string' || !/^[a-z][a-z0-9_.]{1,79}$/.test(body.operation) ||
      typeof body.actionKey !== 'string' || body.actionKey.length < 8 || body.actionKey.length > 128 ||
      body.confirmed !== true || !body.input || typeof body.input !== 'object' || Array.isArray(body.input))
    return json({ error: { code: 'INVALID_OPERATION', message: 'Provide operation, object input, actionKey (8–128 characters), and confirmed:true. Actor/tenant overrides are not accepted.' } }, 400);
  const result = await executeOperation(body);
  return json(result.body, result.status);
}
`;
}

export const instructions = [
  'Generated endpoint is a fail-closed scaffold, not completed business integration; no automated staff actions are enabled.',
  'Configure SPACEWORKS_OPS_TOKEN with a dedicated random token of at least 32 characters in host deployment secrets. Never commit it.',
  'Replace the pending adapter through a reviewed change: use host authentication to resolve actor/tenant, connect domain services, and enforce staff permissions, policy, audit, transactional idempotency and verification.',
  'Run host build and integration tests, including tenant isolation, authorization, duplicate submissions and live resource availability.',
  'Ask the manager for operating criteria and explicitly activate only verified workflows. No host tests or domain writes were executed by this installer.',
];
