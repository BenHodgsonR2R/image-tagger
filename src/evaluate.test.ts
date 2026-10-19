import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";

import type { DecisionResponse, TaggingBackend } from "./backends/backend.ts";
import type { DecisionRecord, ExpectedValue } from "./record.ts";
import { Tagger } from "./tagger.ts";
import type { Vocabulary } from "./vocabulary.ts";

const vocabulary: Vocabulary = {
  people: {
    type: "single",
    values: { none: null, few: null, crowd: null },
  },
  setting: {
    type: "multi",
    question: "Which of these are visible?",
    values: { beach: null, city: null, mountains: null },
  },
  night: { type: "flag", question: "Was the photo taken at night?" },
};

const image = {
  data: new Uint8Array([0xff, 0xd8, 0xff]),
  mimeType: "image/jpeg" as const,
};

async function recordFor(
  recorded: DecisionResponse["answers"],
  expected?: Record<string, ExpectedValue>,
  tagVocabulary: Vocabulary = vocabulary,
): Promise<DecisionRecord> {
  const backend: TaggingBackend = {
    model: "test-model",
    decide: async () => ({ answers: recorded, modelVersion: "test-model-001" }),
  };
  const { record } = await new Tagger({
    backend,
    vocabulary: tagVocabulary,
  }).tag({ id: "photo", image });
  return { ...record, expected };
}

function answers(
  people: Record<string, number>,
  setting: Record<string, number>,
  night: number,
): DecisionResponse["answers"] {
  return { people, setting, night: { yes: night } };
}

function tagger(overrides: Vocabulary = {}) {
  const decide = vi.fn<TaggingBackend["decide"]>();
  return {
    tagger: new Tagger({
      backend: { decide },
      vocabulary: { ...vocabulary, ...overrides },
    }),
    decide,
  };
}

describe("TaggingResult.record", () => {
  test("holds what was asked and answered, as plain JSON", async () => {
    const record = await recordFor(
      answers(
        { none: 0.7, few: 0.2, crowd: 0.1 },
        { beach: 0.9, city: 0.1, mountains: 0.2 },
        0.1,
      ),
    );

    expect(record).toMatchObject({
      format: 1,
      id: "photo",
      image: {
        sha256: createHash("sha256").update(image.data).digest("hex"),
        mimeType: "image/jpeg",
        bytes: 3,
      },
      context: "An image to tag.",
      model: "test-model",
      modelVersion: "test-model-001",
    });
    expect(record.questions[0]).toEqual({
      id: "people",
      type: "choice",
      instructions: "Which people best describes the image?",
      options: { none: null, few: null, crowd: null },
    });
    expect(record.answers.night).toEqual({ yes: 0.1 });
    expect(Date.parse(record.createdAt)).not.toBeNaN();
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
  });
});

