import { describe, expect, test, vi } from "vitest";

import { TaggingError } from "../errors.ts";
import { AmosBackend } from "./amos.ts";
import type { DecisionRequest } from "./backend.ts";

const request: DecisionRequest = {
  context: "Lead photo for Getxo.",
  image: { data: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" },
  questions: [
    {
      id: "people",
      type: "choice",
      instructions: "How many people?",
      options: { none: null, crowd: "A crowd." },
    },
    {
      id: "setting",
      type: "multi",
      instructions: "Which apply?",
      options: { beach: null, city: null },
    },
    { id: "night", type: "yes-no", instructions: "Night?" },
  ],
};

const amosAnswer = {
  model: "amos-1-large",
  answers: {
    people: {
      type: "choice",
      choice: "none",
      probabilities: { none: 0.8, crowd: 0.2 },
      confidence: 0.7,
    },
    setting: { type: "multi", probabilities: { beach: 0.9, city: 0.3 } },
    night: { type: "noul", noul: 0.1 },
  },
  usage: { input_tokens: 1571, output_tokens: 0 },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const noRetryDelay = { attempts: 3, initialDelay: 0, maxDelay: 0 };

// Like window.fetch: throws when called as a method of another object.
async function browserFetch(this: unknown): Promise<Response> {
  if (this !== undefined && this !== globalThis) {
    throw new TypeError("Illegal invocation");
  }
  return json(amosAnswer);
}

describe("AmosBackend.decide()", () => {
  test("calls fetch unbound, as browsers require", async () => {
    await expect(
      new AmosBackend({ fetch: browserFetch, retry: false }).decide(request),
    ).resolves.toMatchObject({ modelVersion: "amos-1-large" });
  });

  test("sends a System One request and maps the answers", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(amosAnswer));
    const backend = new AmosBackend({ fetch, userAgent: "image-tagger-test" });

    const response = await backend.decide(request);

    expect(response).toEqual({
      answers: {
        people: { none: 0.8, crowd: 0.2 },
        setting: { beach: 0.9, city: 0.3 },
        night: { yes: 0.1 },
      },
      modelVersion: "amos-1-large",
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.amos.scira.ai/v1/systemone");
    expect(init?.headers).toMatchObject({ "user-agent": "image-tagger-test" });
    expect(JSON.parse(init?.body as string)).toEqual({
      model: "amos-1-large",
      state: "Lead photo for Getxo.",
      images: ["AQID"],
      questions: {
        people: {
          type: "choice",
          instructions: "How many people?",
          criteria: { none: null, crowd: "A crowd." },
        },
        setting: {
          type: "multi",
          instructions: "Which apply?",
          criteria: { beach: null, city: null },
        },
        night: { type: "noul", instructions: "Night?" },
      },
    });
  });

  test("retries rate limits and server errors", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json(amosAnswer));

    await new AmosBackend({ fetch, retry: noRetryDelay }).decide(request);

    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("retries network failures", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(json(amosAnswer));

    await new AmosBackend({ fetch, retry: noRetryDelay }).decide(request);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("doesn't retry client errors", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({ error: "bad question" }, 400),
    );

    await expect(
      new AmosBackend({ fetch, retry: noRetryDelay }).decide(request),
    ).rejects.toThrow('Amos responded 400: {"error":"bad question"}');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("gives up after the last attempt", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({}, 500));

    await expect(
      new AmosBackend({ fetch, retry: noRetryDelay }).decide(request),
    ).rejects.toThrow("Amos responded 500");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("refuses a request over maxRequestBytes without sending it", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const backend = new AmosBackend({ fetch, maxRequestBytes: 100 });

    const error = await backend
      .decide(request)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TaggingError);
    expect((error as TaggingError).code).toBe("request-too-large");
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([
    ["a choice with 256 options", "choice", 256, '"wide" has 256 options'],
    [
      "a multi with one option",
      "multi",
      1,
      "Use a flag for a single yes/no value.",
    ],
  ] as const)(
    "refuses %s without sending it",
    async (_label, type, count, message) => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      const options = Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`v${index}`, null]),
      );

      const error = await new AmosBackend({ fetch })
        .decide({
          ...request,
          questions: [{ id: "wide", type, instructions: "Which?", options }],
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(TaggingError);
      expect((error as TaggingError).code).toBe("invalid-configuration");
      expect((error as TaggingError).message).toContain(message);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test("sends a choice with 255 options", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(amosAnswer));
    const options = Object.fromEntries(
      Array.from({ length: 255 }, (_, index) => [`v${index}`, null]),
    );

    await new AmosBackend({ fetch })
      .decide({
        ...request,
        questions: [
          { id: "wide", type: "choice", instructions: "Which?", options },
        ],
      })
      .catch(() => undefined);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("reports an unexpected response shape as invalid-response", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({ answers: { night: { type: "noul" } } }),
    );

    const error = await new AmosBackend({ fetch })
      .decide(request)
      .catch((caught: unknown) => caught);

    expect((error as TaggingError).code).toBe("invalid-response");
  });
});
