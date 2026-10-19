import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  AmosBackend,
  type ImageMimeType,
  Tagger,
  TaggingError,
} from "image-tagger";

const mimeTypes: Record<string, ImageMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

async function run() {
  const path =
    process.argv[2] ??
    new URL("../../src/fixtures/mountain-lake.jpg", import.meta.url).pathname;

  try {
    const tagger = new Tagger({
      backend: new AmosBackend({
        baseUrl: process.env.AMOS_BASE_URL || undefined,
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
          values: {
            lake: null,
            mountains: null,
            beach: null,
            city: null,
            countryside: null,
          },
          allowUnlisted: true,
        },
        "time-of-day": {
          type: "single",
          values: {
            day: null,
            "golden-hour": "Sunrise or sunset light.",
            night: null,
          },
          minConfidence: 0.5,
        },
        "text-overlay": {
          type: "flag",
          question:
            "Does the photo have a watermark, caption or other added text?",
        },
      },
      debug: process.env.DEBUG === "true",
    });

    const result = await tagger.tag({
      id: path,
      image: {
        data: await readFile(path),
        mimeType: mimeTypes[extname(path).toLowerCase()] ?? "image/jpeg",
      },
    });

    console.log(result.labels.join("\n"));
    console.log(JSON.stringify(result.tags, null, 2));
  } catch (error) {
    if (error instanceof TaggingError) {
      console.error(`Tagging failed (${error.code}): ${error.message}`);
      console.error(error.details);
      process.exitCode = 1;
      return;
    }

    throw error;
  }
}

await run();
