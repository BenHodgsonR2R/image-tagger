export type TaggingErrorCode =
  | "backend-failure"
  | "invalid-configuration"
  | "invalid-image"
  | "invalid-response"
  | "request-too-large";

export class TaggingError extends Error {
  public readonly name = "TaggingError";

  constructor(
    message: string,
    public readonly code: TaggingErrorCode,
    public readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
