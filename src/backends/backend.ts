/**
 * The image types the tagger accepts: JPEG, PNG and WebP.
 * @group Backends
 */
export const imageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * An image type the tagger accepts.
 * @group Backends
 */
export type ImageMimeType = (typeof imageMimeTypes)[number];

/**
 * An image's bytes and type.
 * @group Backends
 */
export type ImageInput = {
  /** The image file's bytes. */
  data: Uint8Array;
  /** `image/jpeg`, `image/png` or `image/webp`. */
  mimeType: ImageMimeType;
};

/**
 * A question's options: keys mapped to descriptions, or `null` when the key says enough.
 * @group Backends
 */
export type QuestionOptions = Readonly<Record<string, string | null>>;

/**
 * One question about the image, built from a category: `choice` for a single category, `multi` for a multi category, and `yes-no` for a flag.
 * @group Backends
 */
export type Question =
  | {
      /** The category name. */
      id: string;
      /** Pick exactly one option. */
      type: "choice";
      /** The question, as asked. */
      instructions: string;
      /** The values to choose from. */
      options: QuestionOptions;
    }
  | {
      /** The category name. */
      id: string;
      /** Each option applies or not, independently. */
      type: "multi";
      /** The question, as asked. */
      instructions: string;
      /** The values to choose from. */
      options: QuestionOptions;
    }
  | {
      /** The category name. */
      id: string;
      type: "yes-no";
      /** The question, as asked. */
      instructions: string;
    };

/**
 * What {@link Tagger} asks a {@link TaggingBackend}: one image and a question for each category.
 * @group Backends
 */
export type DecisionRequest = {
  /** What the image is and why it's being tagged. */
  context: string;
  /** The image, as given to `tag()`. */
  image: ImageInput;
  /** One for each category asked about. */
  questions: readonly Question[];
};

/**
 * A {@link TaggingBackend}'s answers to a {@link DecisionRequest}.
 * @group Backends
 */
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
 * A model that answers questions about an image. {@link AmosBackend} is the default. For another model, or a
 * stub in tests, pass any object with `decide()`.
 * @group Backends
 */
export interface TaggingBackend {
  /** Model name, included in debug logs and error details. */
  readonly model?: string;
  /** Throw when the request fails; `Tagger` reports it as `backend-failure`. */
  decide(request: DecisionRequest): Promise<DecisionResponse>;
}
