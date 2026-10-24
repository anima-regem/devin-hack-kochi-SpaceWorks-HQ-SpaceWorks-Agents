import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { JsonFileStore, MemoryStore } from '../src/core/store.js';
import type { StateStore } from '../src/core/types.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });
async function diskStore() {
  const directory = await mkdtemp(path.join(process.cwd(), '.store-review-'));
  directories.push(directory);
  return new JsonFileStore(directory, { units: 2 });
}

describe('transaction result and ownership boundaries', () => {
  for (const kind of ['memory', 'disk'] as const) {
    it(`${kind}: rejects an uncloneable result before committing changes and keeps its queue usable`, async () => {
      const store: StateStore<{ units: number }> = kind === 'memory' ? new MemoryStore({ units: 2 }) : await diskStore();
      await expect(store.transact(state => { state.units = 0; return () => 'uncloneable'; })).rejects.toThrow();
      expect(await store.read()).toEqual({ units: 2 });
      await store.transact(state => { state.units -= 1; return { remaining: state.units }; });
      expect(await store.read()).toEqual({ units: 1 });
    });
  }

  it('does not expose mutable committed memory through a callback-retained draft', async () => {
    const store = new MemoryStore({ units: 2, evidence: { scan: 'physical-label' } });
    let retained: { units: number; evidence: { scan: string } } | undefined;
    const result = await store.transact(state => { retained = state; state.units = 1; return state.evidence; });
    retained!.units = 99; retained!.evidence.scan = 'changed later'; result.scan = 'changed result';
    expect(await store.read()).toEqual({ units: 1, evidence: { scan: 'physical-label' } });
  });
});
