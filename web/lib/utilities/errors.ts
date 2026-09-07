/**
 * Diagnowise — error utilities
 *
 * A small typed hierarchy so API routes (phase 3) can catch one thing and
 * map it to the right HTTP status, instead of every route reimplementing
 * "is this a 401 or a 403 or a 404" logic inline.
 */

export class AppError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required.") {
    super(message, 401, "unauthenticated");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.") {
    super(message, 403, "forbidden");
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} not found.`, 404, "not_found");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly issues?: unknown) {
    super(message, 422, "validation_error");
  }
}

/** Converts any thrown error into a safe { status, body } response shape. */
export function toErrorResponse(error: unknown): { status: number; body: { error: string; code: string; issues?: unknown } } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: error.message, code: error.code, ...(error instanceof ValidationError ? { issues: error.issues } : {}) },
    };
  }
  // Never leak raw internal error messages to the client.
  console.error("Unhandled error:", error);
  return { status: 500, body: { error: "Something went wrong. Please try again.", code: "internal_error" } };
}
