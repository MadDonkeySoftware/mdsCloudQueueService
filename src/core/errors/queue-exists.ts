export class QueueExistsError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, QueueExistsError.prototype);
  }
}
