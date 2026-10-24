import { afterEach, describe, expect, it } from 'vitest';
import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspectApp } from '../src/discovery/index.js';

const clean: string[] = [];
async function fixture(name?: string) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'ops-discovery-'))); clean.push(root);
  const app = join(root, 'app'); await mkdir(app);
  if (name) await cp(resolve('examples/apps', name), app, { recursive: true });
  return { root, app };
}
afterEach(async () => { await Promise.all(clean.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe('bounded evidence-based application discovery', () => {
  it('identifies Next.js inventory from implementation and never claims live capabilities', async () => {
    const { root, app } = await fixture('inventory-next');
    const profile = await inspectApp(app, root);
    expect(profile.framework).toBe('nextjs'); expect(profile.domains).toEqual(['inventory']);
    expect(profile.capabilities.map(cap => cap.name)).toContain('stock.receive');
    expect(profile.capabilities.every(cap => cap.status === 'detected-unverified')).toBe(true);
    expect(profile.evidence.some(ref => ref.path === 'inventory.js' && ref.line > 0)).toBe(true);
    expect(profile.recommendedTasks.every(task => task.status === 'needs-implementation')).toBe(true);
    expect(profile.gaps.join(' ')).toContain('runtime availability');
  });
  it('discovers a different app and framework without inventory recommendations', async () => {
    const { root, app } = await fixture('bookings-python');
    const profile = await inspectApp(app, root);
    expect(profile.framework).toBe('flask'); expect(profile.domains).toEqual(['bookings']);
    expect(profile.capabilities.map(cap => cap.name)).toContain('bookings.request');
    expect(profile.recommendedTasks.some(task => /stock|handover/i.test(task.name))).toBe(false);
  });
  it('does not trust repository names or README capability claims', async () => {
    const { root, app } = await fixture();
    await writeFile(join(app, 'README.md'), 'Inventory app supports lending, stock, bookings and every API.');
    await writeFile(join(app, 'claims.js'), '// Inventory app supports stock and bookings; function receiveStock() {}\nexport const projectName = "example";');
    const profile = await inspectApp(app, root);
    expect(profile.domains).toEqual([]); expect(profile.capabilities).toEqual([]);
    expect(profile.purpose).toMatch(/^Unknown/);
  });
  it('reports mixed domains explicitly and does not hide missing integration', async () => {
    const { root, app } = await fixture('inventory-next');
    await writeFile(join(app, 'bookings.js'), 'export function createBooking(roomId, timeSlot) { return {roomId, timeSlot}; }');
    const profile = await inspectApp(app, root);
    expect(profile.domains).toEqual(['inventory', 'bookings']);
    expect(profile.gaps.join(' ')).toContain('Mixed application domains');
    expect(profile.gaps.join(' ')).toContain('tenant permissions');
  });
  it('excludes secret files, dependencies and symlinks, and refuses scope escape', async () => {
    const { root, app } = await fixture();
    await writeFile(join(app, '.env'), 'SECRET=inventory');
    await writeFile(join(app, 'credentials.ts'), 'export const stock = "hidden";');
    await mkdir(join(app, 'node_modules')); await writeFile(join(app, 'node_modules', 'junk.js'), 'const roomId = 1;');
    await writeFile(join(root, 'outside.ts'), 'const inventory = 1;');
    await symlink(join(root, 'outside.ts'), join(app, 'linked.ts'));
    await symlink(root, join(app, 'linked-dir'));
    const profile = await inspectApp(app, root);
    expect(profile.scan.files).toBe(0); expect(profile.scan.excluded).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(profile)).not.toContain('SECRET=');
    await expect(inspectApp(root, app)).rejects.toMatchObject({ code: 'OUTSIDE_SCOPE' });
    await expect(inspectApp(join(app, 'linked-dir'), root)).rejects.toMatchObject({ code: 'UNSAFE_PATH' });
  });
  it('bounds individual files and depth and reports incompleteness', async () => {
    const { root, app } = await fixture();
    await writeFile(join(app, 'huge.ts'), 'const inventory = 1;'.repeat(5000));
    const nested = join(app, ...Array.from({ length: 10 }, () => 'deep'));
    await mkdir(nested, { recursive: true }); await writeFile(join(nested, 'hidden.ts'), 'const roomId=1;');
    const profile = await inspectApp(app, root);
    expect(profile.scan.truncated).toBe(true); expect(profile.domains).toEqual([]);
    expect(profile.gaps.join(' ')).toContain('incomplete');
  });
});