describe("Tagger.evaluate()", () => {
  test("scores a single-value category, counting no value as a miss", async () => {
    const setting = { beach: 0, city: 0, mountains: 0 };
    const records = await Promise.all([
      recordFor(answers({ none: 0.8, few: 0.1, crowd: 0.1 }, setting, 0), {
        people: "none",
      }),
      recordFor(answers({ none: 0.1, few: 0.6, crowd: 0.3 }, setting, 0), {
        people: "crowd",
      }),
      recordFor(answers({ none: 0.3, few: 0.4, crowd: 0.3 }, setting, 0), {
        people: "few",
      }),
    ]);
    const { tagger: confident } = tagger({
      people: {
        type: "single",
        values: { none: null, few: null, crowd: null },
        minConfidence: 0.5,
      },
    });

    const evaluation = confident.evaluate(records);

    expect(evaluation.records).toBe(3);
    expect(evaluation.categories.people).toEqual({
      type: "single",
      total: 3,
      coverage: 2 / 3,
      accuracy: 1 / 3,
      answeredAccuracy: 1 / 2,
      confusion: {
        none: { none: 1 },
        crowd: { few: 1 },
        few: { "(none)": 1 },
      },
    });
  });

  test("scores each value of a multi-value category", async () => {
    const records = [
      await recordFor(
        answers(
          { none: 1, few: 0, crowd: 0 },
          { beach: 0.9, city: 0.6, mountains: 0.1 },
          0,
        ),
        { setting: ["beach"] },
      ),
      await recordFor(
        answers(
          { none: 1, few: 0, crowd: 0 },
          { beach: 0.2, city: 0.8, mountains: 0.1 },
          0,
        ),
        { setting: ["city", "mountains"] },
      ),
    ];
    const { tagger: t } = tagger();

    const setting = t.evaluate(records).categories.setting;

    expect(setting).toEqual({
      type: "multi",
      total: 2,
      values: {
        beach: { support: 1, precision: 1, recall: 1, f1: 1 },
        city: { support: 1, precision: 0.5, recall: 1, f1: 2 / 3 },
        mountains: { support: 1, precision: null, recall: 0, f1: null },
      },
      macroF1: (1 + 2 / 3) / 2,
    });
  });

  test("scores a flag", async () => {
    const records = await Promise.all(
      [
        [0.9, true],
        [0.6, false],
        [0.2, true],
        [0.1, false],
      ].map(([p, expected]) =>
        recordFor(
          answers(
            { none: 1, few: 0, crowd: 0 },
            { beach: 0, city: 0, mountains: 0 },
            p as number,
          ),
          {
            night: expected as boolean,
          },
        ),
      ),
    );
    const { tagger: t } = tagger();

    expect(t.evaluate(records).categories.night).toEqual({
      type: "flag",
      total: 4,
      accuracy: 0.5,
      support: 2,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
    });
  });

  test("applies the tagger's own thresholds without calling the backend", async () => {
    const records = await Promise.all(
      [0.6, 0.7].map((p) =>
        recordFor(
          answers(
            { none: 1, few: 0, crowd: 0 },
            { beach: 0, city: 0, mountains: 0 },
            p,
          ),
          { night: false },
        ),
      ),
    );
    const strict = tagger({
      night: {
        type: "flag",
        question: "Was the photo taken at night?",
        threshold: 0.8,
      },
    });

    expect(tagger().tagger.evaluate(records).categories.night).toMatchObject({
      accuracy: 0,
    });
    expect(strict.tagger.evaluate(records).categories.night).toMatchObject({
      accuracy: 1,
    });
    expect(strict.decide).not.toHaveBeenCalled();
  });

  test("skips expected answers it can't score, saying why", async () => {
    const base = answers(
      { none: 1, few: 0, crowd: 0 },
      { beach: 0, city: 0, mountains: 0 },
      0,
    );
    const reworded: Vocabulary = {
      ...vocabulary,
      night: { type: "flag", question: "Is it dark?" },
    };
    const records = [
      await recordFor(base, {
        weather: "sunny",
        people: "lots",
        setting: "beach",
        night: "yes" as unknown as boolean,
      }),
      await recordFor(base, { night: true }, reworded),
      { ...(await recordFor(base, { people: "none" })), format: 2 as 1 },
    ];
    const { tagger: t } = tagger();

    const evaluation = t.evaluate(records);

    expect(evaluation.records).toBe(0);
    expect(evaluation.categories).toEqual({});
    expect(
      evaluation.skipped.map(
        ({ category, reason }) => `${category}: ${reason}`,
      ),
    ).toEqual([
      "weather: The category isn't in the vocabulary.",
      "people: Expected \"lots\" isn't one of the category's values or null.",
      "setting: Expected \"beach\" isn't a list of the category's values.",
      'night: Expected "yes" isn\'t true or false.',
      "night: The question asked differs from the vocabulary's.",
      "people: Unsupported record format 2.",
    ]);
  });

  test("accepts records whose values were reordered in the vocabulary", async () => {
    const record = await recordFor(
      answers(
        { none: 1, few: 0, crowd: 0 },
        { beach: 1, city: 0, mountains: 0 },
        0,
      ),
      { setting: ["beach"] },
    );
    const { tagger: t } = tagger({
      setting: {
        type: "multi",
        question: "Which of these are visible?",
        values: { mountains: null, city: null, beach: null },
      },
    });

    expect(t.evaluate([record]).skipped).toEqual([]);
  });
});
