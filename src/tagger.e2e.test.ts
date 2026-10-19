import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { AmosBackend } from "./backends/amos.ts";
import { Tagger } from "./tagger.ts";

const tagger = new Tagger({
  backend: new AmosBackend({
    baseUrl: process.env.AMOS_BASE_URL || undefined,
    model: process.env.E2E_MODEL || undefined,
  }),
  vocabulary: {
    people: {
      type: "single",
      question: "How many people are in the photo?",
      values: {
        none: "No people.",
        few: "One to five people.",
        crowd: "A crowd.",
      },
    },
    setting: {
      type: "multi",
      values: { lake: null, mountains: null, beach: null, city: null },
    },
    night: { type: "flag", question: "Was the photo taken at night?" },
  },
});

const lake = readFileSync(
  new URL("fixtures/mountain-lake.jpg", import.meta.url),
);

// Probabilities vary between models, so this checks only tags that are
// unambiguous for the fixture.
describe("Tagger with Amos", () => {
  test("tags a daytime mountain lake with no people", async () => {
    const result = await tagger.tag({
      id: "mountain-lake",
      image: { data: lake, mimeType: "image/jpeg" },
      context: "A travel photo of Lake Bohinj, Slovenia.",
    });

    expect(result.labels).toContain("people:none");
    expect(result.labels).toContain("setting:lake");
    expect(result.labels).toContain("setting:mountains");
    expect(result.labels).not.toContain("setting:city");
    expect(result.labels).not.toContain("night");
    expect(result.modelVersion).toBeTruthy();
  });
});
