import {
  type DecisionResponse,
  type ImageInput,
  imageMimeTypes,
  type Question,
  type TaggingBackend,
} from "./backends/backend.ts";
import { sha256Hex } from "./encoding.ts";
import { TaggingError } from "./errors.ts";
import { type Evaluation, evaluate } from "./evaluate.ts";
import { readTag, toQuestion } from "./questions.ts";
import type { DecisionRecord } from "./record.ts";
import {
  type ResolvedCategory,
  type ResolvedVocabulary,
  resolveVocabulary,
  type Vocabulary,
} from "./vocabulary.ts";

/**
 * One image for {@link Tagger}'s `tag()`.
 * @group Tagging
 */
export type TaggingRequest = {
  /** Your identifier for the image. Returned on the result and in error details. */
  id?: string;
  /** A JPEG, PNG or WebP image. */
  image: ImageInput;
  /** What the image is and what it's for, such as "Lead photo for a travel guide to Getxo, Spain." */
  context?: string;
  /** Tag only these categories. Defaults to every category in the vocabulary. */
  categories?: readonly string[];
};

/**
 * The answer for a {@link SingleCategory}.
 * @group Tagging
 */
export type SingleTag = {
  type: "single";
  /** The chosen value, or `undefined` when none reached `minConfidence` or none fits. */
  value: string | undefined;
  /** Probability of the likeliest listed value. */
  confidence: number;
  /** Each listed value's probability. They sum to 1. */
  probabilities: Readonly<Record<string, number>>;
  /** Probability that none of the values fits. Only with `allowUnlisted`. */
  unlisted?: number;
};

/**
 * The answer for a {@link MultiCategory}.
 * @group Tagging
 */
export type MultiTag = {
  type: "multi";
  /** Values at or above the threshold, likeliest first. */
  values: readonly string[];
  /** Each listed value's probability, independent of the others. */
  probabilities: Readonly<Record<string, number>>;
  /** Probability that something not listed also applies. Only with `allowUnlisted`. */
  unlisted?: number;
};

/**
 * The answer for a {@link FlagCategory}.
 * @group Tagging
 */
export type FlagTag = {
  type: "flag";
  /** Whether the probability reached the category's `threshold`. */
  value: boolean;
  /** How likely the answer is yes. */
  probability: number;
};

/**
 * One category's answer: a {@link SingleTag}, {@link MultiTag} or {@link FlagTag}, matching the category's `type`.
 * @group Tagging
 */
export type Tag = SingleTag | MultiTag | FlagTag;

/**
 * What {@link Tagger}'s `tag()` returns.
 * @group Tagging
 */
export type TaggingResult = {
  /** The request's `id`. */
  id?: string;
  /** Each category's answer, by category name. */
  tags: Readonly<Record<string, Tag>>;
  /** Applied tags as `category:value`, or the category name for a set flag. */
  labels: readonly string[];
  /** The exact model that answered, when the backend reports it. */
  modelVersion?: string;
  /** What was asked and answered, as plain JSON, for `evaluate()`. Nothing is stored. */
  record: DecisionRecord;
};

/**
 * Where {@link Tagger} writes debug logs: anything with a `debug` method, such as `console`.
 * @group Tagging
 */
export type TaggerLogger = Pick<Console, "debug">;

/**
 * The options for {@link Tagger}.
 * @group Tagging
 */
export type TaggerOptions = {
  /** Answers the questions, such as an {@link AmosBackend}. */
  backend: TaggingBackend;
  /** The categories and values the tagger can apply. */
  vocabulary: Vocabulary;
  /** Logs each request and response. Default `false`. */
  debug?: boolean;
  /** Where debug logs go. Defaults to `console`. */
  logger?: TaggerLogger;
};

const defaultContext = "An image to tag.";

/**
 * Tags images with a {@link TaggingBackend}, asking about each category in a {@link Vocabulary}. The model can
 * only answer with values you define. Create one and reuse it.
 * @example
 * ```ts
 * const tagger = new Tagger({
 *   backend: new AmosBackend(),
 *   vocabulary: {
 *     setting: { type: "multi", values: { beach: null, mountains: null, city: null } },
 *     night: { type: "flag", question: "Was the photo taken at night?" },
 *   },
 * });
 *
 * const result = await tagger.tag({
 *   image: { data: await readFile("getxo.jpg"), mimeType: "image/jpeg" },
 *   context: "Lead photo for a travel guide to Getxo, Spain.",
 * });
 * result.labels; // ["setting:beach", "setting:city"]
 * ```
 * @group Tagging
 */
export class Tagger {
  private readonly backend: TaggingBackend;
  private readonly vocabulary: ResolvedVocabulary;
  private readonly debugEnabled: boolean;
  private readonly logger: TaggerLogger;

  /** Checks the vocabulary. Throws a {@link TaggingError} with code `invalid-configuration` if it's invalid. */
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

  /**
   * Tags one image. Throws a {@link TaggingError} when the image or request is invalid, the backend fails, or its
   * answers don't match the questions.
   */
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

    const sentContext = context?.trim() || defaultContext;
    let response: DecisionResponse;

    try {
      response = await this.backend.decide({
        context: sentContext,
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
      record: {
        format: 1,
        id,
        createdAt: new Date().toISOString(),
        image: {
          sha256: await sha256Hex(image.data),
          mimeType: image.mimeType,
          bytes: image.data.byteLength,
        },
        context: sentContext,
        questions,
        answers: Object.fromEntries(
          questions.map(({ id: question }) => [
            question,
            response.answers[question] ?? {},
          ]),
        ),
        model: this.backend.model,
        modelVersion: response.modelVersion,
      },
    };
  }

  /**
   * Scores saved records against their `expected` answers, applying this
   * tagger's thresholds to the recorded probabilities. Nothing is sent to
   * the backend.
   */
  evaluate(records: Iterable<DecisionRecord>): Evaluation {
    return evaluate(this.vocabulary, records);
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

function toLabels(tags: Readonly<Record<string, Tag>>): string[] {
  return Object.entries(tags).flatMap(([name, tag]) => {
    switch (tag.type) {
      case "single":
        return tag.value === undefined ? [] : [`${name}:${tag.value}`];
      case "multi":
        return tag.values.map((value) => `${name}:${value}`);
      default:
        return tag.value ? [name] : [];
    }
  });
}
