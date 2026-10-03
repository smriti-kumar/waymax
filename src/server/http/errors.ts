export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_LARGE"
  | "UNPROCESSABLE"
  | "UPSTREAM"
  | "INTERNAL";

export const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_LARGE: 413,
  UNPROCESSABLE: 422,
  UPSTREAM: 503,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get status() {
    return STATUS[this.code];
  }
}

export const badRequest = (msg: string, details?: unknown) => new ApiError("VALIDATION", msg, details);
export const unauthorized = (msg = "Please sign in") => new ApiError("UNAUTHORIZED", msg);
export const forbidden = (msg = "You don't have access to this") => new ApiError("FORBIDDEN", msg);
export const notFound = (msg = "Not found") => new ApiError("NOT_FOUND", msg);
export const conflict = (msg: string) => new ApiError("CONFLICT", msg);
export const tooLarge = (msg = "That file is too large") => new ApiError("TOO_LARGE", msg);
export const unprocessable = (msg: string, details?: unknown) => new ApiError("UNPROCESSABLE", msg, details);
export const upstream = (msg: string) => new ApiError("UPSTREAM", msg);
