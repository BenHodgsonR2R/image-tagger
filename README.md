# @bhodgson/image-tagger

[![npm](https://img.shields.io/npm/v/@bhodgson/image-tagger)](https://www.npmjs.com/package/@bhodgson/image-tagger)
[![CI](https://github.com/bhodgs/image-tagger/actions/workflows/continuous-integration.yml/badge.svg?branch=main&event=push)](https://github.com/bhodgs/image-tagger/actions/workflows/continuous-integration.yml?query=branch%3Amain)
[![License: MIT](https://img.shields.io/npm/l/@bhodgson/image-tagger)](LICENSE)

Tags images from a vocabulary you define. Each category becomes a typed question for a decision model, which returns a probability for every value you allow and nothing else: it can't invent a tag. Answers that name anything outside the vocabulary are rejected.

The default backend is [Amos 1 Large](https://huggingface.co/mukaddamzaid/amos-1-large), called through its hosted API, which needs no key.

**[Read the docs](https://bhodgs.github.io/image-tagger/)** for guides and the API reference, or try the [playground](https://bhodgs.github.io/image-tagger/playground/): define your own tags and tag your own images or the samples.

## Use the package

Runs in Node.js 22.12 or later, and in modern browsers.

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

Create one `Tagger` and reuse it. Failures throw a `TaggingError`; see [Errors](https://bhodgs.github.io/image-tagger/guides/errors/).

## Develop

Needs Node.js 24 (`nvm use`) and a global pnpm 12 or later (`brew upgrade pnpm`). The exact pnpm version is pinned in `package.json` and switched to automatically.

```bash
pnpm install
pnpm test:run                 # Unit tests
pnpm test:e2e                 # Tags a fixture image with the hosted Amos API
pnpm build && pnpm --filter image-tagger-example start [image]   # Run the example project
pnpm --filter image-tagger-docs dev                              # The docs, at http://localhost:4321/image-tagger/
pnpm --filter image-tagger-demo dev                              # The playground
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

Releasing and CI: [docs/src/content/docs/contributing/releasing.md](docs/src/content/docs/contributing/releasing.md).
