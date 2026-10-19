import { describe, expect, test, vi } from "vitest";

import { AmosBackend } from "./backends/amos.ts";
import type { DecisionResponse, TaggingBackend } from "./backends/backend.ts";
import { TaggingError } from "./errors.ts";
import { type TaggingRequest, Tagger } from "./tagger.ts";
import type { Vocabulary } from "./vocabulary.ts";

const vocabulary: Vocabulary = {
  people: {
    type: "single",
    question: "How many people are in the photo?",
    values: { none: null, few: "One to five people.", crowd: "A crowd." },
  },
  setting: {
    type: "multi",
    values: { beach: null, mountains: null, city: null },
  },
  night: { type: "flag", question: "Was the photo taken at night?" },
};

const answers: DecisionResponse["answers"] = {
  people: { none: 0.1, few: 0.2, crowd: 0.7 },
  setting: { beach: 0.9, mountains: 0.6, city: 0.1 },
  night: { yes: 0.2 },
};

function fakeBackend(
  respond: TaggingBackend["decide"] = async () => ({
    answers,
    modelVersion: "test-model-001",
  }),
) {
  const decide = vi.fn<TaggingBackend["decide"]>(respond);
  const backend: TaggingBackend = { model: "test-model", decide };
  return { backend, decide };
}

function request(overrides: Partial<TaggingRequest> = {}): TaggingRequest {
  return {
    id: "photo-1",
    image: { data: new Uint8Array([0xff, 0xd8, 0xff]), mimeType: "image/jpeg" },
    ...overrides,
  };
}

async function expectTaggingError(
  promise: Promise<unknown>,
  code: TaggingError["code"],
): Promise<TaggingError> {
  const error = await promise.catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(TaggingError);
  expect((error as TaggingError).code).toBe(code);
  return error as TaggingError;
}

