import { z } from 'zod';
import { DomainError } from '../core/errors.js';
import type { Actor } from '../core/types.js';

const actorSchema = z.object({
  id: z.string().min(1).max(160), tenantId: z.string().min(1).max(160),
  role: z.enum(['manager', 'staff', 'member']), name: z.string().max(200),
});

/** Host authentication supplies this value; parsing also snapshots its identity. */
export function trustedActor(value: unknown): Actor {
  const parsed = actorSchema.safeParse(value);
  if (!parsed.success) throw new DomainError('UNAUTHENTICATED', 'A valid host-authenticated actor and tenant are required', 401);
  return parsed.data;
}
