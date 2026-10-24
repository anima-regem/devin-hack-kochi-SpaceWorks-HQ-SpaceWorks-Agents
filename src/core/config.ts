import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { parse } from 'yaml';
import { DomainError } from './errors.js';

const schema = z.object({
  port: z.number().int().min(1024).max(65535).default(4317),
  dataDir: z.string().min(1).default('.data'),
  automationIntervalSeconds: z.number().int().min(15).max(86400).default(60),
  llm: z.enum(['offline', 'openai', 'anthropic', 'openai-compatible']).default('offline'),
  model: z.string().max(200).default(''),
}).strict();
export type Config = z.infer<typeof schema>;

export async function readConfig(root: string, env: NodeJS.ProcessEnv = process.env): Promise<Config> {
  let input: unknown = {};
  try { input = parse(await readFile(path.join(root, 'agents.yaml'), 'utf8')) ?? {}; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const base = schema.parse(input);
  const config = schema.parse({ ...base,
    ...(env.AGENTS_LLM ? { llm: env.AGENTS_LLM } : {}),
    ...(env.AGENTS_MODEL ? { model: env.AGENTS_MODEL } : {}),
  });
  const directory = path.resolve(root, config.dataDir);
  const relative = path.relative(path.resolve(root), directory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new DomainError('OUTSIDE_SCOPE', 'dataDir must be a subdirectory of the Agents workspace.');
  }
  return config;
}

export async function insideWorkspace(target: string, root: string): Promise<string> {
  const actualRoot = await realpath(root);
  const actual = await realpath(path.resolve(actualRoot, target));
  const relative = path.relative(actualRoot, actual);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new DomainError('OUTSIDE_SCOPE', 'Path is outside the authorized workspace.', 403);
  return actual;
}
