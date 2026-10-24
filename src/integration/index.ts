import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DomainError } from '../core/errors.js';
import { inspectApp, type AppProfile } from '../discovery/index.js';
import { authorizedPath, scanApp } from '../discovery/scope.js';
import { adapter, route, instructions } from './templates.js';

export interface IntegrationPlan {
  planHash: string; files: { path: string; content: string }[];
  readiness: 'integration-pending' | 'unsupported'; instructions: string[]; profile: AppProfile;
}

async function safeTarget(root: string, target: string, refuseFile = true): Promise<void> {
  const parts = target.split('/'); let cursor = root;
  for (let i = 0; i < parts.length; i++) {
    cursor = join(cursor, parts[i]!);
    const stat = await lstat(cursor).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    });
    if (!stat) continue;
    if (stat.isSymbolicLink()) throw new DomainError('UNSAFE_PATH', 'Integration target contains a symbolic link.', 409);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new DomainError('COLLISION', `A parent path is not a directory: ${target}`, 409);
    if (i === parts.length - 1 && refuseFile) throw new DomainError('COLLISION', `Refusing to overwrite existing file: ${target}`, 409);
  }
}

export async function planIntegration(path: string, allowedRoot: string): Promise<IntegrationPlan> {
  const scan = await scanApp(path, allowedRoot);
  const profile = await inspectApp(path, allowedRoot);
  const files: IntegrationPlan['files'] = [];
  let readiness: IntegrationPlan['readiness'] = 'unsupported';
  const notes = [...instructions];
  if (scan.truncated) notes.push('Inspection was incomplete. Reduce the selected app scope or review omitted files before generating an integration.');
  else if (profile.framework === 'nextjs') {
    const srcApp = await lstat(join(scan.root, 'src/app')).catch(() => null);
    const app = await lstat(join(scan.root, 'app')).catch(() => null);
    if (srcApp?.isSymbolicLink() || app?.isSymbolicLink()) throw new DomainError('UNSAFE_PATH', 'App router path cannot be a symbolic link.', 409);
    const router = srcApp?.isDirectory() ? 'src/app' : app?.isDirectory() ? 'app' : undefined;
    if (router) {
      readiness = 'integration-pending';
      const endpoint = `${router}/api/ops/v1/route.js`;
      // Next treats route.ts and route.js as the same route: refuse both.
      for (const extension of ['ts', 'tsx', 'js', 'jsx']) await safeTarget(scan.root, `${router}/api/ops/v1/route.${extension}`);
      files.push({ path: endpoint, content: route(`${router === 'src/app' ? '../' : ''}../../../../.spaceworks/ops-adapter.mjs`) });
      files.push({ path: '.spaceworks/ops-adapter.mjs', content: adapter });
      files.push({ path: '.spaceworks/ops.config.json', content: JSON.stringify({ version: 1, integrationStatus: 'pending', automationEnabled: false, operations: [], tokenEnvironment: 'SPACEWORKS_OPS_TOKEN' }, null, 2) + '\n' });
    } else notes.push('Next.js detected, but no supported App Router directory exists. Pages Router integration requires a reviewed adapter.');
  } else notes.push(`No automatic endpoint generator for ${profile.framework}; implement a host-specific integration before activation.`);
  for (const file of files) await safeTarget(scan.root, file.path);
  const planHash = createHash('sha256').update(JSON.stringify({ version: 1, root: scan.root, fingerprint: scan.fingerprint, files, readiness })).digest('hex');
  return { planHash, files, readiness, instructions: notes, profile };
}

export async function applyIntegration(path: string, allowedRoot: string, planHash: string): Promise<{ written: string[]; readiness: 'integration-pending' }> {
  const plan = await planIntegration(path, allowedRoot);
  if (!/^[a-f0-9]{64}$/.test(planHash) || plan.planHash !== planHash) throw new DomainError('STALE_PLAN', 'Application changed or plan hash is invalid. Preview a fresh integration plan.', 409);
  if (plan.readiness === 'unsupported' || !plan.files.length) throw new DomainError('UNSUPPORTED_FRAMEWORK', 'No supported endpoint plan is available for this application.', 422);
  const root = await authorizedPath(path, allowedRoot);
  const written: string[] = [];
  try {
    for (const file of plan.files) {
      await safeTarget(root, file.path);
      // Create each component after inspecting it; never recurse through symlinks.
      let cursor = root;
      for (const component of dirname(file.path).split('/')) {
        cursor = join(cursor, component);
        await mkdir(cursor).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
        const stat = await lstat(cursor);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new DomainError('UNSAFE_PATH', 'Integration parent changed during installation.', 409);
      }
      await safeTarget(root, file.path);
      const handle = await open(join(root, file.path), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      written.push(file.path);
      try { await handle.writeFile(file.content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    }
  } catch (error) {
    // Only remove this invocation's new files; existing application content stays untouched.
    for (const file of written.reverse()) await unlink(join(root, file)).catch(() => undefined);
    throw error;
  }
  return { written, readiness: 'integration-pending' };
}
