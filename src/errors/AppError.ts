class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorDetails?: unknown;

  constructor(statusCode: number, message: string, errorDetails?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errorDetails = errorDetails;
    this.name = "AppError";

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export default AppError;
