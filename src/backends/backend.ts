export const imageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ImageMimeType = (typeof imageMimeTypes)[number];

export type ImageInput = {
  data: Uint8Array;
  mimeType: ImageMimeType;
};

/** Option keys mapped to a description, or `null` when the key says enough. */
export type QuestionOptions = Readonly<Record<string, string | null>>;

export type Question =
  | {
      id: string;
      /** Pick exactly one option. */
      type: "choice";
      instructions: string;
      options: QuestionOptions;
    }
  | {
      id: string;
      /** Each option applies or not, independently. */
      type: "multi";
      instructions: string;
      options: QuestionOptions;
    }
  | {
      id: string;
      type: "yes-no";
      instructions: string;
    };

export type DecisionRequest = {
  /** What the image is and why it's being tagged. */
  context: string;
  image: ImageInput;
  questions: readonly Question[];
};

export type DecisionResponse = {
  /**
   * Probabilities by question ID, then by option key. A `choice` answer has
   * one entry per option, summing to 1. A `multi` answer has one independent
   * probability per option. A `yes-no` answer has a single `yes` entry.
   */
  answers: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** The exact model that answered, when the provider reports it. */
  modelVersion?: string;
};

/**
 * Answers typed questions about an image. Implement this to use another
 * model, or to pass a fake backend to `Tagger` in tests. `Tagger` rejects any
 * answer that names an option it didn't ask about.
 */
export interface TaggingBackend {
  /** Model name, included in debug logs and error details. */
  readonly model?: string;
  /** Throw when the request fails; `Tagger` reports it as `backend-failure`. */
  decide(request: DecisionRequest): Promise<DecisionResponse>;
}
