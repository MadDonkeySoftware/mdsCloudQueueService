export class QueueNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, QueueNotFoundError.prototype);
  }
}
