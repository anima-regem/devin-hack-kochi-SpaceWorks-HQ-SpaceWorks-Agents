import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { MemoryStore, JsonFileStore } from '../src/core/store.js';

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function directory() { const p = await mkdtemp(path.join(os.tmpdir(), 'agents-store-')); temporary.push(p); return p; }

describe('transaction stores', () => {
  it('rolls back failures, returns isolated copies and serializes writes', async () => {
    const store = new MemoryStore({ units: 1 });
    await expect(store.transact(s => { s.units = 20; throw Error('refused'); })).rejects.toThrow('refused');
    expect((await store.read()).units).toBe(1);
    const attempt = () => store.transact(async s => { if (!s.units) throw Error('out of stock'); await Promise.resolve(); s.units--; return s.units; });
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const view = await store.read(); view.units = 99;
    expect((await store.read()).units).toBe(0);
  });
  it('persists state and append-only hash-linked commits across restarts', async () => {
    const dir = await directory();
    const first = new JsonFileStore(dir, { units: 2 });
    await first.transact(s => { s.units--; });
    const before = await readFile(path.join(dir, 'journal.ndjson'), 'utf8');
    const second = new JsonFileStore(dir, { units: 999 });
    expect((await second.read()).units).toBe(1);
    await second.transact(s => { s.units--; });
    const after = await readFile(path.join(dir, 'journal.ndjson'), 'utf8');
    expect(after.startsWith(before)).toBe(true);
    expect(after.trim().split('\n')).toHaveLength(2);
    expect((await new JsonFileStore(dir, { units: 0 }).read()).units).toBe(0);
  });
  it('serializes separate store instances and does not append aborted writes', async () => {
    const dir = await directory();
    const stores = [new JsonFileStore(dir, { n: 0 }), new JsonFileStore(dir, { n: 0 })];
    await Promise.all(stores.map(store => store.transact(async s => { await new Promise(r => setTimeout(r, 10)); s.n++; })));
    expect((await stores[0]!.read()).n).toBe(2);
    await expect(stores[0]!.transact(() => { throw Error('stop'); })).rejects.toThrow();
    expect((await readFile(path.join(dir, 'journal.ndjson'), 'utf8')).trim().split('\n')).toHaveLength(2);
  });
  it('recovers committed journal even if snapshot is missing or obsolete', async () => {
    const dir = await directory(); const store = new JsonFileStore(dir, { n: 0 });
    await store.transact(s => { s.n = 7; });
    await writeFile(path.join(dir, 'state.json'), '{"n":999}');
    expect((await store.read()).n).toBe(7);
  });
  it('fails closed on tampering or an incomplete journal instead of silently resetting data', async () => {
    const dir = await directory(); const store = new JsonFileStore(dir, { n: 0 });
    await store.transact(s => { s.n = 3; });
    await appendFile(path.join(dir, 'journal.ndjson'), '{partial');
    await expect(store.read()).rejects.toMatchObject({ code: 'STORE_CORRUPT' });
    await expect(store.transact(s => { s.n++; })).rejects.toMatchObject({ code: 'STORE_CORRUPT' });
  });
});
