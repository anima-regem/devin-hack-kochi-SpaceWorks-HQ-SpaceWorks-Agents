import { randomUUID, createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import type { StateStore } from './types.js';
import { DomainError } from './errors.js';

export class MemoryStore<T> implements StateStore<T> {
  private state: T;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(initial: T) { this.state = structuredClone(initial); }
  async read(): Promise<T> { await this.tail; return structuredClone(this.state); }
  transact<R>(change: (state: T) => R | Promise<R>): Promise<R> {
    const result = this.tail.then(async () => {
      const draft = structuredClone(this.state);
      const output = await change(draft);
      this.state = draft;
      return structuredClone(output);
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
}

interface JournalRecord<T> {
  version: 1; sequence: number; at: string; previous: string; state: T; hash: string;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Journal is authoritative; snapshot is an atomically replaced convenience export. */
export class JsonFileStore<T> implements StateStore<T> {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private directory: string, private initial: T) {}

  private async locked<R>(work: () => Promise<R>): Promise<R> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    for (const name of ['', 'journal.ndjson', 'state.json', '.lock']) {
      try {
        if ((await lstat(path.join(this.directory, name))).isSymbolicLink()) {
          throw new DomainError('UNSAFE_STORAGE', 'Storage paths must not be symbolic links.');
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const lockPath = path.join(this.directory, '.lock');
    let handle;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { handle = await open(lockPath, 'wx', 0o600); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
    if (!handle) throw new DomainError('STORE_LOCKED', 'Storage is busy. If a process crashed, verify it stopped before removing .lock.', 503);
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      return await work();
    } finally { await handle.close(); await unlink(lockPath); }
  }

  private async recover(): Promise<{ state: T; sequence: number; lastHash: string }> {
    let raw: string;
    try { raw = await readFile(path.join(this.directory, 'journal.ndjson'), 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        try { await lstat(path.join(this.directory, 'state.json')); }
        catch (missing) {
          if ((missing as NodeJS.ErrnoException).code === 'ENOENT') return { state: structuredClone(this.initial), sequence: 0, lastHash: '' };
          throw missing;
        }
        throw new DomainError('STORE_CORRUPT', 'Snapshot exists without its journal. Restore both from a verified backup.', 503);
      }
      throw error;
    }
    let state = structuredClone(this.initial), sequence = 0, lastHash = '';
    if (raw && !raw.endsWith('\n')) throw new DomainError('STORE_CORRUPT', 'Incomplete journal entry. Restore a verified backup before writing.', 503);
    for (const line of raw.split('\n').filter(Boolean)) {
      try {
        const record = JSON.parse(line) as JournalRecord<T>;
        const { hash: recordHash, ...content } = record;
        if (content.version !== 1 || content.sequence !== sequence + 1 || content.previous !== lastHash
          || !('state' in content) || hash(content) !== recordHash) throw new Error('Invalid chain');
        state = content.state; sequence = content.sequence; lastHash = recordHash;
      } catch { throw new DomainError('STORE_CORRUPT', 'Journal validation failed. Restore a verified backup before writing.', 503); }
    }
    return { state, sequence, lastHash };
  }

  private enqueue<R>(work: () => Promise<R>): Promise<R> {
    const result = this.tail.then(() => this.locked(work));
    this.tail = result.catch(() => undefined);
    return result;
  }

  read(): Promise<T> { return this.enqueue(async () => structuredClone((await this.recover()).state)); }

  transact<R>(change: (state: T) => R | Promise<R>): Promise<R> {
    return this.enqueue(async () => {
      const previous = await this.recover();
      const draft = structuredClone(previous.state);
      const result = await change(draft);
      const content = { version: 1 as const, sequence: previous.sequence + 1, at: new Date().toISOString(), previous: previous.lastHash, state: draft };
      const record = { ...content, hash: hash(content) };
      const journal = await open(path.join(this.directory, 'journal.ndjson'), 'a', 0o600);
      try { await journal.writeFile(`${JSON.stringify(record)}\n`); await journal.sync(); }
      finally { await journal.close(); }
      // Once journal fsync succeeds, the transaction is committed. Snapshot errors
      // must not report an ambiguous failure; the journal repairs the next read.
      const temporary = path.join(this.directory, `.snapshot-${randomUUID()}`);
      try {
        const snapshot = await open(temporary, 'wx', 0o600);
        try { await snapshot.writeFile(JSON.stringify(draft, null, 2)); await snapshot.sync(); }
        finally { await snapshot.close(); }
        await rename(temporary, path.join(this.directory, 'state.json'));
      } catch { await unlink(temporary).catch(() => undefined); }
      return structuredClone(result);
    });
  }
}
