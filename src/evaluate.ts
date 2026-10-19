import type { Question, QuestionOptions } from "./backends/backend.ts";
import {
  type FlagCategory,
  type MultiCategory,
  readFlag,
  readMulti,
  readSingle,
  type SingleCategory,
  toQuestion,
} from "./questions.ts";
import type { DecisionRecord, ExpectedValue } from "./record.ts";
import type { ResolvedCategory, ResolvedVocabulary } from "./vocabulary.ts";

/** `null` when undefined: no positives predicted (precision) or none expected (recall). */
export type Scores = {
  /** Images where the value is expected. */
  support: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
};

export type SingleEvaluation = {
  type: "single";
  total: number;
  /** Share of images given a value. Below 1 when `minConfidence` or `allowUnlisted` leave some without one. */
  coverage: number;
  /** Share of images given the expected value. No value matches only an expected `null`. */
  accuracy: number;
  /** Accuracy among the images given a value, or `null` when none were. */
  answeredAccuracy: number | null;
  /** Counts by expected value, then by value given. `(none)` stands for no value. */
  confusion: Readonly<Record<string, Readonly<Record<string, number>>>>;
};

export type MultiEvaluation = {
  type: "multi";
  total: number;
  values: Readonly<Record<string, Scores>>;
  /** Mean F1 over the values that have one. */
  macroF1: number | null;
};

export type FlagEvaluation = Scores & {
  type: "flag";
  total: number;
  accuracy: number;
};

export type CategoryEvaluation =
  SingleEvaluation | MultiEvaluation | FlagEvaluation;

export type SkippedExpectation = {
  id?: string;
  category: string;
  reason: string;
};

export type Evaluation = {
  /** Records with at least one scored category. */
  records: number;
  categories: Readonly<Record<string, CategoryEvaluation>>;
  /** Expected answers that couldn't be scored, and why. */
  skipped: readonly SkippedExpectation[];
};

type Answer = Readonly<Record<string, number>>;

type Scorer = {
  /** Scores one image, or returns false if `expected` doesn't fit the category. */
  add(expected: ExpectedValue, answer: Answer): boolean;
  result(): CategoryEvaluation;
};

const expectedShape: Record<ResolvedCategory["type"], string> = {
  single: "one of its values, or null",
  multi: "a list of its values",
  flag: "true or false",
};

export function evaluate(
  vocabulary: ResolvedVocabulary,
  records: Iterable<DecisionRecord>,
): Evaluation {
  const scorers = new Map<string, Scorer>();
  const scored = new Set<string>();
  const skipped: SkippedExpectation[] = [];
  let recordCount = 0;

  for (const record of records) {
    const skip = (category: string, reason: string) =>
      skipped.push({ id: record.id, category, reason });
    let used = false;

    for (const [name, expected] of Object.entries(record.expected ?? {})) {
      if (record.format !== 1) {
        skip(name, `Unsupported record format ${String(record.format)}.`);
        continue;
      }
      const category = Object.hasOwn(vocabulary, name)
        ? vocabulary[name]
        : undefined;
      if (category === undefined) {
        skip(name, "The category isn't in the vocabulary.");
        continue;
      }
      const asked = record.questions.find((question) => question.id === name);
      const answer = record.answers[name];
      if (asked === undefined || answer === undefined) {
        skip(name, "The record has no answer for this category.");
        continue;
      }
      if (!sameQuestion(asked, toQuestion(name, category))) {
        skip(name, "The question asked differs from the vocabulary's.");
        continue;
      }

      const scorer = scorers.get(name) ?? scorerFor(category);
      scorers.set(name, scorer);
      if (!scorer.add(expected, answer)) {
        skip(
          name,
          `Expected ${JSON.stringify(expected)}, but the category needs ${expectedShape[category.type]}.`,
        );
        continue;
      }
      scored.add(name);
      used = true;
    }

    if (used) {
      recordCount++;
    }
  }

  const categories: Record<string, CategoryEvaluation> = {};
  for (const [name, scorer] of scorers) {
    if (scored.has(name)) {
      categories[name] = scorer.result();
    }
  }

  return { records: recordCount, categories, skipped };
}

