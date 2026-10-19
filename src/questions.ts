import type { Question, QuestionOptions } from "./backends/backend.ts";
import type { Tag } from "./tagger.ts";
import type { ResolvedCategory } from "./vocabulary.ts";

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
  }
  return { id: name, type: "yes-no", instructions: category.question };
}

function withUnlisted(
  values: QuestionOptions,
  allowUnlisted: boolean,
  description: string,
): QuestionOptions {
  return allowUnlisted ? { ...values, [unlistedOption]: description } : values;
}

export function readTag(
  category: ResolvedCategory,
  answer: Readonly<Record<string, number>>,
): Tag {
  if (category.type === "flag") {
    const probability = answer.yes ?? 0;
    return {
      type: "flag",
      value: probability >= category.threshold,
      probability,
    };
  }

  const probabilities = Object.fromEntries(
    Object.keys(category.values).map((value) => [value, answer[value] ?? 0]),
  );
  const unlisted = category.allowUnlisted
    ? { unlisted: answer[unlistedOption] ?? 0 }
    : {};
  const ranked = Object.entries(probabilities).toSorted(
    ([, a], [, b]) => b - a,
  );

  if (category.type === "multi") {
    return {
      type: "multi",
      values: ranked
        .filter(([, p]) => p >= category.threshold)
        .map(([value]) => value),
      probabilities,
      ...unlisted,
    };
  }

  const [best, confidence] = ranked[0] ?? [undefined, 0];
  const unlistedWins = (unlisted.unlisted ?? 0) > confidence;
  return {
    type: "single",
    value:
      unlistedWins || confidence < category.minConfidence ? undefined : best,
    confidence,
    probabilities,
    ...unlisted,
  };
}
