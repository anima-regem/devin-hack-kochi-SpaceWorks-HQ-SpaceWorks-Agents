import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { DomainError } from '../core/errors.js';

const excludedDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.venv', 'venv', '__pycache__', '.spaceworks']);
const sourceExtensions = /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|sql|prisma)$/i;
const secretName = /(?:^\.env|secret|credential|password|token|private[-_]?key|\.pem$|\.key$|\.p12$|\.log$|lock(?:\.json)?$)/i;
export interface SourceFile { path: string; content: string }
export interface Scan { root: string; files: SourceFile[]; excluded: number; truncated: boolean; fingerprint: string }

export async function authorizedPath(path: string, allowedRoot: string): Promise<string> {
  const boundary = resolve(allowedRoot), target = resolve(path);
  const rel = relative(boundary, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new DomainError('OUTSIDE_SCOPE', 'Application must be inside the authorized folder.', 403);
  let cursor = boundary;
  for (const part of ['', ...rel.split(sep).filter(Boolean)]) {
    cursor = part ? join(cursor, part) : cursor;
    const stat = await lstat(cursor).catch(() => null);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) throw new DomainError('UNSAFE_PATH', 'Application paths must be existing directories without symbolic links.', 400);
  }
  // Reject an aliased boundary too: its real location must be exactly the approved path.
  if (await realpath(boundary) !== boundary) throw new DomainError('UNSAFE_PATH', 'The authorized folder must not have symbolic-link ancestors.', 400);
  return target;
}

export async function scanApp(path: string, allowedRoot: string): Promise<Scan> {
  const root = await authorizedPath(path, allowedRoot);
  const files: SourceFile[] = [];
  let excluded = 0, truncated = false, bytes = 0, entries = 0;
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 8) { truncated = true; return; }
    if (await realpath(dir).catch(() => '') !== dir || (await lstat(dir)).isSymbolicLink()) { excluded++; return; }
    const children = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      if (++entries > 4000 || files.length >= 200 || bytes >= 2_000_000) { truncated = true; break; }
      const absolute = join(dir, child.name);
      if (child.isSymbolicLink() || secretName.test(child.name)) { excluded++; continue; }
      if (child.isDirectory()) {
        if (excludedDirs.has(child.name) || child.name.startsWith('.')) { excluded++; continue; }
        await walk(absolute, depth + 1); continue;
      }
      if (!child.isFile() || !(sourceExtensions.test(child.name) || ['package.json', 'README.md', 'requirements.txt', 'pyproject.toml'].includes(child.name))) { excluded++; continue; }
      if (await realpath(absolute).catch(() => '') !== absolute) { excluded++; continue; }
      // NOFOLLOW prevents a file replaced with a symlink during traversal being read.
      const file = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => null);
      if (!file) { excluded++; continue; }
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size > 65_536) { excluded++; truncated = true; continue; }
        const content = await file.readFile('utf8');
        if (content.includes('\0')) { excluded++; continue; }
        bytes += stat.size; files.push({ path: relative(root, absolute).split(sep).join('/'), content });
      } finally { await file.close(); }
    }
  }
  await walk(root, 0);
  const fingerprint = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  return { root, files, excluded, truncated, fingerprint };
}
