import type { Question, QuestionOptions } from "./backends/backend.ts";
import { readTag, toQuestion } from "./questions.ts";
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

const noValue = "(none)";

type Scored = { category: ResolvedCategory; pairs: [ExpectedValue, Answer][] };
type Answer = Readonly<Record<string, number>>;

export function evaluate(
  vocabulary: ResolvedVocabulary,
  records: Iterable<DecisionRecord>,
): Evaluation {
  const scored = new Map<string, Scored>();
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
      if (!isValidExpected(category, expected)) {
        skip(
          name,
          `Expected ${JSON.stringify(expected)}, but the category needs ${expectedShape[category.type]}.`,
        );
        continue;
      }

      const entry = scored.get(name) ?? { category, pairs: [] };
      entry.pairs.push([expected, answer]);
      scored.set(name, entry);
      used = true;
    }

    if (used) {
      recordCount++;
    }
  }

  const categories: Record<string, CategoryEvaluation> = {};
  for (const [name, { category, pairs }] of scored) {
    categories[name] = evaluateCategory(category, pairs);
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

const expectedShape: Record<ResolvedCategory["type"], string> = {
  single: "one of its values, or null",
  multi: "a list of its values",
  flag: "true or false",
};

function isValidExpected(
  category: ResolvedCategory,
  expected: ExpectedValue,
): boolean {
  if (category.type === "flag") {
    return typeof expected === "boolean";
  }

  const isValue = (value: unknown) =>
    typeof value === "string" && Object.hasOwn(category.values, value);

  return category.type === "multi"
    ? Array.isArray(expected) && expected.every(isValue)
    : expected === null || isValue(expected);
}

function evaluateCategory(
  category: ResolvedCategory,
  pairs: readonly [ExpectedValue, Answer][],
): CategoryEvaluation {
  const total = pairs.length;

  if (category.type === "flag") {
    const flags = pairs.map(([expected, answer]): [boolean, boolean] => {
      const tag = readTag(category, answer);
      return [expected === true, tag.type === "flag" && tag.value];
    });
    return {
      type: "flag",
      total,
      accuracy: flags.filter(([e, g]) => e === g).length / total,
      ...scores(flags),
    };
  }

  if (category.type === "multi") {
    const given = pairs.map(([expected, answer]) => {
      const tag = readTag(category, answer);
      return [
        new Set(expected as readonly string[]),
        new Set(tag.type === "multi" ? tag.values : []),
      ] as const;
    });
    const values = Object.fromEntries(
      Object.keys(category.values).map((value) => [
        value,
        scores(given.map(([e, g]) => [e.has(value), g.has(value)])),
      ]),
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
  }

  const confusion: Record<string, Record<string, number>> = {};
  let answered = 0;
  let correct = 0;
  let answeredCorrect = 0;
  for (const [expected, answer] of pairs) {
    const tag = readTag(category, answer);
    const value = tag.type === "single" ? tag.value : undefined;
    const e = (expected as string | null) ?? noValue;
    const g = value ?? noValue;
    const row = (confusion[e] ??= {});
    row[g] = (row[g] ?? 0) + 1;
    if (value !== undefined) {
      answered++;
    }
    if (e === g) {
      correct++;
      if (value !== undefined) {
        answeredCorrect++;
      }
    }
  }
  return {
    type: "single",
    total,
    coverage: answered / total,
    accuracy: correct / total,
    answeredAccuracy: answered === 0 ? null : answeredCorrect / answered,
    confusion,
  };
}

function scores(pairs: readonly (readonly [boolean, boolean])[]): Scores {
  const tp = pairs.filter(([e, g]) => e && g).length;
  const fp = pairs.filter(([e, g]) => !e && g).length;
  const fn = pairs.filter(([e, g]) => e && !g).length;
  const precision = tp + fp === 0 ? null : tp / (tp + fp);
  const recall = tp + fn === 0 ? null : tp / (tp + fn);
  const f1 =
    precision === null || recall === null
      ? null
      : precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
  return { support: tp + fn, precision, recall, f1 };
}
