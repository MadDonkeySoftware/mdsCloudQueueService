export class InvalidNameError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidNameError.prototype);
  }
}
