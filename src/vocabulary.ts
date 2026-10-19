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

export const vocabularySchema = z
  .record(tagName, categorySchema)
  .refine((vocabulary) => Object.keys(vocabulary).length > 0, {
    message: "Define at least one category.",
  });

export type Vocabulary = z.input<typeof vocabularySchema>;
export type ResolvedVocabulary = z.output<typeof vocabularySchema>;
export type Category = z.input<typeof categorySchema>;
export type ResolvedCategory = z.output<typeof categorySchema>;

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