describe("Tagger.tag()", () => {
  test("returns a tag for every category and labels for the applied ones", async () => {
    const { backend } = fakeBackend();

    const result = await new Tagger({ backend, vocabulary }).tag(request());

    expect(result.id).toBe("photo-1");
    expect(result.modelVersion).toBe("test-model-001");
    expect(result.labels).toEqual([
      "people:crowd",
      "setting:beach",
      "setting:mountains",
    ]);
    expect(result.tags.people).toEqual({
      type: "single",
      value: "crowd",
      confidence: 0.7,
      probabilities: { none: 0.1, few: 0.2, crowd: 0.7 },
    });
    expect(result.tags.night).toEqual({
      type: "flag",
      value: false,
      probability: 0.2,
    });
  });

  test("asks one question per category, offering only the vocabulary's values", async () => {
    const { backend, decide } = fakeBackend();

    await new Tagger({ backend, vocabulary }).tag(
      request({ context: "Lead photo for Getxo." }),
    );

    const sent = decide.mock.calls[0]?.[0];
    expect(sent?.context).toBe("Lead photo for Getxo.");
    expect(sent?.questions).toEqual([
      {
        id: "people",
        type: "choice",
        instructions: "How many people are in the photo?",
        options: { none: null, few: "One to five people.", crowd: "A crowd." },
      },
      {
        id: "setting",
        type: "multi",
        instructions:
          "Which of these setting apply to the image? Choose none if none apply.",
        options: { beach: null, mountains: null, city: null },
      },
      {
        id: "night",
        type: "yes-no",
        instructions: "Was the photo taken at night?",
      },
    ]);
  });

  test("rejects an answer naming a value outside the vocabulary", async () => {
    const { backend } = fakeBackend(async () => ({
      answers: {
        ...answers,
        people: { none: 0.1, few: 0.2, crowd: 0.6, "small-group": 0.1 },
      },
    }));

    const error = await expectTaggingError(
      new Tagger({ backend, vocabulary }).tag(request()),
      "invalid-response",
    );

    expect(error.details.issues).toEqual([
      '"people" answered with "small-group", which wasn\'t offered.',
    ]);
  });

  test("rejects missing answers and probabilities", async () => {
    const { backend } = fakeBackend(async () => ({
      answers: { people: { none: 0.5, few: 0.5 }, setting: answers.setting },
    }));

    const error = await expectTaggingError(
      new Tagger({ backend, vocabulary }).tag(request()),
      "invalid-response",
    );

    expect(error.details.issues).toEqual([
      '"people" has no probability for "crowd".',
      'No answer for "night".',
    ]);
  });

  test("leaves a single value unset below minConfidence", async () => {
    const { backend } = fakeBackend();
    const tagger = new Tagger({
      backend,
      vocabulary: {
        ...vocabulary,
        people: {
          ...vocabulary.people,
          minConfidence: 0.8,
        } as Vocabulary[string],
      },
    });

    const result = await tagger.tag(request());

    expect(result.tags.people).toMatchObject({
      value: undefined,
      confidence: 0.7,
    });
    expect(result.labels).not.toContain("people:crowd");
  });

  test("offers a none-of-these option only when allowUnlisted is set", async () => {
    const { backend, decide } = fakeBackend(async () => ({
      answers: { weather: { sunny: 0.2, rainy: 0.1, __unlisted__: 0.7 } },
    }));
    const tagger = new Tagger({
      backend,
      vocabulary: {
        weather: {
          type: "single",
          values: { sunny: null, rainy: null },
          allowUnlisted: true,
        },
      },
    });

    const result = await tagger.tag(request());

    expect(decide.mock.calls[0]?.[0]?.questions[0]).toMatchObject({
      options: {
        sunny: null,
        rainy: null,
        __unlisted__: "None of these fits.",
      },
    });
    expect(result.tags.weather).toEqual({
      type: "single",
      value: undefined,
      confidence: 0.2,
      probabilities: { sunny: 0.2, rainy: 0.1 },
      unlisted: 0.7,
    });
    expect(result.labels).toEqual([]);
  });

  test("rejects a none-of-these answer when allowUnlisted isn't set", async () => {
    const { backend } = fakeBackend(async () => ({
      answers: { weather: { sunny: 0.2, rainy: 0.1, __unlisted__: 0.7 } },
    }));
    const tagger = new Tagger({
      backend,
      vocabulary: {
        weather: { type: "single", values: { sunny: null, rainy: null } },
      },
    });

    await expectTaggingError(tagger.tag(request()), "invalid-response");
  });

  test("passes on a backend's own TaggingError instead of backend-failure", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const tagger = new Tagger({
      backend: new AmosBackend({ fetch }),
      vocabulary: { setting: { type: "multi", values: { beach: null } } },
    });

    await expectTaggingError(tagger.tag(request()), "invalid-configuration");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("tags only the requested categories", async () => {
    const { backend, decide } = fakeBackend();

    const result = await new Tagger({ backend, vocabulary }).tag(
      request({ categories: ["night"] }),
    );

    expect(decide.mock.calls[0]?.[0]?.questions.map(({ id }) => id)).toEqual([
      "night",
    ]);
    expect(Object.keys(result.tags)).toEqual(["night"]);
  });

  test("rejects unknown categories without calling the backend", async () => {
    const { backend, decide } = fakeBackend();

    await expectTaggingError(
      new Tagger({ backend, vocabulary }).tag(
        request({ categories: ["weather"] }),
      ),
      "invalid-configuration",
    );
    expect(decide).not.toHaveBeenCalled();
  });

  test("rejects unsupported and empty images without calling the backend", async () => {
    const { backend, decide } = fakeBackend();
    const tagger = new Tagger({ backend, vocabulary });

    await expectTaggingError(
      tagger.tag(
        request({
          image: {
            data: new Uint8Array([1]),
            mimeType: "image/gif" as "image/png",
          },
        }),
      ),
      "invalid-image",
    );
    await expectTaggingError(
      tagger.tag(
        request({ image: { data: new Uint8Array(), mimeType: "image/png" } }),
      ),
      "invalid-image",
    );
    expect(decide).not.toHaveBeenCalled();
  });

  test("reports backend errors as backend-failure with the cause", async () => {
    const cause = new Error("socket hang up");
    const { backend } = fakeBackend(async () => {
      throw cause;
    });

    const error = await expectTaggingError(
      new Tagger({ backend, vocabulary }).tag(request()),
      "backend-failure",
    );

    expect(error.cause).toBe(cause);
    expect(error.details).toEqual({ id: "photo-1", model: "test-model" });
  });
});

describe("new Tagger()", () => {
  test.each<[string, Vocabulary]>([
    ["no categories", {}],
    [
      "an upper-case category",
      { People: { type: "flag", question: "Any people?" } },
    ],
    [
      "a value with a colon",
      {
        people: {
          type: "single",
          values: { "people:none": null, crowd: null },
        },
      },
    ],
    [
      "a single category with one value",
      { people: { type: "single", values: { crowd: null } } },
    ],
    [
      "a flag without a question",
      { night: { type: "flag" } as unknown as Vocabulary[string] },
    ],
    [
      "a threshold above 1",
      { night: { type: "flag", question: "Night?", threshold: 2 } },
    ],
  ])("rejects a vocabulary with %s", (_, invalid) => {
    const { backend } = fakeBackend();

    expect(() => new Tagger({ backend, vocabulary: invalid })).toThrow(
      TaggingError,
    );
  });
});
