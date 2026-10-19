# @bhodgson/image-tagger

[![npm](https://img.shields.io/npm/v/@bhodgson/image-tagger)](https://www.npmjs.com/package/@bhodgson/image-tagger)
[![CI](https://github.com/BenHodgsonR2R/image-tagger/actions/workflows/continuous-integration.yml/badge.svg?branch=main&event=push)](https://github.com/BenHodgsonR2R/image-tagger/actions/workflows/continuous-integration.yml?query=branch%3Amain)
[![License: MIT](https://img.shields.io/npm/l/@bhodgson/image-tagger)](LICENSE)

Tags images from a vocabulary you define. Each category becomes a typed question for a decision model, which returns a probability for every value you allow and nothing else: it can't invent a tag. Answers that name anything outside the vocabulary are rejected.

The default backend is [Amos 1 Large](https://huggingface.co/mukaddamzaid/amos-1-large), called through its hosted API, which needs no key.

- [Use the package](#use-the-package)
- [Develop](#develop)
- [Reference](#reference)

## Use the package

Needs Node.js 22.12 or later.

```bash
pnpm add @bhodgson/image-tagger
```

```ts
import { readFile } from "node:fs/promises";
import { AmosBackend, Tagger } from "@bhodgson/image-tagger";

const tagger = new Tagger({
  backend: new AmosBackend(),
  vocabulary: {
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
  },
});

const result = await tagger.tag({
  id: "getxo-1",
  image: { data: await readFile("getxo.jpg"), mimeType: "image/jpeg" },
  context: "Lead photo for a travel guide to Getxo, Spain.",
});

result.labels; // ["people:few", "setting:beach", "setting:city"]
result.tags.people; // { type: "single", value: "few", confidence: 0.81, probabilities: { ... } }
```

Create one `Tagger` and reuse it. Failures throw a `TaggingError`; see [Errors](#errors).

## Develop

Needs Node.js 24 (`nvm use`) and a global pnpm 12 or later (`brew upgrade pnpm`). The exact pnpm version is pinned in `package.json` and switched to automatically.

```bash
pnpm install
pnpm test:run                 # Unit tests
pnpm test:e2e                 # Tags a fixture image with the hosted Amos API
pnpm build && pnpm --filter image-tagger-example start [image]   # Run the example project
```

Before opening a pull request:

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm knip
pnpm changeset         # If the published package changed
```

| Script               | Does                                            |
| -------------------- | ----------------------------------------------- |
| `pnpm build`         | Compiles to `dist/`                             |
| `pnpm lint`          | oxlint with type-aware rules (`lint:fix` fixes) |
| `pnpm format`        | Prettier (`format:check` only checks)           |
| `pnpm knip`          | Finds unused files, exports and dependencies    |
| `pnpm check:package` | Checks the packed package's exports and types   |

Releasing and CI: [docs/releasing.md](docs/releasing.md).

## Reference

### Vocabulary

The vocabulary maps category names to categories. Category and value names use lower-case letters, digits and single hyphens, so a label such as `time-of-day:golden-hour` is never ambiguous. Each value maps to a description that tells the model what it means, or `null` when the name says enough.

| `type`   | Answers                                     | Options                                                                                   |
| -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `single` | Exactly one value, such as `people:crowd`.  | `values` (at least two), `question`, `minConfidence` (default `0`), `allowUnlisted`.      |
| `multi`  | Any number of values.                       | `values`, `question`, `threshold` (default `0.5`) applied to each value, `allowUnlisted`. |
| `flag`   | Yes or no. Labelled with the category name. | `question` (required), `threshold` (default `0.5`).                                       |

`question` defaults to one built from the category name. Write your own when the name alone is ambiguous.

**`allowUnlisted`** is off by default, so the model must choose from your values. Turn it on to also offer "none of these fits" (`single`) or "something not listed" (`multi`). The tag then reports `unlisted`, the probability that a value is missing. A `single` category whose likeliest answer is unlisted gets no value. Amos can't name the missing value; use this to find images where the vocabulary falls short.

### Requests

`tagger.tag(request)` tags one image and returns `{ id, tags, labels, modelVersion }`.

| Field        | Description                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| `image`      | Required. `{ data, mimeType }` with `image/jpeg`, `image/png` or `image/webp`. |
| `context`    | What the image is and what it's for. Helps with ambiguous values.              |
| `categories` | Tag only these categories. Defaults to all of them.                            |
| `id`         | Your identifier for the image. Returned on the result and in error details.    |

### Backends

`AmosBackend` options:

| Option            | Description                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `baseUrl`         | Default `https://api.amos.scira.ai`. Point it at your own `amos.serve` to self-host.                         |
| `model`           | Default `amos-1-large`. Always sent: the hosted API otherwise answers with `amos-1-mini`.                    |
| `retry`           | Retries rate limits, server errors, timeouts and network failures, up to 4 attempts. `false` turns them off. |
| `timeout`         | Milliseconds to wait for each request. Default 60 seconds. `false` waits indefinitely.                       |
| `maxRequestBytes` | Default 4,000,000. The hosted API drops larger requests, so they're refused before sending.                  |
| `userAgent`       | Sent as the User-Agent header.                                                                               |

For tests, or another model, pass any object with `decide({ context, image, questions })` that returns `{ answers }`. See `TaggingBackend` for the shapes.

### Errors

`TaggingError` has a `code`, and `details` with the request `id` and `model`.

| `code`                  | Meaning                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `invalid-configuration` | Invalid vocabulary, backend options or `categories`.                                                        |
| `invalid-image`         | Unsupported image type, or an empty image. Nothing is sent.                                                 |
| `request-too-large`     | The request is over `maxRequestBytes`. Send a smaller image.                                                |
| `backend-failure`       | The request failed after retries. The original error is `error.cause`.                                      |
| `invalid-response`      | The answers don't match the questions, such as a value outside the vocabulary. `details.issues` lists them. |

Pass `debug: true` to `Tagger` to log each request and response.