function sameQuestion(a: Question, b: Question): boolean {
  if (a.type !== b.type || a.instructions !== b.instructions) {
    return false;
  }
  if (a.type === "yes-no" || b.type === "yes-no") {
    return true;
  }
  return sortedOptions(a.options) === sortedOptions(b.options);
}

// Order-insensitive, so reordering a vocabulary's values doesn't skip records.
function sortedOptions(options: QuestionOptions): string {
  return JSON.stringify(
    Object.entries(options).toSorted(([a], [b]) => a.localeCompare(b)),
  );
}

function scorerFor(category: ResolvedCategory): Scorer {
  switch (category.type) {
    case "single":
      return singleScorer(category);
    case "multi":
      return multiScorer(category);
    default:
      return flagScorer(category);
  }
}

const noValue = "(none)";

function singleScorer(category: SingleCategory): Scorer {
  const confusion: Record<string, Record<string, number>> = {};
  let total = 0;
  let answered = 0;
  let correct = 0;
  let answeredCorrect = 0;

  return {
    add(expected, answer) {
      if (expected !== null && !isValue(category, expected)) {
        return false;
      }
      const { value } = readSingle(category, answer);
      const want = expected ?? noValue;
      const got = value ?? noValue;
      const row = (confusion[want] ??= {});
      row[got] = (row[got] ?? 0) + 1;

      total++;
      if (value !== undefined) {
        answered++;
      }
      if (want === got) {
        correct++;
        if (value !== undefined) {
          answeredCorrect++;
        }
      }
      return true;
    },
    result: () => ({
      type: "single",
      total,
      coverage: answered / total,
      accuracy: correct / total,
      answeredAccuracy: answered === 0 ? null : answeredCorrect / answered,
      confusion,
    }),
  };
}

function multiScorer(category: MultiCategory): Scorer {
  const counts = new Map(
    Object.keys(category.values).map((value) => [value, new Counts()]),
  );
  let total = 0;

  return {
    add(expected, answer) {
      if (
        !Array.isArray(expected) ||
        !expected.every((value) => isValue(category, value))
      ) {
        return false;
      }
      const given = new Set(readMulti(category, answer).values);
      for (const [value, count] of counts) {
        count.add(expected.includes(value), given.has(value));
      }
      total++;
      return true;
    },
    result: () => {
      const values = Object.fromEntries(
        [...counts].map(([value, count]) => [value, count.scores()]),
      );
      const f1s = Object.values(values).flatMap(({ f1 }) =>
        f1 === null ? [] : [f1],
      );
      return {
        type: "multi",
        total,
        values,
        macroF1:
          f1s.length === 0 ? null : f1s.reduce((a, b) => a + b, 0) / f1s.length,
      };
    },
  };
}

function flagScorer(category: FlagCategory): Scorer {
  const count = new Counts();

  return {
    add(expected, answer) {
      if (typeof expected !== "boolean") {
        return false;
      }
      count.add(expected, readFlag(category, answer).value);
      return true;
    },
    result: () => ({
      type: "flag",
      total: count.total,
      accuracy: count.accuracy,
      ...count.scores(),
    }),
  };
}

function f1Of(precision: number | null, recall: number | null): number | null {
  if (precision === null || recall === null) {
    return null;
  }
  if (precision + recall === 0) {
    return 0;
  }
  return (2 * precision * recall) / (precision + recall);
}

function isValue(
  category: SingleCategory | MultiCategory,
  value: unknown,
): value is string {
  return typeof value === "string" && Object.hasOwn(category.values, value);
}

class Counts {
  private truePositives = 0;
  private falsePositives = 0;
  private falseNegatives = 0;
  private added = 0;
  private correct = 0;

  get total(): number {
    return this.added;
  }

  get accuracy(): number {
    return this.correct / this.added;
  }

  add(expected: boolean, given: boolean): void {
    this.added++;
    if (expected === given) {
      this.correct++;
    }
    if (expected && given) {
      this.truePositives++;
    } else if (given) {
      this.falsePositives++;
    } else if (expected) {
      this.falseNegatives++;
    }
  }

  scores(): Scores {
    const tp = this.truePositives;
    const predicted = tp + this.falsePositives;
    const support = tp + this.falseNegatives;
    const precision = predicted === 0 ? null : tp / predicted;
    const recall = support === 0 ? null : tp / support;
    return { support, precision, recall, f1: f1Of(precision, recall) };
  }
}
