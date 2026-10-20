import type {
  DecisionResponse,
  ImageMimeType,
  Question,
} from "./backends/backend.ts";

/**
 * The right answer for one category, in a {@link DecisionRecord}: a value for a single category, values for a
 * multi category, `true` or `false` for a flag, or `null` when a single category should have no value.
 * @group Evaluation
 */
export type ExpectedValue = string | readonly string[] | boolean | null;

/**
 * What one `tag()` call asked and what came back, as plain JSON. Save it,
 * add `expected`, and score the tagger with `tagger.evaluate()`.
 * @group Evaluation
 */
export type DecisionRecord = {
  /** The record's format. Records in other formats are skipped. */
  format: 1;
  /** The request's `id`. */
  id?: string;
  /** ISO 8601. */
  createdAt: string;
  /** Identifies the image without storing it. */
  image: { sha256: string; mimeType: ImageMimeType; bytes: number };
  /** As sent, including the default when none was given. */
  context: string;
  /** As sent, including default wording and any none-of-these option. */
  questions: readonly Question[];
  /** Raw probabilities by question ID, then option key. */
  answers: DecisionResponse["answers"];
  /** The backend's model name. */
  model?: string;
  /** The exact model that answered, when the backend reports it. */
  modelVersion?: string;
  /** The right answers by category, added by you. */
  expected?: Readonly<Record<string, ExpectedValue>>;
};
