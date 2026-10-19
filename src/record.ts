import type {
  DecisionResponse,
  ImageMimeType,
  Question,
} from "./backends/backend.ts";

/** The right answer for a category: a value, values, a flag, or `null` when none fits. */
export type ExpectedValue = string | readonly string[] | boolean | null;

/**
 * What one `tag()` call asked and what came back, as plain JSON. Save it,
 * add `expected`, and score the tagger with `tagger.evaluate()`.
 */
export type DecisionRecord = {
  format: 1;
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
  model?: string;
  modelVersion?: string;
  /** The right answers by category, added by you. */
  expected?: Readonly<Record<string, ExpectedValue>>;
};
