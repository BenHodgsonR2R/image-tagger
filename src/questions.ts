import type { Question, QuestionOptions } from "./backends/backend.ts";
import type { FlagTag, MultiTag, SingleTag, Tag } from "./tagger.ts";
import type { ResolvedCategory } from "./vocabulary.ts";

export type ResolvedSingleCategory = Extract<
  ResolvedCategory,
  { type: "single" }
>;
export type ResolvedMultiCategory = Extract<
  ResolvedCategory,
  { type: "multi" }
>;
export type ResolvedFlagCategory = Extract<ResolvedCategory, { type: "flag" }>;

type Answer = Readonly<Record<string, number>>;

// Can't collide with a value: tag names allow no underscores.
const unlistedOption = "__unlisted__";

export function toQuestion(name: string, category: ResolvedCategory): Question {
  const label = name.replaceAll("-", " ");

  switch (category.type) {
    case "single":
      return {
        id: name,
        type: "choice",
        instructions:
          category.question ?? `Which ${label} best describes the image?`,
        options: withUnlisted(
          category.values,
          category.allowUnlisted,
          "None of these fits.",
        ),
      };
    case "multi":
      return {
        id: name,
        type: "multi",
        instructions:
          category.question ??
          `Which of these ${label} apply to the image? Choose none if none apply.`,
        options: withUnlisted(
          category.values,
          category.allowUnlisted,
          "Something not listed here.",
        ),
      };
    default:
      return { id: name, type: "yes-no", instructions: category.question };
  }
}

function withUnlisted(
  values: QuestionOptions,
  allowUnlisted: boolean,
  description: string,
): QuestionOptions {
  return allowUnlisted ? { ...values, [unlistedOption]: description } : values;
}

export function readTag(category: ResolvedCategory, answer: Answer): Tag {
  switch (category.type) {
    case "single":
      return readSingle(category, answer);
    case "multi":
      return readMulti(category, answer);
    default:
      return readFlag(category, answer);
  }
}

export function readSingle(
  category: ResolvedSingleCategory,
  answer: Answer,
): SingleTag {
  const { probabilities, ranked, unlisted } = readValues(category, answer);
  const [best, confidence] = ranked[0] ?? [undefined, 0];
  const noneFits = (unlisted.unlisted ?? 0) > confidence;

  return {
    type: "single",
    value: noneFits || confidence < category.minConfidence ? undefined : best,
    confidence,
    probabilities,
    ...unlisted,
  };
}

export function readMulti(
  category: ResolvedMultiCategory,
  answer: Answer,
): MultiTag {
  const { probabilities, ranked, unlisted } = readValues(category, answer);

  return {
    type: "multi",
    values: ranked
      .filter(([, probability]) => probability >= category.threshold)
      .map(([value]) => value),
    probabilities,
    ...unlisted,
  };
}

export function readFlag(
  category: ResolvedFlagCategory,
  answer: Answer,
): FlagTag {
  const probability = answer.yes ?? 0;
  return {
    type: "flag",
    value: probability >= category.threshold,
    probability,
  };
}

function readValues(
  category: ResolvedSingleCategory | ResolvedMultiCategory,
  answer: Answer,
) {
  const probabilities = Object.fromEntries(
    Object.keys(category.values).map((value) => [value, answer[value] ?? 0]),
  );
  return {
    probabilities,
    ranked: Object.entries(probabilities).toSorted(([, a], [, b]) => b - a),
    unlisted: category.allowUnlisted
      ? { unlisted: answer[unlistedOption] ?? 0 }
      : {},
  };
}
