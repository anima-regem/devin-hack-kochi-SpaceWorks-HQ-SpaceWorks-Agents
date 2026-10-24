import { it, expect } from 'vitest';
import { readConfig, insideWorkspace } from '../src/core/config.js';
import { mkdtemp, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

it('loads validated YAML with explicit model env overrides and rejects scope escapes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agents-config-'));
  try {
    await writeFile(path.join(root, 'agents.yaml'), 'port: 4321\nllm: offline\n');
    const config = await readConfig(root, { AGENTS_LLM: 'anthropic', AGENTS_MODEL: 'test-model' });
    expect(config.port).toBe(4321); expect(config.llm).toBe('anthropic');
    await writeFile(path.join(root, 'agents.yaml'), 'dataDir: ../escape\n');
    await expect(readConfig(root, {})).rejects.toMatchObject({ code: 'OUTSIDE_SCOPE' });
    await mkdir(path.join(root, 'fixture'));
    await symlink(os.tmpdir(), path.join(root, 'outside'));
    expect(await insideWorkspace('fixture', root)).toBe(path.join(await import('node:fs/promises').then(f => f.realpath(root)), 'fixture'));
    await expect(insideWorkspace('outside', root)).rejects.toMatchObject({ code: 'OUTSIDE_SCOPE' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
