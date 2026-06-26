export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_JSON'
  | 'INTERNAL_ERROR';

export type ApiErrorPayload = {
  error: string;
  code: ApiErrorCode;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string, code: ApiErrorCode = 'VALIDATION_ERROR'): ApiError {
  return new ApiError(400, code, message);
}

export function notFound(message: string): ApiError {
  return new ApiError(404, 'NOT_FOUND', message);
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof SyntaxError) return badRequest('Invalid JSON body', 'INVALID_JSON');
  if (error instanceof Error) return new ApiError(500, 'INTERNAL_ERROR', error.message || 'Internal server error');
  return new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');
}

export function apiErrorPayload(error: ApiError): ApiErrorPayload {
  return { error: error.message, code: error.code };
}

export function inferErrorCode(status: number | undefined): ApiErrorCode {
  if (status === 404) return 'NOT_FOUND';
  if (status === 400 || status === undefined) return 'BAD_REQUEST';
  return 'INTERNAL_ERROR';
}
