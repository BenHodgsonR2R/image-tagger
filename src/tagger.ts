import {
  type DecisionResponse,
  type ImageInput,
  imageMimeTypes,
  type Question,
  type QuestionOptions,
  type TaggingBackend,
} from "./backends/backend.ts";
import { TaggingError } from "./errors.ts";
import {
  type ResolvedCategory,
  type ResolvedVocabulary,
  resolveVocabulary,
  type Vocabulary,
} from "./vocabulary.ts";

export type TaggingRequest = {
  /** Your identifier for the image. Returned on the result and in error details. */
  id?: string;
  image: ImageInput;
  /** What the image is and what it's for, such as "Lead photo for a travel guide to Getxo, Spain." */
  context?: string;
  /** Tag only these categories. Defaults to every category in the vocabulary. */
  categories?: readonly string[];
};

export type SingleTag = {
  type: "single";
  /** The chosen value, or `undefined` when none reached `minConfidence` or none fits. */
  value: string | undefined;
  /** Probability of the likeliest listed value. */
  confidence: number;
  probabilities: Readonly<Record<string, number>>;
  /** Probability that none of the values fits. Only with `allowUnlisted`. */
  unlisted?: number;
};

export type MultiTag = {
  type: "multi";
  /** Values at or above the threshold, likeliest first. */
  values: readonly string[];
  probabilities: Readonly<Record<string, number>>;
  /** Probability that something not listed also applies. Only with `allowUnlisted`. */
  unlisted?: number;
};

export type FlagTag = {
  type: "flag";
  value: boolean;
  probability: number;
};

export type Tag = SingleTag | MultiTag | FlagTag;

export type TaggingResult = {
  id?: string;
  tags: Readonly<Record<string, Tag>>;
  /** Applied tags as `category:value`, or the category name for a set flag. */
  labels: readonly string[];
  modelVersion?: string;
};

type TaggerLogger = Pick<Console, "debug">;

export type TaggerOptions = {
  backend: TaggingBackend;
  vocabulary: Vocabulary;
  debug?: boolean;
  logger?: TaggerLogger;
};

// Can't collide with a value: tag names allow no underscores.
const unlistedOption = "__unlisted__";

const defaultContext = "An image to tag.";

export class Tagger {
  private readonly backend: TaggingBackend;
  private readonly vocabulary: ResolvedVocabulary;
  private readonly debugEnabled: boolean;
  private readonly logger: TaggerLogger;

  constructor({
    backend,
    vocabulary,
    debug = false,
    logger = console,
  }: TaggerOptions) {
    this.backend = backend;
    this.vocabulary = resolveVocabulary(vocabulary);
    this.debugEnabled = debug;
    this.logger = logger;
  }

  async tag({
    id,
    image,
    context,
    categories,
  }: TaggingRequest): Promise<TaggingResult> {
    const details: RequestDetails = { id, model: this.backend.model };
    const selected = this.selectCategories(categories, details);
    assertImage(image, details);

    const questions = selected.map(([name, category]) =>
      toQuestion(name, category),
    );
    this.debug("request", { ...details, questions });

    let response: DecisionResponse;

    try {
      response = await this.backend.decide({
        context: context?.trim() || defaultContext,
        image,
        questions,
      });
    } catch (cause) {
      if (cause instanceof TaggingError) {
        throw cause;
      }
      throw new TaggingError(
        `The backend request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        "backend-failure",
        details,
        {
          cause,
        },
      );
    }

    this.debug("response", { ...details, response });

    const failure = { ...details, modelVersion: response.modelVersion };
    const issues = questions.flatMap((question) =>
      answerIssues(question, response.answers[question.id]),
    );

    if (issues.length > 0) {
      throw new TaggingError(
        [
          "The backend's answers don't match the questions asked.",
          ...issues.map((issue) => `- ${issue}`),
        ].join("\n"),
        "invalid-response",
        { ...failure, issues },
      );
    }

    const tags: Record<string, Tag> = {};
    for (const [name, category] of selected) {
      tags[name] = readTag(category, response.answers[name] ?? {});
    }

    return {
      id,
      tags,
      labels: toLabels(tags),
      modelVersion: response.modelVersion,
    };
  }

  private selectCategories(
    names: readonly string[] | undefined,
    details: RequestDetails,
  ): [string, ResolvedCategory][] {
    const all = Object.entries(this.vocabulary);

    if (names === undefined) {
      return all;
    }

    const unknown = names.filter(
      (name) => !Object.hasOwn(this.vocabulary, name),
    );
    if (unknown.length > 0 || names.length === 0) {
      throw new TaggingError(
        names.length === 0
          ? "categories is empty; leave it out to tag every category."
          : `Unknown categories: ${unknown.join(", ")}.`,
        "invalid-configuration",
        { ...details, unknown },
      );
    }

    return all.filter(([name]) => names.includes(name));
  }

  private debug(message: string, details: Record<string, unknown>): void {
    if (this.debugEnabled) {
      this.logger.debug(`[tagging] ${message}`, details);
    }
  }
}

type RequestDetails = { id?: string; model?: string };

function assertImage(image: ImageInput, details: RequestDetails): void {
  if (!(imageMimeTypes as readonly string[]).includes(image.mimeType)) {
    throw new TaggingError(
      `Unsupported image type "${image.mimeType}". Use ${imageMimeTypes.join(", ")}.`,
      "invalid-image",
      details,
    );
  }
  if (image.data.byteLength === 0) {
    throw new TaggingError("The image is empty.", "invalid-image", details);
  }
}

function toQuestion(name: string, category: ResolvedCategory): Question {
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

function expectedKeys(question: Question): string[] {
  return question.type === "yes-no" ? ["yes"] : Object.keys(question.options);
}

function answerIssues(
  question: Question,
  answer: Readonly<Record<string, number>> | undefined,
): string[] {
  if (answer === undefined) {
    return [`No answer for "${question.id}".`];
  }

  const expected = expectedKeys(question);
  const issues: string[] = [];

  for (const key of Object.keys(answer)) {
    if (!expected.includes(key)) {
      issues.push(
        `"${question.id}" answered with "${key}", which wasn't offered.`,
      );
    }
  }
  for (const key of expected) {
    const probability = answer[key];
    if (probability === undefined) {
      issues.push(`"${question.id}" has no probability for "${key}".`);
    } else if (
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      issues.push(
        `"${question.id}" has an invalid probability for "${key}": ${probability}.`,
      );
    }
  }

  return issues;
}

function readTag(
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

function toLabels(tags: Readonly<Record<string, Tag>>): string[] {
  return Object.entries(tags).flatMap(([name, tag]) => {
    switch (tag.type) {
      case "single":
        return tag.value === undefined ? [] : [`${name}:${tag.value}`];
      case "multi":
        return tag.values.map((value) => `${name}:${value}`);
    }
    return tag.value ? [name] : [];
  });
}
