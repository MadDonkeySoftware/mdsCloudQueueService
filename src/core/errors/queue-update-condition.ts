export class QueueUpdateConditionError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, QueueUpdateConditionError.prototype);
  }
}
