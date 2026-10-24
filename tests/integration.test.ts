import { afterEach, describe, expect, it } from 'vitest';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { applyIntegration, planIntegration } from '../src/integration/index.js';

const clean: string[] = [];
async function fixture(name = 'inventory-next') {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'ops-install-'))); clean.push(root);
  const app = join(root, 'app'); await cp(resolve('examples/apps', name), app, { recursive: true });
  return { root, app };
}
afterEach(async () => { await Promise.all(clean.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe('reviewable additive Next.js integration', () => {
  it('previews deterministic plans, applies only additive files, and refuses repeat collisions', async () => {
    const { root, app } = await fixture();
    const original = await readFile(join(app, 'inventory.js'), 'utf8');
    const plan = await planIntegration(app, root);
    expect(plan.planHash).toBe((await planIntegration(app, root)).planHash);
    expect(plan.readiness).toBe('integration-pending'); expect(plan.files).toHaveLength(3);
    const result = await applyIntegration(app, root, plan.planHash);
    expect(result.written).toEqual(plan.files.map(file => file.path));
    expect(await readFile(join(app, 'inventory.js'), 'utf8')).toBe(original);
    expect(JSON.parse(await readFile(join(app, '.spaceworks/ops.config.json'), 'utf8')).automationEnabled).toBe(false);
    await expect(applyIntegration(app, root, plan.planHash)).rejects.toMatchObject({ code: 'COLLISION' });
  });
  it('rejects stale plans after source changes and before writing files', async () => {
    const { root, app } = await fixture();
    const plan = await planIntegration(app, root);
    await writeFile(join(app, 'inventory.js'), 'export function listItems() { return []; }');
    await expect(applyIntegration(app, root, plan.planHash)).rejects.toMatchObject({ code: 'STALE_PLAN' });
    await expect(readFile(join(app, '.spaceworks/ops.config.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects alternative Next route extensions and symlinked target directories', async () => {
    const { root, app } = await fixture();
    const routeDir = join(app, 'app/api/ops/v1'); await mkdir(routeDir, { recursive: true });
    await writeFile(join(routeDir, 'route.ts'), 'existing host endpoint');
    await expect(planIntegration(app, root)).rejects.toMatchObject({ code: 'COLLISION' });
    await rm(join(app, 'app/api'), { recursive: true });
    await symlink(root, join(app, '.spaceworks'));
    await expect(planIntegration(app, root)).rejects.toMatchObject({ code: 'UNSAFE_PATH' });
    await expect(planIntegration(root, app)).rejects.toMatchObject({ code: 'OUTSIDE_SCOPE' });
  });
  it('keeps unsupported frameworks visibly incomplete with no files to apply', async () => {
    const { root, app } = await fixture('bookings-python');
    const plan = await planIntegration(app, root);
    expect(plan.readiness).toBe('unsupported'); expect(plan.files).toEqual([]);
    await expect(applyIntegration(app, root, plan.planHash)).rejects.toMatchObject({ code: 'UNSUPPORTED_FRAMEWORK' });
  });
  it('does not produce an installable plan after incomplete bounded inspection', async () => {
    const { root, app } = await fixture();
    await writeFile(join(app, 'oversized.ts'), 'const data = 0;'.repeat(6000));
    const plan = await planIntegration(app, root);
    expect(plan.profile.scan.truncated).toBe(true); expect(plan.files).toEqual([]);
    expect(plan.readiness).toBe('unsupported');
  });
  it('generates syntactically valid executable routes with authentication, strict validation and no enabled business writes', async () => {
    const { root, app } = await fixture();
    const plan = await planIntegration(app, root); await applyIntegration(app, root, plan.planHash);
    for (const file of plan.files.filter(file => /\.(?:mjs|js)$/.test(file.path))) {
      const check = spawnSync(process.execPath, ['--check', join(app, file.path)], { encoding: 'utf8' });
      expect(check.stderr).toBe(''); expect(check.status).toBe(0);
    }
    const endpoint = pathToFileURL(join(app, 'app/api/ops/v1/route.js')).href;
    const script = `import assert from 'node:assert/strict';
      const {GET,POST} = await import(${JSON.stringify(endpoint)});
      delete process.env.SPACEWORKS_OPS_TOKEN;
      assert.equal((await GET(new Request('http://localhost/api/ops/v1'))).status,503);
      const token='a'.repeat(32); process.env.SPACEWORKS_OPS_TOKEN=token;
      assert.equal((await GET(new Request('http://localhost/api/ops/v1'))).status,401);
      const headers={authorization:'Bearer '+token,'content-type':'application/json'};
      const status=await GET(new Request('http://localhost/api/ops/v1',{headers}));
      assert.equal(status.status,200); assert.equal((await status.json()).readiness,'integration-pending');
      const request=(body)=>new Request('http://localhost/api/ops/v1',{method:'POST',headers,body:JSON.stringify(body)});
      const valid={operation:'stock.receive',input:{itemId:'x',quantity:1},actionKey:'stable-key',confirmed:true};
      assert.equal((await POST(request({...valid,actor:{role:'manager'}}))).status,400);
      assert.equal((await POST(request({...valid,confirmed:false}))).status,400);
      assert.equal((await POST(request(valid))).status,503);
      assert.equal((await POST(request({...valid,input:{text:'x'.repeat(20000)}}))).status,413);
      console.log('generated endpoint checks passed');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
    expect(result.stdout).toContain('generated endpoint checks passed');
  });
  it('resolves src/app adapter imports without modifying host source', async () => {
    const { root, app } = await fixture();
    await mkdir(join(app, 'src')); await cp(join(app, 'app'), join(app, 'src/app'), { recursive: true });
    await rm(join(app, 'app'), { recursive: true });
    const plan = await planIntegration(app, root); await applyIntegration(app, root, plan.planHash);
    const endpoint = pathToFileURL(join(app, 'src/app/api/ops/v1/route.js')).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(endpoint)});`], { encoding: 'utf8' });
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  });
});
