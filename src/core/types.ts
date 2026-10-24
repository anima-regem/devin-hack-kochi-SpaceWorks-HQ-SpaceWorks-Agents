export type Role = 'manager' | 'staff' | 'member';
export interface Actor { id: string; tenantId: string; role: Role; name: string }
export interface StateStore<T> {
  read(): Promise<T>;
  transact<R>(change: (state: T) => R | Promise<R>): Promise<R>;
}
export interface OperationResult {
  actionId: string;
  status: 'succeeded' | 'pending';
  summary: string;
  result: unknown;
  replayed?: boolean;
}
export interface OperationDefinition {
  name: string;
  description: string;
  roles: Role[];
  fields: string[];
}
export interface Proposal {
  operation: string; input: Record<string, unknown>; summary: string;
  requiresConfirmation: boolean; missing: string[];
}
