import * as z from "zod";
import { TaggingError } from "./errors.ts";

const tagName = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lower-case letters, digits and single hyphens, such as "time-of-day".',
  );

const text = z.string().trim().min(1);

const probability = z.number().min(0).max(1);

/** Each value's description tells the model what it means, or `null` if the name is enough. */
const valuesSchema = z.record(tagName, text.nullable());

const singleCategorySchema = z.strictObject({
  type: z.literal("single"),
  /** Asked of every image. Defaults to one built from the category name. */
  question: text.optional(),
  values: valuesSchema.refine((values) => Object.keys(values).length >= 2, {
    message: "A single-value category needs at least two values.",
  }),
  /** Below this, no value is chosen. Default 0: the likeliest value always wins. */
  minConfidence: probability.default(0),
  /**
   * Lets the model answer that none of the values fits. The model still can't
   * name a new value; the result reports how likely it is that one is missing.
   */
  allowUnlisted: z.boolean().default(false),
});

const multiCategorySchema = z.strictObject({
  type: z.literal("multi"),
  question: text.optional(),
  values: valuesSchema.refine((values) => Object.keys(values).length >= 1, {
    message: "A multi-value category needs at least one value.",
  }),
  /** Each value at or above this probability is applied. Default 0.5. */
  threshold: probability.default(0.5),
  /** Lets the model report that something not in `values` also applies. */
  allowUnlisted: z.boolean().default(false),
});

const flagCategorySchema = z.strictObject({
  type: z.literal("flag"),
  /** A yes/no question, such as "Was the photo taken at night?" */
  question: text,
  /** The flag is set at or above this probability. Default 0.5. */
  threshold: probability.default(0.5),
});

const categorySchema = z.discriminatedUnion("type", [
  singleCategorySchema,
  multiCategorySchema,
  flagCategorySchema,
]);

const vocabularyRecord = z
  .record(tagName, categorySchema)
  .refine((vocabulary) => Object.keys(vocabulary).length > 0, {
    message: "Define at least one category.",
  });

/**
 * A category's values. Each maps to a description that tells the model what it means, or `null` when the name
 * says enough. Names use lower-case letters, digits and single hyphens, such as `golden-hour`.
 * @group Vocabulary
 */
export type CategoryValues = Record<string, string | null>;

/**
 * A category with exactly one answer, such as `people:crowd`.
 * @group Vocabulary
 */
export type SingleCategory = {
  type: "single";
  /** Asked of every image. Defaults to one built from the category name; write your own when the name alone is ambiguous. */
  question?: string | undefined;
  /** At least two. */
  values: CategoryValues;
  /** Below this, no value is chosen. Default 0: the likeliest value always wins. */
  minConfidence?: number | undefined;
  /**
   * Also offers "none of these fits". The model still can't name a new value: the tag reports `unlisted`, how
   * likely it is that one is missing, and gets no value when that's the likeliest answer. Default `false`.
   */
  allowUnlisted?: boolean | undefined;
};

/**
 * A category with any number of answers, such as `setting:beach` and `setting:city`.
 * @group Vocabulary
 */
export type MultiCategory = {
  type: "multi";
  /** Asked of every image. Defaults to one built from the category name. */
  question?: string | undefined;
  /** At least one. */
  values: CategoryValues;
  /** Each value at or above this probability is applied. Default 0.5. */
  threshold?: number | undefined;
  /** Also offers "something not listed", reported as `unlisted`. Default `false`. */
  allowUnlisted?: boolean | undefined;
};

/**
 * A yes-or-no category. Its label is the category name, such as `night`.
 * @group Vocabulary
 */
export type FlagCategory = {
  type: "flag";
  /** A yes-or-no question, such as "Was the photo taken at night?" */
  question: string;
  /** The flag is set at or above this probability. Default 0.5. */
  threshold?: number | undefined;
};

/**
 * One category of the {@link Vocabulary}: a question the model answers about every image.
 * @group Vocabulary
 */
export type Category = SingleCategory | MultiCategory | FlagCategory;

/**
 * The tags a {@link Tagger} can apply: category names mapped to categories. Names use lower-case letters, digits
 * and single hyphens, so a label such as `time-of-day:golden-hour` is never ambiguous.
 * @example
 * ```ts
 * const vocabulary: Vocabulary = {
 *   people: {
 *     type: "single",
 *     question: "How many people are in the photo?",
 *     values: { none: null, few: "One to five people.", crowd: "A crowd." },
 *   },
 *   setting: { type: "multi", values: { beach: null, mountains: null, city: null } },
 *   night: { type: "flag", question: "Was the photo taken at night?" },
 * };
 * ```
 * @group Vocabulary
 */
export type Vocabulary = Record<string, Category>;

// Fails to compile if the schema and the documented types stop matching, in either direction.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type KeysOf<T> = T extends unknown ? keyof T : never;
type _SchemaMatchesTypes = Assert<
  Same<z.input<typeof vocabularyRecord>, Vocabulary>
>;
type _SchemaHasTheSameFields = Assert<
  Same<KeysOf<z.input<typeof categorySchema>>, KeysOf<Category>>
>;

export type ResolvedVocabulary = z.output<typeof vocabularyRecord>;
export type ResolvedCategory = z.output<typeof categorySchema>;

/**
 * Checks a {@link Vocabulary}, for example one read from JSON. {@link Tagger} checks its vocabulary with this
 * too, and throws a {@link TaggingError} when it's invalid.
 * @group Vocabulary
 */
export const vocabularySchema: z.ZodType<ResolvedVocabulary, Vocabulary> =
  vocabularyRecord;

export function resolveVocabulary(vocabulary: Vocabulary): ResolvedVocabulary {
  const result = vocabularySchema.safeParse(vocabulary);

  if (!result.success) {
    throw new TaggingError(
      `Invalid vocabulary:\n${z.prettifyError(result.error)}`,
      "invalid-configuration",
      { issues: result.error.issues },
    );
  }

  return result.data;
}
