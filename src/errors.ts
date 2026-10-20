/**
 * What went wrong: `invalid-configuration` for an invalid vocabulary, backend options or `categories`;
 * `invalid-image` for an unsupported or empty image, which is never sent; `request-too-large` for a request
 * over `maxRequestBytes`; `backend-failure` when the request failed after any retries, with the original error
 * as `cause`; `invalid-response` when the answers don't match the questions, listed in `details.issues`.
 * @group Errors
 */
export type TaggingErrorCode =
  | "backend-failure"
  | "invalid-configuration"
  | "invalid-image"
  | "invalid-response"
  | "request-too-large";

/**
 * Thrown for every failure. `code` says what went wrong, and `details` has the request's `id` and `model`.
 * @group Errors
 */
export class TaggingError extends Error {
  /** Always `TaggingError`. */
  public readonly name = "TaggingError";

  constructor(
    message: string,
    /** What went wrong. */
    public readonly code: TaggingErrorCode,
    /** The request's `id` and `model`, and more for some codes, such as `issues`. */
    public readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
