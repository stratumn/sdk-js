export default class HttpError extends Error {
  public status: number;
  public body?: any;

  constructor(status: number, message: string, body?: any) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = status;
    this.body = body.errors || body;
    this.name = 'HttpError';
  }
}
