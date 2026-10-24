export class DomainError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) {
    super(message); this.name = 'DomainError';
  }
  public() {
    return { code: this.code, message: this.message, ...(this.details === undefined ? {} : { details: this.details }) };
  }
}
